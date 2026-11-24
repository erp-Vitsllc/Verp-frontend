'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronLeft, ChevronRight, Download, MoreVertical, Plus, Search } from 'lucide-react';
import ListTableRowLink from '@/components/ListTableRowLink';
import { usePersistListReturnState } from '@/hooks/usePersistListReturnState';
import { buildListReturnHref, navigateFromList } from '@/utils/listReturnNavigation';
import PageSizeSelect from '../PageSizeSelect';
import { pageLimit, pageSizeParam, pageWindow } from '../listPageSize';
import { useInventoryAccess } from '../item-master/itemMasterAccess';
import AddVendorModal from './AddVendorModal';
import { deleteVendor, listVendors, vendorApiMessage } from './vendorManagementApi';

const EMPTY_FILTERS = { products: [], brands: [], paymentTerms: [] };

function textParam(params, key) {
    return String(params.get(key) || '');
}

function pageParam(params) {
    const value = Number(params.get('page'));
    return Number.isInteger(value) && value > 0 ? value : 1;
}

function vendorListHref({ search, product, brand, paymentTerms, page, pageSize }) {
    return buildListReturnHref('/inventory/vendor-management', {
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

    function onSearchKeyDown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
            return;
        }
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (!needle || (showAll && filtered.length === 0)) {
            choose('');
            return;
        }
        if (filtered.length === 1) choose(filtered[0]);
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
                                onKeyDown={onSearchKeyDown}
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

const NUMBER_HEADINGS = new Set(['Vendor Outstanding', 'Pending Bills', 'Open LPO']);
const NAME_LIMIT = 15;
const LIST_LIMIT = 2;
const cellClass = 'px-2 py-2.5 align-top break-words [overflow-wrap:anywhere]';

function listItems(values) {
    return (values || []).map((value) => String(value || '').trim()).filter(Boolean);
}

function VendorName({ name, expanded, onToggle }) {
    const full = String(name || '').trim();
    if (!full) return 'N/A';
    if (full.length <= NAME_LIMIT || expanded) {
        return <span className="break-words font-medium text-slate-800">{full}</span>;
    }
    return (
        <span className="font-medium text-slate-800">
            {full.slice(0, NAME_LIMIT)}
            <button
                type="button"
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggle();
                }}
                className="ml-1 font-normal text-blue-700 hover:underline"
            >
                more
            </button>
        </span>
    );
}

function LimitedList({ values, onSeeMore, label }) {
    const items = listItems(values);
    if (!items.length) return 'N/A';
    return (
        <span className="break-words">
            {items.slice(0, LIST_LIMIT).join(', ')}
            {items.length > LIST_LIMIT ? (
                <button
                    type="button"
                    onClick={onSeeMore}
                    className="ml-1 whitespace-nowrap text-blue-700 hover:underline"
                    aria-label={`See more ${label}`}
                >
                    see more
                </button>
            ) : null}
        </span>
    );
}

function RowActions({ vendor, deleting, canEdit, canDelete, onEdit, onDelete }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState(null);
    const rootRef = useRef(null);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const close = (event) => {
            const target = event.target;
            if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            setOpen(false);
        };
        const closeOnMove = () => setOpen(false);
        document.addEventListener('mousedown', close);
        window.addEventListener('scroll', closeOnMove, true);
        window.addEventListener('resize', closeOnMove);
        return () => {
            document.removeEventListener('mousedown', close);
            window.removeEventListener('scroll', closeOnMove, true);
            window.removeEventListener('resize', closeOnMove);
        };
    }, [open]);

    const menu = open && pos ? (
        <div
            ref={menuRef}
            role="menu"
            className="fixed z-[80] w-32 overflow-hidden rounded-xl border border-[#E6EDF5] bg-white py-1 shadow-xl"
            style={{
                top: pos.top,
                left: pos.left,
                transform: pos.openUp ? 'translate(-100%, -100%)' : 'translateX(-100%)',
            }}
        >
            {canEdit ? (
                <button
                    type="button"
                    role="menuitem"
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setOpen(false);
                        onEdit();
                    }}
                    className="block w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                    Edit
                </button>
            ) : null}
            {canDelete ? (
                <button
                    type="button"
                    role="menuitem"
                    disabled={deleting}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setOpen(false);
                        onDelete(event);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                    {deleting ? 'Deleting...' : 'Delete'}
                </button>
            ) : null}
        </div>
    ) : null;

    return (
        <div ref={rootRef} className="flex justify-center" data-row-nav-ignore="">
            <button
                type="button"
                aria-label={`Actions for ${vendor.name || 'vendor'}`}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    const openUp = rect.bottom + 96 > window.innerHeight;
                    setPos({
                        top: openUp ? rect.top - 4 : rect.bottom + 4,
                        left: rect.right,
                        openUp,
                    });
                    setOpen((current) => !current);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
                <MoreVertical size={16} />
            </button>
            {menu ? createPortal(menu, document.body) : null}
        </div>
    );
}

function csvCell(value) {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
}

export default function VendorManagementList() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const searchKey = searchParams.toString();
    const appliedSearchKey = useRef(searchKey);
    const access = useInventoryAccess();
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
    const [expandedNames, setExpandedNames] = useState(() => new Set());
    const showActions = access.canEditVendor || access.canDeleteVendor;
    const columnCount = showActions ? 11 : 10;

    const listHref = useMemo(() => vendorListHref({
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
        listVendors({
            page,
            limit: pageLimit(pageSize),
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
    }, [brand, debouncedQuery, page, pageSize, paymentTerms, product, reloadKey]);

    const { pageCount, currentPage, from, to } = pageWindow(total, page, pageSize);

    useEffect(() => {
        if (loading || page <= pageCount) return;
        setPage(pageCount);
    }, [loading, page, pageCount]);
    const emptyLabel = query || product || brand || paymentTerms
        ? 'No vendors match this search.'
        : 'No vendors yet.';

    function toggleName(id) {
        setExpandedNames((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function openVendorTab(event, vendorId, tab) {
        event.preventDefault();
        event.stopPropagation();
        if (!vendorId) return;
        navigateFromList(router, `/inventory/vendor-management/${vendorId}?tab=${encodeURIComponent(tab)}`, listHref);
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
        const header = ['Vendor Code', 'Vendor Name', 'Location', 'Primary Contact', 'Brands', 'Products', 'Vendor Outstanding', 'Pending Bills', 'Open LPO', 'Status'];
        const lines = rows.map((vendor) => [
            vendor.code,
            vendor.name,
            vendor.location,
            vendor.contact,
            (vendor.listBrands || []).join(', '),
            (vendor.listCategories || []).join(', '),
            money(vendor.outstandingPayment, vendor.currencyCode),
            vendor.pendingBills || 0,
            vendor.openLpos || 0,
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
        <section className="min-w-0 overflow-x-hidden rounded-2xl border border-[#E6EDF5] bg-white p-4 sm:p-6">
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

            <div className="relative z-30 mt-5 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

            <div className="mt-5 min-w-0">
                <table className="w-full table-fixed text-left text-xs sm:text-sm">
                    <colgroup>
                        <col className="w-[9%]" />
                        <col className="w-[13%]" />
                        <col className="w-[9%]" />
                        <col className="w-[11%]" />
                        <col className={showActions ? 'w-[14%]' : 'w-[15%]'} />
                        <col className={showActions ? 'w-[14%]' : 'w-[15%]'} />
                        <col className="w-[10%]" />
                        <col className="w-[6%]" />
                        <col className="w-[5%]" />
                        <col className={showActions ? 'w-[6%]' : 'w-[7%]'} />
                        {showActions ? <col className="w-[3%]" /> : null}
                    </colgroup>
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                            {[
                                'Vendor Code',
                                'Vendor Name',
                                'Location',
                                'Primary Contact',
                                'Brands',
                                'Products',
                                'Vendor Outstanding',
                                'Pending Bills',
                                'Open LPO',
                                'Status',
                                ...(showActions ? ['Action'] : []),
                            ].map((heading) => (
                                <th key={heading} className={`px-2 py-2 font-medium leading-tight ${NUMBER_HEADINGS.has(heading) ? 'text-right' : ''} ${heading === 'Action' ? 'text-center' : ''}`}>{heading}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={columnCount} className="px-2 py-10 text-center text-slate-500">Loading vendors...</td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={columnCount} className="px-2 py-10 text-center text-slate-500">{emptyLabel}</td>
                            </tr>
                        ) : rows.map((vendor) => (
                            <ListTableRowLink
                                key={vendor.id || vendor.code}
                                href={vendor.id ? `/inventory/vendor-management/${vendor.id}` : ''}
                                router={router}
                                listReturnHref={listHref}
                                enabled={Boolean(vendor.id)}
                            >
                            <tr
                                className="cursor-pointer border-b border-slate-100 text-slate-700 hover:bg-slate-50"
                            >
                                <td className={cellClass}>{vendor.code}</td>
                                <td className={cellClass}>
                                    <VendorName
                                        name={vendor.name}
                                        expanded={expandedNames.has(vendor.id)}
                                        onToggle={() => toggleName(vendor.id)}
                                    />
                                </td>
                                <td className={cellClass}>{displayValue(vendor.location)}</td>
                                <td className={cellClass}>{displayValue(vendor.contact)}</td>
                                <td className={cellClass}>
                                    <LimitedList
                                        values={vendor.listBrands}
                                        label="brands"
                                        onSeeMore={(event) => openVendorTab(event, vendor.id, 'Brands')}
                                    />
                                </td>
                                <td className={cellClass}>
                                    <LimitedList
                                        values={vendor.listCategories}
                                        label="products"
                                        onSeeMore={(event) => openVendorTab(event, vendor.id, 'Products')}
                                    />
                                </td>
                                <td className={`${cellClass} text-right tabular-nums`}>{money(vendor.outstandingPayment, vendor.currencyCode)}</td>
                                <td className={`${cellClass} text-right tabular-nums`}>{Number(vendor.pendingBills) || 0}</td>
                                <td className={`${cellClass} text-right tabular-nums`}>{Number(vendor.openLpos) || 0}</td>
                                <td className={cellClass}>
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${statusClass(vendor.status)}`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${statusDot(vendor.status)}`} />
                                        {vendor.status}
                                    </span>
                                </td>
                                {showActions ? (
                                    <td className={`${cellClass} text-center`}>
                                        <RowActions
                                            vendor={vendor}
                                            deleting={deletingId === vendor.id}
                                            canEdit={access.canEditVendor}
                                            canDelete={access.canDeleteVendor}
                                            onEdit={() => setEditor({ vendor })}
                                            onDelete={(event) => removeVendor(event, vendor)}
                                        />
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
