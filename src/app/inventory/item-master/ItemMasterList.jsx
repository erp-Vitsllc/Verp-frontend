'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Plus, Search, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fieldClass } from './CatalogModal';
import { AddBrandModal, AddCategoryModal, AddSubcategoryModal } from './CatalogForms';
import { apiMessage, listBrands, listCategories, listItems } from './itemMasterApi';

const PAGE_SIZE = 6;
const STATUSES = ['Active', 'Low Stock', 'Out of Stock'];

const statusClass = {
    Active: 'bg-emerald-50 text-emerald-600',
    'Low Stock': 'bg-orange-50 text-orange-600',
    'Out of Stock': 'bg-red-50 text-red-600',
};

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
    const { toast } = useToast();
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [brandId, setBrandId] = useState('');
    const [status, setStatus] = useState('');
    const [modal, setModal] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const loadCatalog = () => {
        if (!localStorage.getItem('token')) return Promise.resolve();
        return Promise.all([listCategories(), listBrands()]).then(([categoryRows, brandRows]) => {
            setCategories(categoryRows);
            setBrands(brandRows);
        });
    };

    const loadItems = () => {
        if (!localStorage.getItem('token')) {
            setLoading(false);
            return Promise.resolve();
        }
        setLoading(true);
        return listItems({
            page,
            limit: PAGE_SIZE,
            search,
            categoryId,
            brandId,
            status,
        })
            .then((result) => {
                setRows(result.items || []);
                setTotal(result.total || 0);
                setError('');
            })
            .catch((err) => setError(apiMessage(err, 'Could not load items.')))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadCatalog().catch((err) => setError(apiMessage(err, 'Could not load filters.')));
    }, []);

    useEffect(() => {
        loadItems();
    }, [page, search, categoryId, brandId, status]);

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, total);

    const exportCsv = async () => {
        const result = await listItems({ page: 1, limit: 100, search, categoryId, brandId, status });
        const header = ['Item Code', 'Description', 'Brand', 'Category', 'Model', 'Available', 'Status'];
        const lines = [header.join(',')];
        (result.items || []).forEach((row) => {
            const cells = [row.itemCode, row.description, row.brandName, row.categoryName, row.modelNumber, row.availableQuantity, row.status];
            lines.push(cells.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'item-master.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="rounded-2xl border border-[#E6EDF5] bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-slate-900">Item Master</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => router.push('/inventory/item-master/add')} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white">
                        <Plus size={15} /> Add Item
                    </button>
                    <button type="button" onClick={() => setModal('category')} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700">
                        Add Category
                    </button>
                    <button type="button" onClick={() => setModal('subcategory')} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700">
                        Add Sub Category
                    </button>
                    <button type="button" onClick={() => setModal('brand')} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700">
                        Add Brand
                    </button>
                    <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700">
                        <Upload size={15} /> Import Excel
                        <input
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={() => toast({ title: 'Import Excel', description: 'Export this list first, then keep those columns in the CSV.' })}
                        />
                    </label>
                    <button type="button" onClick={exportCsv} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700">
                        <Download size={15} /> Export
                    </button>
                </div>
            </div>

            <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    className={`${fieldClass} pl-9`}
                    placeholder="Search item, model, brand, category, SKU..."
                    value={search}
                    onChange={(event) => {
                        setPage(1);
                        setSearch(event.target.value);
                    }}
                />
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Filter label="Category" value={categoryId} onChange={(value) => { setPage(1); setCategoryId(value); }}>
                    <option value="">All</option>
                    {categories.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
                </Filter>
                <Filter label="Brand" value={brandId} onChange={(value) => { setPage(1); setBrandId(value); }}>
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

            {error ? <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p> : null}

            <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left">
                    <thead>
                        <tr className="bg-[#F8FAFC] text-[11px] uppercase tracking-wide text-slate-400">
                            {['Item Code', 'Item Name / Description', 'Brand', 'Category', 'Model', 'Available', 'Status'].map((heading) => (
                                <th key={heading} className="px-3 py-3 font-medium">{heading}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">Loading items...</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">No items yet.</td></tr>
                        ) : rows.map((row) => (
                            <tr
                                key={row._id}
                                onClick={() => router.push(`/inventory/item-master/${row._id}`)}
                                className="cursor-pointer border-t border-slate-100 text-sm text-slate-700 hover:bg-slate-50"
                            >
                                <td className="px-3 py-3 font-medium text-slate-500">{row.itemCode}</td>
                                <td className="px-3 py-3 font-medium text-slate-800">{row.description}</td>
                                <td className="px-3 py-3">{row.brandName}</td>
                                <td className="px-3 py-3">{row.categoryName}</td>
                                <td className="px-3 py-3">{row.modelNumber}</td>
                                <td className={`px-3 py-3 font-semibold ${availableClass(row)}`}>{row.availableQuantity}</td>
                                <td className="px-3 py-3">
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass[row.status] || 'bg-slate-100 text-slate-600'}`}>
                                        {row.status}
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

            {modal === 'category' ? (
                <AddCategoryModal
                    onClose={() => setModal('')}
                    onSaved={(saved) => setCategories((current) => [...current, saved].sort((a, b) => a.name.localeCompare(b.name)))}
                />
            ) : null}
            {modal === 'subcategory' ? (
                <AddSubcategoryModal categories={categories} onClose={() => setModal('')} onSaved={() => setModal('')} />
            ) : null}
            {modal === 'brand' ? (
                <AddBrandModal
                    onClose={() => setModal('')}
                    onSaved={(saved) => setBrands((current) => [...current, saved].sort((a, b) => a.name.localeCompare(b.name)))}
                />
            ) : null}
        </div>
    );
}

function Filter({ label, value, onChange, children }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
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
