/**
 * Human-readable Zoho serial (bill_number / expense_number), not the internal Zoho id.
 * Empty until the record is actually billed/expensed in Zoho.
 */
export function resolveZohoDocumentNumber(record = {}) {
    const expenseNo = String(record.zohoExpenseNumber || '').trim();
    if (expenseNo) return expenseNo;

    const billNo = String(record.zohoBillNumber || '').trim();
    if (billNo) return billNo;

    const billed = Boolean(
        String(record.zohoBillId || '').trim() ||
            String(record.zohoExpenseId || '').trim() ||
            (Array.isArray(record.zohoBillIds) &&
                record.zohoBillIds.some((id) => String(id || '').trim())),
    );
    if (billed) {
        const sent = String(record.billNumber || '').trim();
        if (sent) return sent;
    }

    return '';
}

export function formatZohoDocumentNumber(record = {}) {
    return resolveZohoDocumentNumber(record) || '—';
}
