'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Download, Plus, Search } from 'lucide-react';
import { useInventoryAccess } from '../item-master/itemMasterAccess';
import AddVendorModal from './AddVendorModal';
import { listVendors, vendorApiMessage } from './vendorManagementApi';

const PAGE_SIZE = 6;
const EMPTY_FILTERS = { vendorTypes: [], brands: [], paymentTerms: [], statuses: [] };

const fieldClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500';

function FilterSelect({ label, value, options, onChange }) {
    return (
        <label className="block min-w-0">
            <span className="mb-1.5 block whitespace-nowrap text-sm font-medium text-slate-700">{label}</span>
            <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>
                <option value="">All</option>
                {options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
        </label>
    );
}

function statusClass(status) {
    if (status === 'Active') return 'bg-emerald-50 text-emerald-600';
    return 'bg-slate-100 text-slate-600';
}

function statusDot(status) {
    if (status === 'Active') return 'bg-emerald-500';
    return 'bg-slate-400';
}

function displayValue(value) {
    if (value == null || value === '') return 'N/A';
    return value;
}

function csvCell(value) {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
}

export default function VendorManagementList() {
    const router = useRouter();
    const access = useInventoryAccess();
    const [adding, setAdding] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [vendorType, setVendorType] = useState('');
    const [brand, setBrand] = useState('');
    const [paymentTerms, setPaymentTerms] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        listVendors({
            page,
            limit: PAGE_SIZE,
            search: debouncedQuery,
            vendorType,
            brand,
            paymentTerms,
            status,
        })
            .then((data) => {
                if (cancelled) return;
                setRows(Array.isArray(data?.vendors) ? data.vendors : []);
                setTotal(Number(data?.total) || 0);
                setFilters({
                    vendorTypes: data?.filters?.vendorTypes || [],
                    brands: data?.filters?.brands || [],
                    paymentTerms: data?.filters?.paymentTerms || [],
                    statuses: data?.filters?.statuses || [],
                });
            })
            .catch((loadError) => {
                if (cancelled) return;
                setRows([]);
                setTotal(0);
                setError(vendorApiMessage(loadError, 'Could not load vendors.'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [brand, debouncedQuery, page, paymentTerms, reloadKey, status, vendorType]);

    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const currentPage = Math.min(page, pageCount);
    const from = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const to = (currentPage - 1) * PAGE_SIZE + rows.length;
    const emptyLabel = query || vendorType || brand || paymentTerms || status
        ? 'No vendors match this search.'
        : 'No vendors yet.';

    function changeFilter(setter) {
        return (value) => {
            setter(value);
            setPage(1);
        };
    }

    function exportRows() {
        const header = ['Vendor Code', 'Vendor Name', 'Location', 'Primary Contact', 'Brands', 'Products', 'Status'];
        const lines = rows.map((vendor) => [
            vendor.code,
            vendor.name,
            vendor.location,
            vendor.contact,
            (vendor.brands || []).join(', '),
            vendor.products == null ? 'N/A' : vendor.products,
            vendor.status,
        ].map(csvCell).join(','));
        const file = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'vendors.csv';
        link.click();
        URL.revokeObjectURL(url);
    }

    return (
        <section className="rounded-2xl border border-[#E6EDF5] bg-white p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-slate-900">Vendor Management</h1>
                <div className="flex flex-wrap items-center gap-2">
                    {access.ready && !access.canCreateVendor ? null : (
                        <button
                            type="button"
                            onClick={() => setAdding(true)}
                            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4" />
                            Add Vendor
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={exportRows}
                        disabled={rows.length === 0}
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                        <Download className="h-4 w-4" />
                        Export
                    </button>
                </div>
            </div>

            <div className="mt-5 flex items-end gap-3 overflow-x-auto">
                <label className="relative w-52 shrink-0">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setPage(1);
                        }}
                        placeholder="Search vendor, product, brand, contact person, email..."
                        className={`${fieldClass} pl-9`}
                    />
                </label>
                <div className="grid min-w-0 flex-1 grid-cols-4 gap-3">
                    <FilterSelect label="Vendor Type" value={vendorType} options={filters.vendorTypes} onChange={changeFilter(setVendorType)} />
                    <FilterSelect label="Brand" value={brand} options={filters.brands} onChange={changeFilter(setBrand)} />
                    <FilterSelect label="Payment Terms" value={paymentTerms} options={filters.paymentTerms} onChange={changeFilter(setPaymentTerms)} />
                    <FilterSelect label="Status" value={status} options={filters.statuses} onChange={changeFilter(setStatus)} />
                </div>
            </div>

            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

            <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                            {['Vendor Code', 'Vendor Name', 'Location', 'Primary Contact', 'Brands', 'Products', 'Status'].map((heading) => (
                                <th key={heading} className="whitespace-nowrap px-4 py-3 font-medium">{heading}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">Loading vendors...</td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">{emptyLabel}</td>
                            </tr>
                        ) : rows.map((vendor) => (
                            <tr
                                key={vendor.id || vendor.code}
                                onClick={() => vendor.id && router.push(`/inventory/vendor-management/${vendor.id}`)}
                                className="cursor-pointer border-b border-slate-100 text-slate-700 hover:bg-slate-50"
                            >
                                <td className="whitespace-nowrap px-4 py-3.5">{vendor.code}</td>
                                <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-800">{vendor.name}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{displayValue(vendor.location)}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{displayValue(vendor.contact)}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{vendor.brands?.length ? vendor.brands.join(', ') : 'N/A'}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{vendor.products == null ? 'N/A' : vendor.products}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(vendor.status)}`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${statusDot(vendor.status)}`} />
                                        {vendor.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                <p>Showing {from} to {to} of {total} items</p>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
                        disabled={currentPage <= 1 || loading}
                        onClick={() => setPage(currentPage - 1)}
                        aria-label="Previous page"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-blue-600 px-3 font-semibold text-white">{currentPage}</span>
                    <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
                        disabled={currentPage >= pageCount || loading}
                        onClick={() => setPage(currentPage + 1)}
                        aria-label="Next page"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
            {adding ? (
                <AddVendorModal
                    onClose={() => setAdding(false)}
                    onSaved={() => {
                        setAdding(false);
                        setPage(1);
                        setReloadKey((value) => value + 1);
                    }}
                />
            ) : null}
        </section>
    );
}
