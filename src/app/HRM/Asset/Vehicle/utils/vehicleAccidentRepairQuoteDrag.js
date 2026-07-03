export const TIRE_QUOTE_DRAG_TYPE = 'application/x-verp-tire-quote';

export function quoteKindToKey(kind) {
    if (kind === 'attachment') return 'q1';
    if (kind === 'quotation3') return 'q2';
    if (kind === 'tireCondition') return 'q3';
    if (kind === 'quotation2') return 'q2';
    return '';
}

export function quoteKeyToLabel(key) {
    if (key === 'q1') return 'Police Report';
    if (key === 'q2') return 'Police Fine Document';
    if (key === 'q3') return 'Other Document';
    return 'Document';
}

export function buildTireQuoteDragPayload({ key, label, fileName, amount }) {
    return JSON.stringify({
        key,
        label: label || quoteKeyToLabel(key),
        fileName: fileName || '',
        amount: amount != null && amount !== '' ? String(amount) : '',
    });
}

export function parseTireQuoteDragPayload(dataTransfer) {
    if (!dataTransfer) return null;
    const raw = dataTransfer.getData(TIRE_QUOTE_DRAG_TYPE);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        const key = String(parsed?.key || '').trim();
        if (!['q1', 'q2', 'q3'].includes(key)) return null;
        return {
            key,
            label: parsed.label || quoteKeyToLabel(key),
            fileName: parsed.fileName || '',
            amount: parsed.amount || '',
        };
    } catch {
        return null;
    }
}
