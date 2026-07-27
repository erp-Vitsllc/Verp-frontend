/**
 * Shared garage billing fields for Tire / Mech / Body / Accident garage cards.
 * Vendor = Garage Name. Pay Account + Amount + Attachment go to Zoho Bill on Accounts approve.
 */

export function resolveGarageServiceBillAmount(service, remark = {}) {
    const r = remark && typeof remark === 'object' ? remark : {};
    const candidates = [
        r.garageBillAmount,
        r.hrReviewCompanyPay,
        r.hrReviewApprovedAmount,
        service?.value,
        r.approvedAmount,
        r.estimatedCost,
    ];
    for (const raw of candidates) {
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) return Number(n.toFixed(2));
    }
    return 0;
}

export function garageBillingFieldsFromRemark(service, remark = {}) {
    const amount = resolveGarageServiceBillAmount(service, remark);
    return {
        zohoVendorId: String(remark.zohoVendorId || '').trim(),
        payAccountId: String(remark.payAccountId || remark.garagePayAccountId || '').trim(),
        payAccountName: String(remark.payAccountName || remark.garagePayAccountName || '').trim(),
        garageBillAmount:
            amount > 0
                ? String(amount)
                : String(remark.garageBillAmount || '').trim() || '',
        garageAttachmentName: String(remark.garageAttachmentName || '').trim(),
        garageAttachmentBase64: '',
        garageAttachmentMime: '',
        existingGarageAttachmentUrl: String(
            remark.garageAttachmentUrl || remark.garageBillAttachmentUrl || '',
        ).trim(),
    };
}

export function validateGarageBillingFields(formData, { requireAttachment = false } = {}) {
    const errors = {};
    if (!String(formData.payAccountId || '').trim()) {
        errors.payAccountId = 'Pay Account is required';
    }
    const amount = Number(formData.garageBillAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
        errors.garageBillAmount = 'Amount must be greater than 0';
    }
    const hasNew = Boolean(formData.garageAttachmentBase64 && formData.garageAttachmentName);
    const hasExisting = Boolean(
        formData.existingGarageAttachmentUrl || formData.garageAttachmentName,
    );
    if (requireAttachment && !hasNew && !hasExisting) {
        errors.garageAttachment = 'Attachment is required';
    }
    return errors;
}

export function garageBillingRemarkPatch(formData) {
    const amount = Number(formData.garageBillAmount);
    return {
        zohoVendorId: String(formData.zohoVendorId || '').trim() || undefined,
        payAccountId: String(formData.payAccountId || '').trim() || undefined,
        payAccountName: String(formData.payAccountName || '').trim() || undefined,
        garagePayAccountId: String(formData.payAccountId || '').trim() || undefined,
        garagePayAccountName: String(formData.payAccountName || '').trim() || undefined,
        garageBillAmount:
            Number.isFinite(amount) && amount > 0 ? Number(amount.toFixed(2)) : undefined,
        garageAttachmentName: String(formData.garageAttachmentName || '').trim() || undefined,
    };
}

export function garageBillingAttachmentBody(formData) {
    if (formData.garageAttachmentBase64 && formData.garageAttachmentName) {
        return {
            garageBillAttachment: {
                name: formData.garageAttachmentName,
                data: formData.garageAttachmentBase64,
                mimeType: formData.garageAttachmentMime || 'application/pdf',
            },
        };
    }
    return {};
}
