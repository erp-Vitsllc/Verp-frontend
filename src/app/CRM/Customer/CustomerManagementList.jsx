'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronLeft, ChevronRight, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import ListTableRowLink from '@/components/ListTableRowLink';
import { SortHeading, sortRowsByColumn, useColumnSort } from '@/components/ListColumnSort';
import { usePersistListReturnState } from '@/hooks/usePersistListReturnState';
import { buildListReturnHref } from '@/utils/listReturnNavigation';
import PageSizeSelect from '@/app/inventory/PageSizeSelect';
import { pageLimit, pageSizeParam, pageWindow } from '@/app/inventory/listPageSize';
import AddCustomerModal from './AddCustomerModal';
import { useCrmAccess } from './crmAccess';
import { customerApiMessage, deleteCustomer, isSavedCustomer, listCustomers } from './customerApi';

const EMPTY_FILTERS = { products: [], brands: [], paymentTerms: [] };

function textParam(params, key) {
    return String(params.get(key) || '');
}

function pageParam(params) {
    const value = Number(params.get('page'));
    return Number.isInteger(value) && value > 0 ? value : 1;
}

function customerListHref({ search, product, brand, paymentTerms, page, pageSize }) {
    return buildListReturnHref('/CRM/Customer', {
        search,
        product,
        brand,
        terms: paymentTerms,
        page: page > 1 ? page : '',
        size: pageSize && pageSize !== '10' ? pageSize : '',
    });
}

const fieldClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500';

function FilterSelect({ label, value, options, onChange }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const rootRef = useRef(null);
    const needle = query.trim().toLowerCase();
    const filtered = useMemo(() => {
        if (!needle) return options;
        return options.filter((option) => option.toLowerCase().includes(needle));
    }, [needle, options]);
    const showAll = !needle || 'all'.includes(needle);

    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) {
                setOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [open]);

    function close() {
        setOpen(false);
        setQuery('');
    }

    function choose(next) {
        onChange(next);
        close();
    }

    return (
        <div ref={rootRef} className="relative min-w-0">
            <span className="mb-1.5 block whitespace-nowrap text-sm font-medium text-slate-700">{label}</span>
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={label}
                onClick={() => {
                    if (open) close();
                    else setOpen(true);
                }}
                className={`${fieldClass} flex items-center justify-between gap-2 text-left`}
            >
                <span className="min-w-0 truncate">{value || 'All'}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
            </button>
            {open ? (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 p-2">
                        <label className="relative block">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                            <input
                                autoFocus
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={`Search ${label.toLowerCase()}`}
                                aria-label={`Search ${label}`}
                                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-800 outline-none focus:border-blue-500"
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                        event.preventDefault();
                                        close();
                                    }
                                }}
                            />
                        </label>
                    </div>
                    <ul role="listbox" aria-label={label} className="max-h-60 overflow-y-auto py-1">
                        {showAll ? (
                            <li>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={!value}
                                    onClick={() => choose('')}
                                    className={`block w-full truncate px-3 py-2 text-left text-sm ${!value ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                                >
                                    All
                                </button>
                            </li>
                        ) : null}
                        {filtered.length === 0 && !showAll ? (
                            <li className="px-3 py-2 text-sm text-slate-500">No matches.</li>
                        ) : filtered.map((option) => (
                            <li key={option}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={option === value}
                                    onClick={() => choose(option)}
                                    className={`block w-full truncate px-3 py-2 text-left text-sm ${option === value ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                                >
                                    {option}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
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

function money(amount, currency) {
    if (amount == null || amount === '' || Number.isNaN(Number(amount))) return 'N/A';
    const code = String(currency || 'AED').trim() || 'AED';
    try {
        return new Intl.NumberFormat('en-AE', {
            style: 'currency',
            currency: code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(Number(amount));
    } catch {
        return `${code} ${Number(amount).toFixed(2)}`;
    }
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

function customerSortValue(customer, key) {
    if (key === 'code') return customer.code || '';
    if (key === 'name') return customer.name || '';
    if (key === 'location') return customer.location || '';
    if (key === 'contact') return customer.contact || '';
    if (key === 'brands') return (customer.listBrands || []).join(', ');
    if (key === 'products') return customer.products == null ? '' : Number(customer.products) || 0;
    if (key === 'outstanding') return Number(customer.outstandingPayment) || 0;
    if (key === 'status') return customer.status || '';
    return '';
}

const CUSTOMER_COLUMNS = [
    { label: 'Customer Code', key: 'code' },
    { label: 'Customer Name', key: 'name' },
    { label: 'Location', key: 'location' },
    { label: 'Primary Contact', key: 'contact' },
    { label: 'Brands', key: 'brands' },
    { label: 'Products', key: 'products', align: 'right' },
    { label: 'Outstanding Receivables', key: 'outstanding', align: 'right' },
    { label: 'Status', key: 'status' },
];

function csvCell(value) {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
}

export default function CustomerManagementList() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const searchKey = searchParams.toString();
    const appliedSearchKey = useRef(searchKey);
    const access = useCrmAccess();
    const columnSort = useColumnSort();
    const [editor, setEditor] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [query, setQuery] = useState(() => textParam(searchParams, 'search'));
    const [debouncedQuery, setDebouncedQuery] = useState(() => textParam(searchParams, 'search').trim());
    const [product, setProduct] = useState(() => textParam(searchParams, 'product'));
    const [brand, setBrand] = useState(() => textParam(searchParams, 'brand'));
    const [paymentTerms, setPaymentTerms] = useState(() => textParam(searchParams, 'terms'));
    const [page, setPage] = useState(() => pageParam(searchParams));
    const [pageSize, setPageSize] = useState(() => pageSizeParam(searchParams));
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState('');
    const [openCells, setOpenCells] = useState(() => new Set());
    const showActions = access.canEdit || access.canDelete;
    const columnCount = showActions ? 9 : 8;

    const listHref = useMemo(() => customerListHref({
        search: query.trim(),
        product,
        brand,
        paymentTerms,
        page,
        pageSize,
    }), [brand, page, pageSize, paymentTerms, product, query]);

    usePersistListReturnState({
        search: query.trim(),
        product,
        brand,
        terms: paymentTerms,
        page: page > 1 ? page : '',
        size: pageSize !== '10' ? pageSize : '',
    });

    useEffect(() => {
        if (appliedSearchKey.current === searchKey) return;
        appliedSearchKey.current = searchKey;
        const nextQuery = textParam(searchParams, 'search');
        setQuery(nextQuery);
        setDebouncedQuery(nextQuery.trim());
        setProduct(textParam(searchParams, 'product'));
        setBrand(textParam(searchParams, 'brand'));
        setPaymentTerms(textParam(searchParams, 'terms'));
        setPage(pageParam(searchParams));
        setPageSize(pageSizeParam(searchParams));
    }, [searchKey, searchParams]);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        listCustomers({
            page,
            limit: pageLimit(pageSize),
            search: debouncedQuery,
            product,
            brand,
            paymentTerms,
            sort: columnSort.sortKey,
            dir: columnSort.sortDir,
        })
            .then((data) => {
                if (cancelled) return;
                const added = (Array.isArray(data?.customers) ? data.customers : []).filter((row) => row.saved !== false);
                setRows(added);
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
                setError(customerApiMessage(loadError, 'Could not load customers.'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [brand, debouncedQuery, page, pageSize, paymentTerms, product, reloadKey, columnSort.sortKey, columnSort.sortDir]);

    const { pageCount, currentPage, from, to } = pageWindow(total, page, pageSize);

    useEffect(() => {
        if (loading || page <= pageCount) return;
        setPage(pageCount);
    }, [loading, page, pageCount]);

    const sortedRows = useMemo(
        () => sortRowsByColumn(rows, columnSort.sortKey, columnSort.sortDir, customerSortValue),
        [rows, columnSort.sortKey, columnSort.sortDir],
    );
    const emptyLabel = query || product || brand || paymentTerms
        ? 'No customers match this search.'
        : 'No customers yet.';

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

    function changePageSize(next) {
        setPageSize(next);
        setPage(1);
    }

    async function removeCustomer(event, customer) {
        event.stopPropagation();
        const label = [customer.code, customer.name].filter(Boolean).join(' ');
        if (!window.confirm(`Delete ${label}?`)) return;
        setDeletingId(customer.id);
        setError('');
        try {
            await deleteCustomer(customer.id);
            if (rows.length === 1 && page > 1) setPage(page - 1);
            setReloadKey((value) => value + 1);
        } catch (deleteError) {
            setError(customerApiMessage(deleteError, 'Could not delete this customer.'));
        } finally {
            setDeletingId('');
        }
    }

    function exportRows() {
        const header = ['Customer Code', 'Customer Name', 'Location', 'Primary Contact', 'Brands', 'Products', 'Outstanding Receivables', 'Status'];
        const lines = rows.map((customer) => [
            customer.code,
            customer.name,
            customer.location,
            customer.contact,
            (customer.listBrands || []).join(', '),
            customer.products == null ? '' : customer.products,
            money(customer.outstandingPayment, customer.currencyCode),
            customer.status,
        ].map(csvCell).join(','));
        const file = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'customers.csv';
        link.click();
        URL.revokeObjectURL(url);
    }

    return (
        <section className="rounded-2xl border border-[#E6EDF5] bg-white p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-slate-900">Customer</h1>
                <div className="flex flex-wrap items-center gap-2">
                    {access.ready && !access.canCreate ? null : (
                        <button
                            type="button"
                            onClick={() => setEditor({ customer: null })}
                            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4" />
                            Add Customer
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

            <div className="relative z-30 mt-5 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="relative block min-w-0">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setPage(1);
                        }}
                        placeholder="Search customer, product, brand..."
                        className={`${fieldClass} pl-9`}
                    />
                </label>
                <FilterSelect label="Products" value={product} options={filters.products} onChange={changeFilter(setProduct)} />
                <FilterSelect label="Brand" value={brand} options={filters.brands} onChange={changeFilter(setBrand)} />
                <FilterSelect label="Payment Terms" value={paymentTerms} options={filters.paymentTerms} onChange={changeFilter(setPaymentTerms)} />
            </div>

            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

            <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-[13px] font-normal text-slate-600">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                            {[
                                ...CUSTOMER_COLUMNS,
                                ...(showActions ? [{ label: 'Action', key: '' }] : []),
                            ].map((column) => (
                                <SortHeading
                                    key={column.label}
                                    label={column.label}
                                    columnKey={column.key}
                                    sortKey={columnSort.sortKey}
                                    sortDir={columnSort.sortDir}
                                    onSort={(key) => {
                                        columnSort.onSort(key);
                                        setPage(1);
                                    }}
                                    className={`whitespace-nowrap px-4 py-3 font-medium ${column.align === 'right' ? 'text-right' : ''}`}
                                    align={column.align === 'right' ? 'right' : 'left'}
                                />
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={columnCount} className="px-4 py-10 text-center text-slate-500">Loading customers...</td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={columnCount} className="px-4 py-10 text-center text-slate-500">{emptyLabel}</td>
                            </tr>
                        ) : sortedRows.map((customer) => (
                            <ListTableRowLink
                                key={customer.id || customer.code}
                                href={customer.id ? `/CRM/Customer/${customer.id}` : ''}
                                router={router}
                                listReturnHref={listHref}
                                enabled={Boolean(customer.id)}
                            >
                                <tr className="cursor-pointer border-b border-slate-100 text-slate-700 hover:bg-slate-50">
                                    <td className="whitespace-nowrap px-4 py-3.5">{customer.code || 'N/A'}</td>
                                    <td className="whitespace-nowrap px-4 py-3.5">{customer.name}</td>
                                    <td className="whitespace-nowrap px-4 py-3.5">{displayValue(customer.location)}</td>
                                    <td className="whitespace-nowrap px-4 py-3.5">{displayValue(customer.contact)}</td>
                                    <MoreListCell
                                        values={customer.listBrands}
                                        open={openCells.has(`${customer.id}:brands`)}
                                        onToggle={() => toggleCell(`${customer.id}:brands`)}
                                        label="brands"
                                    />
                                    <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums">{customer.products == null ? 'N/A' : customer.products}</td>
                                    <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums">{money(customer.outstandingPayment, customer.currencyCode)}</td>
                                    <td className="whitespace-nowrap px-4 py-3.5">
                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(customer.status)}`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${statusDot(customer.status)}`} />
                                            {customer.status}
                                        </span>
                                    </td>
                                    {showActions ? (
                                        <td className="whitespace-nowrap px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
                                            <div className="flex items-center gap-2">
                                                {access.canEdit ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditor({ customer })}
                                                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                                        aria-label={`Edit ${customer.name || 'customer'}`}
                                                    >
                                                        <Pencil size={13} /> Edit
                                                    </button>
                                                ) : null}
                                                {access.canDelete && isSavedCustomer(customer) ? (
                                                    <button
                                                        type="button"
                                                        disabled={deletingId === customer.id}
                                                        onClick={(event) => removeCustomer(event, customer)}
                                                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                                                        aria-label={`Delete ${customer.name || 'customer'}`}
                                                    >
                                                        <Trash2 size={13} />
                                                        {deletingId === customer.id ? 'Deleting...' : 'Delete'}
                                                    </button>
                                                ) : null}
                                            </div>
                                        </td>
                                    ) : null}
                                </tr>
                            </ListTableRowLink>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                <p>Showing {from} to {to} of {total} items</p>
                <div className="flex flex-wrap items-center gap-3">
                    <PageSizeSelect value={pageSize} onChange={changePageSize} disabled={loading} />
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
            </div>
            {editor ? (
                <AddCustomerModal
                    customer={editor.customer}
                    onClose={() => setEditor(null)}
                    onSaved={() => {
                        const created = !editor.customer;
                        setEditor(null);
                        if (created) setPage(1);
                        setReloadKey((value) => value + 1);
                    }}
                />
            ) : null}
        </section>
    );
}
