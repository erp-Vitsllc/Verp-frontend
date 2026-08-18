/**
 * Zoho Books Serial No. custom field (e.g. VITS-Bills-012507), not Bill# or expense_number.
 */
export function resolveZohoDocumentNumber(record = {}) {
    const expenseNo = String(record.zohoExpenseNumber || '').trim();
    if (expenseNo) return expenseNo;

    const billNo = String(record.zohoBillNumber || '').trim();
    if (billNo) return billNo;

    return '';
}

export function formatZohoDocumentNumber(record = {}) {
    return resolveZohoDocumentNumber(record) || '—';
}
