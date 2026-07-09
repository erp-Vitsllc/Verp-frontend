'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Loader2, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import ErpPageHeader from '@/components/ErpPageHeader';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import axiosInstance from '@/utils/axios';
import { mapZohoCustomerListRows } from '@/utils/zohoCustomers';
import { useZohoCustomers } from '@/hooks/useZohoCustomers';

const COLUMNS = [
    { key: 'name', label: 'NAME' },
    { key: 'companyName', label: 'COMPANY NAME' },
    { key: 'email', label: 'EMAIL' },
    { key: 'workPhone', label: 'WORK PHONE' },
    { key: 'receivables', label: 'RECEIVABLES', align: 'right' },
];

function compareRows(a, b, sortKey, direction) {
    const left =
        sortKey === 'receivables' ? a.receivablesAmount : String(a[sortKey] || '').toLowerCase();
    const right =
        sortKey === 'receivables' ? b.receivablesAmount : String(b[sortKey] || '').toLowerCase();

    if (typeof left === 'number' && typeof right === 'number') {
        return direction === 'asc' ? left - right : right - left;
    }

    const result = String(left).localeCompare(String(right));
    return direction === 'asc' ? result : -result;
}

export default function CrmCustomersPage() {
    const [mounted, setMounted] = useState(false);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState('name');
    const [sortDirection, setSortDirection] = useState('asc');
    const [syncing, setSyncing] = useState(false);
    const { connectZoho } = useZohoCustomers({ enabled: false });

    useEffect(() => {
        setMounted(true);
    }, []);

    const loadCustomers = useCallback(async ({ sync = false } = {}) => {
        setLoading(true);
        setSyncing(sync);
        setError('');
        try {
            const response = await axiosInstance.get('/zoho/customers', {
                skipToast: true,
                timeout: sync ? 120000 : 30000,
                params: sync ? { sync: 'true' } : undefined,
            });
            setRows(mapZohoCustomerListRows(response?.data?.data));
        } catch (err) {
            const isNetworkError = !err?.response && Boolean(err?.request);
            const message = isNetworkError
                ? 'Cannot reach the API server. Restart the backend on port 5000 and try again.'
                : err?.response?.data?.message ||
                  err?.message ||
                  'Failed to load customers from Zoho Books';
            setRows([]);
            setError(message);
        } finally {
            setLoading(false);
            setSyncing(false);
        }
    }, []);

    useEffect(() => {
        if (!mounted) return;
        void loadCustomers();
    }, [mounted, loadCustomers]);

    const filteredRows = useMemo(() => {
        const query = search.trim().toLowerCase();
        const next = query
            ? rows.filter((row) =>
                  [row.name, row.companyName, row.email, row.workPhone, row.receivables]
                      .join(' ')
                      .toLowerCase()
                      .includes(query),
              )
            : rows;

        return [...next].sort((a, b) => compareRows(a, b, sortKey, sortDirection));
    }, [rows, search, sortKey, sortDirection]);

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
        <PermissionGuard moduleId="crm" redirectTo="/dashboard">
            <div className="flex min-h-screen bg-[#f4f6f8]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />
                    <main className="flex-1 p-6 overflow-auto">
                        <ErpPageHeader
                            title="Customers"
                            subtitle="Customer list from local database (sync from Zoho on Refresh)"
                            showBack={false}
                        >
                            <button
                                type="button"
                                onClick={() => void loadCustomers({ sync: true })}
                                disabled={loading}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                                Refresh
                            </button>
                        </ErpPageHeader>

                        {error ? (
                            <div className="mb-4">
                                <ErpErrorBanner message={error} />
                                {/not connected|re-authorize|not configured/i.test(error) ? (
                                    <button
                                        type="button"
                                        onClick={() => void connectZoho()}
                                        className="mt-3 text-sm font-semibold text-teal-700 underline"
                                    >
                                        Connect Zoho Books
                                    </button>
                                ) : null}
                            </div>
                        ) : null}

                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 bg-[#f8fafc]">
                                <div className="flex items-center gap-3 min-w-0">
                                    <button
                                        type="button"
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"
                                        aria-label="Filters"
                                    >
                                        <SlidersHorizontal size={16} />
                                    </button>
                                    <span className="text-sm font-medium text-slate-600">
                                        {filteredRows.length} customer{filteredRows.length === 1 ? '' : 's'}
                                    </span>
                                </div>
                                <div className="relative w-full max-w-xs">
                                    <Search
                                        size={16}
                                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search customers"
                                        className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-[#f8fafc] text-left">
                                            <th className="w-12 px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-slate-300"
                                                    aria-label="Select all customers"
                                                    disabled
                                                />
                                            </th>
                                            {COLUMNS.map((column) => (
                                                <th
                                                    key={column.key}
                                                    className={`px-4 py-3 text-[11px] font-bold tracking-[0.08em] text-slate-500 ${
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
                                                <td
                                                    colSpan={COLUMNS.length + 1}
                                                    className="px-4 py-16 text-center text-slate-500"
                                                >
                                                    <div className="inline-flex items-center gap-2">
                                                        <Loader2 size={18} className="animate-spin" />
                                                        {syncing
                                                            ? 'Syncing customers from Zoho Books...'
                                                            : 'Loading customers...'}
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : null}

                                        {!loading && !filteredRows.length ? (
                                            <tr>
                                                <td
                                                    colSpan={COLUMNS.length + 1}
                                                    className="px-4 py-16 text-center text-slate-500"
                                                >
                                                    {/not connected|re-authorize|not configured/i.test(error)
                                                        ? 'Connect Zoho Books to load customers.'
                                                        : 'No customers in local database. Click Refresh to sync from Zoho Books.'}
                                                </td>
                                            </tr>
                                        ) : null}

                                        {!loading
                                            ? filteredRows.map((row) => (
                                                  <tr
                                                      key={row.id || row.name}
                                                      className="border-b border-slate-100 hover:bg-slate-50/80"
                                                  >
                                                      <td className="px-4 py-3">
                                                          <input
                                                              type="checkbox"
                                                              className="h-4 w-4 rounded border-slate-300"
                                                              aria-label={`Select ${row.name}`}
                                                          />
                                                      </td>
                                                      <td className="px-4 py-3 text-sm font-medium text-slate-800">
                                                          {row.name}
                                                      </td>
                                                      <td className="px-4 py-3 text-sm text-slate-700">
                                                          {row.companyName}
                                                      </td>
                                                      <td className="px-4 py-3 text-sm text-slate-700">
                                                          {row.email}
                                                      </td>
                                                      <td className="px-4 py-3 text-sm text-slate-700">
                                                          {row.workPhone}
                                                      </td>
                                                      <td className="px-4 py-3 text-sm text-slate-700 text-right tabular-nums">
                                                          {row.receivables}
                                                      </td>
                                                  </tr>
                                              ))
                                            : null}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </PermissionGuard>
    );
}
