import {
    mapServiceRecordToFormData,
    validateVehicleServiceForm,
    buildAddServiceBody,
} from '../components/vehicleServicePayload';
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
import { resolveInitiateAbsolutePayAmounts } from './vehicleShopHrReviewPay';
import { validateInitiateServicePaySplit } from './vehicleInitiatePayValidation';

export { OIL_SERVICE_VENDOR_OPTIONS as MECHANICAL_WORK_VENDOR_OPTIONS, formatWarrantyExpiryFromAsset };

export function getLastCompletedTireServiceForAsset(asset, { excludeServiceId } = {}) {
    const services = Array.isArray(asset?.services) ? asset.services : [];
    const excludeId = normalizeMongoId(excludeServiceId);
    return (
        services
            .filter((s) => vehicleServiceTypeKey(s) === 'Mechanical Work')
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
    if (!list.length || target <= 0) return list;
    return redistributeEmployeeLiabilityRows(list, target);
}

/** After one row's paid amount changes, other rows are rebalanced to hit the target. */
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

    const otherIndices = list.map((_, index) => index).filter((index) => index !== changedIndex);
    const cappedChanged = Math.min(Math.max(0, Math.round(parsed)), Math.max(0, target));
    list[changedIndex] = { ...list[changedIndex], paidAmount: String(cappedChanged) };

    if (!otherIndices.length) {
        return list;
    }

    const remaining = Math.max(0, target - cappedChanged);
    const otherCount = otherIndices.length;
    const base = Math.floor(remaining / otherCount);
    const remainder = remaining - base * otherCount;

    otherIndices.forEach((rowIndex, order) => {
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

export function buildMechanicalWorkDetailFormState(service, asset, { flowchartRows = [] } = {}) {
    const base = mapServiceRecordToFormData(service, asset?.assignedTo);
    const remark = parseVehicleServiceRemark(service) || {};
    const lastCompleted = getLastCompletedTireServiceForAsset(asset, { excludeServiceId: service?._id });
    const lastRemark = lastCompleted ? parseVehicleServiceRemark(lastCompleted) : null;

    const assigneeId = asset?.assignedTo?._id || asset?.assignedTo;
    const assigneeIdStr = assigneeId ? String(assigneeId) : '';
    const defaultOwnerId = resolveVehicleServiceAssignedOwnerId(
        asset,
        flowchartRows,
        remark.vehicleOwnerEmployeeId || base.vehicleOwnerEmployeeId,
    );
    const resolvedPay = resolveOilPaymentFields(remark, base);
    const amountMode = resolvedPay.amountMode || 'amount';
    const paymentMethod =
        amountMode === 'warranty' ? '' : resolvedPay.paymentMethod || 'cash';

    const paymentByMode =
        remark.paymentByMode ||
        (String(remark.liableOn || '').toLowerCase() === 'person'
            ? 'person'
            : String(remark.liableOn || '').toLowerCase() === 'split'
              ? 'split'
              : 'company');

    const employeeLiabilityRows =
        Array.isArray(remark.hrReviewEmployeeRows) && remark.hrReviewEmployeeRows.length
            ? remark.hrReviewEmployeeRows.map((row) => ({
                  employeeId: String(row.employeeId || ''),
                  paidAmount: row.paidAmount != null ? String(row.paidAmount) : '',
              }))
            : Array.isArray(remark.employeeLiabilityRows) && remark.employeeLiabilityRows.length
              ? remark.employeeLiabilityRows.map((row) => ({
                    employeeId: String(row.employeeId || ''),
                    paidAmount: row.paidAmount != null ? String(row.paidAmount) : '',
                }))
              : defaultEmployeeRows(assigneeIdStr);

    const state = {
        ...base,
        serviceType: 'Mechanical Work',
        amountMode,
        paymentMethod,
        date: base.date || (service?.date ? new Date(service.date).toISOString().slice(0, 10) : ''),
        previousChangeKm:
            remark.previousChangeKm != null && remark.previousChangeKm !== ''
                ? String(remark.previousChangeKm)
                : lastRemark?.currentKm != null
                  ? String(lastRemark.currentKm)
                  : lastCompleted?.currentKm != null
                    ? String(lastCompleted.currentKm)
                    : '',
        currentKm:
            remark.currentKm != null && remark.currentKm !== ''
                ? String(remark.currentKm)
                : base.currentKm != null && base.currentKm !== ''
                  ? String(base.currentKm)
                  : asset?.currentKilometer != null
                    ? String(asset.currentKilometer)
                    : '',
        vehicleOwnerEmployeeId: defaultOwnerId || assigneeIdStr,
        carDrivenByEmployeeId:
            remark.carDrivenByEmployeeId != null && String(remark.carDrivenByEmployeeId).trim() !== ''
                ? String(remark.carDrivenByEmployeeId)
                : assigneeIdStr,
        paymentByMode,
        companyPayPercent:
            remark.companyPayPercent != null && remark.companyPayPercent !== ''
                ? String(remark.companyPayPercent)
                : paymentByMode === 'company'
                  ? '100'
                  : paymentByMode === 'person'
                    ? '0'
                    : '50',
        employeePayPercent:
            remark.employeePayPercent != null && remark.employeePayPercent !== ''
                ? String(remark.employeePayPercent)
                : paymentByMode === 'person'
                  ? '100'
                  : paymentByMode === 'company'
                    ? '0'
                    : '50',
        estimatedCost:
            remark.hrReviewApprovedAmount != null && remark.hrReviewApprovedAmount !== ''
                ? String(remark.hrReviewApprovedAmount)
                : remark.estimatedCost != null && remark.estimatedCost !== ''
                  ? String(remark.estimatedCost)
                  : base.quotation1Amount || (base.value != null && base.value !== '' ? String(base.value) : ''),
        employeeLiabilityRows,
        serviceIssue: base.serviceIssue || remark.serviceIssue || '',
        vendorName: remark.vendorName || base.vendorName || '',
        quotation1Amount:
            base.quotation1Amount ||
            (base.value != null && base.value !== '' ? String(base.value) : ''),
        quotation2Amount: remark.quotation2Amount != null ? String(remark.quotation2Amount) : base.quotation2Amount || '',
        quotation3Amount: remark.quotation3Amount != null ? String(remark.quotation3Amount) : base.quotation3Amount || '',
        value: base.value != null && base.value !== '' ? String(base.value) : '',
        existingBodyWorkImages: Array.isArray(remark.bodyWorkImages) ? remark.bodyWorkImages : base.existingBodyWorkImages || [],
        bodyWorkImages: [],
    };

    // Prefer absolute HR pay amounts when present (keep Initiate in sync with HR Approval).
    const absCompany = remark.hrReviewCompanyPay ?? remark.companyPayAmount;
    const absEmployee = remark.hrReviewEmployeePay ?? remark.employeePayAmount;
    const absApproved = Number(state.estimatedCost) || 0;
    if (
        absApproved > 0 &&
        ((absCompany != null && absCompany !== '') || (absEmployee != null && absEmployee !== ''))
    ) {
        const employee = Math.max(0, Number(absEmployee) || 0);
        const employeePct = Math.min(100, Math.max(0, Math.round((employee / absApproved) * 100)));
        state.employeePayPercent = String(employeePct);
        state.companyPayPercent = String(Math.min(100, Math.max(0, 100 - employeePct)));
        if (employee <= 0) state.paymentByMode = 'company';
        else if ((Number(absCompany) || 0) <= 0) state.paymentByMode = 'person';
        else state.paymentByMode = 'split';
    }

    const estimatedForSplit = Number(state.estimatedCost);
    const employeePctForSplit = Number(state.employeePayPercent);
    const employeeShare =
        absEmployee != null && absEmployee !== ''
            ? Math.max(0, Number(absEmployee) || 0)
            : Number.isFinite(estimatedForSplit) && Number.isFinite(employeePctForSplit)
              ? Math.round((estimatedForSplit * employeePctForSplit) / 100)
              : 0;
    const hasSavedHrRows =
        Array.isArray(remark.hrReviewEmployeeRows) && remark.hrReviewEmployeeRows.length > 0;
    const rowsNeedAutoFill =
        !hasSavedHrRows &&
        (state.paymentByMode === 'person' || state.paymentByMode === 'split') &&
        employeeShare > 0 &&
        (state.employeeLiabilityRows || []).every((row) => !String(row.paidAmount || '').trim());
    if (rowsNeedAutoFill) {
        state.employeeLiabilityRows = redistributeEmployeeLiabilityRows(
            state.employeeLiabilityRows,
            employeeShare,
        );
    }

    if (state.paymentByMode === 'split' && !hasSavedHrRows) {
        const synced = applyLinkedSplitPayPercent('company', state.companyPayPercent);
        if (synced.companyPayPercent !== undefined) state.companyPayPercent = synced.companyPayPercent;
        if (synced.employeePayPercent !== undefined) state.employeePayPercent = synced.employeePayPercent;
        const target =
            absEmployee != null && absEmployee !== ''
                ? Math.max(0, Number(absEmployee) || 0)
                : computeEmployeePayTarget(state.estimatedCost, state.employeePayPercent);
        if (target > 0 && (state.paymentByMode === 'person' || state.paymentByMode === 'split')) {
            const rowSum = sumEmployeeLiabilityRows(state.employeeLiabilityRows);
            if (Math.abs(rowSum - target) > 0.01) {
                state.employeeLiabilityRows = redistributeEmployeeLiabilityRows(
                    state.employeeLiabilityRows,
                    target,
                );
            }
        }
    }

    {
        const absoluteInit = resolveInitiateAbsolutePayAmounts({
            estimatedCost: state.estimatedCost,
            companyPayPercent: state.companyPayPercent,
            employeePayPercent: state.employeePayPercent,
            companyPayAmount: absCompany,
            employeePayAmount: absEmployee,
        });
        state.companyPayAmount = String(absoluteInit.companyPayAmount);
        state.employeePayAmount = String(absoluteInit.employeePayAmount);
    }
    state.companyPayPartyId = String(remark.companyPayPartyId || '').trim();
    state.companyPayPartyName = String(remark.companyPayPartyName || remark.companyName || '').trim();

    return state;
}

const MECHANICAL_WORK_FIELD_LABELS = {
    vehicleOwnerEmployeeId: 'Vehicle assigned',
    carDrivenByEmployeeId: 'Vehicle Driven By',
    paymentByMode: 'Payment by',
    amountMode: 'Payment type',
    paymentMethod: 'Payment method',
    estimatedCost: 'Estimated cost',
    companyPayPercent: 'Company payment',
    employeePayPercent: 'Employee payment',
    paySplit: 'Payment split',
    employeeLiabilityRows: 'Employee liability',
    attachment: 'Quotes',
    quotation2: 'Quote',
    quotation3: 'Quote',
    quotation1Amount: 'Quote amount',
    quotation2Amount: 'Quote amount',
    quotation3Amount: 'Quote amount',
    bodyWorkImages: 'Rectification area photos',
    tireCondition: 'Tire condition',
    serviceIssue: 'Description',
    previousChangeKm: 'Previous change KM',
    currentKm: 'Current KM',
};

function hasRectificationPhotos(formData) {
    const existing = Array.isArray(formData.existingBodyWorkImages) ? formData.existingBodyWorkImages.length : 0;
    const fresh = Array.isArray(formData.bodyWorkImages) ? formData.bodyWorkImages.length : 0;
    const tire =
        (formData.tireConditionBase64 && formData.tireConditionName) || formData.existingTireConditionUrl;
    return existing + fresh > 0 || !!tire;
}

function withTireConditionFromPhotos(formData) {
    if (
        (formData.tireConditionBase64 && formData.tireConditionName) ||
        formData.existingTireConditionUrl
    ) {
        return formData;
    }
    const firstNew = formData.bodyWorkImages?.[0];
    if (firstNew?.data && firstNew?.name) {
        return {
            ...formData,
            tireConditionName: firstNew.name,
            tireConditionBase64: firstNew.data,
            tireConditionMime: firstNew.mimeType || 'image/jpeg',
        };
    }
    const firstExisting = formData.existingBodyWorkImages?.[0];
    if (firstExisting?.url) {
        return {
            ...formData,
            existingTireConditionUrl: firstExisting.url,
            tireConditionName: firstExisting.name || formData.tireConditionName || '',
        };
    }
    return formData;
}

export function validateMechanicalWorkDetailForm(formData, asset = null) {
    const normalized = withTireConditionFromPhotos(formData);
    const amountMode = normalizeOilPaymentType(normalized.amountMode) || 'amount';
    const payable = isOilPayablePaymentMode(amountMode);

    const payload = {
        ...normalized,
        serviceType: 'Mechanical Work',
        amountMode,
        paymentMethod: payable
            ? normalizeOilPaymentMethod(normalized.paymentMethod) || 'cash'
            : '',
        serviceIssue: String(normalized.serviceIssue || '').trim(),
        currentKm: normalized.currentKm || asset?.currentKilometer || 0,
        previousChangeKm: normalized.previousChangeKm || 0,
        value: normalized.estimatedCost || normalized.quotation1Amount || normalized.value,
        quotation1Amount: normalized.quotation1Amount || normalized.estimatedCost,
    };

    const e = validateVehicleServiceForm(payload);
    if (hasRectificationPhotos(normalized)) {
        delete e.tireCondition;
        delete e.bodyWorkImages;
    }
    delete e.previousChangeKm;
    delete e.currentKm;
    delete e.quotation1Amount;
    delete e.quotation2Amount;
    delete e.quotation3Amount;

    if (!String(formData.carDrivenByEmployeeId || '').trim()) {
        e.carDrivenByEmployeeId = 'Vehicle Driven By is required';
    }
    if (!formData.paymentByMode) {
        e.paymentByMode = 'Payment by is required';
    }
    if (payable && !normalizeOilPaymentMethod(formData.paymentMethod)) {
        e.paymentMethod = 'Payment method is required';
    }

    const estimated = Number(formData.estimatedCost);
    if (payable && (!Number.isFinite(estimated) || estimated <= 0)) {
        e.estimatedCost = 'Estimated cost is required';
    }

    Object.assign(
        e,
        validateInitiateServicePaySplit(formData, {
            requirePayable: payable,
            requireCompanyParty: true,
        }),
    );

    const hasQ1 =
        !!(formData.attachmentBase64 && formData.attachmentName) || !!formData.existingAttachmentUrl;
    if (payable && !hasQ1) e.attachment = 'At least one quote is required';

    if (!hasRectificationPhotos(formData)) {
        e.bodyWorkImages = 'Rectification area photos are required';
    }

    // Description is optional on Mechanical Work details (initiate / schedule / HR / complete).
    delete e.serviceIssue;

    if (!payable) {
        delete e.estimatedCost;
        delete e.companyPayPercent;
        delete e.employeePayPercent;
        delete e.employeeLiabilityRows;
        delete e.paySplit;
        delete e.companyPayPartyId;
        delete e.paymentByMode;
        delete e.attachment;
        delete e.value;
        delete e.paymentMethod;
    }

    return e;
}

export function getMechanicalWorkDetailFormMissingFields(formData, asset = null) {
    const errors = validateMechanicalWorkDetailForm(formData, asset);
    const preferErrorText = new Set([
        'paySplit',
        'employeeLiabilityRows',
        'companyPayPercent',
        'employeePayPercent',
        'companyPayPartyId',
    ]);
    const labels = Object.keys(errors).map((key) =>
        preferErrorText.has(key) ? errors[key] : MECHANICAL_WORK_FIELD_LABELS[key] || errors[key],
    );
    return [...new Set(labels)];
}

export function isMechanicalWorkDetailFormComplete(formData, asset = null) {
    return Object.keys(validateMechanicalWorkDetailForm(formData, asset)).length === 0;
}

export function buildMechanicalWorkDetailSubmitBody(formData, { keepPending = true } = {}) {
    const liableOn =
        formData.paymentByMode === 'person'
            ? 'person'
            : formData.paymentByMode === 'split'
              ? 'split'
              : 'company';

    const normalized = withTireConditionFromPhotos(formData);
    const amountMode = normalizeOilPaymentType(normalized.amountMode) || 'amount';
    const payable = isOilPayablePaymentMode(amountMode);
    const paymentMethod = payable
        ? normalizeOilPaymentMethod(normalized.paymentMethod) || 'cash'
        : '';
    const payload = {
        ...normalized,
        serviceType: 'Mechanical Work',
        amountMode,
        paymentMethod,
        serviceIssue: String(normalized.serviceIssue || '').trim(),
        liableOn,
        liablePersonId:
            normalized.paymentByMode === 'person'
                ? normalized.employeeLiabilityRows?.[0]?.employeeId || normalized.carDrivenByEmployeeId
                : '',
        value: payable
            ? normalized.estimatedCost || normalized.quotation1Amount || normalized.value
            : 0,
        quotation1Amount: normalized.quotation1Amount || normalized.estimatedCost,
        date: normalized.date || new Date().toISOString().slice(0, 10),
    };

    const body = buildAddServiceBody(payload);
    const remark = (() => {
        try {
            return body.remark ? JSON.parse(body.remark) : {};
        } catch {
            return {};
        }
    })();

    remark.requestStatus = keepPending ? 'pending' : 'submitted';
    remark.amountMode = amountMode;
    if (paymentMethod) {
        remark.paymentMethod = paymentMethod;
    } else {
        delete remark.paymentMethod;
    }
    remark.paymentByMode = normalized.paymentByMode;
    remark.estimatedCost = Number(normalized.estimatedCost || 0);
    {
        const cost = Number(normalized.estimatedCost || 0);
        const absolutePay = resolveInitiateAbsolutePayAmounts({
            estimatedCost: normalized.estimatedCost,
            companyPayPercent: normalized.companyPayPercent,
            employeePayPercent: normalized.employeePayPercent,
            companyPayAmount: normalized.companyPayAmount,
            employeePayAmount: normalized.employeePayAmount,
        });
        const companyPayAmount = absolutePay.companyPayAmount;
        const employeePayAmount = absolutePay.employeePayAmount;
        const companyPayPercent =
            cost > 0 ? Math.min(100, Math.max(0, Math.round((companyPayAmount / cost) * 100))) : Number(normalized.companyPayPercent || 0);
        const employeePayPercent =
            cost > 0 ? Math.min(100, Math.max(0, 100 - companyPayPercent)) : Number(normalized.employeePayPercent || 0);
        remark.companyPayPercent = companyPayPercent;
        remark.employeePayPercent = employeePayPercent;
        remark.companyPayAmount = companyPayAmount;
        remark.employeePayAmount = employeePayAmount;
        remark.hrReviewApprovedAmount = cost || undefined;
        remark.hrReviewCompanyPay = companyPayAmount;
        remark.hrReviewEmployeePay = employeePayAmount;
    }
    remark.employeeLiabilityRows = (normalized.employeeLiabilityRows || []).map((row) => ({
        employeeId: row.employeeId,
        paidAmount: Number(row.paidAmount || 0),
    }));
    remark.employeeLiabilityTotal = sumEmployeeLiabilityRows(normalized.employeeLiabilityRows);
    remark.liableOn = liableOn;
    remark.serviceIssue = String(normalized.serviceIssue || '').trim();
    {
        const partyId = String(normalized.companyPayPartyId || '').trim();
        const partyName = String(normalized.companyPayPartyName || '').trim();
        if (partyId) remark.companyPayPartyId = partyId;
        else delete remark.companyPayPartyId;
        if (partyName) {
            remark.companyPayPartyName = partyName;
            remark.companyName = partyName;
        } else {
            delete remark.companyPayPartyName;
            delete remark.companyName;
        }
    }
    // Keep bodyWorkImages on the server; new uploads are sent via body.bodyWorkImages only.
    delete remark.bodyWorkImages;

    if (normalized.previousChangeKm !== '' && normalized.previousChangeKm != null) {
        remark.previousChangeKm = Number(normalized.previousChangeKm);
    }
    if (normalized.currentKm !== '' && normalized.currentKm != null) {
        remark.currentKm = Number(normalized.currentKm);
    }
    if (normalized.quotation2Amount) remark.quotation2Amount = Number(normalized.quotation2Amount);
    if (normalized.quotation3Amount) remark.quotation3Amount = Number(normalized.quotation3Amount);

    body.remark = JSON.stringify(remark);
    body.currentKm = Number(normalized.currentKm || 0);

    const freshImages = (normalized.bodyWorkImages || []).filter((img) => img?.data && img?.name);
    if (freshImages.length) {
        body.bodyWorkImages = freshImages.map((img) => ({
            name: img.name,
            data: img.data,
            mimeType: img.mimeType || 'image/jpeg',
        }));
    }
    if (normalized.tireConditionBase64 && normalized.tireConditionName) {
        body.tireCondition = {
            name: normalized.tireConditionName,
            data: normalized.tireConditionBase64,
            mimeType: normalized.tireConditionMime || 'image/jpeg',
        };
    }

    return body;
}
