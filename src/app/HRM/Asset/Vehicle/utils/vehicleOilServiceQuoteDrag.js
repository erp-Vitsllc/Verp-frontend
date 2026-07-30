export const OIL_QUOTE_DRAG_TYPE = 'application/x-verp-oil-quote';

export function oilQuoteKindToKey(kind) {
    if (kind === 'attachment') return 'q1';
    if (kind === 'quotation2') return 'q2';
    if (kind === 'quotation3') return 'q3';
    return '';
}

export function oilQuoteKeyToLabel(key) {
    if (key === 'q1') return 'Quote 1';
    if (key === 'q2') return 'Quote 2';
    if (key === 'q3') return 'Quote 3';
    return 'Quote';
}

export function buildOilQuoteDragPayload({ key, label, fileName, amount }) {
    return JSON.stringify({
        key,
        label: label || oilQuoteKeyToLabel(key),
        fileName: fileName || '',
        amount: amount != null && amount !== '' ? String(amount) : '',
    });
}

export function parseOilQuoteDragPayload(dataTransfer) {
    if (!dataTransfer) return null;
    const raw = dataTransfer.getData(OIL_QUOTE_DRAG_TYPE);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        const key = String(parsed?.key || '').trim();
        if (!['q1', 'q2', 'q3'].includes(key)) return null;
        return {
            key,
            label: parsed.label || oilQuoteKeyToLabel(key),
            fileName: parsed.fileName || '',
            amount: parsed.amount || '',
        };
    } catch {
        return null;
    }
}
