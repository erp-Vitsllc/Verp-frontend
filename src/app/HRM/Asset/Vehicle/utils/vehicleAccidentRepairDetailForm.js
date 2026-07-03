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
import { OIL_SERVICE_VENDOR_OPTIONS } from './vehicleOilServiceDetailForm';

export { OIL_SERVICE_VENDOR_OPTIONS as ACCIDENT_REPAIR_VENDOR_OPTIONS, formatWarrantyExpiryFromAsset };

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
    if (!list.length || target <= 0) return list;
    return redistributeEmployeeLiabilityRows(list, target);
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

export function buildAccidentRepairDetailFormState(service, asset) {
    const base = mapServiceRecordToFormData(service, asset?.assignedTo);
    const assigneeId = asset?.assignedTo?._id || asset?.assignedTo;
    const assigneeIdStr = assigneeId ? String(assigneeId) : '';

    return {
        ...base,
        serviceType: 'Accident Repair',
        policyNumber: '',
        insuranceExpiryDate: '',
        date: base.date || (service?.date ? new Date(service.date).toISOString().slice(0, 10) : ''),
        currentKm:
            base.currentKm !== '' && base.currentKm != null
                ? String(base.currentKm)
                : asset?.currentKilometer != null
                  ? String(asset.currentKilometer)
                  : '',
        vehicleOwnerEmployeeId: base.vehicleOwnerEmployeeId || assigneeIdStr,
        carDrivenByType: base.carDrivenByType || (base.carDrivenByCompanyId ? 'company' : 'employee'),
        carDrivenByEmployeeId:
            base.carDrivenByType === 'company' || base.carDrivenByCompanyId
                ? base.carDrivenByEmployeeId || ''
                : base.carDrivenByEmployeeId || assigneeIdStr,
        serviceIssue: base.serviceIssue || '',
        accidentImages: [],
    };
}

const ACCIDENT_REPAIR_FIELD_LABELS = {
    accidentDate: 'Accident date',
    accidentTime: 'Accident time',
    accidentLocation: 'Accident location',
    vehicleOwnerEmployeeId: 'Vehicle assigned',
    carDrivenByEmployeeId: 'Car driven by',
    accidentOwnerType: 'Accident party',
    attachment: 'Police report',
    policeFineAmount: 'Police fine',
    accidentImages: 'Accident photos',
    serviceIssue: 'Accident description',
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

    if (!String(formData.vehicleOwnerEmployeeId || '').trim()) {
        e.vehicleOwnerEmployeeId = 'Vehicle assigned is required';
    }
    if (!isCarDrivenBySelected(formData)) {
        e.carDrivenByEmployeeId = 'Car driven by is required';
    }
    if (!hasAccidentPhotos(formData)) {
        e.accidentImages = 'Accident photos are required';
    }

    return e;
}

export function getAccidentRepairDetailFormMissingFields(formData, asset = null) {
    const errors = validateAccidentRepairDetailForm(formData, asset);
    const labels = Object.keys(errors).map((key) => ACCIDENT_REPAIR_FIELD_LABELS[key] || errors[key]);
    return [...new Set(labels)];
}

export function isAccidentRepairDetailFormComplete(formData, asset = null) {
    return Object.keys(validateAccidentRepairDetailForm(formData, asset)).length === 0;
}

export function buildAccidentRepairDetailSubmitBody(formData, { keepPending = true } = {}) {
    const payload = {
        ...formData,
        serviceType: 'Accident Repair',
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
    remark.requestStatus = keepPending ? 'pending' : remark.requestStatus || 'pending';
    body.remark = JSON.stringify(remark);
    return body;
}
