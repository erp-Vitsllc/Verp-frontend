'use client';

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, GripVertical, Paperclip, Printer } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

const FOCUS = 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6fed]/40';
const COLUMNS = ['#', 'Description', 'Qty', 'Rate', 'Amount'];
const BOQ_TABS = [
    { id: 'proposed', label: 'Proposed BOQ' },
    { id: 'actual', label: 'Actual BOQ' },
    { id: 'mr', label: 'MR' },
    { id: 'vendor-lpo', label: 'Vendor LPO' },
];

function money(value) {
    const amount = Number(value);
    const safe = Number.isFinite(amount) ? amount : 0;
    return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusLabel(status) {
    const value = String(status || '').trim();
    if (!value) return '';
    if (/^draft$/i.test(value)) return 'Yet to be Approved';
    return value.replace(/_/g, ' ');
}

function savedQuote(order) {
    const snap = order?.quotationSnapshot;
    if (snap && typeof snap === 'object') return snap;
    return {
        number: order?.quotationRef || '',
        date: order?.quotationDate || '',
        customerName: order?.customer || '',
        projectName: '',
        salespersonName: order?.salespersonName || '',
        billTo: order?.customer ? [order.customer] : [],
        lines: [],
        status: '',
        notes: '',
        terms: '',
        valueExclVat: order?.valueExclVat,
    };
}

function BoqTabs({ active, onChange }) {
    return (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="BOQ">
            {BOQ_TABS.map((item) => {
                const selected = active === item.id;
                return (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => onChange(item.id)}
                        className={selected
                            ? `inline-flex h-10 items-center gap-2 rounded-xl border border-[#2f6fed] bg-[#e8f1ff] px-4 text-[15px] font-semibold text-[#2f6fed] ${FOCUS}`
                            : `inline-flex h-10 items-center gap-2 rounded-xl border border-[#e5edf6] bg-white px-4 text-[15px] font-semibold text-slate-700 hover:bg-[#f4f7fb] ${FOCUS}`}
                    >
                        {item.id === 'proposed' ? <FileText size={16} /> : null}
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}

const ACTUAL_HEAD = [
    { key: 'category', label: 'Category', width: '10%' },
    { key: 'subcategory', label: 'Subcategory', width: '10%' },
    { key: 'item', label: 'Item', width: '9%' },
    { key: 'brand', label: 'Brand', width: '8%' },
    { key: 'modelNo', label: 'Model no', width: '9%' },
    { key: 'description', label: 'Description', width: '12%' },
    { key: 'availableStock', label: 'Available stock', width: '7%', align: 'right' },
    { key: 'quantity', label: 'Qty', width: '6%', align: 'right' },
    { key: 'unitPrice', label: 'Unit price', width: '7%', align: 'right' },
    { key: 'total', label: 'Total', width: '7%', align: 'right' },
    { key: 'vendorName', label: 'Vendor name', width: '8%' },
    { key: 'paymentTerms', label: 'Payment terms', width: '6%' },
];
const ACTUAL_SPAN = ACTUAL_HEAD.length + 1;
const COLUMN_SIZE = {
    drag: { min: 36, max: 72, floor: 44 },
    category: { min: 110, max: 420, floor: 140 },
    subcategory: { min: 120, max: 420, floor: 150 },
    item: { min: 110, max: 420, floor: 140 },
    brand: { min: 100, max: 360, floor: 120 },
    modelNo: { min: 120, max: 360, floor: 140 },
    description: { min: 200, max: 640, floor: 240 },
    availableStock: { min: 88, max: 160, floor: 110 },
    quantity: { min: 72, max: 160, floor: 84 },
    unitPrice: { min: 88, max: 180, floor: 100 },
    total: { min: 88, max: 180, floor: 100 },
    vendorName: { min: 140, max: 460, floor: 170 },
    paymentTerms: { min: 120, max: 360, floor: 140 },
    actions: { min: 44, max: 80, floor: 52 },
};
const COLUMN_PERCENT = {
    drag: 4,
    category: 9,
    subcategory: 9,
    item: 8,
    brand: 7,
    modelNo: 8,
    description: 14,
    availableStock: 8,
    quantity: 5,
    unitPrice: 6,
    total: 6,
    vendorName: 8,
    paymentTerms: 5,
    actions: 3,
};

function fittedWidth(key, texts) {
    const limit = COLUMN_SIZE[key] || { min: 80, max: 320, floor: 100 };
    let width = limit.floor;
    texts.forEach((text) => {
        String(text || '').split('\n').forEach((line) => {
            width = Math.max(width, Math.ceil(line.length * 7.2 + 28));
        });
    });
    return Math.min(limit.max, Math.max(limit.min, width));
}
const CATALOG_FIELDS = [
    ['category', 'categoryName', 'categoryId'],
    ['subcategory', 'subcategoryName', 'subcategoryId'],
    ['item', 'itemName', 'itemOptionId'],
    ['brand', 'brandName', 'brandId'],
    ['modelNo', 'modelNumber', 'itemId'],
];

function rowKey() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyActualRow() {
    return {
        key: rowKey(),
        kind: 'line',
        itemId: '',
        categoryId: '',
        subcategoryId: '',
        itemOptionId: '',
        brandId: '',
        slNo: '',
        category: '',
        subcategory: '',
        item: '',
        brand: '',
        modelNo: '',
        descriptionNew: '',
        descriptionOld: '',
        quantity: '',
        unitPrice: '',
        total: '',
        vendorName: '',
        paymentTerms: '',
    };
}

function shownDescription(row, mode) {
    const key = mode === 'old' ? 'descriptionOld' : 'descriptionNew';
    return String(row?.[key] || '').trim();
}

function sameName(left, right) {
    return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

function optionList(values, current) {
    const seen = new Map();
    const add = (value) => {
        const label = String(value || '').trim();
        if (!label) return;
        const key = label.toLowerCase();
        if (!seen.has(key)) seen.set(key, label);
    };
    values.forEach(add);
    add(current);
    return [...seen.values()].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
}

function fieldMatches(item, line, field, prop, idKey) {
    const id = String(line?.[idKey] || '');
    const name = String(line?.[field] || '').trim();
    if (field === 'modelNo') {
        if (!name) return true;
        return sameName(item.modelNumber, name);
    }
    if (!id && !name) return true;
    if (id) return String(item[idKey] || '') === id;
    return sameName(item[prop], name);
}

function itemMatches(item, line, skip) {
    return CATALOG_FIELDS.every(([field, prop, idKey]) => (
        field === skip || fieldMatches(item, line, field, prop, idKey)
    ));
}

function existingCatalogName(items, line, field) {
    const typed = String(line?.[field] || '').trim();
    if (!typed) return false;
    return (items || []).some((item) => {
        if (field === 'category') return sameName(item.categoryName, typed);
        if (field !== 'subcategory' || !sameName(item.subcategoryName, typed)) return false;
        const categoryId = String(line?.categoryId || '');
        const category = String(line?.category || '').trim();
        if (categoryId) return String(item.categoryId || '') === categoryId;
        if (category) return sameName(item.categoryName, category);
        return true;
    });
}

function catalogChoices(items, line, field) {
    const meta = CATALOG_FIELDS.find(([key]) => key === field);
    if (!meta) return [];
    const [, prop] = meta;
    const labels = [];
    items.forEach((item) => {
        if (!itemMatches(item, line, field)) return;
        labels.push(field === 'modelNo' ? item.modelNumber : item[prop]);
    });
    return optionList(labels, line?.[field]);
}

function catalogDescription(item) {
    return [item?.description, item?.moreDescription]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join('\n');
}

function applyCatalogItem(line, item) {
    const next = {
        ...line,
        kind: 'line',
        itemId: String(item.id || ''),
        categoryId: String(item.categoryId || ''),
        subcategoryId: String(item.subcategoryId || ''),
        itemOptionId: String(item.itemOptionId || ''),
        brandId: String(item.brandId || ''),
        category: item.categoryName || '',
        subcategory: item.subcategoryName || '',
        item: item.itemName || '',
        brand: item.brandName || '',
        modelNo: item.modelNumber || '',
        descriptionNew: catalogDescription(item) || line.descriptionNew || '',
    };
    return syncLineTotal(next);
}

function syncLineTotal(line) {
    const qtyText = String(line?.quantity ?? '').trim();
    const priceText = String(line?.unitPrice ?? '').trim();
    if (!qtyText || !priceText) return { ...line, total: '' };
    const qty = Number(qtyText);
    const price = Number(priceText);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return { ...line, total: '' };
    return { ...line, total: Math.round(qty * price * 100) / 100 };
}

function pickCatalogValue(line, field, value, items) {
    const meta = CATALOG_FIELDS.find(([key]) => key === field);
    if (!meta) return { ...line, [field]: value };
    const [, prop, idKey] = meta;
    const next = { ...line, [field]: value };
    if (field === 'modelNo') next.itemId = '';
    else next[idKey] = '';
    const typed = String(value || '').trim();
    if (!typed) return next;
    if (field === 'modelNo') {
        const owners = items.filter((item) => sameName(item.modelNumber, typed));
        const owner = owners.find((item) => !item.pendingStock) || owners[0];
        return owner ? applyCatalogItem(next, owner) : next;
    }
    const ids = new Set();
    items.forEach((item) => {
        if (sameName(item[prop], typed) && item[idKey]) ids.add(String(item[idKey]));
    });
    if (ids.size === 1) next[idKey] = [...ids][0];
    let pool = items.filter((item) => fieldMatches(item, next, field, prop, idKey));
    if (!pool.length) return next;
    CATALOG_FIELDS.forEach(([key, nameProp, keyId]) => {
        if (key === field) return;
        const current = String(next[key] || '').trim();
        if (!current) return;
        const source = key === 'modelNo' ? 'modelNumber' : nameProp;
        const matched = pool.filter((item) => sameName(item[source], current));
        if (matched.length) {
            pool = matched;
            return;
        }
        next[key] = '';
        if (key === 'modelNo') next.itemId = '';
        else next[keyId] = '';
    });
    if (pool.length === 1) return applyCatalogItem(next, pool[0]);
    if (field === 'subcategory' || field === 'item') {
        const owners = catalogOwners(next, field, items);
        if (field === 'item') applyUniqueCatalogField(next, owners, 'subcategory', 'subcategoryId', 'subcategoryName');
        applyUniqueCatalogField(next, owners, 'category', 'categoryId', 'categoryName');
    }
    return next;
}

function catalogOwners(line, field, items) {
    const meta = CATALOG_FIELDS.find(([key]) => key === field);
    if (!meta) return [];
    const [, prop, idKey] = meta;
    const id = String(line?.[idKey] || '');
    const name = String(line?.[field] || '').trim();
    if (!id && !name) return [];
    return items.filter((item) => (
        id ? String(item[idKey] || '') === id : sameName(item[prop], name)
    ));
}

function applyUniqueCatalogField(line, owners, field, idKey, nameKey) {
    const values = new Map();
    owners.forEach((item) => {
        const id = String(item[idKey] || '');
        const name = String(item[nameKey] || '').trim();
        if (!id && !name) return;
        values.set(id || name.toLowerCase(), { id, name });
    });
    if (values.size !== 1) return;
    const chosen = [...values.values()][0];
    line[idKey] = chosen.id;
    line[field] = chosen.name;
}

function editAmount(line, field, raw) {
    const cleaned = String(raw ?? '').replace(/,/g, '');
    if (cleaned !== '' && !/^\d*\.?\d*$/.test(cleaned)) return line;
    if (field === 'total') return line;
    return syncLineTotal({ ...line, [field]: cleaned });
}

function lineFromSaved(line) {
    return syncLineTotal({
        ...emptyActualRow(),
        slNo: line?.slNo ?? '',
        itemId: line?.itemId || '',
        categoryId: line?.categoryId || '',
        subcategoryId: line?.subcategoryId || '',
        itemOptionId: line?.itemOptionId || '',
        brandId: line?.brandId || '',
        category: line?.category || '',
        subcategory: line?.subcategory || '',
        item: line?.item || '',
        brand: line?.brand || '',
        modelNo: line?.modelNo || '',
        descriptionNew: line?.descriptionNew || '',
        descriptionOld: line?.descriptionOld || '',
        quantity: line?.quantity ?? '',
        unitPrice: line?.unitPrice ?? '',
        vendorName: line?.vendorName || '',
        paymentTerms: paymentTermOption(line?.paymentTerms) || line?.paymentTerms || '',
        purchaserItemStatus: ['pending', 'approved', 'rejected'].includes(line?.purchaserItemStatus) ? line.purchaserItemStatus : '',
        newItemKey: line?.newItemKey || '',
    });
}

function rowsFromTables(tables) {
    const rows = [];
    (Array.isArray(tables) ? tables : []).forEach((table) => {
        const inner = Array.isArray(table?.rows) ? table.rows : [];
        const hasHeader = inner.some((row) => row?.kind === 'header');
        const title = String(table?.title || '').trim();
        if (!hasHeader && title) rows.push({ key: rowKey(), kind: 'header', title });
        inner.forEach((row) => {
            if (row?.kind === 'header') {
                const name = String(row?.title || '').trim();
                if (name) rows.push({ key: rowKey(), kind: 'header', title: name });
                return;
            }
            rows.push(lineFromSaved(row));
        });
    });
    if (!rows.some((row) => row.kind !== 'header')) rows.push(emptyActualRow());
    return rows;
}

function catalogItem(row) {
    return {
        id: String(row?.id || row?._id || ''),
        categoryId: String(row?.categoryId || ''),
        subcategoryId: String(row?.subcategoryId || ''),
        itemOptionId: String(row?.itemOptionId || ''),
        brandId: String(row?.brandId || ''),
        categoryName: row?.categoryName || '',
        subcategoryName: row?.subcategoryName || '',
        itemName: row?.itemName || '',
        brandName: row?.brandName || '',
        modelNumber: row?.modelNumber || '',
        description: row?.description || '',
        moreDescription: row?.moreDescription || '',
        lastStockPrice: Number(row?.lastStockPrice) || 0,
        pendingStock: Boolean(row?.pendingStock),
        availableStock: Number(row?.availableQuantity) || 0,
    };
}

function stockOwners(line, catalog) {
    const itemName = String(line?.item || '').trim();
    if (!itemName) return [];
    let owners = (catalog || []).filter((item) => sameName(item.itemName, itemName));
    const subId = String(line?.subcategoryId || '');
    const subName = String(line?.subcategory || '').trim();
    if (subId) owners = owners.filter((item) => String(item.subcategoryId || '') === subId);
    else if (subName) owners = owners.filter((item) => sameName(item.subcategoryName, subName));
    const brandId = String(line?.brandId || '');
    const brandName = String(line?.brand || '').trim();
    if (brandId) owners = owners.filter((item) => String(item.brandId || '') === brandId);
    else if (brandName) owners = owners.filter((item) => sameName(item.brandName, brandName));
    const model = String(line?.modelNo || '').trim();
    if (model) owners = owners.filter((item) => sameName(item.modelNumber, model));
    return owners;
}

function availableStockFor(line, catalog) {
    const itemId = String(line?.itemId || '');
    if (itemId) {
        const match = (catalog || []).find((item) => item.id === itemId);
        if (match) return match.availableStock;
        return String(line?.item || line?.category || '').trim() ? 0 : '';
    }
    const itemName = String(line?.item || '').trim();
    if (!itemName) return '';
    const owners = stockOwners(line, catalog);
    if (!owners.length) return itemName ? 0 : '';
    return owners.reduce((sum, item) => sum + (Number(item.availableStock) || 0), 0);
}

function stockText(line, catalog) {
    const stock = availableStockFor(line, catalog);
    if (stock === '' || stock == null) return '';
    return Number(stock) === 0 ? 'Out of Stock' : String(stock);
}

const PURCHASER_NEW_ITEM_MESSAGE = 'purchasor have a task on itemmaster new item is added approve that first';

function isNewBoqItem(line, catalog) {
    if (line?.kind === 'header') return false;
    const status = String(line?.purchaserItemStatus || '');
    if (status === 'pending' || status === 'rejected') return true;
    if (status === 'approved') return false;
    const itemName = String(line?.item || '').trim();
    if (!itemName) return false;
    const itemId = String(line?.itemId || '');
    if (itemId) {
        const listed = (catalog || []).some((item) => item.id === itemId);
        if (listed || !(catalog || []).length) return false;
    }
    return stockOwners(line, catalog).length === 0;
}

function loadBoqCatalog() {
    const vendorsOf = (response) => (Array.isArray(response?.data?.vendors) ? response.data.vendors : []);
    const itemsOf = (response) => (Array.isArray(response?.data?.items) ? response.data.items.map(catalogItem) : []);
    return axiosInstance.get('/WorkOrder/boq-catalog', { skipToast: true })
        .then((response) => ({ items: itemsOf(response), vendors: vendorsOf(response) }))
        .catch(() => Promise.all([
            axiosInstance.get('/Inventory/items/stock-options', { skipToast: true }).catch(() => ({ data: {} })),
            axiosInstance.get('/WorkOrder/vendors', { skipToast: true }).catch(() => ({ data: {} })),
        ]).then(([itemsResponse, vendorsResponse]) => ({
            items: itemsOf(itemsResponse),
            vendors: vendorsOf(vendorsResponse),
        })));
}

const REQUIRED_LINE_COLUMNS = [
    ['category', 'Category'],
    ['subcategory', 'Subcategory'],
    ['item', 'Item'],
    ['brand', 'Brand'],
    ['modelNo', 'Model no'],
    ['descriptionNew', 'Description (New)'],
    ['descriptionOld', 'Description (Old)'],
    ['quantity', 'Qty'],
    ['unitPrice', 'Unit price'],
    ['total', 'Total'],
    ['vendorName', 'Vendor name'],
    ['paymentTerms', 'Payment terms'],
];

function blankBoqMessage(rows, catalog) {
    const list = Array.isArray(rows) ? rows : [];
    const lines = list.filter((row) => row?.kind !== 'header');
    if (!lines.length) return 'Add at least one row and fill every column.';
    const missing = [];
    list.forEach((row, index) => {
        const rowNo = index + 1;
        if (row?.kind === 'header') {
            if (!String(row.title || '').trim()) missing.push(`Row ${rowNo}: header`);
            return;
        }
        REQUIRED_LINE_COLUMNS.forEach(([key, label]) => {
            if (String(row?.[key] ?? '').trim() === '') missing.push(`Row ${rowNo}: ${label}`);
        });
        if (String(row?.category || '').trim() && !existingCatalogName(catalog, row, 'category')) {
            missing.push(`Row ${rowNo}: Category must already exist`);
        }
        if (String(row?.subcategory || '').trim() && !existingCatalogName(catalog, row, 'subcategory')) {
            missing.push(`Row ${rowNo}: Subcategory must already exist`);
        }
        const stock = availableStockFor(row, catalog);
        if (stock === '' || stock == null) missing.push(`Row ${rowNo}: Available stock`);
    });
    if (!missing.length) return '';
    const shown = missing.slice(0, 6);
    const extra = missing.length - shown.length;
    return `Every row and column must be filled. ${shown.join('; ')}${extra ? `; and ${extra} more` : ''}.`;
}

function rowPayload(row) {
    if (row.kind === 'header') {
        const title = String(row.title || '').trim();
        return title ? { kind: 'header', title } : null;
    }
    const { key, ...rest } = row;
    return { ...rest, kind: 'line' };
}

const PAYMENT_TERM_OPTIONS = ['Cash', 'Due on receipt', '30 days', '60 days', '45 days', '90 days'];

/** A vendor term such as "Net 60" becomes one of the Actual BOQ choices. */
function paymentTermOption(value) {
    const key = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key) return '';
    const exact = PAYMENT_TERM_OPTIONS.find((item) => item.toLowerCase() === key);
    if (exact) return exact;
    if (/\bcash\b/.test(key)) return 'Cash';
    if (/due on receipt|due upon receipt/.test(key)) return 'Due on receipt';
    const days = key.match(/(\d+)\s*days?\b/) || key.match(/\bnet\s*(\d+)\b/);
    if (!days) return '';
    return PAYMENT_TERM_OPTIONS.find((item) => item.toLowerCase() === `${days[1]} days`) || '';
}

function paymentTermChoices(current) {
    const saved = String(current || '').trim();
    const known = paymentTermOption(saved);
    if (!saved || known) return PAYMENT_TERM_OPTIONS;
    return [...PAYMENT_TERM_OPTIONS, saved];
}

function paymentKind(terms) {
    const value = String(terms || '').trim().toLowerCase();
    if (!value) return '';
    if (/\bcash\b/.test(value) || value.includes('due on receipt') || value === 'cod' || value === 'immediate' || value === 'net 0' || value === '0') {
        return 'cash';
    }
    return 'credit';
}

function printAmount(value) {
    if (value === '' || value == null) return '';
    const amount = Number(value);
    if (!Number.isFinite(amount)) return String(value);
    return money(amount);
}

function printDescription(row) {
    const current = String(row?.descriptionOld || '').trim();
    if (current) return current;
    return String(row?.descriptionNew || '').trim();
}

async function downloadActualBoqPdf(order, tables, descriptionMode = 'new') {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const usable = pageW - margin * 2;
    const headers = ['Description', 'Quantity', 'Price', 'Vendor'];
    const weights = [52, 14, 16, 18];
    const aligns = ['left', 'right', 'right', 'left'];
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    const colW = weights.map((weight) => (usable * weight) / weightTotal);
    let y = 16;

    const drawHeaderRow = () => {
        if (y + 8 > pageH - 12) {
            pdf.addPage();
            y = 16;
        }
        pdf.setFillColor(47, 111, 237);
        pdf.rect(margin, y, usable, 8, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(255, 255, 255);
        let x = margin;
        headers.forEach((label, index) => {
            const align = aligns[index];
            const textX = align === 'right' ? x + colW[index] - 2 : x + 2;
            pdf.text(label, textX, y + 5.2, { align });
            x += colW[index];
        });
        y += 8;
    };

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Actual BOQ', margin, y);
    y += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    const titleBits = [order?.workOrderNo, order?.customer].map((part) => String(part || '').trim()).filter(Boolean);
    if (titleBits.length) {
        pdf.text(titleBits.join('  ·  '), margin, y);
        y += 6;
    }
    y += 2;

    tables.forEach((table, tableIndex) => {
        const heading = String(table.title || '').trim() || (tables.length > 1 ? `Table ${tableIndex + 1}` : '');
        if (heading) {
            if (y + 8 > pageH - 12) {
                pdf.addPage();
                y = 16;
            }
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.setTextColor(15, 23, 42);
            pdf.text(heading, margin, y + 4);
            y += 7;
        }
        drawHeaderRow();
        let stripe = 0;
        (table.rows || []).forEach((row) => {
            if (row?.kind === 'header') {
                const section = String(row.title || '').trim();
                if (!section) return;
                if (y + 8 > pageH - 12) {
                    pdf.addPage();
                    y = 16;
                }
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(10);
                pdf.setTextColor(15, 23, 42);
                pdf.text(section, margin, y + 4);
                y += 7;
                return;
            }
            const cells = [
                shownDescription(row, descriptionMode),
                printAmount(row.quantity),
                printAmount(row.unitPrice),
                String(row.vendorName || '').trim(),
            ];
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            const lines = cells.map((cell, index) => pdf.splitTextToSize(cell || ' ', Math.max(colW[index] - 4, 8)));
            const rowH = Math.max(7, Math.max(...lines.map((line) => line.length)) * 3.6 + 2);
            if (y + rowH > pageH - 12) {
                pdf.addPage();
                y = 16;
                drawHeaderRow();
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(8);
            }
            if (stripe % 2 === 1) {
                pdf.setFillColor(244, 247, 251);
                pdf.rect(margin, y, usable, rowH, 'F');
            }
            stripe += 1;
            pdf.setTextColor(15, 23, 42);
            let x = margin;
            lines.forEach((line, index) => {
                const align = aligns[index];
                const textX = align === 'right' ? x + colW[index] - 2 : x + 2;
                pdf.text(line, textX, y + 4.5, { align });
                x += colW[index];
            });
            pdf.setDrawColor(226, 232, 240);
            pdf.line(margin, y + rowH, margin + usable, y + rowH);
            y += rowH;
        });
        const summary = tableSummary(table.rows);
        if (y + 8 > pageH - 12) {
            pdf.addPage();
            y = 16;
        }
        y += 5;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(51, 65, 85);
        pdf.text(
            `Cash: ${money(summary.cash)}    Credit: ${money(summary.credit)}    Vendor count: ${summary.vendorCount}    Total qty: ${quantityLabel(summary.quantity)}    Total count: ${summary.lineCount}    Total: ${money(summary.amount)}`,
            margin,
            y,
        );
        y += 8;
    });

    const fileName = String(order?.workOrderNo || 'actual-boq').replace(/[^\w.-]+/g, '-');
    pdf.save(`${fileName}-actual-boq.pdf`);
}

function quantityLabel(value) {
    const amount = Number(value);
    const safe = Number.isFinite(amount) ? amount : 0;
    return safe.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function lineIsFilled(row) {
    return ['category', 'subcategory', 'item', 'brand', 'modelNo', 'quantity', 'unitPrice', 'vendorName']
        .some((key) => String(row?.[key] ?? '').trim() !== '');
}

function tableSummary(rows) {
    const vendors = new Set();
    let cash = 0;
    let credit = 0;
    let amount = 0;
    let quantity = 0;
    let lineCount = 0;
    (Array.isArray(rows) ? rows : []).forEach((row) => {
        if (row?.kind === 'header') return;
        const raw = String(row?.total ?? '').trim();
        const lineTotal = raw === '' ? 0 : Number(raw);
        const total = Number.isFinite(lineTotal) ? lineTotal : 0;
        amount += total;
        const qtyRaw = String(row?.quantity ?? '').trim();
        const qty = qtyRaw === '' ? 0 : Number(qtyRaw);
        if (Number.isFinite(qty)) quantity += qty;
        if (lineIsFilled(row)) lineCount += 1;
        const kind = paymentKind(row?.paymentTerms);
        if (kind === 'cash') cash += total;
        if (kind === 'credit') credit += total;
        const vendor = String(row?.vendorName || '').trim().toLowerCase();
        if (vendor) vendors.add(vendor);
    });
    return { cash, credit, vendorCount: vendors.size, amount, quantity, lineCount };
}

function useFitTextArea(value, fill, layoutKey) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const node = ref.current;
        if (!node) return;
        if (fill) {
            node.style.height = '100%';
            return;
        }
        node.style.height = '0px';
        node.style.height = `${Math.max(28, node.scrollHeight)}px`;
    }, [value, fill, layoutKey]);
    return ref;
}

function ResizeHandle({ axis, title, onResize, onReset }) {
    const vertical = axis === 'col';
    return (
        <span
            role="separator"
            aria-orientation={vertical ? 'vertical' : 'horizontal'}
            title={title}
            onMouseDown={onResize}
            onDoubleClick={onReset}
            className={vertical
                ? 'absolute -right-1 top-0 z-20 h-full w-2 cursor-col-resize bg-slate-300/0 hover:bg-[#2f6fed]'
                : 'absolute -bottom-1 left-0 z-20 h-1.5 w-full cursor-row-resize bg-slate-300/0 hover:bg-[#2f6fed]'}
        />
    );
}

function CellSuggest({ value, options, onPick, readOnly = false, fill = false, layoutKey = 0, allowNew = false }) {
    const rootRef = useRef(null);
    const menuRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [text, setText] = useState(value || '');
    const areaRef = useFitTextArea(text, fill, layoutKey);
    const [menuStyle, setMenuStyle] = useState(null);
    const [active, setActive] = useState(0);
    const needle = String(text || '').trim().toLowerCase();
    const shown = needle
        ? options.filter((option) => option.toLowerCase().includes(needle))
        : options;
    const typedValue = String(text || '').trim();
    const hasExact = options.some((option) => option.toLowerCase() === typedValue.toLowerCase());
    const canAdd = allowNew && Boolean(typedValue) && !hasExact;

    useEffect(() => {
        setText(value || '');
    }, [value]);

    useEffect(() => {
        setActive(0);
    }, [needle, shown.length]);

    useLayoutEffect(() => {
        if (!open) return undefined;
        const place = () => {
            const rect = rootRef.current?.getBoundingClientRect();
            if (!rect) return;
            const width = Math.max(rect.width, 200);
            const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
            const estimated = Math.min(224, (Math.max(shown.length, 1) + (canAdd ? 1 : 0)) * 32 + 8);
            const below = rect.bottom + 4;
            const top = below + estimated > window.innerHeight - 8
                ? Math.max(8, rect.top - estimated - 4)
                : below;
            setMenuStyle({ position: 'fixed', top, left, width, zIndex: 80 });
        };
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [open, text, shown.length, canAdd]);

    useEffect(() => {
        if (!open) return undefined;
        const close = (event) => {
            const target = event.target;
            if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const pick = (option) => {
        setText(option);
        setOpen(false);
        if (option !== value) onPick(option);
    };

    const revert = () => {
        const typed = String(text || '').trim();
        if (!typed) {
            if (value) onPick('');
            else setText('');
            return;
        }
        const exact = options.filter((option) => option.toLowerCase() === typed.toLowerCase());
        if (exact.length === 1) {
            pick(exact[0]);
            return;
        }
        if (allowNew) {
            if (typed !== String(value || '').trim()) onPick(typed);
            else setText(value || '');
            return;
        }
        setText(value || '');
    };

    const menu = open && menuStyle ? createPortal(
        <ul
            ref={menuRef}
            style={menuStyle}
            className="max-h-56 overflow-y-auto rounded-lg border border-[#E6EDF5] bg-white py-1 shadow-lg"
            onMouseDown={(event) => event.preventDefault()}
        >
            {canAdd ? (
                <li>
                    <button
                        type="button"
                        onClick={() => pick(typedValue)}
                        className="w-full px-3 py-2 text-left text-[12px] font-semibold text-[#2f6fed] hover:bg-[#e8f1ff]"
                    >
                        Add &quot;{typedValue}&quot;
                    </button>
                </li>
            ) : null}
            {shown.length ? shown.map((option, index) => (
                <li key={option}>
                    <button
                        type="button"
                        onMouseEnter={() => setActive(index)}
                        onClick={() => pick(option)}
                        className={`w-full px-3 py-2 text-left text-[12px] ${index === active ? 'bg-blue-600 text-white' : 'text-slate-700'}`}
                    >
                        {option}
                    </button>
                </li>
            )) : canAdd ? null : (
                <li className="px-3 py-2 text-[12px] text-slate-400">No matches</li>
            )}
        </ul>,
        document.body,
    ) : null;

    return (
        <div ref={rootRef} className={`relative min-w-0 ${fill ? 'h-full' : ''}`}>
            <textarea
                ref={areaRef}
                value={text}
                readOnly={readOnly}
                rows={1}
                placeholder={readOnly ? '' : (allowNew ? 'Select or type' : 'Select')}
                autoComplete="off"
                onChange={(event) => {
                    if (readOnly) return;
                    setText(event.target.value);
                    setOpen(true);
                }}
                onFocus={() => {
                    if (!readOnly) setOpen(true);
                }}
                onBlur={() => {
                    setOpen(false);
                    if (!readOnly) revert();
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') event.preventDefault();
                    if (readOnly) return;
                    if (event.key === 'Escape') {
                        event.stopPropagation();
                        setOpen(false);
                        setText(value || '');
                        return;
                    }
                    if (event.key === 'Enter' && allowNew && !shown.length) {
                        event.preventDefault();
                        setOpen(false);
                        if (typedValue && typedValue !== String(value || '').trim()) onPick(typedValue);
                        return;
                    }
                    if (!open || !shown.length) return;
                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setActive((current) => (current + 1) % shown.length);
                    } else if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setActive((current) => (current - 1 + shown.length) % shown.length);
                    } else if (event.key === 'Enter' && shown.length) {
                        pick(shown[Math.min(active, shown.length - 1)]);
                    }
                }}
                className={`w-full resize-none bg-transparent px-0.5 py-1 text-left text-[12px] leading-snug text-slate-800 outline-none placeholder:text-slate-400 ${fill ? 'h-full overflow-auto' : 'overflow-hidden'} ${readOnly ? 'cursor-default' : ''}`}
            />
            {menu}
        </div>
    );
}

function GrowText({ value, onChange, readOnly = false, fill = false, layoutKey = 0, label, align = 'left', strong = false }) {
    const ref = useFitTextArea(value, fill, layoutKey);
    return (
        <textarea
            ref={ref}
            value={value ?? ''}
            readOnly={readOnly}
            rows={1}
            aria-label={label}
            onChange={(event) => onChange?.(event.target.value)}
            className={`w-full resize-none bg-transparent px-0.5 py-1 text-[12px] leading-snug outline-none ${align === 'right' ? 'text-right tabular-nums' : 'text-left'} ${strong ? 'font-semibold text-slate-800' : 'text-slate-700'} ${fill ? 'h-full overflow-auto' : 'overflow-hidden'} ${readOnly ? 'cursor-default' : ''}`}
        />
    );
}

function ActualBoqTable({ order, onSaved }) {
    const { toast } = useToast();
    const dragFrom = useRef(null);
    const dropAtRef = useRef(null);
    const [rows, setRows] = useState([]);
    const [updateRows, setUpdateRows] = useState([]);
    const [updateOpen, setUpdateOpen] = useState(false);
    const [updateMeta, setUpdateMeta] = useState({ status: '', title: 'Updates', reason: '' });
    const [approvedUpdates, setApprovedUpdates] = useState([]);
    const [updateRejectNote, setUpdateRejectNote] = useState('');
    const [catalog, setCatalog] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [menu, setMenu] = useState(null);
    const [printing, setPrinting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [rejectNote, setRejectNote] = useState('');
    const [descriptionMode, setDescriptionMode] = useState('new');
    const [headerAsk, setHeaderAsk] = useState(null);
    const [dropAt, setDropAt] = useState(null);
    const [dropScope, setDropScope] = useState('');
    const [colWidths, setColWidths] = useState({});
    const [rowHeights, setRowHeights] = useState({});
    const resizeRef = useRef(null);
    const fitted = useMemo(() => {
        const map = {};
        const textsOf = (key) => {
            if (key === 'drag' || key === 'actions') return [''];
            const body = rows
                .filter((row) => row.kind !== 'header')
                .map((row) => (
                    key === 'description'
                        ? shownDescription(row, descriptionMode)
                        : key === 'availableStock'
                            ? stockText(row, catalog)
                            : row[key]
                ));
            const head = ACTUAL_HEAD.find((column) => column.key === key);
            return head ? [head.label, ...body] : body;
        };
        Object.keys(COLUMN_SIZE).forEach((key) => {
            map[key] = colWidths[key] || fittedWidth(key, textsOf(key));
        });
        return map;
    }, [rows, descriptionMode, colWidths, catalog]);

    useEffect(() => {
        const move = (event) => {
            const session = resizeRef.current;
            if (!session) return;
            const delta = session.kind === 'col' ? event.clientX - session.startX : event.clientY - session.startY;
            const size = Math.max(session.min, Math.min(session.max, Math.round(session.startSize + delta)));
            if (session.kind === 'col') {
                setColWidths((current) => ({
                    ...(Object.keys(current).length ? current : (session.baseWidths || {})),
                    [session.key]: size,
                }));
            } else setRowHeights((current) => ({ ...current, [session.key]: size }));
        };
        const stop = () => {
            if (!resizeRef.current) return;
            resizeRef.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', stop);
        return () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', stop);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, []);
    const capturedAt = order?.quotationSnapshot?.capturedAt || '';
    const savedStatus = order?.actualBoq?.status || '';
    const savedStamp = order?.actualBoq?.requestedAt || order?.actualBoq?.decidedAt || '';
    const updateStamp = (Array.isArray(order?.actualBoq?.updates) ? order.actualBoq.updates : []).map((item) => [
        item?.status || '',
        item?.title || '',
        item?.requestedAt || '',
        item?.decidedAt || '',
        item?.reason || '',
    ].join('~')).join('|');
    const vendorNames = useMemo(() => optionList(vendors.map((vendor) => vendor.name), ''), [vendors]);

    useEffect(() => {
        let cancelled = false;
        loadBoqCatalog()
            .then((result) => {
                if (cancelled) return;
                setCatalog(result.items);
                setVendors(result.vendors);
            })
            .catch(() => {
                if (!cancelled) {
                    setCatalog([]);
                    setVendors([]);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [savedStatus]);

    useEffect(() => {
        const saved = Array.isArray(order?.actualBoq?.tables) ? order.actualBoq.tables : [];
        if (saved.length) {
            setRows(rowsFromTables(saved));
            setLoading(false);
            setFailed(false);
            setMenu(null);
            return undefined;
        }
        if (!order?._id) return undefined;
        let cancelled = false;
        setLoading(true);
        setFailed(false);
        setMenu(null);
        axiosInstance.get(`/WorkOrder/${order._id}/actual-boq`, { skipToast: true })
            .then((response) => {
                if (cancelled) return;
                const lines = Array.isArray(response.data?.lines) ? response.data.lines : [];
                setRows(lines.length ? lines.map((line) => lineFromSaved(line)) : [emptyActualRow()]);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [order?._id, capturedAt, savedStatus, savedStamp]);

    useEffect(() => {
        const updates = Array.isArray(order?.actualBoq?.updates) ? order.actualBoq.updates : [];
        const frozen = [];
        let open = null;
        updates.forEach((item, index) => {
            if (item?.status === 'approved') {
                frozen.push({
                    key: `${index}-${item?.title || 'Updates'}`,
                    title: item?.title || 'Updates',
                    rows: rowsFromTables(item?.tables),
                });
                return;
            }
            open = item;
        });
        setApprovedUpdates(frozen);
        if (!open) {
            setUpdateOpen(false);
            setUpdateRows([]);
            setUpdateMeta({ status: '', title: 'Updates', reason: '', saved: false });
            return;
        }
        setUpdateOpen(true);
        setUpdateMeta({
            status: open.status || 'draft',
            title: open.title || 'Updates',
            reason: open.reason || '',
            saved: Boolean(open.requestedAt),
        });
        setUpdateRows(rowsFromTables(open.tables));
        setMenu(null);
    }, [order?._id, updateStamp]);

    useEffect(() => {
        if (!menu) return undefined;
        const close = (event) => {
            const target = event.target;
            if (target?.closest?.('[data-boq-menu]') || target?.closest?.('[data-boq-plus]')) return;
            setMenu(null);
        };
        const dismiss = () => setMenu(null);
        const onKey = (event) => {
            if (event.key === 'Escape') setMenu(null);
        };
        window.addEventListener('mousedown', close);
        window.addEventListener('keydown', onKey);
        window.addEventListener('resize', dismiss);
        window.addEventListener('scroll', dismiss, true);
        return () => {
            window.removeEventListener('mousedown', close);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', dismiss);
            window.removeEventListener('scroll', dismiss, true);
        };
    }, [menu]);

    const applyRows = (scope, recipe) => {
        const setter = scope === 'update' ? setUpdateRows : setRows;
        setter((current) => recipe(current));
    };

    const openMenu = (event, rowIndex, scope) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const id = `row:${scope}:${rowIndex}`;
        const width = 156;
        const height = 152;
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        const below = rect.bottom + 4;
        const top = below + height > window.innerHeight ? Math.max(8, rect.top - height - 4) : below;
        setMenu((current) => (current?.id === id ? null : { id, rowIndex, scope, top, left }));
    };

    const insertRow = (scope, rowIndex, row) => {
        applyRows(scope, (current) => {
            const next = current.slice();
            next.splice(rowIndex + 1, 0, row);
            return next;
        });
        setMenu(null);
    };

    const addRow = (scope, rowIndex) => insertRow(scope, rowIndex, emptyActualRow());

    const cloneRow = (scope, rowIndex) => {
        applyRows(scope, (current) => {
            const source = current[rowIndex];
            if (!source) return current;
            const next = current.slice();
            next.splice(rowIndex + 1, 0, { ...source, key: rowKey() });
            return next;
        });
        setMenu(null);
    };

    const deleteRow = (scope, rowIndex) => {
        applyRows(scope, (current) => {
            const next = current.filter((_, index) => index !== rowIndex);
            if (!next.some((row) => row.kind !== 'header')) next.push(emptyActualRow());
            return next.length ? next : [emptyActualRow()];
        });
        setMenu(null);
    };

    const askHeader = (scope, rowIndex) => {
        setMenu(null);
        setHeaderAsk({ scope, rowIndex, name: '' });
    };

    const confirmHeader = () => {
        const name = String(headerAsk?.name || '').trim();
        const rowIndex = headerAsk?.rowIndex;
        const scope = headerAsk?.scope || 'main';
        if (!name || rowIndex == null) return;
        applyRows(scope, (current) => {
            if (rowIndex < 0 || rowIndex >= current.length) return current;
            const next = current.slice();
            next.splice(rowIndex + 1, 0, { key: rowKey(), kind: 'header', title: name });
            return next;
        });
        setHeaderAsk(null);
    };

    const patchRow = (scope, rowIndex, next) => {
        applyRows(scope, (current) => current.map((row, index) => (index === rowIndex ? next : row)));
    };

    const moveRow = (scope, from, to) => {
        applyRows(scope, (current) => {
            if (from == null || to == null || from < 0 || from >= current.length) return current;
            if (from === to || from + 1 === to) return current;
            const next = current.slice();
            const [item] = next.splice(from, 1);
            const dest = from < to ? to - 1 : to;
            next.splice(dest, 0, item);
            return next;
        });
    };

    const onDragStart = (event, rowIndex, scope) => {
        dragFrom.current = { scope, index: rowIndex };
        dropAtRef.current = null;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(rowIndex));
    };

    const onDragOver = (event, rowIndex, scope) => {
        if (!dragFrom.current || dragFrom.current.scope !== scope) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const next = event.clientY > rect.top + rect.height / 2 ? rowIndex + 1 : rowIndex;
        dropAtRef.current = next;
        setDropScope(scope);
        setDropAt(next);
    };

    const onDrop = (event) => {
        event.preventDefault();
        const from = dragFrom.current;
        if (from) moveRow(from.scope, from.index, dropAtRef.current);
        dragFrom.current = null;
        dropAtRef.current = null;
        setDropScope('');
        setDropAt(null);
    };

    const onDragEnd = () => {
        dragFrom.current = null;
        dropAtRef.current = null;
        setDropScope('');
        setDropAt(null);
    };

    const boqStatus = order?.actualBoq?.status || '';
    const pending = boqStatus === 'pending';
    const approved = boqStatus === 'approved';
    const purchaserItemRows = rows.filter((row) => row?.kind !== 'header' && row?.purchaserItemStatus);
    const purchaserGate = purchaserItemRows.length > 0;
    const purchaserItemsOpen = purchaserItemRows.some((row) => row.purchaserItemStatus !== 'approved');
    const canDecide = pending && (purchaserGate ? Boolean(order?.viewerIsPurchaseOfficer) : Boolean(order?.viewerIsProjectManager));
    const canSave = !pending && !approved;
    const canEditUpdate = approved && updateOpen && updateMeta.status !== 'pending';
    const canDecideUpdate = approved && updateMeta.status === 'pending' && Boolean(order?.viewerIsPurchaseOfficer);

    const saveBoq = async (mode) => {
        if (saving || !canSave) return;
        if (mode === 'submit') {
            const gaps = blankBoqMessage(rows, catalog);
            if (gaps) {
                toast({ title: 'Cannot submit', description: gaps });
                return;
            }
        }
        setSaving(true);
        try {
            const response = await axiosInstance.patch(`/WorkOrder/${order._id}`, {
                ...(mode === 'submit' ? { submitActualBoq: true } : { saveActualBoqDraft: true }),
                actualBoqTables: [{
                    title: '',
                    rows: rows.map(rowPayload).filter(Boolean),
                }],
            });
            if (response.data?.workOrder) onSaved?.(response.data.workOrder);
            toast({
                title: mode === 'submit' ? 'Actual BOQ submitted' : 'Actual BOQ draft saved',
                description: response.data?.emailMessage || (mode === 'submit'
                    ? `Waiting for ${order?.projectManagerName || 'the project manager'} to approve.`
                    : 'The task and notification are assigned to you.'),
            });
        } catch (error) {
            toast({
                title: mode === 'submit' ? 'Could not submit' : 'Could not save the draft',
                description: error?.response?.data?.message || 'Try again.',
            });
        } finally {
            setSaving(false);
        }
    };

    const decideBoq = async (decision) => {
        if (saving || !canDecide) return;
        if (decision === 'reject' && !rejectNote.trim()) return;
        if (decision === 'approve') {
            const gaps = blankBoqMessage(rows, catalog);
            if (gaps) {
                toast({ title: 'Cannot approve', description: gaps });
                return;
            }
        }
        setSaving(true);
        try {
            const response = await axiosInstance.patch(`/WorkOrder/${order._id}`, {
                decideActualBoq: decision,
                rejectReason: rejectNote.trim(),
            });
            setRejectNote('');
            if (response.data?.workOrder) onSaved?.(response.data.workOrder);
            toast({
                title: decision === 'approve' ? 'Approved actual BOQ' : 'Actual BOQ rejected',
                description: response.data?.emailMessage || (decision === 'approve'
                    ? 'This actual BOQ is approved.'
                    : 'The rejection description was saved.'),
            });
        } catch (error) {
            toast({
                title: decision === 'approve' ? 'Could not approve' : 'Could not reject',
                description: error?.response?.data?.message || 'Try again.',
            });
        } finally {
            setSaving(false);
        }
    };

    const startUpdate = () => {
        const count = approvedUpdates.length;
        setUpdateMeta({
            status: 'draft',
            title: count === 0 ? 'Updates' : `Updates ${count + 1}`,
            reason: '',
            saved: false,
        });
        setUpdateRows([emptyActualRow()]);
        setUpdateOpen(true);
        setUpdateRejectNote('');
    };

    const saveUpdate = async (mode) => {
        if (saving || !canEditUpdate) return;
        if (mode === 'submit') {
            const gaps = blankBoqMessage(updateRows, catalog);
            if (gaps) {
                toast({ title: 'Cannot submit', description: gaps });
                return;
            }
        }
        setSaving(true);
        try {
            const response = await axiosInstance.patch(`/WorkOrder/${order._id}`, {
                ...(mode === 'submit' ? { submitActualBoqUpdate: true } : { saveActualBoqUpdateDraft: true }),
                actualBoqUpdateTables: [{
                    title: '',
                    rows: updateRows.map(rowPayload).filter(Boolean),
                }],
            });
            if (response.data?.workOrder) onSaved?.(response.data.workOrder);
            toast({
                title: mode === 'submit' ? `${updateMeta.title || 'Updates'} submitted` : `${updateMeta.title || 'Updates'} draft saved`,
                description: response.data?.emailMessage || (mode === 'submit'
                    ? `Waiting for ${order?.purchaseOfficerName || 'the purchase officer'} to approve.`
                    : 'The task and notification are assigned to you.'),
            });
        } catch (error) {
            toast({
                title: mode === 'submit' ? 'Could not submit' : 'Could not save the draft',
                description: error?.response?.data?.message || 'Try again.',
            });
        } finally {
            setSaving(false);
        }
    };

    const decideUpdate = async (decision) => {
        if (saving || !canDecideUpdate) return;
        if (decision === 'reject' && !updateRejectNote.trim()) return;
        if (decision === 'approve') {
            const gaps = blankBoqMessage(updateRows, catalog);
            if (gaps) {
                toast({ title: 'Cannot approve', description: gaps });
                return;
            }
        }
        setSaving(true);
        try {
            const response = await axiosInstance.patch(`/WorkOrder/${order._id}`, {
                decideActualBoqUpdate: decision,
                rejectReason: updateRejectNote.trim(),
            });
            setUpdateRejectNote('');
            if (response.data?.workOrder) onSaved?.(response.data.workOrder);
            toast({
                title: decision === 'approve' ? `${updateMeta.title || 'Updates'} approved` : `${updateMeta.title || 'Updates'} rejected`,
                description: response.data?.emailMessage || (decision === 'approve'
                    ? 'This update is approved. The next add starts a new table.'
                    : 'The rejection description was saved.'),
            });
        } catch (error) {
            toast({
                title: decision === 'approve' ? 'Could not approve' : 'Could not reject',
                description: error?.response?.data?.message || 'Try again.',
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p className="text-sm text-slate-500">Loading actual BOQ…</p>;
    if (failed) return <p className="text-sm text-slate-500">Actual BOQ could not be loaded.</p>;
    if (!rows.length) return <p className="text-sm text-slate-500">No actual BOQ lines yet.</p>;

    const cell = 'relative break-words border border-slate-200 px-1 py-1 align-top font-normal';
    const head = 'relative break-words border border-slate-200 px-1 py-1 align-bottom font-semibold';
    const customColumns = Object.keys(colWidths).length > 0;
    const tableWidth = Object.values(fitted).reduce((sum, width) => sum + width, 0);
    const columnStyle = (key) => (customColumns ? { width: fitted[key] } : { width: `${COLUMN_PERCENT[key]}%` });

    const beginResize = (kind, key, event) => {
        event.preventDefault();
        event.stopPropagation();
        const limit = kind === 'col' ? (COLUMN_SIZE[key] || { min: 72, max: 640 }) : { min: 32, max: 720 };
        let baseWidths = null;
        let measured;
        if (kind === 'col') {
            const table = event.currentTarget.closest('table');
            const headers = table ? [...table.querySelectorAll('thead th')] : [];
            const keys = ['drag', ...ACTUAL_HEAD.map((column) => column.key), 'actions'];
            if (headers.length === keys.length) {
                baseWidths = {};
                keys.forEach((columnKey, index) => {
                    baseWidths[columnKey] = Math.round(headers[index].getBoundingClientRect().width);
                });
            }
            measured = baseWidths?.[key] || colWidths[key] || fitted[key];
        } else {
            measured = rowHeights[key] || event.currentTarget.parentElement?.getBoundingClientRect().height || 36;
        }
        resizeRef.current = {
            kind,
            key,
            startX: event.clientX,
            startY: event.clientY,
            startSize: measured,
            min: Math.min(limit.min, measured || limit.min),
            max: limit.max,
            baseWidths,
        };
        document.body.style.cursor = kind === 'col' ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';
    };

    const resetSize = (kind, key, event) => {
        event.preventDefault();
        event.stopPropagation();
        const clear = (current) => {
            const next = { ...current };
            delete next[key];
            return next;
        };
        if (kind === 'col') setColWidths(clear);
        else setRowHeights(clear);
    };

    const printPdf = async () => {
        if (printing || !rows.length) return;
        setPrinting(true);
        try {
            await downloadActualBoqPdf(order, [{ title: '', rows }], descriptionMode);
        } finally {
            setPrinting(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={printPdf}
                    disabled={printing}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e5edf6] bg-white px-3 text-[13px] font-semibold text-[#2f6fed] hover:bg-[#f4f7fb] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`}
                >
                    <Printer size={14} />
                    {printing ? 'Preparing…' : 'Print'}
                </button>
            </div>
            {(() => {
                const renderSheet = (sheetRows, locked, scope, title) => {
                const summary = tableSummary(sheetRows);
                const descriptionKey = descriptionMode === 'old' ? 'descriptionOld' : 'descriptionNew';
                const totalIndex = ACTUAL_HEAD.findIndex((column) => column.key === 'total');
                return (
                <div>
                {title ? <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3> : null}
                {!locked ? (
                    <p className="mb-2 text-[12px] leading-5 text-slate-500">
                        {scope === 'main'
                            ? 'Choose an existing category and subcategory. Item, brand, and model no can be new. A new item shows with a yellow border and stays pending for the purchaser until they approve it on Item Master. Its stock is Out of Stock.'
                            : 'Choose an existing category and subcategory. Item, brand, and model no can be new. A new item is added on this BOQ now. After approval it is stored with the other items, and its stock is Out of Stock.'}
                    </p>
                ) : null}
                <div className="max-w-full overflow-auto">
                <table className={`border-collapse text-left text-[12px] leading-snug text-slate-700 table-fixed ${customColumns ? '' : 'w-full'}`} style={customColumns ? { width: tableWidth } : undefined}>
                    <colgroup>
                        <col style={columnStyle('drag')} />
                        {ACTUAL_HEAD.map((column) => (
                            <col key={column.key} style={columnStyle(column.key)} />
                        ))}
                        <col style={columnStyle('actions')} />
                    </colgroup>
                    <thead>
                        <tr className="bg-[#f4f7fb] text-[10px] uppercase tracking-wide text-slate-500">
                            <th className={head} aria-label="Drag row" style={columnStyle('drag')}>
                                <ResizeHandle
                                    axis="col"
                                    title="Drag to change width. Double-click to fit the text."
                                    onResize={(event) => beginResize('col', 'drag', event)}
                                    onReset={(event) => resetSize('col', 'drag', event)}
                                />
                            </th>
                            {ACTUAL_HEAD.map((column) => (
                                column.key === 'description' ? (
                                    <th key={column.key} className={head} style={columnStyle(column.key)}>
                                        <ResizeHandle
                                            axis="col"
                                            title="Drag to change width. Double-click to fit the text."
                                            onResize={(event) => beginResize('col', column.key, event)}
                                            onReset={(event) => resetSize('col', column.key, event)}
                                        />
                                        <div className="text-center">Description</div>
                                        <div className="mt-1 flex justify-center gap-1 normal-case tracking-normal">
                                            <button
                                                type="button"
                                                onClick={() => setDescriptionMode('new')}
                                                className={descriptionMode === 'new'
                                                    ? 'rounded border border-[#2f6fed] bg-[#e8f1ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#2f6fed]'
                                                    : 'rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500'}
                                            >
                                                New
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDescriptionMode('old')}
                                                className={descriptionMode === 'old'
                                                    ? 'rounded border border-[#2f6fed] bg-[#e8f1ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#2f6fed]'
                                                    : 'rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500'}
                                            >
                                                Old
                                            </button>
                                        </div>
                                    </th>
                                ) : (
                                    <th key={column.key} className={`${head} ${column.align === 'right' ? 'text-right' : ''}`} style={columnStyle(column.key)}>
                                        <ResizeHandle
                                            axis="col"
                                            title="Drag to change width. Double-click to fit the text."
                                            onResize={(event) => beginResize('col', column.key, event)}
                                            onReset={(event) => resetSize('col', column.key, event)}
                                        />
                                        {column.label}
                                    </th>
                                )
                            ))}
                            <th className={head} aria-label="Row actions" style={columnStyle('actions')}>
                                <ResizeHandle
                                    axis="col"
                                    title="Drag to change width. Double-click to fit the text."
                                    onResize={(event) => beginResize('col', 'actions', event)}
                                    onReset={(event) => resetSize('col', 'actions', event)}
                                />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sheetRows.map((line, rowIndex) => {
                            const rowHeight = rowHeights[line.key];
                            const fill = Boolean(rowHeight);
                            const rowStyle = rowHeight ? { height: rowHeight } : undefined;
                            const rowEdge = (
                                <ResizeHandle
                                    axis="row"
                                    title="Drag to change height. Double-click to fit the text."
                                    onResize={(event) => beginResize('row', line.key, event)}
                                    onReset={(event) => resetSize('row', line.key, event)}
                                />
                            );
                            const marker = dropScope === scope && dropAt === rowIndex
                                ? 'shadow-[inset_0_2px_0_0_#2f6fed]'
                                : dropScope === scope && dropAt === rowIndex + 1 && rowIndex === sheetRows.length - 1
                                    ? 'shadow-[inset_0_-2px_0_0_#2f6fed]'
                                    : '';
                            const dragHandle = (
                                <div
                                    draggable={!locked}
                                    aria-label="Drag row"
                                    title="Drag row"
                                    onDragStart={(event) => {
                                        if (locked) {
                                            event.preventDefault();
                                            return;
                                        }
                                        onDragStart(event, rowIndex, scope);
                                    }}
                                    onDragEnd={onDragEnd}
                                    className={`mx-auto flex h-7 w-6 items-center justify-center rounded text-slate-500 ${locked ? 'cursor-default opacity-40' : 'cursor-grab hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing'}`}
                                >
                                    <GripVertical size={16} />
                                </div>
                            );
                            const plusButton = locked ? null : (
                                <button
                                    type="button"
                                    data-boq-plus=""
                                    aria-label="Row actions"
                                    aria-expanded={menu?.id === `row:${scope}:${rowIndex}`}
                                    onClick={(event) => openMenu(event, rowIndex, scope)}
                                    className="inline-flex h-5 w-5 items-center justify-center rounded border border-[#2f6fed] bg-white text-[12px] font-bold leading-none text-[#2f6fed] hover:bg-[#e8f1ff]"
                                >
                                    +
                                </button>
                            );
                            if (line.kind === 'header') {
                                return (
                                    <tr
                                        key={line.key}
                                        className={`bg-[#f8fafc] ${marker}`}
                                        style={rowStyle}
                                        onDragOver={(event) => onDragOver(event, rowIndex, scope)}
                                        onDrop={onDrop}
                                    >
                                        <td className={`${cell} px-0.5 text-center`} style={rowStyle}>{dragHandle}{rowEdge}</td>
                                        <td colSpan={ACTUAL_SPAN} className={`${cell} px-2 py-2`} style={rowStyle}>
                                            {rowEdge}
                                            <div className="flex items-center gap-2">
                                                {locked ? (
                                                    <span className="min-w-0 flex-1 text-[13px] font-semibold text-slate-800">{line.title}</span>
                                                ) : (
                                                    <input
                                                        value={line.title || ''}
                                                        onChange={(event) => patchRow(scope, rowIndex, { ...line, title: event.target.value })}
                                                        className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-slate-800 outline-none"
                                                        aria-label="Header name"
                                                    />
                                                )}
                                                {plusButton}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }
                            const description = line[descriptionKey] || '';
                            const purchaserStatus = scope === 'main' ? String(line.purchaserItemStatus || '') : '';
                            const newItemRow = scope === 'main' && isNewBoqItem(line, catalog);
                            const lineCell = newItemRow
                                ? 'relative break-words border-2 border-yellow-400 bg-yellow-50 px-1 py-1 align-top font-normal'
                                : cell;
                            return (
                                <tr
                                    key={line.key}
                                    className={marker}
                                    style={rowStyle}
                                    onDragOver={(event) => onDragOver(event, rowIndex, scope)}
                                    onDrop={onDrop}
                                >
                                    <td className={`${lineCell} px-0.5 text-center`} style={rowStyle}>{dragHandle}{rowEdge}</td>
                                    {CATALOG_FIELDS.map(([field]) => (
                                        <td key={field} className={lineCell} style={rowStyle}>
                                            {rowEdge}
                                            <CellSuggest
                                                value={line[field] || ''}
                                                options={catalogChoices(catalog, line, field)}
                                                readOnly={locked}
                                                allowNew={field === 'item' || field === 'brand' || field === 'modelNo'}
                                                fill={fill}
                                                layoutKey={fitted[field]}
                                                onPick={(value) => patchRow(scope, rowIndex, pickCatalogValue(line, field, value, catalog))}
                                            />
                                            {field === 'item' && purchaserStatus === 'pending' ? (
                                                <p className="px-0.5 pt-0.5 text-[10px] font-semibold leading-4 text-amber-700">Pending for purchaser</p>
                                            ) : null}
                                            {field === 'item' && purchaserStatus === 'rejected' ? (
                                                <p className="px-0.5 pt-0.5 text-[10px] font-semibold leading-4 text-rose-700">Rejected</p>
                                            ) : null}
                                        </td>
                                    ))}
                                    <td className={lineCell} style={rowStyle}>
                                        {rowEdge}
                                        <GrowText
                                            value={description}
                                            readOnly={locked}
                                            fill={fill}
                                            layoutKey={`${fitted.description}:${descriptionMode}`}
                                            label="Description"
                                            onChange={(value) => patchRow(scope, rowIndex, { ...line, [descriptionKey]: value })}
                                        />
                                    </td>
                                    <td className={lineCell} style={rowStyle}>
                                        {rowEdge}
                                        <p className={`px-0.5 py-1 text-right text-[12px] font-medium tabular-nums ${stockText(line, catalog) === 'Out of Stock' ? 'text-red-600' : 'text-slate-700'}`}>
                                            {stockText(line, catalog)}
                                        </p>
                                    </td>
                                    {['quantity', 'unitPrice'].map((field) => (
                                        <td key={field} className={lineCell} style={rowStyle}>
                                            {rowEdge}
                                            <GrowText
                                                value={line[field] ?? ''}
                                                readOnly={locked}
                                                fill={fill}
                                                layoutKey={fitted[field]}
                                                align="right"
                                                label={field === 'unitPrice' ? 'Unit price' : 'Quantity'}
                                                onChange={(value) => patchRow(scope, rowIndex, editAmount(line, field, value))}
                                            />
                                        </td>
                                    ))}
                                    <td className={lineCell} style={rowStyle}>
                                        {rowEdge}
                                        <GrowText
                                            value={line.total ?? ''}
                                            readOnly
                                            fill={fill}
                                            layoutKey={fitted.total}
                                            align="right"
                                            strong
                                            label="Total"
                                        />
                                    </td>
                                    <td className={lineCell} style={rowStyle}>
                                        {rowEdge}
                                        <CellSuggest
                                            value={line.vendorName || ''}
                                            options={optionList(vendorNames, line.vendorName)}
                                            readOnly={locked}
                                            fill={fill}
                                            layoutKey={fitted.vendorName}
                                            onPick={(value) => {
                                                const vendor = vendors.find((row) => sameName(row.name, value));
                                                patchRow(scope, rowIndex, {
                                                    ...line,
                                                    vendorName: value,
                                                    paymentTerms: paymentTermOption(vendor?.paymentTerms) || line.paymentTerms,
                                                });
                                            }}
                                        />
                                    </td>
                                    <td className={lineCell} style={rowStyle}>
                                        {rowEdge}
                                        <select
                                            value={paymentTermOption(line.paymentTerms) || line.paymentTerms || ''}
                                            disabled={locked}
                                            aria-label="Payment terms"
                                            onChange={(event) => patchRow(scope, rowIndex, { ...line, paymentTerms: event.target.value })}
                                            className="w-full cursor-pointer bg-transparent px-0.5 py-1 text-[12px] text-slate-800 outline-none disabled:cursor-default"
                                        >
                                            <option value="">{locked ? '' : 'Select'}</option>
                                            {paymentTermChoices(line.paymentTerms).map((option) => (
                                                <option key={option} value={option}>{option}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className={`${lineCell} text-center`} style={rowStyle}>{rowEdge}{plusButton}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-[#f8fafc] text-[12px] font-semibold text-slate-800">
                            <td className={cell} />
                            <td className={`${cell} px-1 py-1.5 text-right text-[10px] uppercase tracking-wide text-slate-500`} colSpan={totalIndex}>Total</td>
                            <td className={`${cell} px-1 py-1.5 text-right tabular-nums`}>{money(summary.amount)}</td>
                            <td className={cell} colSpan={ACTUAL_HEAD.length - totalIndex} />
                        </tr>
                    </tfoot>
                </table>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-600">
                    <span>Cash: <span className="font-medium tabular-nums text-slate-800">{money(summary.cash)}</span></span>
                    <span>Credit: <span className="font-medium tabular-nums text-slate-800">{money(summary.credit)}</span></span>
                    <span>Vendor count: <span className="font-medium tabular-nums text-slate-800">{summary.vendorCount}</span></span>
                    <span>Total qty: <span className="font-medium tabular-nums text-slate-800">{quantityLabel(summary.quantity)}</span></span>
                    <span>Total count: <span className="font-medium tabular-nums text-slate-800">{summary.lineCount}</span></span>
                </p>
                </div>
                </div>
                );
                };
                return (
                    <>

                    {renderSheet(rows, !canSave, 'main')}
                    {approved ? (
                        <div className="flex flex-col gap-5">
                            <p className="text-sm font-semibold text-emerald-700">Approved actual BOQ</p>
                            {approvedUpdates.map((batch) => (
                                <div key={batch.key}>
                                    {renderSheet(batch.rows, true, `saved:${batch.key}`, batch.title)}
                                    <p className="text-sm font-semibold text-emerald-700">Approved</p>
                                </div>
                            ))}
                            {updateOpen ? (
                                <div className="flex flex-col gap-3">
                                    {renderSheet(updateRows, !canEditUpdate, 'update', updateMeta.title || 'Updates')}
                                    {updateMeta.saved && updateMeta.status === 'draft' ? (
                                        <p className="text-sm text-slate-600">Draft saved. The task and notification are assigned to you.</p>
                                    ) : null}
                                    {updateMeta.status === 'pending' && !canDecideUpdate ? (
                                        <p className="text-sm text-amber-800">Waiting for {order?.purchaseOfficerName || 'the purchase officer'}.</p>
                                    ) : null}
                                    {updateMeta.status === 'rejected' && updateMeta.reason ? (
                                        <p className="text-sm text-rose-700">Rejected: {updateMeta.reason}</p>
                                    ) : null}
                                    {canDecideUpdate ? (
                                        <div className="flex flex-col gap-2">
                                            <p className="text-sm text-slate-600">Approve this update, or reject it with a description.</p>
                                            <textarea
                                                value={updateRejectNote}
                                                onChange={(event) => setUpdateRejectNote(event.target.value)}
                                                rows={2}
                                                placeholder="Description is required to reject"
                                                className="w-full rounded-xl border border-[#e5edf6] px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#2f6fed]/30"
                                            />
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    disabled={saving}
                                                    onClick={() => decideUpdate('approve')}
                                                    className={`inline-flex h-11 items-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] disabled:opacity-60 ${FOCUS}`}
                                                >
                                                    {saving ? 'Saving…' : 'Approve'}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={saving || !updateRejectNote.trim()}
                                                    onClick={() => decideUpdate('reject')}
                                                    className={`inline-flex h-11 items-center rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 ${FOCUS}`}
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                    {canEditUpdate ? (
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                disabled={saving}
                                                onClick={() => saveUpdate('draft')}
                                                className={`inline-flex h-11 items-center rounded-xl border border-[#e5edf6] bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 ${FOCUS}`}
                                            >
                                                {saving ? 'Saving…' : 'Draft'}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={saving}
                                                onClick={() => saveUpdate('submit')}
                                                className={`inline-flex h-11 items-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] disabled:opacity-60 ${FOCUS}`}
                                            >
                                                {saving ? 'Saving…' : 'Submit'}
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <div>
                                    <button
                                        type="button"
                                        onClick={startUpdate}
                                        className={`inline-flex h-11 items-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] ${FOCUS}`}
                                    >
                                        Add
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : null}
                    </>
                );
            })()}
            <div className="flex flex-col gap-3">
                {boqStatus === 'draft' ? (
                    <p className="text-sm text-slate-600">Draft saved. The task and notification are assigned to you.</p>
                ) : null}
                {pending && !canDecide ? (
                    <p className="text-sm text-amber-800">
                        {purchaserGate
                            ? `Waiting for ${order?.purchaseOfficerName || 'the purchaser'}. New items stay pending for the purchaser until they are approved on Item Master.`
                            : `Waiting for ${order?.projectManagerName || 'the project manager'}. Their notification opens this actual BOQ, where they can approve or reject.`}
                    </p>
                ) : null}
                {boqStatus === 'rejected' && order?.actualBoq?.reason ? (
                    <p className="text-sm text-rose-700">Rejected: {order.actualBoq.reason}</p>
                ) : null}
                {canDecide ? (
                    <div className="flex flex-col gap-2">
                        {purchaserItemsOpen ? (
                            <p className="text-sm text-amber-800">{PURCHASER_NEW_ITEM_MESSAGE}</p>
                        ) : (
                            <p className="text-sm text-slate-600">Approve this actual BOQ, or reject it with a description.</p>
                        )}
                        <textarea
                            value={rejectNote}
                            onChange={(event) => setRejectNote(event.target.value)}
                            rows={2}
                            placeholder="Description is required to reject"
                            className="w-full rounded-xl border border-[#e5edf6] px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#2f6fed]/30"
                        />
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => decideBoq('approve')}
                                className={`inline-flex h-11 items-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] disabled:opacity-60 ${FOCUS}`}
                            >
                                {saving ? 'Saving…' : 'Approve'}
                            </button>
                            <button
                                type="button"
                                disabled={saving || !rejectNote.trim()}
                                onClick={() => decideBoq('reject')}
                                className={`inline-flex h-11 items-center rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 ${FOCUS}`}
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                ) : null}
                {canSave ? (
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => saveBoq('draft')}
                            className={`inline-flex h-11 items-center rounded-xl border border-[#e5edf6] bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 ${FOCUS}`}
                        >
                            {saving ? 'Saving…' : 'Draft'}
                        </button>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => saveBoq('submit')}
                            className={`inline-flex h-11 items-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] disabled:opacity-60 ${FOCUS}`}
                        >
                            {saving ? 'Saving…' : 'Submit'}
                        </button>
                    </div>
                ) : null}
            </div>
            {menu && typeof document !== 'undefined' ? createPortal(
                <div
                    data-boq-menu=""
                    className="fixed z-[70] w-[156px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left text-[12px] text-slate-700 shadow-lg"
                    style={{ top: menu.top, left: menu.left }}
                >
                    <button type="button" onClick={() => addRow(menu.scope || 'main', menu.rowIndex)} className="block w-full px-3 py-1.5 text-left hover:bg-[#f4f7fb]">Add row</button>
                    <button type="button" onClick={() => cloneRow(menu.scope || 'main', menu.rowIndex)} className="block w-full px-3 py-1.5 text-left hover:bg-[#f4f7fb]">Clone row</button>
                    <button type="button" onClick={() => askHeader(menu.scope || 'main', menu.rowIndex)} className="block w-full px-3 py-1.5 text-left hover:bg-[#f4f7fb]">Insert header</button>
                    <button type="button" onClick={() => deleteRow(menu.scope || 'main', menu.rowIndex)} className="block w-full px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50">Delete</button>
                </div>,
                document.body,
            ) : null}
            {headerAsk ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            confirmHeader();
                        }}
                        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
                    >
                        <h3 className="text-base font-semibold text-slate-900">Header name</h3>
                        <input
                            autoFocus
                            value={headerAsk.name}
                            onChange={(event) => setHeaderAsk((current) => ({ ...current, name: event.target.value }))}
                            placeholder="Enter the header name"
                            className="mt-3 h-10 w-full rounded-xl border border-[#e5edf6] px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#2f6fed]/30"
                        />
                        <div className="mt-4 flex justify-end gap-2">
                            <button type="button" onClick={() => setHeaderAsk(null)} className={`inline-flex h-9 items-center rounded-xl border border-[#e5edf6] px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 ${FOCUS}`}>Cancel</button>
                            <button type="submit" disabled={!headerAsk.name.trim()} className={`inline-flex h-9 items-center rounded-xl bg-[#2f6fed] px-3 text-sm font-semibold text-white hover:bg-[#245fe0] disabled:opacity-60 ${FOCUS}`}>OK</button>
                        </div>
                    </form>
                </div>
            ) : null}
        </div>
    );
}

function mrDescription(row) {
    const written = String(row?.description || '').trim();
    if (written && row?.descriptionOld == null && row?.descriptionNew == null) return written;
    return String(row?.descriptionOld || '').trim() || String(row?.descriptionNew || '').trim() || written;
}

function mrQtyNumber(value) {
    const text = String(value ?? '').trim();
    if (!text) return 0;
    const amount = Number(text);
    if (!Number.isFinite(amount)) return 0;
    return Math.round(amount * 1000) / 1000;
}

function mrGroupKey(sourceKey) {
    const parts = String(sourceKey || '').split(':');
    if (parts[0] === 'update') return `update:${parts[1]}`;
    return parts[0] || '';
}

function mrLine(row) {
    return syncLineTotal({
        sourceKey: row?.sourceKey || '',
        description: mrDescription(row),
        quantity: row?.quantity ?? '',
        boqQuantity: row?.boqQuantity ?? row?.quantity ?? '',
        unitPrice: row?.unitPrice ?? '',
        requiredDate: String(row?.requiredDate || '').slice(0, 10),
        leadTime: row?.leadTime || '',
        vendorName: row?.vendorName || '',
        paymentTerms: paymentTermOption(row?.paymentTerms) || row?.paymentTerms || '',
    });
}

function mrGroupRows(tables, keyPrefix) {
    const rows = [];
    (Array.isArray(tables) ? tables : []).forEach((table, tableIndex) => {
        (Array.isArray(table?.rows) ? table.rows : []).forEach((row, rowIndex) => {
            if (row?.kind === 'header') return;
            rows.push(mrLine({ ...row, sourceKey: `${keyPrefix}:${tableIndex}:${rowIndex}` }));
        });
    });
    return rows;
}

function approvedMrGroups(order) {
    const groups = [];
    if (order?.actualBoq?.status === 'approved') {
        const rows = mrGroupRows(order.actualBoq?.tables, 'boq');
        if (rows.length) groups.push({ sourceKey: 'boq', rows });
    }
    (Array.isArray(order?.actualBoq?.updates) ? order.actualBoq.updates : []).forEach((update, updateIndex) => {
        if (update?.status !== 'approved') return;
        const sourceKey = `update:${updateIndex}`;
        const rows = mrGroupRows(update?.tables, sourceKey);
        if (rows.length) groups.push({ sourceKey, rows });
    });
    return groups;
}

function withBoqQuantity(order, rows) {
    const quantities = boqQtyByKey(order);
    return rows.map((row) => mrLine({
        ...row,
        boqQuantity: quantities.has(row?.sourceKey) ? quantities.get(row.sourceKey) : (row?.boqQuantity ?? row?.quantity),
    }));
}

function mrDocumentNo(order, index) {
    const number = String(order?.workOrderNo || '').trim() || 'WO';
    return `MR-${number}-${String(index + 1).padStart(3, '0')}`;
}

function mrBatches(order) {
    const stored = order?.materialRequest?.batches;
    if (Array.isArray(stored) && stored.length) {
        return stored.map((batch, index) => ({
            sourceKey: batch?.sourceKey || 'boq',
            title: mrDocumentNo(order, index),
            status: batch?.status || 'open',
            approvalStage: batch?.approvalStage || '',
            reason: batch?.reason || '',
            rows: withBoqQuantity(order, Array.isArray(batch?.rows) ? batch.rows : []),
        }));
    }
    if (!order?.materialRequest?.built) return [];
    const rows = [];
    (Array.isArray(order.materialRequest.tables) ? order.materialRequest.tables : []).forEach((table) => {
        (Array.isArray(table?.rows) ? table.rows : []).forEach((row) => {
            if (row?.kind === 'header') return;
            rows.push(row);
        });
    });
    return [{
        sourceKey: 'boq',
        title: mrDocumentNo(order, 0),
        status: order.materialRequest.status || 'open',
        approvalStage: order.materialRequest.approvalStage || '',
        reason: order.materialRequest.reason || '',
        rows: withBoqQuantity(order, rows),
    }];
}

function actualBoqQtyAllZero(order) {
    const tables = [
        ...(Array.isArray(order?.actualBoq?.tables) ? order.actualBoq.tables : []),
        ...(Array.isArray(order?.actualBoq?.updates) ? order.actualBoq.updates : []).flatMap((update) => (
            Array.isArray(update?.tables) ? update.tables : []
        )),
    ];
    return !tables.some((table) => (Array.isArray(table?.rows) ? table.rows : []).some((row) => (
        row?.kind !== 'header' && mrQtyNumber(row?.quantity) > 0
    )));
}

function boqQtyByKey(order) {
    const quantities = new Map();
    approvedMrGroups(order).forEach((group) => {
        group.rows.forEach((row) => quantities.set(row.sourceKey, mrQtyNumber(row.quantity)));
    });
    return quantities;
}

function consumedMrQty(batches, exceptSourceKey) {
    const totals = new Map();
    batches.forEach((batch) => {
        if (batch?.status === 'rejected') return;
        if (exceptSourceKey && batch.sourceKey === exceptSourceKey) return;
        (batch.rows || []).forEach((row) => {
            if (!row?.sourceKey) return;
            totals.set(row.sourceKey, mrQtyNumber(totals.get(row.sourceKey)) + mrQtyNumber(row.quantity));
        });
    });
    return totals;
}

function nextMrRows(order, batches) {
    const opened = new Set(batches.map((batch) => batch.sourceKey));
    const nextGroup = approvedMrGroups(order).find((group) => (
        !opened.has(group.sourceKey) && group.rows.some((row) => mrQtyNumber(row.quantity) > 0)
    ));
    const consumed = consumedMrQty(batches);
    const quantities = boqQtyByKey(order);
    const rows = [];
    approvedMrGroups(order).forEach((group) => {
        group.rows.forEach((row) => {
            const boqQuantity = quantities.get(row.sourceKey) || 0;
            const balance = boqQuantity - mrQtyNumber(consumed.get(row.sourceKey));
            if (balance <= 0) return;
            if (group.sourceKey !== nextGroup?.sourceKey && !opened.has(group.sourceKey)) return;
            rows.push(mrLine({ ...row, quantity: balance, boqQuantity }));
        });
    });
    return rows;
}

function nextMrCreate(order) {
    if (order?.actualBoq?.status !== 'approved') return null;
    const batches = mrBatches(order);
    if (batches.length) {
        const last = batches[batches.length - 1];
        if (last.status !== 'pending' && last.status !== 'approved') return null;
    }
    const number = mrDocumentNo(order, batches.length);
    const label = `Create ${number}`;
    const zero = actualBoqQtyAllZero(order);
    const rows = nextMrRows(order, batches);
    if (zero || !rows.length) {
        return {
            label,
            number,
            disabled: true,
            reason: zero
                ? 'Create MR is unavailable because every actual BOQ quantity is 0.'
                : 'There is no remaining approved quantity for another material request.',
        };
    }
    return { label, number, disabled: false, reason: '' };
}

function mrPendingRows(order, batches, edits) {
    const live = batches.map((batch) => ({
        ...batch,
        rows: edits[batch.sourceKey] || batch.rows,
    }));
    const consumed = consumedMrQty(live);
    const opened = new Set();
    batches.forEach((batch) => {
        opened.add(batch.sourceKey);
        (batch.rows || []).forEach((row) => opened.add(mrGroupKey(row.sourceKey)));
        (edits[batch.sourceKey] || []).forEach((row) => opened.add(mrGroupKey(row.sourceKey)));
    });
    const onScreen = new Set();
    live.forEach((batch) => {
        if (batch.status === 'rejected') return;
        (batch.rows || []).forEach((row) => { if (row.sourceKey) onScreen.add(row.sourceKey); });
    });
    const quantities = boqQtyByKey(order);
    const pending = [];
    quantities.forEach((boqQuantity, sourceKey) => {
        const balance = boqQuantity - mrQtyNumber(consumed.get(sourceKey));
        if (balance <= 0 || onScreen.has(sourceKey) || !opened.has(mrGroupKey(sourceKey))) return;
        const line = approvedMrGroups(order).flatMap((group) => group.rows).find((row) => row.sourceKey === sourceKey);
        pending.push({ sourceKey, description: line?.description || 'Item', balance });
    });
    return pending;
}

function MaterialRequest({ order, onSaved, onOpenBudget }) {
    const { toast } = useToast();
    const [edits, setEdits] = useState({});
    const [rejectNotes, setRejectNotes] = useState({});
    const [saving, setSaving] = useState(false);
    const batches = useMemo(() => mrBatches(order), [order]);
    const createNext = nextMrCreate(order);
    const pendingRows = mrPendingRows(order, batches, edits);
    const stamp = useMemo(() => JSON.stringify(batches.map((batch) => ({
        sourceKey: batch.sourceKey,
        status: batch.status,
        stage: batch.approvalStage,
        reason: batch.reason,
        rows: batch.rows,
    }))), [batches]);

    useEffect(() => {
        const next = {};
        JSON.parse(stamp).forEach((batch) => { next[batch.sourceKey] = batch.rows; });
        setEdits(next);
        setRejectNotes({});
    }, [stamp]);

    const patchRow = (sourceKey, index, patch) => {
        setEdits((current) => {
            const rows = [...(current[sourceKey] || [])];
            rows[index] = syncLineTotal({ ...rows[index], ...patch });
            return { ...current, [sourceKey]: rows };
        });
    };
    const removeRow = (sourceKey, index) => {
        setEdits((current) => {
            const rows = [...(current[sourceKey] || [])];
            rows.splice(index, 1);
            return { ...current, [sourceKey]: rows };
        });
    };
    const balanceFor = (batchKey, row) => {
        const usedElsewhere = batches.reduce((sum, batch) => {
            if (batch.sourceKey === batchKey || batch.status === 'rejected') return sum;
            return sum + (edits[batch.sourceKey] || batch.rows).reduce((lineSum, line) => (
                line.sourceKey === row.sourceKey ? lineSum + mrQtyNumber(line.quantity) : lineSum
            ), 0);
        }, 0);
        const available = Math.max(0, mrQtyNumber(row.boqQuantity) - usedElsewhere);
        return { available, pending: Math.max(0, available - mrQtyNumber(row.quantity)) };
    };

    const payloadRows = (sourceKey) => (edits[sourceKey] || []).map((row) => ({
        sourceKey: row.sourceKey,
        description: row.description,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        requiredDate: row.requiredDate,
        leadTime: row.leadTime,
        vendorName: row.vendorName,
        paymentTerms: row.paymentTerms,
    }));

    const saveOrder = async (body, successTitle) => {
        setSaving(true);
        try {
            const response = await updateWorkOrder(order._id, body);
            onSaved?.(response.workOrder);
            toast({ title: successTitle, description: response.emailMessage || '' });
        } catch (err) {
            toast({ title: 'Could not save', description: err.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const create = () => saveOrder({ createMaterialRequest: true }, `${createNext?.number || 'Material request'} created`);
    const saveDraft = (sourceKey) => saveOrder(
        { saveMaterialRequestDraft: true, mrSourceKey: sourceKey, materialRequestRows: payloadRows(sourceKey) },
        'Draft saved',
    );
    const submit = (sourceKey) => saveOrder(
        { submitMaterialRequest: true, mrSourceKey: sourceKey, materialRequestRows: payloadRows(sourceKey) },
        'Submitted for approval',
    );
    const decide = (sourceKey, decision) => {
        if (decision === 'reject' && !String(rejectNotes[sourceKey] || '').trim()) {
            toast({ title: 'Description required', description: 'Add a description before rejecting.', variant: 'destructive' });
            return;
        }
        saveOrder({
            decideMaterialRequest: decision,
            mrSourceKey: sourceKey,
            rejectReason: decision === 'reject' ? rejectNotes[sourceKey] : '',
            materialRequestRows: payloadRows(sourceKey),
        }, decision === 'approve' ? 'Approved' : 'Rejected');
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-base font-semibold text-slate-950">Material request</h3>
                    <p className="mt-1 text-sm text-slate-500">
                        Create one material request for each approved BOQ. A removed row or a lower quantity stays pending and is included on the next material request.
                    </p>
                </div>
                {createNext ? (
                    <button
                        type="button"
                        disabled={saving || createNext.disabled}
                        title={createNext.reason || undefined}
                        onClick={create}
                        className={`inline-flex h-11 items-center rounded-xl bg-[#7C3AED] px-4 text-sm font-semibold text-white hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`}
                    >
                        {createNext.label}
                    </button>
                ) : null}
            </div>
            {createNext?.disabled && createNext.reason ? (
                <p className="text-sm text-slate-500">{createNext.reason}</p>
            ) : null}
            {pendingRows.length ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <h4 className="text-sm font-semibold text-amber-900">Pending balance</h4>
                    <p className="mt-1 text-xs text-amber-800">The next material request includes these quantities.</p>
                    <ul className="mt-2 space-y-1 text-sm text-amber-900">
                        {pendingRows.map((row) => (
                            <li key={row.sourceKey}>{row.description}: {row.balance}</li>
                        ))}
                    </ul>
                </div>
            ) : null}
            {batches.length ? batches.map((batch) => {
                const rows = edits[batch.sourceKey] || batch.rows;
                const canPrepare = ['open', 'draft', 'rejected'].includes(batch.status);
                const canDecide = batch.status === 'pending' && (
                    batch.approvalStage === 'manager' ? Boolean(order.viewerCanApproveMrManager) : Boolean(order.viewerIsPurchaseOfficer)
                );
                const canEdit = canPrepare || canDecide;
                const submitLabel = order.viewerSubmitsMaterialRequestToManager ? 'Submit' : 'Submit for approval';
                const statusLabel = batch.status === 'pending'
                    ? (batch.approvalStage === 'manager' ? 'Waiting for the project manager' : 'Waiting for the purchase officer')
                    : batch.status === 'approved' ? 'Approved' : batch.status === 'rejected' ? 'Rejected' : batch.status === 'draft' ? 'Draft' : 'Open';
                return (
                    <div key={batch.sourceKey} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold text-slate-900">{batch.title}</h4>
                            <span className="text-xs font-medium text-slate-500">{statusLabel}</span>
                        </div>
                        {batch.status === 'rejected' && batch.reason ? (
                            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{batch.reason}</p>
                        ) : null}
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="w-full min-w-[1180px] border-collapse text-sm">
                                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <tr>
                                        {['Description', 'Qty', 'Unit price', 'Total price', 'Required date', 'Lead time', 'Vendor', 'Payment terms'].map((label) => (
                                            <th key={label} className="border-b border-slate-200 px-3 py-3">{label}</th>
                                        ))}
                                        {canEdit ? <th className="border-b border-slate-200 px-3 py-3">Remove</th> : null}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, index) => (
                                        <tr key={row.sourceKey || index} className="border-b border-slate-100 align-top">
                                            <td className="px-3 py-2">
                                                <input value={row.description} disabled={!canEdit} onChange={(event) => patchRow(batch.sourceKey, index, { description: event.target.value })} className={`h-10 w-full min-w-[220px] rounded-lg border border-slate-200 px-2 ${FOCUS}`} />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    value={row.quantity}
                                                    disabled={!canEdit}
                                                    onChange={(event) => {
                                                        const { available } = balanceFor(batch.sourceKey, row);
                                                        const typed = event.target.value;
                                                        const amount = Number(typed);
                                                        let quantity = typed;
                                                        if (typed !== '' && Number.isFinite(amount)) {
                                                            if (amount < 0) quantity = '0';
                                                            else if (amount > available) quantity = String(available);
                                                        }
                                                        patchRow(batch.sourceKey, index, { quantity });
                                                    }}
                                                    className={`h-10 w-24 rounded-lg border border-slate-200 px-2 ${FOCUS}`}
                                                />
                                                {balanceFor(batch.sourceKey, row).pending > 0 ? (
                                                    <p className="mt-1 text-xs font-medium text-amber-700">Pending {balanceFor(batch.sourceKey, row).pending}</p>
                                                ) : null}
                                            </td>
                                            <td className="px-3 py-2"><input value={row.unitPrice} disabled={!canEdit} onChange={(event) => patchRow(batch.sourceKey, index, { unitPrice: event.target.value })} className={`h-10 w-28 rounded-lg border border-slate-200 px-2 ${FOCUS}`} /></td>
                                            <td className="px-3 py-2 text-slate-700">{money(row.total)}</td>
                                            <td className="px-3 py-2"><input type="date" value={row.requiredDate} disabled={!canEdit} onChange={(event) => patchRow(batch.sourceKey, index, { requiredDate: event.target.value })} className={`h-10 rounded-lg border border-slate-200 px-2 ${FOCUS}`} /></td>
                                            <td className="px-3 py-2"><input value={row.leadTime} disabled={!canEdit} placeholder="Days" onChange={(event) => patchRow(batch.sourceKey, index, { leadTime: event.target.value })} className={`h-10 w-28 rounded-lg border border-slate-200 px-2 ${FOCUS}`} /></td>
                                            <td className="px-3 py-2"><input value={row.vendorName} disabled={!canEdit} onChange={(event) => patchRow(batch.sourceKey, index, { vendorName: event.target.value })} className={`h-10 w-44 rounded-lg border border-slate-200 px-2 ${FOCUS}`} /></td>
                                            <td className="px-3 py-2">
                                                <select value={paymentTermOption(row.paymentTerms) || row.paymentTerms || ''} disabled={!canEdit} onChange={(event) => patchRow(batch.sourceKey, index, { paymentTerms: event.target.value })} className={`h-10 w-40 rounded-lg border border-slate-200 px-2 ${FOCUS}`}>
                                                    <option value="">Select</option>
                                                    {paymentTermChoices(row.paymentTerms).map((option) => (
                                                        <option key={option} value={option}>{option}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            {canEdit ? (
                                                <td className="px-3 py-2">
                                                    <button type="button" onClick={() => removeRow(batch.sourceKey, index)} className={`h-10 rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 ${FOCUS}`}>Remove</button>
                                                </td>
                                            ) : null}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {canPrepare ? (
                            <div className="flex flex-wrap gap-2">
                                <button type="button" disabled={saving} onClick={() => saveDraft(batch.sourceKey)} className={`inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 ${FOCUS}`}>Draft</button>
                                <button type="button" disabled={saving} onClick={() => submit(batch.sourceKey)} className={`inline-flex h-11 items-center rounded-xl bg-[#7C3AED] px-4 text-sm font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-60 ${FOCUS}`}>{submitLabel}</button>
                            </div>
                        ) : null}
                        {batch.status === 'approved' && onOpenBudget ? (
                            <button type="button" onClick={onOpenBudget} className={`inline-flex h-11 items-center rounded-xl bg-[#7C3AED] px-4 text-sm font-semibold text-white hover:bg-[#6D28D9] ${FOCUS}`}>Submit for budget</button>
                        ) : null}
                        {canDecide ? (
                            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <textarea
                                    value={rejectNotes[batch.sourceKey] || ''}
                                    onChange={(event) => setRejectNotes((current) => ({ ...current, [batch.sourceKey]: event.target.value }))}
                                    rows={2}
                                    placeholder="Description, required when rejecting"
                                    className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm ${FOCUS}`}
                                />
                                <div className="flex flex-wrap gap-2">
                                    <button type="button" disabled={saving} onClick={() => decide(batch.sourceKey, 'approve')} className={`inline-flex h-11 items-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 ${FOCUS}`}>Approve</button>
                                    <button type="button" disabled={saving || !String(rejectNotes[batch.sourceKey] || '').trim()} onClick={() => decide(batch.sourceKey, 'reject')} className={`inline-flex h-11 items-center rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 ${FOCUS}`}>Reject</button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                );
            }) : (
                <p className="text-sm text-slate-500">
                    {order?.actualBoq?.status === 'approved'
                        ? 'Use Create MR to build the first request from the approved actual BOQ.'
                        : 'The actual BOQ has to be approved before a material request can be created.'}
                </p>
            )}
        </div>
    );
}

function VendorLpo({ order }) {
    const groups = useMemo(() => {
        const rows = mrBatches(order)
            .filter((batch) => batch.status === 'approved')
            .flatMap((batch) => batch.rows.map((row) => ({ ...row, mrTitle: batch.title })));
        const byVendor = new Map();
        rows.forEach((row) => {
            const vendor = String(row.vendorName || '').trim() || 'No vendor';
            if (!byVendor.has(vendor)) byVendor.set(vendor, []);
            byVendor.get(vendor).push(row);
        });
        return [...byVendor.entries()];
    }, [order]);

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-base font-semibold text-slate-950">Vendor LPO</h3>
                <p className="mt-1 text-sm text-slate-500">Lines from the approved material requests, grouped by vendor.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">Generate LPO</p>
                <p className="mt-1 text-sm text-slate-500">On processing. This opens after management approves the budget.</p>
            </div>
            {groups.length ? groups.map(([vendor, rows]) => (
                <div key={vendor} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                    <h4 className="text-sm font-semibold text-slate-900">{vendor}</h4>
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full min-w-[980px] border-collapse text-sm">
                            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <tr>
                                    {['MR', 'Description', 'Qty', 'Unit price', 'Total price', 'Required date', 'Lead time', 'Payment terms'].map((label) => (
                                        <th key={label} className="border-b border-slate-200 px-3 py-3">{label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, index) => (
                                    <tr key={`${row.sourceKey || index}`} className="border-b border-slate-100">
                                        <td className="px-3 py-3 text-slate-700">{row.mrTitle}</td>
                                        <td className="px-3 py-3 text-slate-800">{row.description || '—'}</td>
                                        <td className="px-3 py-3 tabular-nums text-slate-700">{row.quantity === '' || row.quantity == null ? '—' : row.quantity}</td>
                                        <td className="px-3 py-3 tabular-nums text-slate-700">{row.unitPrice === '' || row.unitPrice == null ? '—' : money(row.unitPrice)}</td>
                                        <td className="px-3 py-3 tabular-nums text-slate-700">{money(row.total)}</td>
                                        <td className="px-3 py-3 text-slate-700">{row.requiredDate || '—'}</td>
                                        <td className="px-3 py-3 text-slate-700">{row.leadTime || '—'}</td>
                                        <td className="px-3 py-3 text-slate-700">{row.paymentTerms || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )) : (
                <p className="text-sm text-slate-500">A vendor LPO appears here after a material request is approved.</p>
            )}
        </div>
    );
}

export default function WorkOrderQuotationPanel({ order, onOpen, onSaved, onOpenBudget, view = 'proposed', onViewChange }) {
    const quote = savedQuote(order);
    const lines = Array.isArray(quote.lines) ? quote.lines : [];
    const subTotal = Number(quote.valueExclVat) || 0;
    const status = statusLabel(quote.status);
    const hasQuote = Boolean(order?.quotationRef);

    return (
        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <BoqTabs active={view} onChange={(next) => onViewChange?.(next)} />
                {view === 'proposed' && hasQuote ? (
                    <div className="flex items-center gap-2">
                        {status ? (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">{status}</span>
                        ) : null}
                        <button
                            type="button"
                            onClick={onOpen}
                            className={`inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e5edf6] bg-white px-3 text-[13px] font-semibold text-[#2f6fed] hover:bg-[#f4f7fb] ${FOCUS}`}
                        >
                            <Paperclip size={14} />
                            PDF
                        </button>
                    </div>
                ) : null}
            </div>
            {view === 'actual' ? <ActualBoqTable order={order} onSaved={onSaved} /> : null}
            {view === 'mr' ? <MaterialRequest order={order} onSaved={onSaved} onOpenBudget={onOpenBudget} /> : null}
            {view === 'vendor-lpo' ? <VendorLpo order={order} /> : null}
            {view === 'proposed' && !hasQuote ? (
                <p className="text-sm text-slate-500">No quotation is saved on this work order.</p>
            ) : null}
            {view === 'proposed' && hasQuote ? (
            <>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                    <thead>
                        <tr className="border-b border-slate-200 bg-[#f4f7fb] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {COLUMNS.map((column) => (
                                <th
                                    key={column}
                                    className={`px-3 py-2 font-semibold whitespace-nowrap ${column === 'Description' ? '' : column === '#' ? 'w-12' : 'text-right'}`}
                                >
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {lines.length === 0 ? (
                            <tr>
                                <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-sm text-slate-400">
                                    Open the quotation to see the saved document.
                                </td>
                            </tr>
                        ) : null}
                        {lines.map((line, index) => (
                            <tr
                                key={line.id || index}
                                className="border-b border-slate-100 last:border-0"
                            >
                                <td className="px-3 py-3 align-top text-slate-500 tabular-nums">{index + 1}</td>
                                <td className="px-3 py-3 whitespace-pre-line text-slate-700">{line.description}</td>
                                <td className="px-3 py-3 text-right align-top tabular-nums text-slate-700">{money(line.quantity)}</td>
                                <td className="px-3 py-3 text-right align-top tabular-nums text-slate-700">{money(line.rate)}</td>
                                <td className="px-3 py-3 text-right align-top font-medium tabular-nums text-slate-800">{money(line.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <dl className="ml-auto mt-4 w-full max-w-xs text-sm">
                <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500">Sub Total</dt>
                    <dd className="font-medium tabular-nums text-slate-800">{money(subTotal)}</dd>
                </div>
            </dl>
            </>
            ) : null}
        </section>
    );
}
