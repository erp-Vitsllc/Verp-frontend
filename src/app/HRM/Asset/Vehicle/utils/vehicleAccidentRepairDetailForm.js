import {
    mapServiceRecordToFormData,
    validateVehicleServiceForm,
    buildAddServiceBody,
} from '../components/vehicleServicePayload';
import { isCarDrivenBySelected } from './vehicleCarDrivenBySelect';
import {
    normalizeMongoId,
    parseVehicleServiceRemark,
    resolveVehicleServiceListRowTone,
    vehicleServiceTypeKey,
} from '../components/vehicleServiceUtils';
import { formatWarrantyExpiryFromAsset } from './vehicleOilServiceWarranty';
import {
    OIL_SERVICE_VENDOR_OPTIONS,
    isOilPayablePaymentMode,
    normalizeOilPaymentMethod,
    normalizeOilPaymentType,
    resolveOilPaymentFields,
} from './vehicleOilServiceDetailForm';
import { resolveVehicleServiceAssignedOwnerId } from './vehicleServiceAssignedOwner';
import {
    validateInitiateServicePaySplit,
} from './vehicleInitiatePayValidation';

export { OIL_SERVICE_VENDOR_OPTIONS as ACCIDENT_REPAIR_VENDOR_OPTIONS, formatWarrantyExpiryFromAsset };

export function isAccidentOtherPartyForm(formData = {}) {
    return String(formData.accidentOwnerType || '').trim().toLowerCase() === 'thirdparty';
}

export function computeAccidentFinesTotal(formData = {}) {
    const insurance = isAccidentOtherPartyForm(formData)
        ? 0
        : Number(formData.insuranceFineAmount) || 0;
    const police = Number(formData.policeFineAmount) || 0;
    const otherRows = normalizeOtherFineRows(formData.otherFineRows, formData.otherFineAmount);
    const other = sumOtherFineRows(otherRows);
    return Math.round(insurance + police + other);
}

/** Keep TOTAL AMOUNT (and company/employee pay) equal to the Payment Details TOTAL. */
export function accidentRepairPayPatchFromFines(formData = {}, totalFines) {
    const costBase = Math.max(0, Math.round(Number(totalFines) || 0));
    const mode = String(formData.paymentByMode || '').toLowerCase();
    const costStr = String(costBase);
    const companyPct = clampPayPercent(formData.companyPayPercent);
    const employeePct = clampPayPercent(formData.employeePayPercent);

    let companyPayAmount = formData.companyPayAmount;
    let employeePayAmount = formData.employeePayAmount;
    let companyPayPercent = formData.companyPayPercent;
    let employeePayPercent = formData.employeePayPercent;

    if (mode === 'company') {
        companyPayAmount = costStr;
        employeePayAmount = '0';
        companyPayPercent = '100';
        employeePayPercent = '0';
    } else if (mode === 'person') {
        companyPayAmount = '0';
        employeePayAmount = costStr;
        companyPayPercent = '0';
        employeePayPercent = '100';
    } else if (mode === 'split') {
        const pct = companyPct != null ? companyPct : employeePct != null ? 100 - employeePct : 50;
        companyPayPercent = String(pct);
        employeePayPercent = String(100 - pct);
        const companyAmt = Math.round((costBase * pct) / 100);
        companyPayAmount = String(companyAmt);
        employeePayAmount = String(Math.max(0, costBase - companyAmt));
    } else if (costBase === 0) {
        if (formData.companyPayAmount) companyPayAmount = '0';
        if (formData.employeePayAmount) employeePayAmount = '0';
    }

    const rows = Array.isArray(formData.employeeLiabilityRows) ? formData.employeeLiabilityRows : [];
    const employeeLiabilityRows =
        costBase <= 0
            ? rows.map((row) => ({ ...row, paidAmount: '0' }))
            : applyEmployeePayTargetToRows(rows, costBase, employeePayPercent);

    return {
        estimatedCost: costStr,
        companyPayAmount,
        employeePayAmount,
        companyPayPercent,
        employeePayPercent,
        employeeLiabilityRows,
    };
}

export function accidentRepairPayPatchUnchanged(prev = {}, patch = {}) {
    const sameRows =
        JSON.stringify(prev.employeeLiabilityRows || []) ===
        JSON.stringify(patch.employeeLiabilityRows || []);
    return (
        String(prev.estimatedCost ?? '') === String(patch.estimatedCost ?? '') &&
        String(prev.companyPayAmount ?? '') === String(patch.companyPayAmount ?? '') &&
        String(prev.employeePayAmount ?? '') === String(patch.employeePayAmount ?? '') &&
        String(prev.companyPayPercent ?? '') === String(patch.companyPayPercent ?? '') &&
        String(prev.employeePayPercent ?? '') === String(patch.employeePayPercent ?? '') &&
        sameRows
    );
}

/** Other-party damage: wipe payable amounts so TOTAL and TOTAL AMOUNT both become 0. */
export function applyAccidentOtherPartyAmountReset(formData = {}) {
    const next = {
        ...formData,
        insuranceFineAmount: '',
        policeFineAmount: '',
        otherFineAmount: '',
        otherFineRows: [],
    };
    return {
        ...next,
        ...accidentRepairPayPatchFromFines(next, 0),
    };
}

export function getLastCompletedTireServiceForAsset(asset, { excludeServiceId } = {}) {
    const services = Array.isArray(asset?.services) ? asset.services : [];
    const excludeId = normalizeMongoId(excludeServiceId);
    return (
        services
            .filter((s) => vehicleServiceTypeKey(s) === 'Accident Repair')
            .filter((s) => !excludeId || normalizeMongoId(s._id) !== excludeId)
            .filter((s) => {
                const remark = parseVehicleServiceRemark(s) || {};
                const requestStatus = String(remark.requestStatus || '').toLowerCase();
                if (requestStatus === 'draft' || requestStatus === 'pending') return false;
                const row = {
                    serviceId: normalizeMongoId(s._id),
                    remark: s.remark,
                    workflowSnapshot: s.workflowSnapshot,
                };
                return (
                    resolveVehicleServiceListRowTone(row, {
                        activeServiceWorkflow: asset?.activeServiceWorkflow,
                    }) === 'done'
                );
            })
            .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0))[0] || null
    );
}

function defaultEmployeeRows(assigneeIdStr) {
    return [{ employeeId: assigneeIdStr || '', paidAmount: '' }];
}

export function sumEmployeeLiabilityRows(rows) {
    return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
        const amt = Number(row?.paidAmount);
        return sum + (Number.isFinite(amt) ? amt : 0);
    }, 0);
}

export function redistributeEmployeeLiabilityRows(rows, targetTotal) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return list;
    const total = Number(targetTotal);
    if (!Number.isFinite(total) || total < 0) {
        return list.map((row) => ({ ...row, paidAmount: '' }));
    }
    const count = list.length;
    const base = Math.floor(total / count);
    const remainder = total - base * count;
    return list.map((row, index) => ({
        ...row,
        paidAmount: String(base + (index === 0 ? remainder : 0)),
    }));
}

export function computeEmployeePayTarget(estimatedCost, employeePayPercent) {
    const cost = Number(estimatedCost) || 0;
    const pct = Number(employeePayPercent) || 0;
    if (!Number.isFinite(cost) || !Number.isFinite(pct) || cost <= 0 || pct < 0) return 0;
    return Math.round((cost * pct) / 100);
}

export function applyEmployeePayTargetToRows(rows, estimatedCost, employeePayPercent) {
    const target = computeEmployeePayTarget(estimatedCost, employeePayPercent);
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return list;
    if (target <= 0) {
        return list.map((row) => ({ ...row, paidAmount: '0' }));
    }
    return redistributeEmployeeLiabilityRows(list, target);
}

export function normalizeOtherFineRows(rows, legacyOtherFineAmount) {
    if (Array.isArray(rows) && rows.length) {
        return rows.map((row) => ({
            name: String(row?.name || '').trim(),
            amount: row?.amount != null && row?.amount !== '' ? String(row.amount) : '',
        }));
    }
    const legacy = Number(legacyOtherFineAmount);
    if (Number.isFinite(legacy) && legacy > 0) {
        return [{ name: 'Other Fine', amount: String(legacy) }];
    }
    return [];
}

export function sumOtherFineRows(rows) {
    if (!Array.isArray(rows)) return 0;
    return rows.reduce((sum, row) => sum + (Number(row?.amount) || 0), 0);
}

/** After one row's paid amount changes, only rows below it are rebalanced to hit the target. */
export function adjustEmployeeRowsAfterPaidChange(rows, changedIndex, rawPaidAmount, targetTotal) {
    const list = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
    if (!list.length || changedIndex < 0 || changedIndex >= list.length) return list;

    const target = Number(targetTotal);
    if (!Number.isFinite(target) || target < 0) {
        list[changedIndex] = { ...list[changedIndex], paidAmount: rawPaidAmount };
        return list;
    }

    if (rawPaidAmount === '' || rawPaidAmount == null) {
        list[changedIndex] = { ...list[changedIndex], paidAmount: '' };
        return list;
    }

    const parsed = Number(rawPaidAmount);
    if (!Number.isFinite(parsed) || parsed < 0) {
        list[changedIndex] = { ...list[changedIndex], paidAmount: String(rawPaidAmount) };
        return list;
    }

    const sumAbove = list
        .slice(0, changedIndex)
        .reduce((sum, row) => sum + (Number(row?.paidAmount) || 0), 0);
    const belowIndices = list.map((_, index) => index).filter((index) => index > changedIndex);
    const maxForChanged = Math.max(0, target - sumAbove);
    const cappedChanged = Math.min(Math.max(0, Math.round(parsed)), maxForChanged);

    list[changedIndex] = { ...list[changedIndex], paidAmount: String(cappedChanged) };

    if (!belowIndices.length) {
        return list;
    }

    const remaining = Math.max(0, target - sumAbove - cappedChanged);
    const belowCount = belowIndices.length;
    const base = Math.floor(remaining / belowCount);
    const remainder = remaining - base * belowCount;

    belowIndices.forEach((rowIndex, order) => {
        list[rowIndex] = {
            ...list[rowIndex],
            paidAmount: String(base + (order === 0 ? remainder : 0)),
        };
    });
    return list;
}

function clampPayPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.min(100, Math.max(0, Math.round(n)));
}

/** Keep company + employee pay % at 100 in EMP & CMPY mode. */
export function applyLinkedSplitPayPercent(changedField, rawValue) {
    if (rawValue === '' || rawValue == null) {
        return changedField === 'company'
            ? { companyPayPercent: '', employeePayPercent: undefined }
            : { companyPayPercent: undefined, employeePayPercent: '' };
    }
    const pct = clampPayPercent(rawValue);
    if (pct === null) {
        return changedField === 'company'
            ? { companyPayPercent: String(rawValue), employeePayPercent: undefined }
            : { companyPayPercent: undefined, employeePayPercent: String(rawValue) };
    }
    const other = 100 - pct;
    return changedField === 'company'
        ? { companyPayPercent: String(pct), employeePayPercent: String(other) }
        : { employeePayPercent: String(pct), companyPayPercent: String(other) };
}

export function buildEmployeeRowBreakdowns(rows) {
    const list = Array.isArray(rows) ? rows : [];
    return list.map((row) => {
        const paidAmount = Number(row?.paidAmount) || 0;
        return {
            paidAmount,
            totalPay: paidAmount,
        };
    });
}

export function buildAccidentRepairDetailFormState(service, asset, { flowchartRows = [] } = {}) {
    const base = mapServiceRecordToFormData(service, asset?.assignedTo);
    const assigneeId = asset?.assignedTo?._id || asset?.assignedTo;
    const assigneeIdStr = assigneeId ? String(assigneeId) : '';
    const remark = parseVehicleServiceRemark(service) || {};
    const defaultOwnerId = resolveVehicleServiceAssignedOwnerId(
        asset,
        flowchartRows,
        remark.vehicleOwnerEmployeeId || base.vehicleOwnerEmployeeId,
    );
    const resolvedPay = resolveOilPaymentFields(remark, base);
    const amountMode = resolvedPay.amountMode || 'amount';
    const paymentMethod =
        amountMode === 'warranty' ? '' : resolvedPay.paymentMethod || 'cash';

    const garageQuotes = Array.isArray(remark.accidentGarageQuotes) ? remark.accidentGarageQuotes : [];
    const quoteByKey = (key) =>
        garageQuotes.find((row) => String(row?.key || '').toLowerCase() === key) || null;
    const q1 = quoteByKey('q1');
    const q2 = quoteByKey('q2');
    const q3 = quoteByKey('q3');

    const paymentByModeRaw = String(remark.paymentByMode || '').toLowerCase();
    const paymentByMode =
        paymentByModeRaw === 'person' || paymentByModeRaw === 'company' || paymentByModeRaw === 'split'
            ? paymentByModeRaw
            : '';
    const liabilityRows = Array.isArray(remark.employeeLiabilityRows)
        ? remark.employeeLiabilityRows.map((row) => ({
              employeeId: String(row?.employeeId || ''),
              paidAmount: row?.paidAmount != null ? String(row.paidAmount) : '',
          }))
        : defaultEmployeeRows(
              String(remark.carDrivenByEmployeeId || remark.vehicleOwnerEmployeeId || assigneeIdStr || ''),
          );

    const insuranceFine = Number(remark.insuranceFineAmount) || 0;
    const policeFine = Number(remark.policeFineAmount) || 0;
    const otherFineRows = normalizeOtherFineRows(remark.otherFineRows, remark.otherFineAmount);
    const otherFine = sumOtherFineRows(otherFineRows);
    const fineTotal = insuranceFine + policeFine + otherFine;
    const estimatedFromRemark =
        remark.hrReviewApprovedAmount != null && remark.hrReviewApprovedAmount !== ''
            ? String(remark.hrReviewApprovedAmount)
            : remark.estimatedCost != null && remark.estimatedCost !== ''
              ? String(remark.estimatedCost)
              : fineTotal > 0
                ? String(fineTotal)
                : '';

    const state = {
        ...base,
        serviceType: 'Accident Repair',
        amountMode,
        paymentMethod,
        policyNumber: '',
        insuranceExpiryDate: '',
        date: base.date || (service?.date ? new Date(service.date).toISOString().slice(0, 10) : ''),
        currentKm:
            base.currentKm !== '' && base.currentKm != null
                ? String(base.currentKm)
                : asset?.currentKilometer != null
                  ? String(asset.currentKilometer)
                  : '',
        vehicleOwnerEmployeeId: defaultOwnerId || assigneeIdStr,
        carDrivenByType: base.carDrivenByType || (base.carDrivenByCompanyId ? 'company' : 'employee'),
        carDrivenByEmployeeId:
            base.carDrivenByType === 'company' || base.carDrivenByCompanyId
                ? base.carDrivenByEmployeeId || ''
                : base.carDrivenByEmployeeId || assigneeIdStr,
        serviceIssue: base.serviceIssue || '',
        accidentImages: [],
        paymentByMode,
        companyPayPercent:
            remark.companyPayPercent != null && remark.companyPayPercent !== ''
                ? String(remark.companyPayPercent)
                : paymentByMode === 'person'
                  ? '0'
                  : paymentByMode === 'split'
                    ? '50'
                    : paymentByMode === 'company'
                      ? '100'
                      : '',
        employeePayPercent:
            remark.employeePayPercent != null && remark.employeePayPercent !== ''
                ? String(remark.employeePayPercent)
                : paymentByMode === 'person'
                  ? '100'
                  : paymentByMode === 'split'
                    ? '50'
                    : paymentByMode === 'company'
                      ? '0'
                      : '',
        estimatedCost: estimatedFromRemark,
        companyPayAmount:
            remark.hrReviewCompanyPay != null && remark.hrReviewCompanyPay !== ''
                ? String(remark.hrReviewCompanyPay)
                : remark.companyPayAmount != null && remark.companyPayAmount !== ''
                  ? String(remark.companyPayAmount)
                  : '',
        employeePayAmount:
            remark.hrReviewEmployeePay != null && remark.hrReviewEmployeePay !== ''
                ? String(remark.hrReviewEmployeePay)
                : remark.employeePayAmount != null && remark.employeePayAmount !== ''
                  ? String(remark.employeePayAmount)
                  : '',
        companyPayPartyId: String(remark.companyPayPartyId || '').trim(),
        companyPayPartyName: String(remark.companyPayPartyName || remark.companyName || '').trim(),
        employeeLiabilityRows: liabilityRows,
        otherFineRows,
        otherFineAmount: otherFine > 0 ? String(otherFine) : '',
        garageQuote1Name: q1?.name || '',
        garageQuote1Base64: '',
        garageQuote1Mime: '',
        existingGarageQuote1Url: q1?.url ? String(q1.url) : '',
        garageQuote1Amount:
            q1?.amount != null && q1?.amount !== ''
                ? String(q1.amount)
                : remark.quotation1Amount != null
                  ? String(remark.quotation1Amount)
                  : '',
        garageQuote2Name: q2?.name || '',
        garageQuote2Base64: '',
        garageQuote2Mime: '',
        existingGarageQuote2Url: q2?.url ? String(q2.url) : '',
        garageQuote2Amount:
            q2?.amount != null && q2?.amount !== ''
                ? String(q2.amount)
                : remark.quotation2Amount != null
                  ? String(remark.quotation2Amount)
                  : '',
        garageQuote3Name: q3?.name || '',
        garageQuote3Base64: '',
        garageQuote3Mime: '',
        existingGarageQuote3Url: q3?.url ? String(q3.url) : '',
        garageQuote3Amount:
            q3?.amount != null && q3?.amount !== ''
                ? String(q3.amount)
                : remark.quotation3Amount != null
                  ? String(remark.quotation3Amount)
                  : '',
    };
    if (isAccidentOtherPartyForm(state)) {
        return applyAccidentOtherPartyAmountReset(state);
    }
    return state;
}

const ACCIDENT_REPAIR_FIELD_LABELS = {
    accidentDate: 'Accident date',
    accidentTime: 'Accident time',
    accidentLocation: 'Accident location',
    vehicleOwnerEmployeeId: 'Vehicle assigned',
    carDrivenByEmployeeId: 'Vehicle Driven By',
    accidentOwnerType: 'Accident party',
    amountMode: 'Payment type',
    paymentMethod: 'Payment method',
    attachment: 'Police report',
    policeFineAmount: 'Police fine',
    accidentImages: 'Accident photos',
    serviceIssue: 'Description',
    paymentByMode: 'Payment by',
    estimatedCost: 'Total amount',
    paySplit: 'Payment split',
    finesTotalMatch: 'TOTAL / TOTAL AMOUNT',
    companyPayPercent: 'Company payment',
    employeePayPercent: 'Employee payment',
    employeeLiabilityRows: 'Employee payment rows',
    companyPayPartyId: 'Company name',
};

function hasAccidentPhotos(formData) {
    const existing = Array.isArray(formData.existingAccidentImages) ? formData.existingAccidentImages.length : 0;
    const fresh = Array.isArray(formData.accidentImages) ? formData.accidentImages.length : 0;
    return existing + fresh > 0;
}

export function validateAccidentRepairDetailForm(formData, asset = null) {
    const payload = {
        ...formData,
        serviceType: 'Accident Repair',
        serviceIssue: String(formData.serviceIssue || '').trim(),
        date: formData.date || formData.accidentDate || new Date().toISOString().slice(0, 10),
        currentKm: formData.currentKm || asset?.currentKilometer || 0,
    };

    const e = validateVehicleServiceForm(payload);

    delete e.accidentRepairDurationDays;
    delete e.date;
    delete e.value;

    if (!isCarDrivenBySelected(formData)) {
        e.carDrivenByEmployeeId = 'Vehicle Driven By is required';
    }
    if (!hasAccidentPhotos(formData)) {
        e.accidentImages = 'Accident photos are required';
    }

    // Description is optional on Accident Repair details.
    delete e.serviceIssue;

    const amountMode = normalizeOilPaymentType(formData.amountMode) || 'amount';
    const payable = isOilPayablePaymentMode(amountMode);
    if (payable && !normalizeOilPaymentMethod(formData.paymentMethod)) {
        e.paymentMethod = 'Payment method is required';
    }

    const finesTotal = computeAccidentFinesTotal(formData);
    const isOtherParty = isAccidentOtherPartyForm(formData);
    Object.assign(
        e,
        validateInitiateServicePaySplit(formData, {
            requirePayable: payable,
            requireCompanyParty: true,
            requireFinesTotalMatch: true,
            finesTotal,
            allowZeroEstimated: isOtherParty,
        }),
    );

    if (isOtherParty) {
        delete e.paymentByMode;
        delete e.estimatedCost;
        if (!String(formData.paymentByMode || '').trim() || finesTotal === 0) {
            delete e.paySplit;
            delete e.companyPayPercent;
            delete e.employeePayPercent;
            delete e.employeeLiabilityRows;
            delete e.companyPayPartyId;
        }
    }

    if (!payable) {
        delete e.estimatedCost;
        delete e.paymentByMode;
        delete e.paySplit;
        delete e.finesTotalMatch;
        delete e.companyPayPercent;
        delete e.employeePayPercent;
        delete e.employeeLiabilityRows;
        delete e.companyPayPartyId;
    }

    return e;
}

export function getAccidentRepairDetailFormMissingFields(formData, asset = null) {
    const errors = validateAccidentRepairDetailForm(formData, asset);
    const preferErrorText = new Set([
        'paySplit',
        'finesTotalMatch',
        'employeeLiabilityRows',
        'companyPayPercent',
        'employeePayPercent',
        'companyPayPartyId',
    ]);
    const labels = Object.keys(errors).map((key) =>
        preferErrorText.has(key) ? errors[key] : ACCIDENT_REPAIR_FIELD_LABELS[key] || errors[key],
    );
    return [...new Set(labels)];
}

export function isAccidentRepairDetailFormComplete(formData, asset = null) {
    return Object.keys(validateAccidentRepairDetailForm(formData, asset)).length === 0;
}

export function buildAccidentRepairDetailSubmitBody(formData, { keepPending = true } = {}) {
    const amountMode = normalizeOilPaymentType(formData.amountMode) || 'amount';
    const payable = isOilPayablePaymentMode(amountMode);
    const paymentMethod = payable
        ? normalizeOilPaymentMethod(formData.paymentMethod) || 'cash'
        : '';
    const payload = {
        ...formData,
        serviceType: 'Accident Repair',
        amountMode,
        paymentMethod,
        serviceIssue: String(formData.serviceIssue || '').trim(),
        date: formData.date || formData.accidentDate || new Date().toISOString().slice(0, 10),
    };

    const body = buildAddServiceBody(payload);
    let remark = {};
    try {
        remark = body.remark ? JSON.parse(body.remark) : {};
    } catch {
        remark = {};
    }
    remark.requestStatus = keepPending ? 'pending' : 'submitted';
    remark.amountMode = amountMode;
    if (paymentMethod) {
        remark.paymentMethod = paymentMethod;
    } else {
        delete remark.paymentMethod;
    }
    if (isAccidentOtherPartyForm(formData)) {
        remark.insuranceFineAmount = 0;
        remark.policeFineAmount = Number(formData.policeFineAmount) || 0;
        const payPatch = accidentRepairPayPatchFromFines(formData, computeAccidentFinesTotal(formData));
        remark.estimatedCost = Number(payPatch.estimatedCost) || 0;
        remark.companyPayAmount = Number(payPatch.companyPayAmount) || 0;
        remark.employeePayAmount = Number(payPatch.employeePayAmount) || 0;
        remark.hrReviewApprovedAmount = remark.estimatedCost;
        remark.hrReviewCompanyPay = remark.companyPayAmount;
        remark.hrReviewEmployeePay = remark.employeePayAmount;
    }

    const quoteDefs = [
        {
            key: 'q1',
            name: formData.garageQuote1Name,
            base64: formData.garageQuote1Base64,
            mime: formData.garageQuote1Mime,
            existingUrl: formData.existingGarageQuote1Url,
            amount: formData.garageQuote1Amount,
        },
        {
            key: 'q2',
            name: formData.garageQuote2Name,
            base64: formData.garageQuote2Base64,
            mime: formData.garageQuote2Mime,
            existingUrl: formData.existingGarageQuote2Url,
            amount: formData.garageQuote2Amount,
        },
        {
            key: 'q3',
            name: formData.garageQuote3Name,
            base64: formData.garageQuote3Base64,
            mime: formData.garageQuote3Mime,
            existingUrl: formData.existingGarageQuote3Url,
            amount: formData.garageQuote3Amount,
        },
    ];

    const remarkQuotes = [];
    const uploadQuotes = [];
    for (const q of quoteDefs) {
        const name = String(q.name || '').trim();
        const existingUrl = String(q.existingUrl || '').trim();
        const amountRaw = String(q.amount ?? '').trim();
        const amount = amountRaw !== '' && Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : undefined;
        if (q.base64 && name) {
            uploadQuotes.push({
                key: q.key,
                name,
                data: q.base64,
                mimeType: q.mime || 'application/pdf',
                ...(amount !== undefined ? { amount } : {}),
            });
            remarkQuotes.push({
                key: q.key,
                name,
                url: existingUrl || undefined,
                ...(amount !== undefined ? { amount } : {}),
            });
        } else if (existingUrl || name || amount !== undefined) {
            remarkQuotes.push({
                key: q.key,
                name: name || undefined,
                url: existingUrl || undefined,
                ...(amount !== undefined ? { amount } : {}),
            });
        }
    }

    if (remarkQuotes.length) {
        remark.accidentGarageQuotes = remarkQuotes.filter((row) => row.url || row.name || row.amount != null);
    } else {
        delete remark.accidentGarageQuotes;
    }

    if (formData.garageQuote1Amount !== '' && formData.garageQuote1Amount != null) {
        remark.quotation1Amount = Number(formData.garageQuote1Amount) || 0;
    }
    if (formData.garageQuote2Amount !== '' && formData.garageQuote2Amount != null) {
        remark.quotation2Amount = Number(formData.garageQuote2Amount) || 0;
    }
    if (formData.garageQuote3Amount !== '' && formData.garageQuote3Amount != null) {
        remark.quotation3Amount = Number(formData.garageQuote3Amount) || 0;
    }

    const otherFineRows = normalizeOtherFineRows(formData.otherFineRows, formData.otherFineAmount)
        .filter((row) => String(row.name || '').trim() || Number(row.amount) > 0)
        .map((row) => ({
            name: String(row.name || '').trim() || 'Other Fine',
            amount: Number(row.amount) || 0,
        }));
    if (otherFineRows.length) {
        remark.otherFineRows = otherFineRows;
        remark.otherFineAmount = otherFineRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    } else {
        delete remark.otherFineRows;
        remark.otherFineAmount = 0;
    }

    const paymentByModeRaw = String(formData.paymentByMode || '').toLowerCase();
    if (paymentByModeRaw === 'person' || paymentByModeRaw === 'company' || paymentByModeRaw === 'split') {
        remark.paymentByMode = paymentByModeRaw;
        remark.liableOn = paymentByModeRaw;

        const finesTotal = computeAccidentFinesTotal(formData);
        const payPatch = accidentRepairPayPatchFromFines(formData, finesTotal);
        const estimated = Number(payPatch.estimatedCost) || 0;
        const companyPayAmount = Number(payPatch.companyPayAmount) || 0;
        const employeePayAmount = Number(payPatch.employeePayAmount) || 0;
        const companyPct =
            estimated > 0
                ? Math.min(100, Math.max(0, Math.round((companyPayAmount / estimated) * 100)))
                : paymentByModeRaw === 'company'
                  ? 100
                  : paymentByModeRaw === 'person'
                    ? 0
                    : Number(formData.companyPayPercent) || 50;
        const employeePct =
            estimated > 0
                ? Math.min(100, Math.max(0, 100 - companyPct))
                : paymentByModeRaw === 'person'
                  ? 100
                  : paymentByModeRaw === 'company'
                    ? 0
                    : Number(formData.employeePayPercent) || 50;

        remark.companyPayPercent = String(companyPct);
        remark.employeePayPercent = String(employeePct);
        remark.estimatedCost = estimated;
        remark.companyPayAmount = companyPayAmount;
        remark.employeePayAmount = employeePayAmount;
        remark.hrReviewApprovedAmount = estimated;
        remark.hrReviewCompanyPay = companyPayAmount;
        remark.hrReviewEmployeePay = employeePayAmount;

        const partyId = String(formData.companyPayPartyId || '').trim();
        const partyName = String(formData.companyPayPartyName || '').trim();
        if (partyId) remark.companyPayPartyId = partyId;
        else delete remark.companyPayPartyId;
        if (partyName) {
            remark.companyPayPartyName = partyName;
            remark.companyName = partyName;
        } else {
            delete remark.companyPayPartyName;
            delete remark.companyName;
        }

        const rows = Array.isArray(formData.employeeLiabilityRows)
            ? formData.employeeLiabilityRows
                  .filter((row) => String(row?.employeeId || '').trim())
                  .map((row) => ({
                      employeeId: String(row.employeeId),
                      paidAmount: Number(row.paidAmount) || 0,
                  }))
            : [];
        if (rows.length) {
            remark.employeeLiabilityRows = rows;
            remark.hrReviewEmployeeRows = rows;
            remark.employeeLiabilityTotal = rows.reduce((sum, row) => sum + (Number(row.paidAmount) || 0), 0);
        }
    }

    body.remark = JSON.stringify(remark);
    if (uploadQuotes.length) {
        body.accidentGarageQuotes = uploadQuotes;
    }
    return body;
}
