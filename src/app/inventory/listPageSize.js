export const LIST_PAGE_SIZES = ['10', '20', '50', '100', 'all'];

export function pageSizeParam(params) {
    const value = String(params.get('size') || '10');
    return LIST_PAGE_SIZES.includes(value) ? value : '10';
}

export function pageLimit(size) {
    return size === 'all' ? 0 : Number(size);
}

export function pageWindow(total, page, size) {
    const count = Math.max(0, Number(total) || 0);
    const numericSize = size === 'all' ? Math.max(count, 1) : Number(size);
    const pageCount = size === 'all' ? 1 : Math.max(1, Math.ceil(count / numericSize));
    const currentPage = Math.min(Math.max(1, page), pageCount);
    const from = count === 0 ? 0 : (currentPage - 1) * (size === 'all' ? count : numericSize) + 1;
    const to = count === 0 ? 0 : size === 'all' ? count : Math.min(currentPage * numericSize, count);
    return { pageCount, currentPage, from, to };
}

export function slicePage(rows, page, size) {
    if (size === 'all') return rows;
    const numericSize = Number(size);
    const start = (Math.max(1, page) - 1) * numericSize;
    return rows.slice(start, start + numericSize);
}
