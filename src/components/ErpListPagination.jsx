'use client';

export const ERP_LIST_PAGE_SIZES = [10, 50, 100];

export default function ErpListPagination({
    currentPage,
    pageSize,
    totalItems,
    onPageChange,
    onPageSizeChange,
    itemLabel = 'records',
}) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const endItem = Math.min(safePage * pageSize, totalItems);

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200 bg-[#f8fafc] px-3 sm:px-4 py-2.5 sm:py-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600">
                <span>
                    Showing {startItem}–{endItem} of {totalItems} {itemLabel}
                </span>
                <label className="inline-flex items-center gap-2">
                    <span className="text-slate-500">Rows</span>
                    <select
                        value={pageSize}
                        onChange={(event) => onPageSizeChange?.(Number(event.target.value))}
                        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs sm:text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
                        aria-label="Rows per page"
                    >
                        {ERP_LIST_PAGE_SIZES.map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onPageChange?.(safePage - 1)}
                    disabled={safePage <= 1}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Previous
                </button>
                <span className="text-xs sm:text-sm font-medium text-slate-600 tabular-nums">
                    Page {safePage} / {totalPages}
                </span>
                <button
                    type="button"
                    onClick={() => onPageChange?.(safePage + 1)}
                    disabled={safePage >= totalPages}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Next
                </button>
            </div>
        </div>
    );
}
