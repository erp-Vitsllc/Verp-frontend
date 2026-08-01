import { validateVehicleServiceForm, mapServiceRecordToFormData, buildAddServiceBody } from '../components/vehicleServicePayload';
import { formatWarrantyExpiryFromAsset, resolveDefaultPaymentMode } from './vehicleOilServiceWarranty';
import {
    garageBillingAttachmentBody,
    garageBillingFieldsFromRemark,
    garageBillingRemarkPatch,
} from './vehicleGarageBillingFields';

export const DEFAULT_OIL_SERVICE_TYPE = 'Engine Oil';

/** Payment Type — drives workflow (Cash path vs Warranty). Stored in remark.amountMode. */
export const OIL_PAYMENT_TYPE_OPTIONS = [
    { id: 'amount', label: 'Cash' },
    { id: 'warranty', label: 'Warranty' },
];

/** Payment Method — how cash services are paid. Stored in remark.paymentMethod. */
export const OIL_PAYMENT_METHOD_OPTIONS = [
    { id: 'cash', label: 'Cash' },
    { id: 'acc_pay', label: 'Acc Pay' },
    { id: 'bank_transfer', label: 'Bank Transfer' },
];

const OIL_PAYMENT_METHOD_IDS = new Set(OIL_PAYMENT_METHOD_OPTIONS.map((o) => o.id));

export function normalizeOilPaymentType(value) {
    const raw = String(value || '').toLowerCase().trim();
    if (raw === 'warranty') return 'warranty';
    if (raw === 'amount' || raw === 'cash') return 'amount';
    // Legacy: payment method values were briefly stored in amountMode
    if (raw === 'acc_pay' || raw === 'bank_transfer') return 'amount';
    return '';
}

export function normalizeOilPaymentMethod(value) {
    const raw = String(value || '').toLowerCase().trim();
    if (raw === 'amount' || raw === 'cash') return 'cash';
    if (raw === 'accpay' || raw === 'account_pay' || raw === 'account pay') return 'acc_pay';
    if (raw === 'banktransfer' || raw === 'bank transfer') return 'bank_transfer';
    if (OIL_PAYMENT_METHOD_IDS.has(raw)) return raw;
    return '';
}

export function isOilWarrantyPaymentMode(mode) {
    return normalizeOilPaymentType(mode) === 'warranty';
}

/** Cash payment type — amount + HR/Accounts path. */
export function isOilPayablePaymentMode(mode) {
    return !isOilWarrantyPaymentMode(mode);
}

export function oilPaymentTypeLabel(mode) {
    const id = normalizeOilPaymentType(mode);
    return OIL_PAYMENT_TYPE_OPTIONS.find((o) => o.id === id)?.label || '—';
}

export function oilPaymentMethodLabel(mode) {
    const id = normalizeOilPaymentMethod(mode);
    return OIL_PAYMENT_METHOD_OPTIONS.find((o) => o.id === id)?.label || '—';
}

/** Resolve payment type + method from service remark (supports brief legacy mix-up). */
export function resolveOilPaymentFields(remark = {}, base = {}) {
    const rawMode = String(remark.amountMode || base.amountMode || '').toLowerCase().trim();
    const amountMode =
        normalizeOilPaymentType(rawMode) ||
        (rawMode === 'acc_pay' || rawMode === 'bank_transfer' ? 'amount' : '') ||
        '';
    const fromRemark = normalizeOilPaymentMethod(remark.paymentMethod);
    const fromLegacyMode =
        rawMode === 'acc_pay' || rawMode === 'bank_transfer' || rawMode === 'amount' || rawMode === 'cash'
            ? normalizeOilPaymentMethod(rawMode === 'amount' ? 'cash' : rawMode)
            : '';
    const paymentMethod = fromRemark || fromLegacyMode || 'cash';
    return { amountMode, paymentMethod };
}

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
    const resolved = resolveOilPaymentFields(remark, base);
    const amountMode = resolved.amountMode || resolveDefaultPaymentMode(asset);
    const paymentMethod =
        amountMode === 'warranty' ? '' : resolved.paymentMethod || 'cash';

    return {
        ...base,
        serviceType: 'Oil Service',
        amountMode,
        paymentMethod,
        garageName: String(remark.garageName || remark.vendorName || base.garageName || base.vendorName || '').trim(),
        vendorName: String(remark.vendorName || remark.garageName || base.vendorName || base.garageName || '').trim(),
        zohoVendorId: String(remark.zohoVendorId || base.zohoVendorId || '').trim(),
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
        ...garageBillingFieldsFromRemark(service, {
            ...remark,
            // Prefer oil amount fields for the pay amount display.
            garageBillAmount:
                remark.garageBillAmount ||
                remark.totalServiceCharge ||
                (base.value != null && base.value !== '' ? base.value : ''),
        }),
    };
}

export function validateOilServiceDetailCreateForm(formData) {
    const payload = {
        ...formData,
        serviceType: 'Oil Service',
        date: formData.serviceStartDate || formData.date,
        serviceEndDate: formData.serviceEndDate || formData.nextChangeMonth,
        serviceIssue: String(formData.serviceIssue || '').trim(),
        quotation1Amount:
            formData.quotation1Amount ||
            (isOilPayablePaymentMode(formData.amountMode) ? formData.value : ''),
    };

    const errors = validateVehicleServiceForm(payload);

    // Initiate Service only — schedule fields / quotes / description handled on later cards.
    delete errors.attachment;
    delete errors.quotation1Amount;
    delete errors.approvedQuotationChoice;
    delete errors.serviceIssue;
    delete errors.garageName;
    delete errors.garageLocation;
    delete errors.garageContact;
    delete errors.serviceStartDate;
    delete errors.serviceEndDate;
    delete errors.nextChangeMonth;
    delete errors.date;
    delete errors.payAccountId;
    delete errors.garageBillAmount;
    delete errors.garageAttachment;

    if (!String(formData.oilServiceTypeText ?? '').trim()) {
        errors.oilServiceTypeText = 'Oil type is required';
    }
    if (!String(formData.currentKm ?? '').trim()) {
        errors.currentKm = 'Current KM is required';
    }
    if (!String(formData.lastChangeKm ?? '').trim()) {
        errors.lastChangeKm = 'Last change KM is required';
    }
    const currentKmNum = Number(formData.currentKm);
    const lastKmNum = Number(formData.lastChangeKm);
    if (
        Number.isFinite(currentKmNum) &&
        Number.isFinite(lastKmNum) &&
        lastKmNum > currentKmNum
    ) {
        errors.lastChangeKm = 'Last change KM cannot be more than current KM';
    }
    if (String(formData.nextChangeKm ?? '').trim() !== '') {
        const nextKmNum = Number(formData.nextChangeKm);
        if (!Number.isFinite(nextKmNum) || nextKmNum < 0) {
            errors.nextChangeKm = 'Next service KM must be a valid number';
        } else if (Number.isFinite(currentKmNum) && nextKmNum < currentKmNum) {
            errors.nextChangeKm = 'Next service KM must be equal to or more than current KM';
        }
    }
    if (!String(formData.carDrivenByEmployeeId ?? '').trim()) {
        errors.carDrivenByEmployeeId = 'Car driven by is required';
    }
    if (isOilPayablePaymentMode(formData.amountMode)) {
        const amount = Number(formData.value);
        if (!Number.isFinite(amount) || amount <= 0) {
            errors.value = 'Amount must be greater than 0';
        }
        if (!normalizeOilPaymentMethod(formData.paymentMethod)) {
            errors.paymentMethod = 'Payment method is required';
        }
        delete errors.vendorName;
        delete errors.garageName;
    } else {
        delete errors.value;
        delete errors.paymentMethod;
        if (!String(formData.garageName || formData.vendorName || '').trim()) {
            errors.vendorName = 'Vendor is required for warranty';
        }
    }

    return errors;
}

/** Schedule & Reschedule card — garage, dates, description. Amount comes from Initiate. Quotation drop is optional. */
export function validateOilServiceScheduleForm(formData) {
    const errors = {};
    if (!String(formData.garageName ?? '').trim()) {
        errors.garageName = 'Garage name is required';
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
    // Description is optional for oil schedule / HR approval.
    return errors;
}

export function getOilServiceScheduleMissingFields(formData) {
    const errors = validateOilServiceScheduleForm(formData);
    const labels = {
        garageName: 'Garage name',
        garageLocation: 'Garage location',
        garageContact: 'Garage contact',
        serviceStartDate: 'Service start date',
        serviceEndDate: 'Service end date',
    };
    return Object.keys(errors).map((key) => labels[key] || errors[key]);
}

export function isOilServiceScheduleFormComplete(formData) {
    return Object.keys(validateOilServiceScheduleForm(formData)).length === 0;
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
    amountMode: 'Payment type',
    paymentMethod: 'Payment method',
    vendorName: 'Vendor',
    garageName: 'Vendor',
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

export function buildOilServiceDetailSubmitBody(formData, { initiated = false } = {}) {
    const amount = String(formData.value || '').trim();
    const payable = isOilPayablePaymentMode(formData.amountMode);
    const amountMode = normalizeOilPaymentType(formData.amountMode) || formData.amountMode;
    const paymentMethod = payable
        ? normalizeOilPaymentMethod(formData.paymentMethod) || 'cash'
        : '';
    const warrantyVendor = String(formData.garageName || formData.vendorName || '').trim();
    const payload = {
        ...formData,
        serviceType: 'Oil Service',
        amountMode,
        paymentMethod,
        vendorName: payable ? String(formData.vendorName || '').trim() : warrantyVendor,
        garageName: String(formData.garageName || formData.vendorName || '').trim(),
        zohoVendorId: String(formData.zohoVendorId || '').trim(),
        quotation1Amount: payable ? amount : formData.quotation1Amount,
        value: payable ? amount : 0,
        garageBillAmount: payable ? amount || formData.garageBillAmount : formData.garageBillAmount,
    };
    const body = buildAddServiceBody(payload);
    const remark = (() => {
        try {
            return body.remark ? JSON.parse(body.remark) : {};
        } catch {
            return {};
        }
    })();
    remark.amountMode = amountMode;
    if (paymentMethod) {
        remark.paymentMethod = paymentMethod;
    } else {
        delete remark.paymentMethod;
    }
    if (formData.lastChangeKm !== '' && formData.lastChangeKm != null) {
        remark.previousChangeKm = Number(formData.lastChangeKm);
    }
    if (initiated) {
        remark.requestStatus = 'pending';
        remark.oilServiceInitiatedAt = new Date().toISOString();
    } else {
        remark.requestStatus = 'pending';
    }
    if (formData.serviceEndDate) {
        remark.serviceEndDate = formData.serviceEndDate;
        remark.nextChangeMonth = String(formData.serviceEndDate).slice(0, 7);
    } else if (formData.nextChangeMonth) {
        remark.nextChangeMonth = formData.nextChangeMonth;
        remark.serviceEndDate = `${String(formData.nextChangeMonth).slice(0, 7)}-01`;
    }
    Object.assign(remark, garageBillingRemarkPatch(payload));
    if (warrantyVendor || payable) {
        const vendor = String(payload.garageName || payload.vendorName || '').trim();
        if (vendor) {
            remark.garageName = vendor;
            remark.vendorName = vendor;
        }
    }
    if (String(payload.zohoVendorId || '').trim()) {
        remark.zohoVendorId = String(payload.zohoVendorId).trim();
    }
    if (String(formData.approvedQuotationChoice || '').trim()) {
        remark.approvedQuotationChoice = String(formData.approvedQuotationChoice).trim();
    }
    body.remark = JSON.stringify(remark);
    if (!payable) {
        body.value = 0;
    }
    Object.assign(body, garageBillingAttachmentBody(formData));
    return body;
}
