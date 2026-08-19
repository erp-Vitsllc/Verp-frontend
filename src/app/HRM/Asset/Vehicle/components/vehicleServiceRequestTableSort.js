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
