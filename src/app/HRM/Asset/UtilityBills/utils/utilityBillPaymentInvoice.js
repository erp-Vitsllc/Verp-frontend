import axiosInstance from '@/utils/axios';

/**
 * Find the Accounts Payment linked to a UtilityBill (by bill id or batch id).
 */
export async function fetchUtilityBillPayment(bill, client = axiosInstance) {
    if (!bill?._id) return null;
    try {
        const res = await client.get('/Payment', { skipToast: true });
        const list = Array.isArray(res.data?.payments)
            ? res.data.payments
            : Array.isArray(res.data)
              ? res.data
              : [];
        const billId = String(bill._id);
        const batchId = bill.batchId ? String(bill.batchId) : '';
        return (
            list.find((p) => {
                if (String(p?.paymentType || '') !== 'UtilityBill') return false;
                const rel = String(p?.relatedEntityId || p?.referenceId || '');
                return rel === billId || (batchId && rel === batchId);
            }) || null
        );
    } catch {
        return null;
    }
}

/**
 * Load the payment record used for the Payments RECEIPT invoice view.
 * @returns {Promise<{ payment: object|null, error?: string }>}
 */
export async function loadUtilityBillPaymentInvoice(bill, client = axiosInstance) {
    const payment = await fetchUtilityBillPayment(bill, client);
    if (!payment) {
        return {
            payment: null,
            error:
                'No payment invoice found for this bill yet. Complete payment in Accounts → Payments first.',
        };
    }
    return { payment };
}
