'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { navHrefProps } from '@/utils/linkContextMenu';
import { useInventoryAccess } from '../item-master/itemMasterAccess';
import AddVendorModal from './AddVendorModal';
import { deleteVendor, listVendors, vendorApiMessage } from './vendorManagementApi';

const PAGE_SIZE = 6;
const EMPTY_FILTERS = { products: [], brands: [], paymentTerms: [] };

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

function MoreListCell({ values, open, onToggle, label }) {
    const items = (values || []).map((value) => String(value || '').trim()).filter(Boolean);
    if (!items.length) return <td className="whitespace-nowrap px-4 py-3.5">N/A</td>;
    const preview = items.slice(0, 3).join(', ');
    if (open) {
        return (
            <td className="max-w-xs px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={onToggle} className="whitespace-normal break-words text-left">
                    {items.join(', ')}
                </button>
            </td>
        );
    }
    return (
        <td className="whitespace-nowrap px-4 py-3.5">
            {preview}
            {items.length > 3 ? (
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onToggle();
                    }}
                    className="ml-1 text-blue-700 hover:underline"
                    aria-label={`Show all ${label}`}
                >
                    more...
                </button>
            ) : null}
        </td>
    );
}

function csvCell(value) {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
}

export default function VendorManagementList() {
    const router = useRouter();
    const access = useInventoryAccess();
    const [editor, setEditor] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [product, setProduct] = useState('');
    const [brand, setBrand] = useState('');
    const [paymentTerms, setPaymentTerms] = useState('');
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState('');
    const [openCells, setOpenCells] = useState(() => new Set());
    const showActions = access.canEditVendor || access.canDeleteVendor;
    const columnCount = showActions ? 8 : 7;

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
            product,
            brand,
            paymentTerms,
        })
            .then((data) => {
                if (cancelled) return;
                setRows(Array.isArray(data?.vendors) ? data.vendors : []);
                setTotal(Number(data?.total) || 0);
                setFilters({
                    products: data?.filters?.products || [],
                    brands: data?.filters?.brands || [],
                    paymentTerms: data?.filters?.paymentTerms || [],
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
    }, [brand, debouncedQuery, page, paymentTerms, product, reloadKey]);

    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const currentPage = Math.min(page, pageCount);
    const from = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const to = (currentPage - 1) * PAGE_SIZE + rows.length;
    const emptyLabel = query || product || brand || paymentTerms
        ? 'No vendors match this search.'
        : 'No vendors yet.';

    function toggleCell(key) {
        setOpenCells((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    function changeFilter(setter) {
        return (value) => {
            setter(value);
            setPage(1);
        };
    }

    async function removeVendor(event, vendor) {
        event.stopPropagation();
        const label = [vendor.code, vendor.name].filter(Boolean).join(' ');
        if (!window.confirm(`Delete ${label}?`)) return;
        setDeletingId(vendor.id);
        setError('');
        try {
            await deleteVendor(vendor.id);
            if (rows.length === 1 && page > 1) setPage(page - 1);
            setReloadKey((value) => value + 1);
        } catch (deleteError) {
            setError(vendorApiMessage(deleteError, 'Could not delete this vendor.'));
        } finally {
            setDeletingId('');
        }
    }

    function exportRows() {
        const header = ['Vendor Code', 'Vendor Name', 'Location', 'Primary Contact', 'Brands', 'Products', 'Status'];
        const lines = rows.map((vendor) => [
            vendor.code,
            vendor.name,
            vendor.location,
            vendor.contact,
            (vendor.listBrands || []).join(', '),
            (vendor.listCategories || []).join(', '),
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
                            onClick={() => setEditor({ vendor: null })}
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

            <div className="mt-5 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="relative block min-w-0">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setPage(1);
                        }}
                        placeholder="Search vendor, product, brand..."
                        className={`${fieldClass} pl-9`}
                    />
                </label>
                <FilterSelect label="Products" value={product} options={filters.products} onChange={changeFilter(setProduct)} />
                <FilterSelect label="Brand" value={brand} options={filters.brands} onChange={changeFilter(setBrand)} />
                <FilterSelect label="Payment Terms" value={paymentTerms} options={filters.paymentTerms} onChange={changeFilter(setPaymentTerms)} />
            </div>

            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

            <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                            {[
                                'Vendor Code',
                                'Vendor Name',
                                'Location',
                                'Primary Contact',
                                'Brands',
                                'Products',
                                'Status',
                                ...(showActions ? ['Action'] : []),
                            ].map((heading) => (
                                <th key={heading} className="whitespace-nowrap px-4 py-3 font-medium">{heading}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={columnCount} className="px-4 py-10 text-center text-slate-500">Loading vendors...</td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={columnCount} className="px-4 py-10 text-center text-slate-500">{emptyLabel}</td>
                            </tr>
                        ) : rows.map((vendor) => (
                            <tr
                                key={vendor.id || vendor.code}
                                onClick={() => vendor.id && router.push(`/inventory/vendor-management/${vendor.id}`)}
                                className="cursor-pointer border-b border-slate-100 text-slate-700 hover:bg-slate-50"
                                {...(vendor.id ? navHrefProps(`/inventory/vendor-management/${vendor.id}`) : {})}
                            >
                                <td className="whitespace-nowrap px-4 py-3.5">{vendor.code}</td>
                                <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-800">{vendor.name}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{displayValue(vendor.location)}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{displayValue(vendor.contact)}</td>
                                <MoreListCell
                                    values={vendor.listBrands}
                                    open={openCells.has(`${vendor.id}:brands`)}
                                    onToggle={() => toggleCell(`${vendor.id}:brands`)}
                                    label="brands"
                                />
                                <MoreListCell
                                    values={vendor.listCategories}
                                    open={openCells.has(`${vendor.id}:products`)}
                                    onToggle={() => toggleCell(`${vendor.id}:products`)}
                                    label="products"
                                />
                                <td className="whitespace-nowrap px-4 py-3.5">
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(vendor.status)}`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${statusDot(vendor.status)}`} />
                                        {vendor.status}
                                    </span>
                                </td>
                                {showActions ? (
                                    <td className="whitespace-nowrap px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
                                        <div className="flex items-center gap-2">
                                            {access.canEditVendor ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditor({ vendor })}
                                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                                    aria-label={`Edit ${vendor.name || 'vendor'}`}
                                                >
                                                    <Pencil size={13} /> Edit
                                                </button>
                                            ) : null}
                                            {access.canDeleteVendor ? (
                                                <button
                                                    type="button"
                                                    disabled={deletingId === vendor.id}
                                                    onClick={(event) => removeVendor(event, vendor)}
                                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                                                    aria-label={`Delete ${vendor.name || 'vendor'}`}
                                                >
                                                    <Trash2 size={13} />
                                                    {deletingId === vendor.id ? 'Deleting...' : 'Delete'}
                                                </button>
                                            ) : null}
                                        </div>
                                    </td>
                                ) : null}
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
            {editor ? (
                <AddVendorModal
                    vendor={editor.vendor}
                    onClose={() => setEditor(null)}
                    onSaved={() => {
                        const created = !editor.vendor;
                        setEditor(null);
                        if (created) setPage(1);
                        setReloadKey((value) => value + 1);
                    }}
                />
            ) : null}
        </section>
    );
}
