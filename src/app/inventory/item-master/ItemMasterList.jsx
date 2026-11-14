'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { fieldClass } from './CatalogModal';
import { AddBrandModal, AddCategoryModal, AddSubcategoryModal } from './CatalogForms';
import { useInventoryAccess } from './itemMasterAccess';
import {
    apiMessage,
    deleteBrand,
    deleteCategory,
    deleteItem,
    deleteSubcategory,
    listBrands,
    listCategories,
    listItems,
    listSubcategories,
} from './itemMasterApi';

const PAGE_SIZE = 6;
const STATUSES = ['Stock In', 'Low Stock', 'Out of Stock'];
const TABS = [
    { id: 'items', label: 'Items' },
    { id: 'category', label: 'Category' },
    { id: 'subcategory', label: 'Sub Category' },
    { id: 'brand', label: 'Brand' },
];

const primaryButtonClass = 'inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white';
const quietButtonClass = 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700';

const statusClass = {
    'Stock In': 'bg-emerald-50 text-emerald-600',
    Active: 'bg-emerald-50 text-emerald-600',
    'Low Stock': 'bg-orange-50 text-orange-600',
    'Out of Stock': 'bg-red-50 text-red-600',
};

function asRows(value) {
    return Array.isArray(value) ? value : [];
}

function countOf(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function matchesName(row, query) {
    if (!query) return true;
    return String(row?.name || '').toLowerCase().includes(query);
}

function idList(values) {
    return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '')).filter(Boolean))];
}

function listNoun(list) {
    if (list === 'items') return 'items';
    if (list === 'category') return 'categories';
    if (list === 'subcategory') return 'subcategories';
    return 'brands';
}

function rowsForLink(rows, link, listName) {
    if (!link || link.list !== listName) return rows;
    if (link.categoryId) {
        const categoryId = String(link.categoryId);
        return rows.filter((row) => String(row.categoryId || '') === categoryId);
    }
    const allow = new Set(idList(link.allow));
    return rows.filter((row) => allow.has(String(row._id)));
}

function upsertSorted(current, saved) {
    const next = current.filter((row) => String(row._id) !== String(saved?._id));
    if (saved?._id) next.push(saved);
    next.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    return next;
}

function csvCell(value) {
    const text = String(value ?? '');
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
}

function availableClass(row) {
    if (row.availableQuantity === 0 || row.status === 'Out of Stock') return 'text-red-500';
    if (row.status === 'Low Stock') return 'text-orange-500';
    return 'text-slate-800';
}

function pageNumbers(page, pages) {
    const values = new Set([1, page - 1, page, page + 1, pages].filter((value) => value >= 1 && value <= pages));
    return [...values].sort((a, b) => a - b);
}

export default function ItemMasterList() {
    const router = useRouter();
    const access = useInventoryAccess();
    const catalogRequest = useRef(0);
    const [tab, setTab] = useState('items');
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [catalogSearch, setCatalogSearch] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [subcategoryId, setSubcategoryId] = useState('');
    const [brandId, setBrandId] = useState('');
    const [status, setStatus] = useState('');
    const [linkedList, setLinkedList] = useState(null);
    const [modal, setModal] = useState('');
    const [returnToSubcategory, setReturnToSubcategory] = useState(false);
    const [itemError, setItemError] = useState('');
    const [openDescriptions, setOpenDescriptions] = useState(() => new Set());
    const [catalogError, setCatalogError] = useState('');
    const [loading, setLoading] = useState(true);
    const [catalogLoading, setCatalogLoading] = useState(true);
    const [reloadToken, setReloadToken] = useState(0);
    const [deletingId, setDeletingId] = useState('');
    const [draft, setDraft] = useState(null);

    const loadCatalog = useCallback((quiet = false) => {
        const requestId = catalogRequest.current + 1;
        catalogRequest.current = requestId;
        if (!localStorage.getItem('token')) {
            setCatalogLoading(false);
            return Promise.resolve();
        }
        if (!quiet) setCatalogLoading(true);
        return Promise.all([listCategories(), listSubcategories(), listBrands()])
            .then(([categoryRows, subcategoryRows, brandRows]) => {
                if (requestId !== catalogRequest.current) return;
                setCategories(asRows(categoryRows));
                setSubcategories(asRows(subcategoryRows));
                setBrands(asRows(brandRows));
                setCatalogError('');
            })
            .catch((err) => {
                if (requestId !== catalogRequest.current) return;
                setCatalogError(apiMessage(err, 'Could not load this list.'));
            })
            .finally(() => {
                if (requestId === catalogRequest.current) setCatalogLoading(false);
            });
    }, []);

    useEffect(() => {
        if (!access.ready || !access.canViewItems) {
            if (access.ready) setCatalogLoading(false);
            return;
        }
        loadCatalog();
    }, [access.ready, access.canViewItems, loadCatalog]);

    useEffect(() => {
        if (!access.ready || !access.canViewItems || tab === 'items') return undefined;
        loadCatalog(true);
        return undefined;
    }, [access.ready, access.canViewItems, tab, loadCatalog]);

    useEffect(() => {
        let cancelled = false;
        if (!access.ready || !access.canViewItems) {
            if (access.ready) setLoading(false);
            return undefined;
        }
        if (!localStorage.getItem('token')) {
            setLoading(false);
            return undefined;
        }
        setLoading(true);
        listItems({
            page,
            limit: PAGE_SIZE,
            search,
            categoryId,
            subcategoryId,
            brandId,
            status,
        })
            .then((result) => {
                if (cancelled) return;
                setRows(result.items || []);
                setTotal(result.total || 0);
                setItemError('');
            })
            .catch((err) => {
                if (!cancelled) setItemError(apiMessage(err, 'Could not load items.'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [access.ready, access.canViewItems, page, search, categoryId, subcategoryId, brandId, status, reloadToken]);

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, total);
    const catalogQuery = catalogSearch.trim().toLowerCase();
    const categoryScope = rowsForLink(categories, linkedList, 'category');
    const subcategoryScope = rowsForLink(subcategories, linkedList, 'subcategory');
    const brandScope = rowsForLink(brands, linkedList, 'brand');
    const visibleCategories = categoryScope.filter((row) => matchesName(row, catalogQuery));
    const visibleSubcategories = subcategoryScope.filter((row) => matchesName(row, catalogQuery));
    const visibleBrands = brandScope.filter((row) => matchesName(row, catalogQuery));

    const clearItemLink = () => {
        setCategoryId('');
        setSubcategoryId('');
        setBrandId('');
        setPage(1);
    };

    const showAllLinked = () => {
        if (linkedList?.list === 'items') clearItemLink();
        setCatalogSearch('');
        setLinkedList(null);
    };

    const selectTab = (next) => {
        if (next === tab) return;
        if (linkedList?.list === 'items') clearItemLink();
        setLinkedList(null);
        setTab(next);
    };

    const showCatalog = (list, { caption, categoryId: parentCategoryId = '', allow = [] }) => {
        setCatalogSearch('');
        setLinkedList({
            list,
            caption,
            categoryId: parentCategoryId,
            allow: parentCategoryId ? [] : idList(allow),
        });
        setTab(list);
    };

    const showItems = ({ caption, categoryId: nextCategoryId = '', subcategoryId: nextSubcategoryId = '', brandId: nextBrandId = '' }) => {
        setSearch('');
        setStatus('');
        setPage(1);
        setCategoryId(nextCategoryId);
        setSubcategoryId(nextSubcategoryId);
        setBrandId(nextBrandId);
        setLinkedList({ list: 'items', caption, categoryId: '', allow: [] });
        setTab('items');
    };

    const chooseCategory = (value) => {
        setPage(1);
        setCategoryId(value);
        setSubcategoryId((current) => {
            if (!value || !current) return current;
            const match = subcategories.find((row) => String(row._id) === String(current));
            return match && String(match.categoryId || '') === String(value) ? current : '';
        });
        setLinkedList((current) => (current?.list === 'items' ? null : current));
    };

    const chooseBrand = (value) => {
        setPage(1);
        setBrandId(value);
        setLinkedList((current) => (current?.list === 'items' ? null : current));
    };

    const openCount = (source, columnKey, row) => {
        const caption = `${source} ${row.name || ''}`.trim();
        if (columnKey === 'itemCount') {
            if (source === 'category') showItems({ caption, categoryId: row._id });
            else if (source === 'subcategory') showItems({ caption, subcategoryId: row._id });
            else if (source === 'brand') showItems({ caption, brandId: row._id });
            return;
        }
        if (columnKey === 'subcategoryCount' && source === 'category') {
            showCatalog('subcategory', { caption, categoryId: row._id });
            return;
        }
        if (columnKey === 'subcategoryCount' && source === 'brand') {
            showCatalog('subcategory', { caption, allow: row.subcategoryIds });
            return;
        }
        if (columnKey === 'brandCount') {
            showCatalog('brand', { caption, allow: row.brandIds });
            return;
        }
        if (columnKey === 'categoryCount') {
            const allow = row.categoryIds?.length ? row.categoryIds : [row.categoryId];
            showCatalog('category', { caption, allow });
        }
    };

    const closeModal = () => {
        const backToSubcategory = returnToSubcategory;
        setModal(backToSubcategory ? 'subcategory' : '');
        setReturnToSubcategory(false);
        if (!backToSubcategory) setDraft(null);
    };

    const dismissModal = () => {
        setModal('');
        setDraft(null);
        setReturnToSubcategory(false);
    };

    const openCreate = (kind) => {
        setDraft(null);
        setModal(kind);
    };

    const openEdit = (kind, row) => {
        setDraft(row);
        setModal(kind);
    };

    const finishCatalogSave = (kind, saved) => {
        if (draft?._id) {
            setDraft(null);
            setModal('');
            setReturnToSubcategory(false);
            loadCatalog(true);
            return;
        }
        if (kind === 'category') setCategories((current) => upsertSorted(current, saved));
        else if (kind === 'subcategory') setSubcategories((current) => upsertSorted(current, saved));
        else setBrands((current) => upsertSorted(current, saved));
        if (kind === 'category') closeModal();
        else setModal('');
        loadCatalog(true);
    };

    const removeItem = async (row) => {
        const label = [row.itemCode, row.description].filter(Boolean).join(' ');
        if (!window.confirm(`Delete ${label || 'this item'}?`)) return;
        setDeletingId(String(row._id));
        setItemError('');
        try {
            await deleteItem(row._id);
            if (rows.length === 1 && page > 1) setPage((current) => current - 1);
            setReloadToken((value) => value + 1);
        } catch (err) {
            setItemError(apiMessage(err, 'Could not delete this item.'));
        } finally {
            setDeletingId('');
        }
    };

    const removeCatalog = async (kind, row) => {
        const label = row.name || 'this row';
        if (!window.confirm(`Delete ${label}?`)) return;
        setDeletingId(String(row._id));
        setCatalogError('');
        try {
            if (kind === 'category') await deleteCategory(row._id);
            else if (kind === 'subcategory') await deleteSubcategory(row._id);
            else await deleteBrand(row._id);
            const drop = (current) => current.filter((item) => String(item._id) !== String(row._id));
            if (kind === 'category') setCategories(drop);
            else if (kind === 'subcategory') setSubcategories(drop);
            else setBrands(drop);
            loadCatalog(true);
        } catch (err) {
            setCatalogError(apiMessage(err, 'Could not delete this row.'));
        } finally {
            setDeletingId('');
        }
    };

    const exportCsv = async () => {
        try {
            const result = await listItems({ page: 1, limit: 100, search, categoryId, subcategoryId, brandId, status });
            const header = ['Item Code', 'Description', 'Brand', 'Category', 'Model', 'Available', 'Status'];
            const lines = [header.map(csvCell).join(',')];
            (result.items || []).forEach((row) => {
                const cells = [row.itemCode, row.description, row.brandName, row.categoryName, row.modelNumber, row.availableQuantity, row.status];
                lines.push(cells.map(csvCell).join(','));
            });
            const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'item-master.csv';
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            setItemError(apiMessage(err, 'Could not export items.'));
        }
    };

    if (access.ready && !access.canViewItems) {
        return (
            <div className="rounded-2xl border border-[#E6EDF5] bg-white p-5 shadow-sm">
                <h1 className="text-2xl font-bold text-slate-900">Item Master</h1>
                <p className="mt-3 text-sm text-slate-500">You do not have permission to view Item Master.</p>
            </div>
        );
    }

    const searchPlaceholder = {
        items: 'Search item, model, brand, category, SKU...',
        category: 'Search category...',
        subcategory: 'Search subcategory...',
        brand: 'Search brand...',
    }[tab];
    const showItemActions = access.canEditItem || access.canDeleteItem;
    const itemColumnCount = showItemActions ? 8 : 7;
    const itemHeadings = ['Item Code', 'Item Name / Description', 'Brand', 'Category', 'Model', 'Available', 'Status'];
    if (showItemActions) itemHeadings.push('Actions');

    return (
        <div className="rounded-2xl border border-[#E6EDF5] bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-slate-900">Item Master</h1>
                <div className="flex flex-wrap items-center gap-2">
                    {tab === 'items' && access.canCreateItem ? (
                        <button type="button" onClick={() => router.push('/inventory/item-master/add')} className={primaryButtonClass}>
                            <Plus size={15} /> Add Item
                        </button>
                    ) : null}
                    {tab === 'items' ? (
                        <button type="button" onClick={exportCsv} className={quietButtonClass}>
                            <Download size={15} /> Export
                        </button>
                    ) : null}
                    {tab === 'category' && access.canCreateCategory ? (
                        <button type="button" onClick={() => openCreate('category')} className={primaryButtonClass}>
                            <Plus size={15} /> Add Category
                        </button>
                    ) : null}
                    {tab === 'subcategory' && access.canCreateSubcategory ? (
                        <button type="button" onClick={() => openCreate('subcategory')} className={primaryButtonClass}>
                            <Plus size={15} /> Add Sub Category
                        </button>
                    ) : null}
                    {tab === 'brand' && access.canCreateBrand ? (
                        <button type="button" onClick={() => openCreate('brand')} className={primaryButtonClass}>
                            <Plus size={15} /> Add Brand
                        </button>
                    ) : null}
                </div>
            </div>

            <div role="tablist" aria-label="Item Master" className="mb-4 flex gap-1 overflow-x-auto border-b border-[#E6EDF5]">
                {TABS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.id}
                        onClick={() => selectTab(item.id)}
                        className={`shrink-0 border-b-2 px-3 pb-2 text-sm font-medium ${tab === item.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <div className="mb-4 flex items-end gap-3">
                <div className={`relative ${tab === 'items' ? 'w-52 shrink-0' : 'min-w-0 flex-1'}`}>
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        className={`${fieldClass} pl-9`}
                        placeholder={searchPlaceholder}
                        value={tab === 'items' ? search : catalogSearch}
                        onChange={(event) => {
                            const value = event.target.value;
                            if (tab === 'items') {
                                setPage(1);
                                setSearch(value);
                                return;
                            }
                            setCatalogSearch(value);
                        }}
                    />
                </div>
                {tab === 'items' ? (
                    <div className="grid min-w-0 flex-1 grid-cols-4 gap-3">
                        <Filter label="Category" value={categoryId} onChange={chooseCategory}>
                            <option value="">All</option>
                            {categories.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
                        </Filter>
                        <Filter label="Brand" value={brandId} onChange={chooseBrand}>
                            <option value="">All</option>
                            {brands.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
                        </Filter>
                        <Filter label="Stock Status" value={status} onChange={(value) => { setPage(1); setStatus(value); }}>
                            <option value="">All</option>
                            {STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
                        </Filter>
                        <Filter label="Warehouse" value="" onChange={() => {}}>
                            <option value="">All</option>
                        </Filter>
                    </div>
                ) : null}
            </div>

            {linkedList ? (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#EAF3FF] px-3 py-2 text-sm text-slate-700">
                    <p>
                        Showing only <span className="font-semibold">{listNoun(linkedList.list)}</span> for {linkedList.caption}
                    </p>
                    <button type="button" onClick={showAllLinked} className="font-semibold text-blue-700 hover:underline">
                        Show all
                    </button>
                </div>
            ) : null}

            {tab === 'items' && itemError ? <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{itemError}</p> : null}
            {catalogError ? <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{catalogError}</p> : null}

            {tab === 'items' ? (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[860px] text-left">
                            <thead>
                                <tr className="bg-[#F8FAFC] text-[11px] uppercase tracking-wide text-slate-400">
                                    {itemHeadings.map((heading) => (
                                        <th key={heading} className="px-3 py-3 font-medium">{heading}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={itemColumnCount} className="px-3 py-8 text-center text-sm text-slate-400">Loading items...</td></tr>
                                ) : rows.length === 0 ? (
                                    <tr><td colSpan={itemColumnCount} className="px-3 py-8 text-center text-sm text-slate-400">{search || categoryId || subcategoryId || brandId || status ? 'No items match this filter.' : 'No items yet.'}</td></tr>
                                ) : rows.map((row) => (
                                    <tr
                                        key={row._id}
                                        onClick={() => router.push(`/inventory/item-master/${row._id}`)}
                                        className="cursor-pointer border-t border-slate-100 text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                        <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-500">{row.itemCode}</td>
                                        <DescriptionCell
                                            text={row.description}
                                            open={openDescriptions.has(row._id)}
                                            onToggle={() => {
                                                setOpenDescriptions((current) => {
                                                    const next = new Set(current);
                                                    if (next.has(row._id)) next.delete(row._id);
                                                    else next.add(row._id);
                                                    return next;
                                                });
                                            }}
                                        />
                                        <ItemLinkCell
                                            name={row.brandName}
                                            label="brand"
                                            onOpen={row.brandId ? () => showItems({ caption: `brand ${row.brandName || ''}`.trim(), brandId: row.brandId }) : null}
                                        />
                                        <ItemLinkCell
                                            name={row.categoryName}
                                            label="category"
                                            onOpen={row.categoryId ? () => showItems({ caption: `category ${row.categoryName || ''}`.trim(), categoryId: row.categoryId }) : null}
                                        />
                                        <td className="whitespace-nowrap px-3 py-3">{row.modelNumber}</td>
                                        <td className={`whitespace-nowrap px-3 py-3 font-semibold ${availableClass(row)}`}>{row.availableQuantity}</td>
                                        <td className="whitespace-nowrap px-3 py-3">
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass[row.status] || 'bg-slate-100 text-slate-600'}`}>
                                                {row.status}
                                            </span>
                                        </td>
                                        {showItemActions ? (
                                            <td className="whitespace-nowrap px-3 py-3" onClick={(event) => event.stopPropagation()}>
                                                <RowActions
                                                    deleting={deletingId === String(row._id)}
                                                    editLabel={`Edit ${row.itemCode || 'item'}`}
                                                    deleteLabel={`Delete ${row.itemCode || 'item'}`}
                                                    onEdit={access.canEditItem ? () => router.push(`/inventory/item-master/${row._id}/edit`) : null}
                                                    onDelete={access.canDeleteItem ? () => removeItem(row) : null}
                                                />
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
                            <PagerButton label="<" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} />
                            {pageNumbers(page, pages).map((value, index, list) => (
                                <span key={value} className="flex items-center">
                                    {index > 0 && value - list[index - 1] > 1 ? <span className="px-1">...</span> : null}
                                    <button
                                        type="button"
                                        onClick={() => setPage(value)}
                                        className={`h-8 min-w-8 rounded-lg px-2 ${value === page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        {value}
                                    </button>
                                </span>
                            ))}
                            <PagerButton label=">" disabled={page >= pages} onClick={() => setPage((current) => current + 1)} />
                        </div>
                    </div>
                </>
            ) : null}

            {tab === 'category' ? (
                <CatalogTable
                    noun="categories"
                    total={categoryScope.length}
                    rows={visibleCategories}
                    loading={catalogLoading && categories.length === 0}
                    empty={catalogEmpty(catalogError, categories, categoryScope, catalogQuery, 'Categories could not be loaded.', 'No categories yet.', 'No categories match your search.', linkedList)}
                    columns={[
                        { label: 'Category Name', key: 'name' },
                        { label: 'Sub Category', key: 'subcategoryCount', count: true },
                        { label: 'Brand', key: 'brandCount', count: true },
                        { label: 'Item', key: 'itemCount', count: true },
                    ]}
                    onOpen={(columnKey, row) => openCount('category', columnKey, row)}
                    onEdit={access.canEditCategory ? (row) => openEdit('category', row) : null}
                    onDelete={access.canDeleteCategory ? (row) => removeCatalog('category', row) : null}
                    deletingId={deletingId}
                />
            ) : null}

            {tab === 'subcategory' ? (
                <CatalogTable
                    noun="subcategories"
                    total={subcategoryScope.length}
                    rows={visibleSubcategories}
                    loading={catalogLoading && subcategories.length === 0}
                    empty={catalogEmpty(catalogError, subcategories, subcategoryScope, catalogQuery, 'Subcategories could not be loaded.', 'No subcategories yet.', 'No subcategories match your search.', linkedList)}
                    columns={[
                        { label: 'Subcategory Name', key: 'name' },
                        { label: 'Category', key: 'categoryCount', count: true },
                        { label: 'Brand', key: 'brandCount', count: true },
                        { label: 'Item', key: 'itemCount', count: true },
                    ]}
                    onOpen={(columnKey, row) => openCount('subcategory', columnKey, row)}
                    onEdit={access.canEditSubcategory ? (row) => openEdit('subcategory', row) : null}
                    onDelete={access.canDeleteSubcategory ? (row) => removeCatalog('subcategory', row) : null}
                    deletingId={deletingId}
                />
            ) : null}

            {tab === 'brand' ? (
                <CatalogTable
                    noun="brands"
                    total={brandScope.length}
                    rows={visibleBrands}
                    loading={catalogLoading && brands.length === 0}
                    empty={catalogEmpty(catalogError, brands, brandScope, catalogQuery, 'Brands could not be loaded.', 'No brands yet.', 'No brands match your search.', linkedList)}
                    columns={[
                        { label: 'Brand Name', key: 'name' },
                        { label: 'Category', key: 'categoryCount', count: true },
                        { label: 'Subcategory', key: 'subcategoryCount', count: true },
                        { label: 'Item', key: 'itemCount', count: true },
                    ]}
                    onOpen={(columnKey, row) => openCount('brand', columnKey, row)}
                    onEdit={access.canEditBrand ? (row) => openEdit('brand', row) : null}
                    onDelete={access.canDeleteBrand ? (row) => removeCatalog('brand', row) : null}
                    deletingId={deletingId}
                />
            ) : null}

            {modal === 'category' ? (
                <AddCategoryModal
                    key={draft?._id || 'new-category'}
                    record={draft}
                    onClose={closeModal}
                    onSaved={(saved) => finishCatalogSave('category', saved)}
                />
            ) : null}
            {modal === 'subcategory' ? (
                <AddSubcategoryModal
                    key={draft?._id || 'new-subcategory'}
                    record={draft}
                    categories={categories}
                    loadError={catalogError}
                    canCreateCategory={access.canCreateCategory}
                    onClose={dismissModal}
                    onCreateCategory={() => {
                        setDraft(null);
                        setReturnToSubcategory(true);
                        setModal('category');
                    }}
                    onSaved={(saved) => finishCatalogSave('subcategory', saved)}
                />
            ) : null}
            {modal === 'brand' ? (
                <AddBrandModal
                    key={draft?._id || 'new-brand'}
                    record={draft}
                    onClose={dismissModal}
                    onSaved={(saved) => finishCatalogSave('brand', saved)}
                />
            ) : null}
        </div>
    );
}

function catalogEmpty(error, allRows, scopedRows, query, errorLabel, emptyLabel, searchLabel, link) {
    if (error) return errorLabel;
    if (allRows.length === 0) return emptyLabel;
    if (scopedRows.length === 0) return `No matches for ${link?.caption || 'this filter'}.`;
    if (query) return searchLabel;
    return emptyLabel;
}

function DescriptionCell({ text, open, onToggle }) {
    const value = String(text || '');
    const truncated = value.length > 20;
    if (open) {
        return (
            <td className="max-w-xs px-3 py-3 font-medium text-slate-800" onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={onToggle} className="whitespace-normal break-words text-left">
                    {value}
                </button>
            </td>
        );
    }
    return (
        <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-800">
            {truncated ? value.slice(0, 20) : value}
            {truncated ? (
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onToggle();
                    }}
                    className="text-blue-700 hover:underline"
                    aria-label="Show full item name"
                >
                    ...
                </button>
            ) : null}
        </td>
    );
}

function ItemLinkCell({ name, label, onOpen }) {
    if (!onOpen) {
        return <td className="whitespace-nowrap px-3 py-3">{name || '—'}</td>;
    }
    return (
        <td className="p-0" onClick={(event) => event.stopPropagation()}>
            <button
                type="button"
                onClick={onOpen}
                className="w-full whitespace-nowrap px-3 py-3 text-left font-medium text-blue-700 hover:bg-blue-50 hover:underline"
                aria-label={`Show items for ${label} ${name || ''}`.trim()}
            >
                {name || '—'}
            </button>
        </td>
    );
}

function RowActions({ editLabel, deleteLabel, deleting, onEdit, onDelete }) {
    return (
        <div className="flex items-center gap-2">
            {onEdit ? (
                <button
                    type="button"
                    onClick={onEdit}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    aria-label={editLabel}
                >
                    <Pencil size={13} /> Edit
                </button>
            ) : null}
            {onDelete ? (
                <button
                    type="button"
                    disabled={deleting}
                    onClick={onDelete}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    aria-label={deleteLabel}
                >
                    <Trash2 size={13} /> {deleting ? 'Deleting...' : 'Delete'}
                </button>
            ) : null}
        </div>
    );
}

function CatalogTable({ noun, total, rows, loading, empty, columns, onOpen, onEdit, onDelete, deletingId }) {
    const showActions = Boolean(onEdit || onDelete);
    const columnCount = columns.length + (showActions ? 1 : 0);
    return (
        <>
            <div className="overflow-x-auto">
                <table className="-mx-6 w-[calc(100%+3rem)] min-w-[720px] table-fixed border-separate border-spacing-x-6 text-left">
                    <colgroup>
                        {columns.map((column) => (
                            <col key={column.key} style={{ width: column.count ? '15%' : '26%' }} />
                        ))}
                        {showActions ? <col style={{ width: '29%' }} /> : null}
                    </colgroup>
                    <thead>
                        <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    className={`whitespace-nowrap rounded-lg bg-[#F8FAFC] px-4 py-3 font-medium ${column.count ? 'text-right' : ''}`}
                                >
                                    {column.label}
                                </th>
                            ))}
                            {showActions ? <th className="whitespace-nowrap rounded-lg bg-[#F8FAFC] px-4 py-3 font-medium">Actions</th> : null}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={columnCount} className="px-4 py-8 text-center text-sm text-slate-400">Loading...</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={columnCount} className="px-4 py-8 text-center text-sm text-slate-400">{empty}</td></tr>
                        ) : rows.map((row) => (
                            <tr key={row._id} className="text-sm text-slate-700">
                                {columns.map((column) => {
                                    if (!column.count) {
                                        return (
                                            <td key={column.key} className="truncate border-b border-slate-100 px-4 py-3 font-medium text-slate-800" title={row.name}>
                                                {row.name}
                                            </td>
                                        );
                                    }
                                    const value = countOf(row[column.key]);
                                    const action = `Show ${column.label} for ${row.name || 'this row'}`;
                                    return (
                                        <td key={column.key} className="border-b border-slate-100 p-0 text-right">
                                            <button
                                                type="button"
                                                onClick={() => onOpen(column.key, row)}
                                                className="w-full px-4 py-3 text-right font-semibold tabular-nums text-blue-700 hover:bg-blue-50 hover:underline"
                                                aria-label={action}
                                                title={action}
                                            >
                                                {value}
                                            </button>
                                        </td>
                                    );
                                })}
                                {showActions ? (
                                    <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3">
                                        <RowActions
                                            deleting={String(deletingId) === String(row._id)}
                                            editLabel={`Edit ${row.name || noun}`}
                                            deleteLabel={`Delete ${row.name || noun}`}
                                            onEdit={onEdit ? () => onEdit(row) : null}
                                            onDelete={onDelete ? () => onDelete(row) : null}
                                        />
                                    </td>
                                ) : null}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="mt-4 text-sm text-slate-500">Showing {rows.length} of {total} {noun}</p>
        </>
    );
}

function Filter({ label, value, onChange, children }) {
    return (
        <label className="block">
            <span className="mb-1 block whitespace-nowrap text-xs font-medium text-slate-500">{label}</span>
            <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>
                {children}
            </select>
        </label>
    );
}

function PagerButton({ label, disabled, onClick }) {
    return (
        <button type="button" disabled={disabled} onClick={onClick} className="h-8 w-8 rounded-lg text-slate-500 disabled:opacity-40">
            {label}
        </button>
    );
}
