import { validateVehicleServiceForm, mapServiceRecordToFormData, buildAddServiceBody } from '../components/vehicleServicePayload';
import { formatWarrantyExpiryFromAsset, resolveDefaultPaymentMode } from './vehicleOilServiceWarranty';

export const DEFAULT_OIL_SERVICE_TYPE = 'Engine Oil';

export const OIL_SERVICE_VENDOR_OPTIONS = [
    'Al Futtaim Motors',
    'AGMC',
    'Emirates Motor Company',
    'Dynatrade',
    'FastTrack Auto',
    'Galadari Automobiles',
    'Arabian Automobiles',
    'Premier Car Care',
];

/** Static garage / vendor list for oil service assignment (API later). */
export const OIL_SERVICE_GARAGE_VENDOR_OPTIONS = OIL_SERVICE_VENDOR_OPTIONS;

export function buildOilServiceDetailFormState(service, asset, scheduleRow) {
    const base = mapServiceRecordToFormData(service, asset?.assignedTo);
    const remark = (() => {
        try {
            return service?.remark ? JSON.parse(service.remark) : {};
        } catch {
            return {};
        }
    })();

    const assigneeId = asset?.assignedTo?._id || asset?.assignedTo;
    const assigneeIdStr = assigneeId ? String(assigneeId) : '';
    const savedAmountMode = String(remark.amountMode || base.amountMode || '').toLowerCase();
    const amountMode =
        savedAmountMode === 'warranty' || savedAmountMode === 'amount'
            ? savedAmountMode
            : resolveDefaultPaymentMode(asset);

    return {
        ...base,
        serviceType: 'Oil Service',
        amountMode,
        oilServiceTypeText: remark.oilServiceTypeText || base.oilServiceTypeText || DEFAULT_OIL_SERVICE_TYPE,
        currentKm:
            remark.currentKm != null && remark.currentKm !== ''
                ? String(remark.currentKm)
                : base.currentKm != null && base.currentKm !== ''
                  ? String(base.currentKm)
                  : asset?.currentKilometer != null
                    ? String(asset.currentKilometer)
                    : '',
        vehicleOwnerEmployeeId:
            remark.vehicleOwnerEmployeeId != null && String(remark.vehicleOwnerEmployeeId).trim() !== ''
                ? String(remark.vehicleOwnerEmployeeId)
                : assigneeIdStr,
        carDrivenByEmployeeId:
            remark.carDrivenByEmployeeId != null && String(remark.carDrivenByEmployeeId).trim() !== ''
                ? String(remark.carDrivenByEmployeeId)
                : assigneeIdStr,
        lastChangeKm:
            remark.previousChangeKm != null
                ? String(remark.previousChangeKm)
                : scheduleRow?.lastOilServiceKm != null
                  ? String(scheduleRow.lastOilServiceKm)
                  : '',
        serviceEndDate:
            remark.serviceEndDate ||
            (remark.nextChangeMonth ? `${String(remark.nextChangeMonth).slice(0, 7)}-01` : ''),
        serviceStartDate:
            base.serviceStartDate ||
            remark.serviceStartDate ||
            (service?.date ? new Date(service.date).toISOString().slice(0, 10) : base.date),
        quotation1Amount:
            base.quotation1Amount ||
            (base.value != null && base.value !== '' ? String(base.value) : ''),
        value: base.value != null && base.value !== '' ? String(base.value) : '',
    };
}

export function validateOilServiceDetailCreateForm(formData) {
    const hasQuote1 =
        !!(formData.attachmentBase64 && formData.attachmentName) ||
        !!formData.existingAttachmentUrl;

    const payload = {
        ...formData,
        serviceType: 'Oil Service',
        date: formData.serviceStartDate || formData.date,
        serviceEndDate: formData.serviceEndDate || formData.nextChangeMonth,
        serviceIssue: String(formData.serviceIssue || '').trim(),
        quotation1Amount:
            formData.quotation1Amount ||
            (formData.amountMode === 'amount' ? formData.value : ''),
    };

    const errors = validateVehicleServiceForm(payload);

    if (!String(formData.oilServiceTypeText ?? '').trim()) {
        errors.oilServiceTypeText = 'Oil type is required';
    }
    if (!String(formData.currentKm ?? '').trim()) {
        errors.currentKm = 'Current KM is required';
    }
    if (!String(formData.lastChangeKm ?? '').trim()) {
        errors.lastChangeKm = 'Last change KM is required';
    }
    if (!String(formData.carDrivenByEmployeeId ?? '').trim()) {
        errors.carDrivenByEmployeeId = 'Car driven by is required';
    }
    if (!String(formData.garageName ?? '').trim()) {
        errors.garageName = 'Garage vendor is required';
    }
    if (!String(formData.garageLocation ?? '').trim()) {
        errors.garageLocation = 'Garage location is required';
    }
    if (!String(formData.garageContact ?? '').trim()) {
        errors.garageContact = 'Garage contact is required';
    }
    if (!String(formData.serviceStartDate ?? '').trim()) {
        errors.serviceStartDate = 'Service start date is required';
    }
    if (!String(formData.serviceEndDate ?? '').trim() && !String(formData.nextChangeMonth ?? '').trim()) {
        errors.serviceEndDate = 'Service end date is required';
    }
    if (!String(formData.serviceIssue ?? '').trim()) {
        errors.serviceIssue = 'Work description is required';
    }

    if (formData.amountMode === 'warranty') {
        if (!String(formData.vendorName ?? '').trim()) {
            errors.vendorName = 'Warranty type is required';
        }
    } else {
        const amount = Number(formData.value);
        if (!Number.isFinite(amount) || amount <= 0) {
            errors.value = 'Amount must be greater than 0';
        }
        if (!hasQuote1) {
            errors.attachment = 'Quote 1 PDF is required';
        }
    }

    return errors;
}

const OIL_SERVICE_FIELD_LABELS = {
    oilServiceTypeText: 'Oil type',
    currentKm: 'Current KM',
    lastChangeKm: 'Last change KM',
    vehicleOwnerEmployeeId: 'Vehicle assigned',
    carDrivenByEmployeeId: 'Car driven by',
    garageName: 'Garage name',
    garageLocation: 'Garage location',
    garageContact: 'Garage contact',
    serviceStartDate: 'Service start date',
    serviceEndDate: 'Service end date',
    nextChangeMonth: 'Service end date',
    serviceIssue: 'Work description',
    vendorName: 'Warranty type',
    amountMode: 'Payment type',
    value: 'Amount',
    attachment: 'Quote 1',
    quotation1Amount: 'Amount',
    date: 'Service date',
};

export function getOilServiceDetailFormMissingFields(formData) {
    const errors = validateOilServiceDetailCreateForm(formData);
    const labels = Object.keys(errors).map((key) => OIL_SERVICE_FIELD_LABELS[key] || errors[key]);
    return [...new Set(labels)];
}

export function isOilServiceDetailFormComplete(formData) {
    return Object.keys(validateOilServiceDetailCreateForm(formData)).length === 0;
}

export { formatWarrantyExpiryFromAsset };

export function buildOilServiceDetailSubmitBody(formData) {
    const amount = String(formData.value || '').trim();
    const payload = {
        ...formData,
        serviceType: 'Oil Service',
        quotation1Amount: formData.amountMode === 'amount' ? amount : formData.quotation1Amount,
        value: formData.amountMode === 'amount' ? amount : formData.value,
    };
    const body = buildAddServiceBody(payload);
    const remark = (() => {
        try {
            return body.remark ? JSON.parse(body.remark) : {};
        } catch {
            return {};
        }
    })();
    if (formData.lastChangeKm !== '' && formData.lastChangeKm != null) {
        remark.previousChangeKm = Number(formData.lastChangeKm);
    }
    remark.requestStatus = 'pending';
    if (formData.serviceEndDate) {
        remark.serviceEndDate = formData.serviceEndDate;
        remark.nextChangeMonth = String(formData.serviceEndDate).slice(0, 7);
    } else if (formData.nextChangeMonth) {
        remark.nextChangeMonth = formData.nextChangeMonth;
        remark.serviceEndDate = `${String(formData.nextChangeMonth).slice(0, 7)}-01`;
    }
    body.remark = JSON.stringify(remark);
    return body;
}
