'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bell, Download, LayoutGrid, List, Pencil, Plus, Receipt, Search, Trash2 } from 'lucide-react';
import ListTableRowLink from '@/components/ListTableRowLink';
import { usePersistListReturnState } from '@/hooks/usePersistListReturnState';
import { buildListReturnHref, navigateFromList } from '@/utils/listReturnNavigation';
import PageSizeSelect from '../PageSizeSelect';
import { pageLimit, pageSizeParam, pageWindow, slicePage } from '../listPageSize';
import { fieldClass } from './CatalogModal';
import AddStockModal from './AddStockModal';
import { AddBrandModal, AddCategoryModal, AddSubcategoryModal } from './CatalogForms';
import { useInventoryAccess } from './itemMasterAccess';
import {
    apiMessage,
    deleteBrand,
    deleteCategory,
    deleteItem,
    deleteSubcategory,
    listBrandImages,
    listBrands,
    listCategories,
    listCategoryImages,
    getStockApprovalContext,
    listItems,
    listSubcategories,
    listSubcategoryImages,
} from './itemMasterApi';

const STATUSES = ['Stock In', 'Low Stock', 'Out of Stock'];
const DEFAULT_STOCK_STATUS = 'Stock In';
const TABS = [
    { id: 'items', label: 'Items' },
    { id: 'category', label: 'Category' },
    { id: 'subcategory', label: 'Sub Category' },
    { id: 'brand', label: 'Brand' },
];

const primaryButtonClass = 'inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white';
const quietButtonClass = 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700';

const STOCK_DELETE_TITLE = 'Delete is unavailable while stock is greater than 0.';

const statusClass = {
    'Stock In': 'bg-emerald-50 text-emerald-600',
    Active: 'bg-emerald-50 text-emerald-600',
    'Low Stock': 'bg-orange-50 text-orange-600',
    'Out of Stock': 'bg-red-50 text-red-600',
};

function statusBadgeClass(status) {
    if (String(status || '').startsWith('Waiting for ')) return 'bg-amber-50 text-amber-700';
    return statusClass[status] || 'bg-slate-100 text-slate-600';
}

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

function textParam(params, key) {
    return String(params.get(key) || '');
}

function brandImageSrc(value) {
    const text = String(value || '');
    return text.startsWith('data:image/') ? text : '';
}

function brandInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '—';
    return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function pageParam(params) {
    const value = Number(params.get('page'));
    return Number.isInteger(value) && value > 0 ? value : 1;
}

function tabParam(params) {
    const value = textParam(params, 'tab');
    return TABS.some((tab) => tab.id === value) ? value : 'items';
}

function stockStatusParam(params) {
    const value = textParam(params, 'status');
    if (value === 'All' || STATUSES.includes(value)) return value;
    return DEFAULT_STOCK_STATUS;
}

function itemListHref({ tab, search, categoryId, subcategoryId, brandId, status, page, pageSize }) {
    return buildListReturnHref('/inventory/item-master', {
        tab: tab && tab !== 'items' ? tab : '',
        search,
        category: categoryId,
        subcategory: subcategoryId,
        brand: brandId,
        status: status !== DEFAULT_STOCK_STATUS ? status : '',
        page: page > 1 ? page : '',
        size: pageSize && pageSize !== '10' ? pageSize : '',
    });
}

const BRAND_THUMB_COLUMNS = 12;

function thumbPageLimit(pageSize) {
    if (pageSize === 'all') return 'all';
    const rows = Number(pageSize);
    return Number.isFinite(rows) && rows > 0 ? String(rows * BRAND_THUMB_COLUMNS) : pageSize;
}

function pageIdKey(rows, page, pageSize) {
    const range = pageWindow(rows.length, page, pageSize);
    return slicePage(rows, range.currentPage, pageSize).map((row) => String(row._id || '')).filter(Boolean).join(',');
}

function usePagedImages({ enabled, idKey, token, load }) {
    const requestRef = useRef(0);
    const loadedRef = useRef({});
    const pendingRef = useRef(new Set());
    const appliedToken = useRef(token);
    const [images, setImages] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!enabled || !idKey || !localStorage.getItem('token')) return undefined;
        if (appliedToken.current !== token) {
            appliedToken.current = token;
            loadedRef.current = {};
            pendingRef.current = new Set();
            setImages({});
        }
        const ids = idKey.split(',').filter((id) => (
            id && !Object.prototype.hasOwnProperty.call(loadedRef.current, id) && !pendingRef.current.has(id)
        ));
        if (!ids.length) return undefined;
        const requestId = requestRef.current + 1;
        requestRef.current = requestId;
        ids.forEach((id) => pendingRef.current.add(id));
        setLoading(true);
        const chunks = [];
        for (let index = 0; index < ids.length; index += 40) chunks.push(ids.slice(index, index + 40));
        let cancelled = false;
        Promise.all(chunks.map((chunk) => load(chunk)))
            .then((groups) => {
                if (cancelled || requestId !== requestRef.current) return;
                const next = { ...loadedRef.current };
                ids.forEach((id) => {
                    next[id] = '';
                    pendingRef.current.delete(id);
                });
                asRows(groups.flat()).forEach((row) => {
                    const id = String(row?._id || '');
                    if (id) next[id] = brandImageSrc(row.image);
                });
                loadedRef.current = next;
                setImages(next);
            })
            .catch(() => {
                if (cancelled) return;
                ids.forEach((id) => pendingRef.current.delete(id));
            })
            .finally(() => {
                if (!cancelled && requestId === requestRef.current) setLoading(false);
            });
        return () => {
            cancelled = true;
            ids.forEach((id) => pendingRef.current.delete(id));
        };
    }, [enabled, idKey, load, token]);

    return { images, loading };
}

function pageNumbers(page, pages) {
    const values = new Set([1, page - 1, page, page + 1, pages].filter((value) => value >= 1 && value <= pages));
    return [...values].sort((a, b) => a - b);
}

export default function ItemMasterList() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const searchKey = searchParams.toString();
    const appliedSearchKey = useRef(searchKey);
    const access = useInventoryAccess();
    const catalogRequest = useRef(0);
    const [tab, setTab] = useState(() => tabParam(searchParams));
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(() => pageParam(searchParams));
    const [pageSize, setPageSize] = useState(() => pageSizeParam(searchParams));
    const [search, setSearch] = useState(() => textParam(searchParams, 'search'));
    const [catalogSearch, setCatalogSearch] = useState('');
    const [categoryId, setCategoryId] = useState(() => textParam(searchParams, 'category'));
    const [subcategoryId, setSubcategoryId] = useState(() => textParam(searchParams, 'subcategory'));
    const [brandId, setBrandId] = useState(() => textParam(searchParams, 'brand'));
    const [status, setStatus] = useState(() => stockStatusParam(searchParams));
    const [linkedList, setLinkedList] = useState(null);
    const [modal, setModal] = useState('');
    const [addStockOpen, setAddStockOpen] = useState(() => searchParams.get('addStock') === '1' || Boolean(searchParams.get('stockEntry')));
    const [reviewEntryId, setReviewEntryId] = useState(() => searchParams.get('stockEntry') || '');
    const [stockApprovals, setStockApprovals] = useState({ isPurchaseOfficer: false, entries: [] });
    const [returnToSubcategory, setReturnToSubcategory] = useState(false);
    const [itemError, setItemError] = useState('');
    const [catalogError, setCatalogError] = useState('');
    const [loading, setLoading] = useState(true);
    const [catalogLoading, setCatalogLoading] = useState(true);
    const [reloadToken, setReloadToken] = useState(0);
    const [deletingId, setDeletingId] = useState('');
    const [draft, setDraft] = useState(null);
    const [brandView, setBrandView] = useState('thumbnail');
    const [imageTokens, setImageTokens] = useState({ category: 0, subcategory: 0, brand: 0 });

    const listHref = useMemo(() => itemListHref({
        tab,
        search: search.trim(),
        categoryId,
        subcategoryId,
        brandId,
        status: status !== DEFAULT_STOCK_STATUS ? status : '',
        page,
        pageSize,
    }), [brandId, categoryId, page, pageSize, search, status, subcategoryId, tab]);

    usePersistListReturnState({
        tab: tab !== 'items' ? tab : '',
        search: search.trim(),
        category: categoryId,
        subcategory: subcategoryId,
        brand: brandId,
        status: status !== DEFAULT_STOCK_STATUS ? status : '',
        page: page > 1 ? page : '',
        size: pageSize !== '10' ? pageSize : '',
    });

    useEffect(() => {
        if (appliedSearchKey.current === searchKey) return;
        appliedSearchKey.current = searchKey;
        setTab(tabParam(searchParams));
        setSearch(textParam(searchParams, 'search'));
        setCategoryId(textParam(searchParams, 'category'));
        setSubcategoryId(textParam(searchParams, 'subcategory'));
        setBrandId(textParam(searchParams, 'brand'));
        setStatus(stockStatusParam(searchParams));
        setPage(pageParam(searchParams));
        setPageSize(pageSizeParam(searchParams));
    }, [searchKey, searchParams]);

    useEffect(() => {
        const reviewId = searchParams.get('stockEntry') || '';
        if (reviewId) {
            setReviewEntryId(reviewId);
            setAddStockOpen(true);
        }
        if (searchParams.get('addStock') === '1') setAddStockOpen(true);
    }, [searchParams]);

    useEffect(() => {
        if (!access.ready || !access.canViewItems) return undefined;
        if (!localStorage.getItem('token')) return undefined;
        let cancelled = false;
        getStockApprovalContext()
            .then((result) => {
                if (cancelled) return;
                setStockApprovals({
                    isPurchaseOfficer: Boolean(result?.isPurchaseOfficer),
                    entries: Array.isArray(result?.entries) ? result.entries : [],
                });
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [access.ready, access.canViewItems, reloadToken]);

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
            limit: pageLimit(pageSize),
            search,
            categoryId,
            subcategoryId,
            brandId,
            status: status !== DEFAULT_STOCK_STATUS ? status : '',
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
    }, [access.ready, access.canViewItems, page, pageSize, search, categoryId, subcategoryId, brandId, status, reloadToken]);

    const { pageCount: pages, currentPage, from, to } = pageWindow(total, page, pageSize);
    const catalogQuery = catalogSearch.trim().toLowerCase();
    const categoryScope = rowsForLink(categories, linkedList, 'category');
    const subcategoryScope = rowsForLink(subcategories, linkedList, 'subcategory');
    const brandScope = rowsForLink(brands, linkedList, 'brand');
    const visibleCategories = categoryScope.filter((row) => matchesName(row, catalogQuery));
    const visibleSubcategories = subcategoryScope.filter((row) => matchesName(row, catalogQuery));
    const visibleBrands = brandScope.filter((row) => matchesName(row, catalogQuery));
    const categoryImageKey = useMemo(
        () => (tab === 'category' ? pageIdKey(visibleCategories, page, pageSize) : ''),
        [page, pageSize, tab, visibleCategories],
    );
    const subcategoryImageKey = useMemo(
        () => (tab === 'subcategory' ? pageIdKey(visibleSubcategories, page, pageSize) : ''),
        [page, pageSize, tab, visibleSubcategories],
    );
    const brandImageKey = useMemo(
        () => (tab === 'brand' && brandView === 'thumbnail' ? pageIdKey(visibleBrands, page, thumbPageLimit(pageSize)) : ''),
        [brandView, page, pageSize, tab, visibleBrands],
    );
    const imagesEnabled = Boolean(access.ready && access.canViewItems);
    const categoryPics = usePagedImages({
        enabled: imagesEnabled && tab === 'category',
        idKey: categoryImageKey,
        token: imageTokens.category,
        load: listCategoryImages,
    });
    const subcategoryPics = usePagedImages({
        enabled: imagesEnabled && tab === 'subcategory',
        idKey: subcategoryImageKey,
        token: imageTokens.subcategory,
        load: listSubcategoryImages,
    });
    const brandPics = usePagedImages({
        enabled: imagesEnabled && tab === 'brand' && brandView === 'thumbnail',
        idKey: brandImageKey,
        token: imageTokens.brand,
        load: listBrandImages,
    });

    useEffect(() => {
        if (tab === 'items') {
            if (loading || page <= pages) return;
            setPage(pages);
            return;
        }
        if (catalogLoading) return;
        const count = tab === 'category'
            ? visibleCategories.length
            : tab === 'subcategory'
                ? visibleSubcategories.length
                : visibleBrands.length;
        const pagingSize = tab === 'brand' && brandView === 'thumbnail' ? thumbPageLimit(pageSize) : pageSize;
        const { pageCount } = pageWindow(count, page, pagingSize);
        if (page > pageCount) setPage(pageCount);
    }, [
        catalogLoading,
        loading,
        brandView,
        page,
        pageSize,
        pages,
        tab,
        visibleBrands.length,
        visibleCategories.length,
        visibleSubcategories.length,
    ]);

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

    const changePageSize = (next) => {
        setPageSize(next);
        setPage(1);
    };

    const selectTab = (next) => {
        if (next === tab) return;
        if (linkedList?.list === 'items') clearItemLink();
        setLinkedList(null);
        setPage(1);
        if (next === 'brand') setBrandView('thumbnail');
        setTab(next);
    };

    const showCatalog = (list, { caption, categoryId: parentCategoryId = '', allow = [] }) => {
        setCatalogSearch('');
        setPage(1);
        setLinkedList({
            list,
            caption,
            categoryId: parentCategoryId,
            allow: parentCategoryId ? [] : idList(allow),
        });
        if (list === 'brand') setBrandView('thumbnail');
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

    const refreshImages = (kind) => {
        setImageTokens((current) => (
            Object.prototype.hasOwnProperty.call(current, kind)
                ? { ...current, [kind]: current[kind] + 1 }
                : current
        ));
    };

    const finishCatalogSave = (kind, saved) => {
        refreshImages(kind);
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
            refreshImages(kind);
            loadCatalog(true);
        } catch (err) {
            setCatalogError(apiMessage(err, 'Could not delete this row.'));
        } finally {
            setDeletingId('');
        }
    };

    const exportCsv = async () => {
        try {
            const result = await listItems({
                page: 1,
                limit: 0,
                search,
                categoryId,
                subcategoryId,
                brandId,
                status: status !== DEFAULT_STOCK_STATUS ? status : '',
            });
            const header = ['Item Code', 'Item Name', 'Brand', 'Model', 'Description', 'Category', 'Qty', 'Status'];
            const lines = [header.map(csvCell).join(',')];
            (result.items || []).forEach((row) => {
                const cells = [row.itemCode, row.itemName, row.brandName, row.modelNumber, row.description, row.categoryName, row.availableQuantity, row.status];
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
    const itemColumnCount = showItemActions ? 9 : 8;
    const itemHeadings = ['Item Code', 'Item Name', 'Brand', 'Model', 'Description', 'Category', 'Qty', 'Status'];
    if (showItemActions) itemHeadings.push('Actions');

    return (
        <div className="rounded-2xl border border-[#E6EDF5] bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-slate-900">Item Master</h1>
                <div className="flex flex-wrap items-center gap-2">
                    {tab === 'items' && (access.canCreateItem || access.canEditItem) ? (
                        <button type="button" onClick={() => {
                            setReviewEntryId('');
                            setAddStockOpen(true);
                            if (searchParams.get('stockEntry')) {
                                const next = new URLSearchParams(searchParams.toString());
                                next.delete('stockEntry');
                                const query = next.toString();
                                router.replace(query ? `/inventory/item-master?${query}` : '/inventory/item-master');
                            }
                        }} className={primaryButtonClass}>
                            <Receipt size={15} /> Add Bill
                        </button>
                    ) : null}
                    {tab === 'items' && access.canCreateItem ? (
                        <button type="button" onClick={() => navigateFromList(router, '/inventory/item-master/add', listHref)} className={primaryButtonClass}>
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

            {tab === 'items' && stockApprovals.isPurchaseOfficer && stockApprovals.entries.length ? (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
                        <Bell size={16} />
                        Stock waiting for your approval
                    </div>
                    <ul className="space-y-1">
                        {stockApprovals.entries.map((entry) => (
                            <li key={entry._id}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setReviewEntryId(String(entry._id));
                                        setAddStockOpen(true);
                                        const next = new URLSearchParams(searchParams.toString());
                                        next.set('stockEntry', String(entry._id));
                                        router.replace(`/inventory/item-master?${next.toString()}`);
                                    }}
                                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm text-amber-950 hover:bg-amber-100"
                                >
                                    <span>
                                        {entry.billNo || 'Stock bill'}
                                        {entry.editPending ? ' · edit' : ''}
                                        {entry.submittedByName ? ` · ${entry.submittedByName}` : ''}
                                        {` · ${entry.lineCount || 0} item${entry.lineCount === 1 ? '' : 's'}`}
                                    </span>
                                    <span className="shrink-0 font-semibold text-amber-800">Review</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

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

            <div className="mb-4 flex flex-wrap items-end gap-3">
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
                            setPage(1);
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
                            <option value="All">All</option>
                            {STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
                        </Filter>
                        <Filter label="Warehouse" value="" onChange={() => {}}>
                            <option value="">All</option>
                        </Filter>
                    </div>
                ) : null}
                {tab === 'brand' ? (
                    <BrandViewSwitch value={brandView} onChange={setBrandView} />
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
                        <table className="w-full min-w-[980px] text-left">
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
                                    <tr><td colSpan={itemColumnCount} className="px-3 py-8 text-center text-sm text-slate-400">{search || categoryId || subcategoryId || brandId || status !== DEFAULT_STOCK_STATUS ? 'No items match this filter.' : 'No items yet.'}</td></tr>
                                ) : rows.map((row) => (
                                    <ListTableRowLink
                                        key={row._id}
                                        href={`/inventory/item-master/${row._id}`}
                                        router={router}
                                        listReturnHref={listHref}
                                    >
                                    <tr
                                        className="cursor-pointer border-t border-slate-100 text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                        <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-500">{row.itemCode}</td>
                                        <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-800">{row.itemName}</td>
                                        <ItemLinkCell
                                            name={row.brandName}
                                            label="brand"
                                            onOpen={row.brandId ? () => showItems({ caption: `brand ${row.brandName || ''}`.trim(), brandId: row.brandId }) : null}
                                        />
                                        <td className="whitespace-nowrap px-3 py-3">{row.modelNumber}</td>
                                        <DescriptionCell row={row} />
                                        <ItemLinkCell
                                            name={row.categoryName}
                                            label="category"
                                            onOpen={row.categoryId ? () => showItems({ caption: `category ${row.categoryName || ''}`.trim(), categoryId: row.categoryId }) : null}
                                        />
                                        <td className={`whitespace-nowrap px-3 py-3 font-semibold ${availableClass(row)}`}>{row.availableQuantity}</td>
                                        <td className="whitespace-nowrap px-3 py-3">
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(row.status)}`}>
                                                {row.status}
                                            </span>
                                        </td>
                                        {showItemActions ? (
                                            <td className="whitespace-nowrap px-3 py-3" onClick={(event) => event.stopPropagation()}>
                                                <RowActions
                                                    deleting={deletingId === String(row._id)}
                                                    editLabel={`Edit ${row.itemCode || 'item'}`}
                                                    deleteLabel={`Delete ${row.itemCode || 'item'}`}
                                                    onEdit={access.canEditItem ? () => navigateFromList(router, `/inventory/item-master/${row._id}/edit`, listHref) : null}
                                                    onDelete={access.canDeleteItem ? () => removeItem(row) : null}
                                                    deleteDisabled={countOf(row.availableQuantity) > 0}
                                                    deleteTitle={STOCK_DELETE_TITLE}
                                                />
                                            </td>
                                        ) : null}
                                    </tr>
                                    </ListTableRowLink>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <ListPager
                        from={from}
                        to={to}
                        total={total}
                        noun="items"
                        page={currentPage}
                        pages={pages}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={changePageSize}
                    />
                </>
            ) : null}

            {tab === 'category' ? (
                <CatalogTable
                    noun="categories"
                    rows={visibleCategories}
                    loading={catalogLoading && categories.length === 0}
                    empty={catalogEmpty(catalogError, categories, categoryScope, catalogQuery, 'Categories could not be loaded.', 'No categories yet.', 'No categories match your search.', linkedList)}
                    serial
                    images={categoryPics.images}
                    imagesLoading={categoryPics.loading}
                    columns={[
                        { label: 'Category Name', key: 'name' },
                        { label: 'Sub Category', key: 'subcategoryCount', count: true },
                        { label: 'Brand', key: 'brandCount', count: true },
                        { label: 'Item', key: 'itemCount', count: true },
                    ]}
                    onOpen={(columnKey, row) => openCount('category', columnKey, row)}
                    onEdit={access.canEditCategory ? (row) => openEdit('category', row) : null}
                    onDelete={access.canDeleteCategory ? (row) => removeCatalog('category', row) : null}
                    deleteLocked={(row) => countOf(row.stockQuantity) > 0}
                    deletingId={deletingId}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={changePageSize}
                />
            ) : null}

            {tab === 'subcategory' ? (
                <CatalogTable
                    noun="subcategories"
                    rows={visibleSubcategories}
                    loading={catalogLoading && subcategories.length === 0}
                    empty={catalogEmpty(catalogError, subcategories, subcategoryScope, catalogQuery, 'Subcategories could not be loaded.', 'No subcategories yet.', 'No subcategories match your search.', linkedList)}
                    serial
                    images={subcategoryPics.images}
                    imagesLoading={subcategoryPics.loading}
                    columns={[
                        { label: 'Subcategory Name', key: 'name' },
                        { label: 'Category', key: 'categoryCount', count: true },
                        { label: 'Brand', key: 'brandCount', count: true },
                        { label: 'Item', key: 'itemCount', count: true },
                    ]}
                    onOpen={(columnKey, row) => openCount('subcategory', columnKey, row)}
                    onEdit={access.canEditSubcategory ? (row) => openEdit('subcategory', row) : null}
                    onDelete={access.canDeleteSubcategory ? (row) => removeCatalog('subcategory', row) : null}
                    deleteLocked={(row) => countOf(row.stockQuantity) > 0}
                    deletingId={deletingId}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={changePageSize}
                />
            ) : null}

            {tab === 'brand' ? (
                brandView === 'list' ? (
                    <CatalogTable
                        noun="brands"
                        rows={visibleBrands}
                        loading={catalogLoading && brands.length === 0}
                        empty={catalogEmpty(catalogError, brands, brandScope, catalogQuery, 'Brands could not be loaded.', 'No brands yet.', 'No brands match your search.', linkedList)}
                        serial
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
                        page={page}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={changePageSize}
                    />
                ) : (
                    <BrandThumbnailGrid
                        rows={visibleBrands}
                        loading={catalogLoading && brands.length === 0}
                        empty={catalogEmpty(catalogError, brands, brandScope, catalogQuery, 'Brands could not be loaded.', 'No brands yet.', 'No brands match your search.', linkedList)}
                        images={brandPics.images}
                        imagesLoading={brandPics.loading}
                        page={page}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={changePageSize}
                        onOpen={(row) => showItems({ caption: `brand ${row.name || ''}`.trim(), brandId: row._id })}
                    />
                )
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
            {addStockOpen ? (
                <AddStockModal
                    key={reviewEntryId || 'new-bill'}
                    reviewEntryId={reviewEntryId}
                    onClose={() => {
                        setAddStockOpen(false);
                        setReviewEntryId('');
                        if (searchParams.get('addStock') === '1' || searchParams.get('stockEntry')) {
                            const next = new URLSearchParams(searchParams.toString());
                            next.delete('addStock');
                            next.delete('stockEntry');
                            const query = next.toString();
                            router.replace(query ? `/inventory/item-master?${query}` : '/inventory/item-master');
                        }
                    }}
                    onSaved={() => setReloadToken((value) => value + 1)}
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

function descriptionLine(parts) {
    return parts.map((part) => String(part || '').trim()).filter(Boolean).join(', ');
}

function DescriptionCell({ row }) {
    const primary = descriptionLine([row?.itemName, row?.subcategoryName]);
    const secondary = descriptionLine([row?.brandName, row?.modelNumber]);
    const fallback = !primary && !secondary ? String(row?.description || '').trim() : '';
    return (
        <td className="min-w-[240px] max-w-sm px-3 py-3 align-top">
            <div className="flex flex-col gap-0.5">
                {primary || fallback ? (
                    <p className="text-[15px] font-semibold leading-5 text-slate-900">{primary || fallback}</p>
                ) : null}
                {secondary ? <p className="text-xs leading-4 text-slate-500">{secondary}</p> : null}
            </div>
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

function RowActions({ editLabel, deleteLabel, deleting, onEdit, onDelete, deleteDisabled = false, deleteTitle = '', compact = false }) {
    const editClass = compact
        ? 'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50'
        : 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50';
    const deleteClass = compact
        ? 'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50'
        : 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50';
    const locked = Boolean(deleteDisabled);
    return (
        <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
            {onEdit ? (
                <button type="button" onClick={onEdit} className={editClass} aria-label={editLabel} title="Edit">
                    <Pencil size={13} /> {compact ? null : 'Edit'}
                </button>
            ) : null}
            {onDelete ? (
                <button
                    type="button"
                    disabled={deleting || locked}
                    onClick={onDelete}
                    className={deleteClass}
                    aria-label={deleteLabel}
                    title={locked ? (deleteTitle || STOCK_DELETE_TITLE) : (deleting ? 'Deleting...' : 'Delete')}
                >
                    <Trash2 size={13} /> {compact ? null : (deleting ? 'Deleting...' : 'Delete')}
                </button>
            ) : null}
        </div>
    );
}

function BrandViewSwitch({ value, onChange }) {
    const options = [
        { id: 'thumbnail', label: 'Thumbnail view', icon: LayoutGrid },
        { id: 'list', label: 'List view', icon: List },
    ];
    return (
        <div role="tablist" aria-label="Brand layout" className="flex h-9 shrink-0 items-center rounded-lg border border-[#E2E8F0] bg-white p-0.5">
            {options.map((option) => {
                const Icon = option.icon;
                const selected = value === option.id;
                return (
                    <button
                        key={option.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => onChange(option.id)}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium ${selected ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Icon size={14} />
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

function BrandThumbnailGrid({ rows, loading, empty, images, imagesLoading, page, pageSize, onPageChange, onPageSizeChange, onOpen }) {
    const limit = thumbPageLimit(pageSize);
    const range = pageWindow(rows.length, page, limit);
    const pageRows = slicePage(rows, range.currentPage, limit);
    return (
        <>
            {loading ? (
                <p className="py-8 text-center text-sm text-slate-400">Loading...</p>
            ) : rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">{empty}</p>
            ) : (
                <div className="grid grid-cols-12 gap-3">
                    {pageRows.map((row) => {
                        const image = brandImageSrc(images[String(row._id)]);
                        const name = row.name || 'Brand';
                        return (
                            <button
                                key={row._id}
                                type="button"
                                title={name}
                                aria-label={`Show items for ${name}`}
                                onClick={() => onOpen(row)}
                                className={`flex aspect-square min-w-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-[#E6EDF5] shadow-sm transition hover:border-blue-300 hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${image ? 'bg-white p-2' : 'bg-[#F8FAFC]'}`}
                            >
                                {image ? (
                                    <img src={image} alt="" className="h-full w-full object-contain" />
                                ) : imagesLoading ? (
                                    <span className="h-8 w-8 animate-pulse rounded-md bg-slate-200" />
                                ) : (
                                    <span className="px-1 text-center text-sm font-semibold text-slate-400">{brandInitials(row.name)}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
            <ListPager
                from={range.from}
                to={range.to}
                total={rows.length}
                noun="brands"
                page={range.currentPage}
                pages={range.pageCount}
                pageSize={pageSize}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
            />
        </>
    );
}

function CatalogImage({ src, pending, name }) {
    return (
        <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-[#E6EDF5] bg-[#F8FAFC]">
            {src ? (
                <img src={src} alt="" className="h-full w-full object-contain" />
            ) : pending ? (
                <span className="h-4 w-4 animate-pulse rounded bg-slate-200" />
            ) : (
                <span className="text-[10px] font-semibold text-slate-400">{brandInitials(name)}</span>
            )}
        </span>
    );
}

function CatalogTable({ noun, rows, loading, empty, columns, onOpen, onEdit, onDelete, deleteLocked = null, deletingId, page, pageSize, onPageChange, onPageSizeChange, serial = false, images = null, imagesLoading = false }) {
    const showActions = Boolean(onEdit || onDelete);
    const showImage = images != null;
    const columnCount = columns.length + (showActions ? 1 : 0) + (serial ? 1 : 0) + (showImage ? 1 : 0);
    const range = pageWindow(rows.length, page, pageSize);
    const pageRows = slicePage(rows, range.currentPage, pageSize);
    const countWidth = showImage || serial ? '13%' : '15%';
    const nameWidth = showImage ? '20%' : (serial ? '22%' : '26%');
    const actionWidth = showImage ? '24%' : (serial ? '31%' : '29%');
    return (
        <>
            <div className="overflow-x-auto">
                <table className={`-mx-6 w-[calc(100%+3rem)] table-fixed border-separate border-spacing-x-6 text-left ${showImage ? 'min-w-[920px]' : 'min-w-[720px]'}`}>
                    <colgroup>
                        {serial ? <col style={{ width: showImage ? '7%' : '8%' }} /> : null}
                        {showImage ? <col style={{ width: '10%' }} /> : null}
                        {columns.map((column) => (
                            <col key={column.key} style={{ width: column.count ? countWidth : nameWidth }} />
                        ))}
                        {showActions ? <col style={{ width: actionWidth }} /> : null}
                    </colgroup>
                    <thead>
                        <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                            {serial ? <th className="whitespace-nowrap rounded-lg bg-[#F8FAFC] px-4 py-3 font-medium">Sl No</th> : null}
                            {showImage ? <th className="whitespace-nowrap rounded-lg bg-[#F8FAFC] px-4 py-3 font-medium">Image</th> : null}
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
                        ) : pageRows.map((row, index) => (
                            <tr key={row._id} className="text-sm text-slate-700">
                                {serial ? (
                                    <td className="border-b border-slate-100 px-4 py-3 tabular-nums text-slate-500">{range.from + index}</td>
                                ) : null}
                                {showImage ? (
                                    <td className="border-b border-slate-100 px-4 py-2">
                                        <CatalogImage
                                            src={brandImageSrc(images[String(row._id)])}
                                            pending={imagesLoading && !Object.prototype.hasOwnProperty.call(images, String(row._id))}
                                            name={row.name}
                                        />
                                    </td>
                                ) : null}
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
                                            deleteDisabled={Boolean(deleteLocked && deleteLocked(row))}
                                            deleteTitle={STOCK_DELETE_TITLE}
                                        />
                                    </td>
                                ) : null}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ListPager
                from={range.from}
                to={range.to}
                total={rows.length}
                noun={noun}
                page={range.currentPage}
                pages={range.pageCount}
                pageSize={pageSize}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
            />
        </>
    );
}

function ListPager({ from, to, total, noun, page, pages, pageSize, onPageChange, onPageSizeChange }) {
    return (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
            <p>Showing {from} to {to} of {total} {noun}</p>
            <div className="flex flex-wrap items-center gap-3">
                <PageSizeSelect value={pageSize} onChange={onPageSizeChange} />
                <div className="flex items-center gap-1">
                    <PagerButton label="<" disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
                    {pageNumbers(page, pages).map((value, index, list) => (
                        <span key={value} className="flex items-center">
                            {index > 0 && value - list[index - 1] > 1 ? <span className="px-1">...</span> : null}
                            <button
                                type="button"
                                onClick={() => onPageChange(value)}
                                className={`h-8 min-w-8 rounded-lg px-2 ${value === page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                                {value}
                            </button>
                        </span>
                    ))}
                    <PagerButton label=">" disabled={page >= pages} onClick={() => onPageChange(page + 1)} />
                </div>
            </div>
        </div>
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
