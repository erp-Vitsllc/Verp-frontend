'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowUpDown,
    Loader2,
    Plus,
    RefreshCw,
    Search,
    SlidersHorizontal,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import ErpPageHeader from '@/components/ErpPageHeader';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import ErpListPagination from '@/components/ErpListPagination';
import { useZohoVendors } from '@/hooks/useZohoVendors';
import { useZohoChunkedList } from '@/hooks/useZohoChunkedList';
import { useZohoOrganizations } from '@/hooks/useZohoOrganizations';
import { mapZohoVendorPaymentListRows } from '@/utils/zohoVendorPayments';
import ZohoOrganizationPicker from '@/components/ZohoOrganizationPicker';
import ViewVendorPaymentDetail from './components/ViewVendorPaymentDetail';

const COLUMNS = [
    { key: 'date', label: 'DATE' },
    { key: 'location', label: 'LOCATION' },
    { key: 'paymentNumber', label: 'PAYMENT #' },
    { key: 'referenceNumber', label: 'REFERENCE #' },
    { key: 'vendorName', label: 'VENDOR NAME' },
    { key: 'billNumber', label: 'BILL #' },
    { key: 'mode', label: 'MODE' },
    { key: 'status', label: 'STATUS' },
    { key: 'amount', label: 'AMOUNT', align: 'right', sortValue: 'amountValue' },
    { key: 'unusedAmount', label: 'UNUSED AMOUNT', align: 'right', sortValue: 'unusedAmountValue' },
];

function statusBadgeClass(status) {
    const value = String(status || '').toLowerCase();
    if (value.includes('partial')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (value.includes('void') || value.includes('draft')) {
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
    if (
        value.includes('applied') ||
        value.includes('paid') ||
        !value ||
        value === '—'
    ) {
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    return 'bg-slate-50 text-slate-600 border-slate-200';
}

function displayStatus(status) {
    const value = String(status || '').toLowerCase();
    if (value.includes('partial')) return 'PARTIAL';
    if (value.includes('applied') || value.includes('paid') || !value || value === '—') {
        return 'PAID';
    }
    return String(status || 'PAID').toUpperCase();
}

function compactAmount(amount, currencyCode = 'AED') {
    const raw = String(amount || '').trim();
    if (!raw || raw === '—') {
        const code = String(currencyCode || 'AED').trim() || 'AED';
        return `${code}0.00`;
    }
    return raw.replace(/^([A-Z]{3})\s+/, '$1');
}

function PurchasesPaymentsMadeContent() {
    const [mounted, setMounted] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortKey, setSortKey] = useState('date');
    const [sortDirection, setSortDirection] = useState('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const {
        options: zohoOrgOptions,
        organizationId,
        setOrganizationId,
        active: activeZohoOrg,
        loading: loadingOrgs,
    } = useZohoOrganizations();
    const { connectZoho } = useZohoVendors({
        enabled: false,
        organizationId,
    });
    const router = useRouter();
    const searchParams = useSearchParams();
    const {
        rows,
        totalCount,
        loading,
        loadingMore,
        error,
        setError,
        syncedCount,
        load: loadPayments,
    } = useZohoChunkedList({
        endpoint: '/zoho/vendorpayments',
        mapRows: mapZohoVendorPaymentListRows,
        getRowId: (row) => String(row?.id || ''),
        organizationId,
    });

    const selectedPaymentId = String(searchParams?.get('paymentId') || '').trim();
    const detailOpen = Boolean(selectedPaymentId);
    const organizationIdFromUrl = String(searchParams?.get('organizationId') || '').trim();

    useEffect(() => {
        if (!organizationIdFromUrl || organizationIdFromUrl === organizationId) return;
        setOrganizationId(organizationIdFromUrl);
    }, [organizationId, organizationIdFromUrl, setOrganizationId]);

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
                    'Failed to start Zoho authorization. Check Zoho settings in the backend .env, then restart the server.',
            );
        }
    }, [connectZoho, setError]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, sortKey, sortDirection, pageSize, organizationId]);

    useEffect(() => {
        if (!mounted || !organizationId) return;
        void loadPayments({
            page: currentPage,
            pageSize,
            search: debouncedSearch,
            sortBy: sortKey,
            sortDir: sortDirection,
        });
    }, [
        mounted,
        organizationId,
        currentPage,
        pageSize,
        debouncedSearch,
        sortKey,
        sortDirection,
        loadPayments,
    ]);

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortKey(key);
        setSortDirection(key === 'date' ? 'desc' : 'asc');
    };

    const selectPayment = useCallback(
        (paymentId) => {
            const id = String(paymentId || '').trim();
            if (!id) return;
            const params = new URLSearchParams(searchParams?.toString() || '');
            params.set('paymentId', id);
            router.push(`/Accounts/PaymentsMade?${params.toString()}`, { scroll: false });
        },
        [router, searchParams],
    );

    const closeDetail = useCallback(() => {
        router.push('/Accounts/PaymentsMade', { scroll: false });
    }, [router]);

    const selectedPreview = useMemo(
        () => rows.find((row) => String(row.id) === selectedPaymentId) || null,
        [rows, selectedPaymentId],
    );

    if (!mounted) return null;

    return (
        <PermissionGuard moduleId="purchases" redirectTo="/dashboard">
            <div className="flex h-screen max-h-screen w-full max-w-full overflow-hidden bg-[#f4f6f8]">
                <Sidebar />
                <div className="flex min-h-0 min-w-0 flex-1 flex-col w-full max-w-full overflow-hidden">
                    <div className="shrink-0">
                        <Navbar />
                    </div>

                    {detailOpen ? (
                        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
                            {error ? (
                                <div className="shrink-0 px-3 sm:px-5 pt-3">
                                    <ErpErrorBanner message={error} />
                                </div>
                            ) : null}

                            <div className="flex min-h-0 flex-1 overflow-hidden border-t border-slate-200 bg-white">
                                <aside className="hidden min-h-0 w-[340px] shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white xl:w-[380px] lg:flex">
                                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
                                        <div className="min-w-0">
                                            <h1 className="text-sm font-bold text-slate-800">
                                                All Payments
                                            </h1>
                                            <p className="truncate text-[11px] text-slate-400">
                                                {totalCount} record
                                                {totalCount === 1 ? '' : 's'}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={closeDetail}
                                            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                                        >
                                            Full list
                                        </button>
                                    </div>

                                    <div className="shrink-0 border-b border-slate-100 px-3 py-2">
                                        <div className="relative">
                                            <Search
                                                size={14}
                                                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                                            />
                                            <input
                                                type="text"
                                                value={search}
                                                onChange={(event) => setSearch(event.target.value)}
                                                placeholder="Search payments"
                                                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                            />
                                        </div>
                                    </div>

                                    <div className="min-h-0 flex-1 overflow-y-scroll overscroll-contain">
                                        {rows.map((row) => {
                                            const active = String(row.id) === selectedPaymentId;
                                            return (
                                                <button
                                                    key={row.id}
                                                    type="button"
                                                    onClick={() => selectPayment(row.id)}
                                                    className={`flex w-full items-start gap-2.5 border-b border-slate-100 px-3 py-3 text-left transition-colors ${
                                                        active
                                                            ? 'bg-[#eef3f8]'
                                                            : 'bg-white hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className="truncate text-sm font-semibold text-slate-900">
                                                                {row.vendorName || '—'}
                                                            </p>
                                                            <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-800">
                                                                {compactAmount(
                                                                    row.amount,
                                                                    row.currencyCode,
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div className="mt-0.5 flex items-center justify-between gap-2">
                                                            <p className="truncate text-[11px] text-slate-500">
                                                                {row.date}
                                                                {row.mode && row.mode !== '—'
                                                                    ? ` • ${row.mode}`
                                                                    : ''}
                                                            </p>
                                                            <span
                                                                className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${statusBadgeClass(row.status)}`}
                                                            >
                                                                {displayStatus(row.status)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </aside>

                                <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                                    <ViewVendorPaymentDetail
                                        key={`${organizationId}:${selectedPaymentId}`}
                                        paymentId={selectedPaymentId}
                                        organizationId={organizationId}
                                        variant="panel"
                                        listPreview={selectedPreview}
                                        onClose={closeDetail}
                                    />
                                </section>
                            </div>
                        </main>
                    ) : (
                        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5 lg:p-8 w-full max-w-full">
                            <ErpPageHeader
                                title="Payments Made"
                                subtitle={
                                    activeZohoOrg?.brand
                                        ? `${activeZohoOrg.brand} Zoho — Refresh makes ERP match Zoho (batches of 400)`
                                        : 'Matches Zoho after Refresh — add/update/delete in Zoho, then Refresh (batches of 400)'
                                }
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    {zohoOrgOptions.length > 1 ? (
                                        <ZohoOrganizationPicker
                                            options={zohoOrgOptions}
                                            value={organizationId}
                                            onChange={setOrganizationId}
                                            loading={loadingOrgs}
                                            size="sm"
                                        />
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const qs = organizationId
                                                ? `?organizationId=${encodeURIComponent(organizationId)}`
                                                : '';
                                            router.push(`/Accounts/PaymentsMade/new${qs}`);
                                        }}
                                        className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-blue-600 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
                                    >
                                        <Plus size={16} />
                                        New
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void loadPayments({
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
                                        <RefreshCw
                                            size={16}
                                            className={
                                                loading || loadingMore ? 'animate-spin' : ''
                                            }
                                        />
                                        Refresh
                                    </button>
                                </div>
                            </ErpPageHeader>

                            {error ? (
                                <div className="mb-3 sm:mb-4">
                                    <ErpErrorBanner message={error} />
                                    {/not connected|re-authorize|not configured|not authorized|authorization|oauth/i.test(
                                        error,
                                    ) ? (
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

                            <div className="overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200 px-3 sm:px-4 py-2.5 sm:py-3 bg-[#f8fafc]">
                                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                                        <button
                                            type="button"
                                            className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"
                                            aria-label="Filters"
                                        >
                                            <SlidersHorizontal size={16} />
                                        </button>
                                        <span className="text-xs sm:text-sm font-medium text-slate-600">
                                            All Payments
                                        </span>
                                        <span className="text-xs sm:text-sm text-slate-400">
                                            {totalCount} record
                                            {totalCount === 1 ? '' : 's'}
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
                                            onChange={(event) => setSearch(event.target.value)}
                                            placeholder="Search payments"
                                            className="h-9 sm:h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
                                        />
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="min-w-[1050px] w-full border-collapse text-xs sm:text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-[#f8fafc] text-left">
                                                <th className="w-12 px-3 sm:px-4 py-2 sm:py-3">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded border-slate-300"
                                                        aria-label="Select all payments made"
                                                        disabled
                                                    />
                                                </th>
                                                {COLUMNS.map((column) => (
                                                    <th
                                                        key={column.key}
                                                        className={`px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-[11px] font-bold tracking-[0.08em] text-slate-500 whitespace-nowrap ${
                                                            column.align === 'right'
                                                                ? 'text-right'
                                                                : ''
                                                        }`}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSort(column.key)}
                                                            className={`inline-flex items-center gap-1 hover:text-slate-700 ${
                                                                column.align === 'right'
                                                                    ? 'ml-auto'
                                                                    : ''
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
                                                    <td
                                                        colSpan={COLUMNS.length + 1}
                                                        className="px-3 sm:px-4 py-10 sm:py-16 text-center text-slate-500"
                                                    >
                                                        <div className="inline-flex items-center gap-2">
                                                            <Loader2
                                                                size={18}
                                                                className="animate-spin"
                                                            />
                                                            Loading payments…
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : null}

                                            {!loading && !rows.length ? (
                                                <tr>
                                                    <td
                                                        colSpan={COLUMNS.length + 1}
                                                        className="px-3 sm:px-4 py-10 sm:py-16 text-center text-slate-500"
                                                    >
                                                        {/not connected|re-authorize|not configured|not authorized/i.test(
                                                            error,
                                                        )
                                                            ? 'Connect Zoho Books to load payments made.'
                                                            : 'No payments made found in Zoho Books.'}
                                                    </td>
                                                </tr>
                                            ) : null}

                                            {!loading
                                                ? rows.map((row) => (
                                                      <tr
                                                          key={row.id}
                                                          role="button"
                                                          tabIndex={0}
                                                          onClick={() => selectPayment(row.id)}
                                                          onKeyDown={(event) => {
                                                              if (
                                                                  event.key === 'Enter' ||
                                                                  event.key === ' '
                                                              ) {
                                                                  event.preventDefault();
                                                                  selectPayment(row.id);
                                                              }
                                                          }}
                                                          className="cursor-pointer border-b border-slate-100 hover:bg-slate-50/80"
                                                      >
                                                          <td
                                                              className="px-3 sm:px-4 py-2 sm:py-3"
                                                              onClick={(event) =>
                                                                  event.stopPropagation()
                                                              }
                                                              onKeyDown={(event) =>
                                                                  event.stopPropagation()
                                                              }
                                                          >
                                                              <input
                                                                  type="checkbox"
                                                                  className="h-4 w-4 rounded border-slate-300"
                                                                  aria-label={`Select payment ${row.paymentNumber}`}
                                                              />
                                                          </td>
                                                          <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-slate-700">
                                                              {row.date}
                                                          </td>
                                                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-slate-700">
                                                              {row.location}
                                                          </td>
                                                          <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap font-medium text-slate-800">
                                                              {row.paymentNumber}
                                                          </td>
                                                          <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-slate-700">
                                                              {row.referenceNumber}
                                                          </td>
                                                          <td className="px-3 sm:px-4 py-2 sm:py-3 font-medium text-slate-800">
                                                              {row.vendorName}
                                                          </td>
                                                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-slate-700">
                                                              {row.billNumber}
                                                          </td>
                                                          <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-slate-700">
                                                              {row.mode}
                                                          </td>
                                                          <td className="px-3 sm:px-4 py-2 sm:py-3">
                                                              <span
                                                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${statusBadgeClass(row.status)}`}
                                                              >
                                                                  {displayStatus(row.status)}
                                                              </span>
                                                          </td>
                                                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-right tabular-nums whitespace-nowrap text-slate-700">
                                                              {row.amount}
                                                          </td>
                                                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-right tabular-nums whitespace-nowrap text-slate-700">
                                                              {row.unusedAmount}
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
                                        itemLabel="payments"
                                    />
                                ) : null}
                            </div>
                        </main>
                    )}
                </div>
            </div>
        </PermissionGuard>
    );
}

export default function PurchasesPaymentsMadePage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center">Loading...</div>
            }
        >
            <PurchasesPaymentsMadeContent />
        </Suspense>
    );
}
