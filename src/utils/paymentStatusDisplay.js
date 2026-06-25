export const COMPLETED_PAYMENT_STATUSES = ['Completed', 'Paid', 'Success', 'Approved', 'Active'];

export const PENDING_PAYMENT_STATUSES = ['Pending', 'Processing'];

export const REJECTED_PAYMENT_STATUSES = ['Rejected', 'Cancelled', 'Failed'];

function normalizeStatus(status) {
    return String(status || '').trim();
}

export function isCompletedPaymentStatus(status) {
    return COMPLETED_PAYMENT_STATUSES.includes(normalizeStatus(status));
}

export function isPendingPaymentStatus(status) {
    return PENDING_PAYMENT_STATUSES.includes(normalizeStatus(status));
}

export function isRejectedPaymentStatus(status) {
    return REJECTED_PAYMENT_STATUSES.includes(normalizeStatus(status));
}

/** User-facing label: Processing → Pending, Completed family → Completed */
export function getPaymentStatusLabel(status) {
    const normalized = normalizeStatus(status);
    if (!normalized) return 'Pending';
    if (isCompletedPaymentStatus(normalized)) return 'Completed';
    if (isPendingPaymentStatus(normalized)) return 'Pending';
    if (isRejectedPaymentStatus(normalized)) return normalized;
    return normalized;
}

export function getPaymentStatusBadgeClass(status) {
    if (isCompletedPaymentStatus(status)) {
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (isPendingPaymentStatus(status)) {
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (isRejectedPaymentStatus(status)) {
        return 'bg-red-50 text-red-700 border-red-200';
    }
    return 'bg-gray-50 text-gray-700 border-gray-200';
}

/** Tinted card / row surface for payment list items */
export function getPaymentStatusSurfaceClass(status) {
    if (isCompletedPaymentStatus(status)) {
        return 'bg-emerald-50/70 border-emerald-100 hover:bg-emerald-50';
    }
    if (isPendingPaymentStatus(status)) {
        return 'bg-amber-50/70 border-amber-100 hover:bg-amber-50';
    }
    if (isRejectedPaymentStatus(status)) {
        return 'bg-red-50/50 border-red-100 hover:bg-red-50';
    }
    return 'bg-gray-50/50 border-gray-100 hover:bg-gray-50';
}

export function getPaymentAmountTextClass(status) {
    if (isCompletedPaymentStatus(status)) return 'text-emerald-700';
    if (isPendingPaymentStatus(status)) return 'text-amber-700';
    if (isRejectedPaymentStatus(status)) return 'text-red-600';
    return 'text-gray-700';
}

export function isPaymentCountableTowardPaid(status) {
    return isCompletedPaymentStatus(status);
}

export function shouldShowPaymentInHistory(status) {
    const normalized = normalizeStatus(status);
    if (!normalized) return true;
    return !isRejectedPaymentStatus(normalized);
}
