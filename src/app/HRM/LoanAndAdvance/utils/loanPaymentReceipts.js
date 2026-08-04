import { shouldShowPaymentInHistory } from '@/utils/paymentStatusDisplay';

const RECEIPT_CACHE_PREFIX = 'verp:paymentReceipt:';

function repaymentTypeForLoan(loan) {
    return String(loan?.type || 'Loan').trim() === 'Advance' ? 'AdvanceRepayment' : 'LoanRepayment';
}

/**
 * All employee→company repayment payments for a loan/advance (including small partials).
 * Sorted oldest → newest for the Document dropdown.
 */
export function getLoanRepaymentPaymentsForDocuments(loan, allPayments = []) {
    if (!loan) return [];
    const loanMongoId = String(loan._id || loan.id || '');
    const loanCode = String(loan.loanId || '');
    const repaymentType = repaymentTypeForLoan(loan);

    const matched = (allPayments || []).filter((p) => {
        if (!shouldShowPaymentInHistory(p.status)) return false;
        if (String(p.relatedEntityType || '') !== repaymentType) return false;
        const refOk = loanCode && String(p.referenceId || '') === loanCode;
        const idOk =
            loanMongoId &&
            String(p.relatedEntityId?._id || p.relatedEntityId || '') === loanMongoId;
        return refOk || idOk;
    });

    return matched.sort((a, b) => {
        const ta = new Date(a.paymentDate || a.createdAt || 0).getTime();
        const tb = new Date(b.paymentDate || b.createdAt || 0).getTime();
        if (ta !== tb) return ta - tb;
        return String(a.paymentId || a._id || '').localeCompare(String(b.paymentId || b._id || ''));
    });
}

export function cachePaymentReceipt(payment) {
    const id = String(payment?._id || payment?.paymentId || '').trim();
    if (!id || typeof window === 'undefined') return id;
    try {
        sessionStorage.setItem(`${RECEIPT_CACHE_PREFIX}${id}`, JSON.stringify(payment));
        if (payment.paymentId && String(payment.paymentId) !== id) {
            sessionStorage.setItem(
                `${RECEIPT_CACHE_PREFIX}${payment.paymentId}`,
                JSON.stringify(payment),
            );
        }
    } catch {
        /* ignore quota */
    }
    return id;
}

export function readCachedPaymentReceipt(paymentKey) {
    if (!paymentKey || typeof window === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(`${RECEIPT_CACHE_PREFIX}${paymentKey}`);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/** Open rendered payment invoice/receipt in a new browser tab. */
export function openPaymentReceiptInNewTab(payment) {
    if (!payment || typeof window === 'undefined') return;
    const id = cachePaymentReceipt(payment);
    if (!id) return;
    window.open(
        `/Accounts/Payments/receipt/${encodeURIComponent(id)}`,
        '_blank',
        'noopener,noreferrer',
    );
}
