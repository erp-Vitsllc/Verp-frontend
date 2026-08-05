/**
 * Schedule/Reschedule — Payment to Garage (Yes/No) + optional description.
 * Shared by Tire / Mechanical / Body / Accident / Oil schedule cards.
 */

export function normalizePaymentToGarage(value) {
    const v = String(value || '')
        .trim()
        .toLowerCase();
    if (v === 'yes' || v === 'true' || v === '1') return 'yes';
    return 'no';
}

export function paymentToGarageFieldsFromRemark(remark = {}) {
    const attachments = Array.isArray(remark.paymentToGarageAttachments)
        ? remark.paymentToGarageAttachments
              .map((row) => ({
                  name: String(row?.name || '').trim(),
                  url: String(row?.url || row?.publicId || '').trim(),
              }))
              .filter((row) => row.url || row.name)
        : [];

    const amountRaw = remark.paymentToGarageAmount;
    return {
        paymentToGarage: normalizePaymentToGarage(remark.paymentToGarage),
        paymentToGarageAmount:
            amountRaw != null && amountRaw !== '' ? String(amountRaw) : '',
        paymentToGarageAttachments: attachments,
        paymentToGarageNewAttachments: [],
        scheduleDescription: String(
            remark.scheduleDescription || remark.garageScheduleDescription || '',
        ).trim(),
    };
}

export function validatePaymentToGarageFields(formData) {
    const errors = {};
    if (normalizePaymentToGarage(formData.paymentToGarage) !== 'yes') return errors;

    const amount = Number(formData.paymentToGarageAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
        errors.paymentToGarageAmount = 'Amount is required when Payment to Garage is Yes';
    }

    const existing = Array.isArray(formData.paymentToGarageAttachments)
        ? formData.paymentToGarageAttachments.filter((row) => row?.url || row?.name)
        : [];
    const fresh = Array.isArray(formData.paymentToGarageNewAttachments)
        ? formData.paymentToGarageNewAttachments.filter((row) => row?.data && row?.name)
        : [];
    if (!existing.length && !fresh.length) {
        errors.paymentToGarageAttachments =
            'At least one attachment is required when Payment to Garage is Yes';
    }
    return errors;
}

export function paymentToGarageRemarkPatch(formData) {
    const yes = normalizePaymentToGarage(formData.paymentToGarage) === 'yes';
    const amount = Number(formData.paymentToGarageAmount);
    const existing = Array.isArray(formData.paymentToGarageAttachments)
        ? formData.paymentToGarageAttachments
              .map((row) => ({
                  name: String(row?.name || '').trim(),
                  url: String(row?.url || '').trim(),
              }))
              .filter((row) => row.url)
        : [];

    const patch = {
        paymentToGarage: yes ? 'yes' : 'no',
        scheduleDescription: String(formData.scheduleDescription || '').trim(),
        garageScheduleDescription: String(formData.scheduleDescription || '').trim(),
    };

    if (yes) {
        patch.paymentToGarageAmount =
            Number.isFinite(amount) && amount > 0 ? Number(amount.toFixed(2)) : '';
        patch.paymentToGarageAttachments = existing;
    } else {
        patch.paymentToGarageAmount = '';
        // Clear attachment refs when switching to No.
        patch.paymentToGarageAttachments = [];
    }

    return patch;
}

export function paymentToGarageAttachmentBody(formData) {
    if (normalizePaymentToGarage(formData.paymentToGarage) !== 'yes') return {};
    const fresh = Array.isArray(formData.paymentToGarageNewAttachments)
        ? formData.paymentToGarageNewAttachments.filter((row) => row?.data && row?.name)
        : [];
    if (!fresh.length) return {};
    return {
        paymentToGarageAttachments: fresh.map((row) => ({
            name: row.name,
            data: row.data,
            mimeType: row.mimeType || 'application/pdf',
        })),
    };
}
