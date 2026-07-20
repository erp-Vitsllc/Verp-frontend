'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, Loader2, Plus, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import ErpPageHeader from '@/components/ErpPageHeader';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import ErpListPagination from '@/components/ErpListPagination';
import { mapZohoVendorListRows } from '@/utils/zohoVendors';
import { useZohoVendors } from '@/hooks/useZohoVendors';
import { useZohoChunkedList } from '@/hooks/useZohoChunkedList';

const COLUMNS = [
    { key: 'name', label: 'NAME' },
    { key: 'companyName', label: 'COMPANY NAME' },
    { key: 'email', label: 'EMAIL' },
    { key: 'workPhone', label: 'WORK PHONE' },
    { key: 'payables', label: 'PAYABLES', align: 'right' },
];

export default function PurchasesVendorsPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortKey, setSortKey] = useState('name');
    const [sortDirection, setSortDirection] = useState('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const { connectZoho } = useZohoVendors({ enabled: false });
    const {
        rows,
        totalCount,
        loading,
        loadingMore,
        error,
        setError,
        syncedCount,
        load: loadVendors,
    } = useZohoChunkedList({
        endpoint: '/zoho/vendors',
        mapRows: mapZohoVendorListRows,
        getRowId: (row) => String(row?.id || ''),
    });

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const handleConnectZoho = useCallback(async () => {
        try {
            setError('');
            await connectZoho();
        } catch (err) {
            setError(
                err?.message ||
                    'Failed to start Zoho authorization. Check ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REDIRECT_URI in the backend .env, then restart the server.',
            );
        }
    }, [connectZoho, setError]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, sortKey, sortDirection, pageSize]);

    useEffect(() => {
        if (!mounted) return;
        void loadVendors({
            page: currentPage,
            pageSize,
            search: debouncedSearch,
            sortBy: sortKey,
            sortDir: sortDirection,
        });
    }, [mounted, currentPage, pageSize, debouncedSearch, sortKey, sortDirection, loadVendors]);

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortKey(key);
        setSortDirection('asc');
    };

    if (!mounted) return null;

    return (
        <PermissionGuard moduleId="purchases" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#f4f6f8]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <main className="flex-1 p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden overflow-y-auto">
                        <ErpPageHeader
                            title="Vendors"
                            subtitle="Local database — click Refresh to sync from Zoho (batches of 400)"
                        >
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => router.push('/Accounts/Vendors/new')}
                                    className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-blue-600 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
                                >
                                    <Plus size={16} />
                                    New
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        void loadVendors({
                                            sync: true,
                                            page: currentPage,
                                            pageSize,
                                            search: debouncedSearch,
                                            sortBy: sortKey,
                                            sortDir: sortDirection,
                                        })
                                    }
                                    disabled={loading || loadingMore}
                                    className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-slate-200 bg-white px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
                                >
                                    <RefreshCw size={16} className={loading || loadingMore ? 'animate-spin' : ''} />
                                    Refresh
                                </button>
                            </div>
                        </ErpPageHeader>

                        {error ? (
                            <div className="mb-3 sm:mb-4">
                                <ErpErrorBanner message={error} />
                                {/not connected|re-authorize|not configured|authorization|oauth/i.test(error) ? (
                                    <button
                                        type="button"
                                        onClick={() => void handleConnectZoho()}
                                        className="mt-2 sm:mt-3 text-xs sm:text-sm font-semibold text-teal-700 underline"
                                    >
                                        Connect Zoho Books
                                    </button>
                                ) : null}
                            </div>
                        ) : null}

                        <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200 px-3 sm:px-4 py-2.5 sm:py-3 bg-[#f8fafc]">
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                    <button
                                        type="button"
                                        className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"
                                        aria-label="Filters"
                                    >
                                        <SlidersHorizontal size={16} />
                                    </button>
                                    <span className="text-xs sm:text-sm font-medium text-slate-600">
                                        {totalCount} vendor{totalCount === 1 ? '' : 's'}
                                        {loadingMore
                                            ? ` · syncing from Zoho… (${syncedCount} synced)`
                                            : ''}
                                    </span>
                                </div>
                                <div className="relative w-full sm:max-w-xs">
                                    <Search
                                        size={16}
                                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search vendors"
                                        className="h-9 sm:h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-[640px] w-full border-collapse text-xs sm:text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-[#f8fafc] text-left">
                                            <th className="w-12 px-3 sm:px-4 py-2 sm:py-3">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-slate-300"
                                                    aria-label="Select all vendors"
                                                    disabled
                                                />
                                            </th>
                                            {COLUMNS.map((column) => (
                                                <th
                                                    key={column.key}
                                                    className={`px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-[11px] font-bold tracking-[0.08em] text-slate-500 ${
                                                        column.align === 'right' ? 'text-right' : ''
                                                    }`}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSort(column.key)}
                                                        className={`inline-flex items-center gap-1 hover:text-slate-700 ${
                                                            column.align === 'right' ? 'ml-auto' : ''
                                                        }`}
                                                    >
                                                        {column.label}
                                                        <ArrowUpDown size={12} />
                                                    </button>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr>
                                                <td colSpan={COLUMNS.length + 1} className="px-3 sm:px-4 py-10 sm:py-16 text-center text-slate-500">
                                                    <div className="inline-flex items-center gap-2">
                                                        <Loader2 size={18} className="animate-spin" />
                                                        Loading vendors…
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : null}

                                        {!loading && !rows.length ? (
                                            <tr>
                                                <td colSpan={COLUMNS.length + 1} className="px-3 sm:px-4 py-10 sm:py-16 text-center text-slate-500">
                                                    {/not connected|re-authorize|not configured/i.test(error)
                                                        ? 'Connect Zoho Books to load vendors.'
                                                        : 'No vendors in local database. Click Refresh to sync from Zoho Books.'}
                                                </td>
                                            </tr>
                                        ) : null}

                                        {!loading
                                            ? rows.map((row) => (
                                                  <tr
                                                      key={row.id || row.name}
                                                      className="border-b border-slate-100 hover:bg-slate-50/80"
                                                  >
                                                      <td className="px-3 sm:px-4 py-2 sm:py-3">
                                                          <input
                                                              type="checkbox"
                                                              className="h-4 w-4 rounded border-slate-300"
                                                              aria-label={`Select ${row.name}`}
                                                          />
                                                      </td>
                                                      <td className="px-3 sm:px-4 py-2 sm:py-3 font-medium text-slate-800">
                                                          {row.name}
                                                      </td>
                                                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-slate-700">
                                                          {row.companyName}
                                                      </td>
                                                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-slate-700">
                                                          {row.email}
                                                      </td>
                                                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-slate-700">
                                                          {row.workPhone}
                                                      </td>
                                                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-slate-700 text-right tabular-nums">
                                                          {row.payables}
                                                      </td>
                                                  </tr>
                                              ))
                                            : null}
                                    </tbody>
                                </table>
                            </div>

                            {!loading && totalCount > 0 ? (
                                <ErpListPagination
                                    currentPage={currentPage}
                                    pageSize={pageSize}
                                    totalItems={totalCount}
                                    onPageChange={setCurrentPage}
                                    onPageSizeChange={setPageSize}
                                    itemLabel="vendors"
                                />
                            ) : null}
                        </div>
                    </main>
                </div>
            </div>
        </PermissionGuard>
    );
}
