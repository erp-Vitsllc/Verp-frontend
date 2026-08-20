export function compareServiceTableValues(a, b, type, direction) {
    const dir = direction === 'desc' ? -1 : 1;
    const aEmpty = a == null || a === '';
    const bEmpty = b == null || b === '';
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;

    if (type === 'number' || type === 'date') {
        return (Number(a) - Number(b)) * dir;
    }

    return (
        String(a).localeCompare(String(b), undefined, {
            numeric: true,
            sensitivity: 'base',
        }) * dir
    );
}

export function sortServiceTableRows(rows, getSortValue, sortKey, sortDirection, columnType) {
    const sorted = [...rows].sort((a, b) =>
        compareServiceTableValues(
            getSortValue(a, sortKey),
            getSortValue(b, sortKey),
            columnType,
            sortDirection,
        ),
    );
    return sorted.map((row, index) => ({ ...row, slNo: index + 1 }));
}

export function dateSortValue(value) {
    if (!value) return null;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : null;
}

export function numberSortValue(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

export function textSortValue(value) {
    const text = String(value ?? '').trim();
    return text || null;
}

/** Sort VEGA-ASSET-056 above VEGA-VHCL-014 when descending, by the trailing number. */
export function codeSortValue(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const match = text.match(/(\d+)\s*$/);
    if (!match) return text.toLowerCase();
    const n = Number(match[1]);
    if (!Number.isFinite(n)) return text.toLowerCase();
    return `${String(n).padStart(12, '0')}|${text.toLowerCase()}`;
}
