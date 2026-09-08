import { shouldShowPaymentInHistory } from '@/utils/paymentStatusDisplay';

const RECEIPT_CACHE_PREFIX = 'verp:paymentReceipt:';

function repaymentTypeForLoan(loan) {
    return String(loan?.type || 'Loan').trim() === 'Advance' ? 'AdvanceRepayment' : 'LoanRepayment';
}

function sortPaymentsOldestFirst(list = []) {
    return [...list].sort((a, b) => {
        const ta = new Date(a.paymentDate || a.createdAt || 0).getTime();
        const tb = new Date(b.paymentDate || b.createdAt || 0).getTime();
        if (ta !== tb) return ta - tb;
        return String(a.paymentId || a._id || '').localeCompare(String(b.paymentId || b._id || ''));
    });
}

function paymentMatchesEntity(payment, { mongoId, code, relatedEntityType }) {
    if (!payment) return false;
    if (String(payment.relatedEntityType || '') !== relatedEntityType) return false;
    const refOk = code && String(payment.referenceId || '') === code;
    const idOk =
        mongoId &&
        String(payment.relatedEntityId?._id || payment.relatedEntityId || '') === mongoId;
    return Boolean(refOk || idOk);
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
        return paymentMatchesEntity(p, {
            mongoId: loanMongoId,
            code: loanCode,
            relatedEntityType: repaymentType,
        });
    });

    return sortPaymentsOldestFirst(matched);
}

/**
 * Employee fine payments for the Document column (same invoice list as loan repayments).
 */
export function getFinePaymentsForDocuments(fine, allPayments = []) {
    if (!fine) return [];
    const fineMongoId = String(fine._id || fine.id || '');
    const fineCode = String(fine.fineId || '');

    const matched = (allPayments || []).filter((p) => {
        if (!shouldShowPaymentInHistory(p.status)) return false;
        const type = String(p.relatedEntityType || '').trim();
        if (type && type !== 'Fine') return false;
        const refOk = fineCode && String(p.referenceId || '') === fineCode;
        const idOk =
            fineMongoId &&
            String(p.relatedEntityId?._id || p.relatedEntityId || '') === fineMongoId;
        return Boolean(refOk || idOk);
    });

    return sortPaymentsOldestFirst(matched);
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
