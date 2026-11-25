'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
    { key: 'quantity', label: 'Qty', width: '6%', align: 'right' },
    { key: 'unitPrice', label: 'Unit price', width: '7%', align: 'right' },
    { key: 'total', label: 'Total', width: '7%', align: 'right' },
    { key: 'vendorName', label: 'Vendor name', width: '8%' },
    { key: 'paymentTerms', label: 'Payment terms', width: '6%' },
];
const ACTUAL_SPAN = ACTUAL_HEAD.length + 1;
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
    const priceBlank = next.unitPrice === '' || next.unitPrice == null;
    if (priceBlank && Number(item.lastStockPrice) > 0) next.unitPrice = item.lastStockPrice;
    const totalBlank = next.total === '' || next.total == null;
    const qty = Number(next.quantity);
    const price = Number(next.unitPrice);
    if (
        totalBlank
        && next.quantity !== ''
        && next.quantity != null
        && next.unitPrice !== ''
        && next.unitPrice != null
        && Number.isFinite(qty)
        && Number.isFinite(price)
    ) {
        next.total = Math.round(qty * price * 100) / 100;
    }
    return next;
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
    return next;
}

function editAmount(line, field, raw) {
    const cleaned = String(raw ?? '').replace(/,/g, '');
    if (cleaned !== '' && !/^\d*\.?\d*$/.test(cleaned)) return line;
    const next = { ...line, [field]: cleaned };
    if (field === 'quantity' || field === 'unitPrice') {
        const qtyText = field === 'quantity' ? cleaned : String(line.quantity ?? '');
        const priceText = field === 'unitPrice' ? cleaned : String(line.unitPrice ?? '');
        if (qtyText === '' || priceText === '') next.total = '';
        else {
            const qty = Number(qtyText);
            const price = Number(priceText);
            if (Number.isFinite(qty) && Number.isFinite(price)) next.total = Math.round(qty * price * 100) / 100;
        }
    }
    return next;
}

function lineFromSaved(line) {
    return {
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
        total: line?.total ?? '',
        vendorName: line?.vendorName || '',
        paymentTerms: line?.paymentTerms || '',
    };
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
    };
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

function rowPayload(row) {
    if (row.kind === 'header') {
        const title = String(row.title || '').trim();
        return title ? { kind: 'header', title } : null;
    }
    const { key, ...rest } = row;
    return { ...rest, kind: 'line' };
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
            `Cash: ${money(summary.cash)}    Credit: ${money(summary.credit)}    Vendor count: ${summary.vendorCount}`,
            margin,
            y,
        );
        y += 8;
    });

    const fileName = String(order?.workOrderNo || 'actual-boq').replace(/[^\w.-]+/g, '-');
    pdf.save(`${fileName}-actual-boq.pdf`);
}

function tableSummary(rows) {
    const vendors = new Set();
    let cash = 0;
    let credit = 0;
    (Array.isArray(rows) ? rows : []).forEach((row) => {
        if (row?.kind === 'header') return;
        const amount = Number(row?.total);
        const total = Number.isFinite(amount) ? amount : 0;
        const kind = paymentKind(row?.paymentTerms);
        if (kind === 'cash') cash += total;
        if (kind === 'credit') credit += total;
        const vendor = String(row?.vendorName || '').trim().toLowerCase();
        if (vendor) vendors.add(vendor);
    });
    return { cash, credit, vendorCount: vendors.size };
}

function CellSuggest({ value, options, onPick, readOnly = false }) {
    const rootRef = useRef(null);
    const menuRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [text, setText] = useState(value || '');
    const [menuStyle, setMenuStyle] = useState(null);
    const [active, setActive] = useState(0);
    const needle = String(text || '').trim().toLowerCase();
    const shown = needle
        ? options.filter((option) => option.toLowerCase().includes(needle))
        : options;

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
            const estimated = Math.min(224, Math.max(shown.length, 1) * 32 + 8);
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
    }, [open, text, shown.length]);

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
        setText(value || '');
    };

    const menu = open && menuStyle ? createPortal(
        <ul
            ref={menuRef}
            style={menuStyle}
            className="max-h-56 overflow-y-auto rounded-lg border border-[#E6EDF5] bg-white py-1 shadow-lg"
            onMouseDown={(event) => event.preventDefault()}
        >
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
            )) : (
                <li className="px-3 py-2 text-[12px] text-slate-400">No matches</li>
            )}
        </ul>,
        document.body,
    ) : null;

    return (
        <div ref={rootRef} className="relative min-w-0">
            <input
                value={text}
                readOnly={readOnly}
                placeholder={readOnly ? '' : 'Select'}
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
                    if (readOnly) return;
                    if (event.key === 'Escape') {
                        event.stopPropagation();
                        setOpen(false);
                        setText(value || '');
                        return;
                    }
                    if (!open || !shown.length) return;
                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setActive((current) => (current + 1) % shown.length);
                    } else if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setActive((current) => (current - 1 + shown.length) % shown.length);
                    } else if (event.key === 'Enter') {
                        event.preventDefault();
                        pick(shown[Math.min(active, shown.length - 1)]);
                    }
                }}
                className={`w-full truncate bg-transparent px-0.5 py-1 text-left text-[12px] leading-snug text-slate-800 outline-none placeholder:text-slate-400 ${readOnly ? 'cursor-default' : ''}`}
            />
            {menu}
        </div>
    );
}

function ActualBoqTable({ order, onSaved }) {
    const { toast } = useToast();
    const dragFrom = useRef(null);
    const dropAtRef = useRef(null);
    const [rows, setRows] = useState([]);
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
    const capturedAt = order?.quotationSnapshot?.capturedAt || '';
    const savedStatus = order?.actualBoq?.status || '';
    const savedStamp = order?.actualBoq?.requestedAt || order?.actualBoq?.decidedAt || '';
    const vendorNames = useMemo(() => optionList(vendors.map((vendor) => vendor.name), ''), [vendors]);
    const termNames = useMemo(() => optionList(vendors.map((vendor) => vendor.paymentTerms), ''), [vendors]);

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
    }, []);

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

    const openMenu = (event, rowIndex) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const id = `row:${rowIndex}`;
        const width = 156;
        const height = 152;
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        const below = rect.bottom + 4;
        const top = below + height > window.innerHeight ? Math.max(8, rect.top - height - 4) : below;
        setMenu((current) => (current?.id === id ? null : { id, rowIndex, top, left }));
    };

    const insertRow = (rowIndex, row) => {
        setRows((current) => {
            const next = current.slice();
            next.splice(rowIndex + 1, 0, row);
            return next;
        });
        setMenu(null);
    };

    const addRow = (rowIndex) => insertRow(rowIndex, emptyActualRow());

    const cloneRow = (rowIndex) => {
        setRows((current) => {
            const source = current[rowIndex];
            if (!source) return current;
            const next = current.slice();
            next.splice(rowIndex + 1, 0, { ...source, key: rowKey() });
            return next;
        });
        setMenu(null);
    };

    const deleteRow = (rowIndex) => {
        setRows((current) => {
            const next = current.filter((_, index) => index !== rowIndex);
            if (!next.some((row) => row.kind !== 'header')) next.push(emptyActualRow());
            return next.length ? next : [emptyActualRow()];
        });
        setMenu(null);
    };

    const askHeader = (rowIndex) => {
        setMenu(null);
        setHeaderAsk({ rowIndex, name: '' });
    };

    const confirmHeader = () => {
        const name = String(headerAsk?.name || '').trim();
        const rowIndex = headerAsk?.rowIndex;
        if (!name || rowIndex == null) return;
        setRows((current) => {
            if (rowIndex < 0 || rowIndex >= current.length) return current;
            const next = current.slice();
            next.splice(rowIndex + 1, 0, { key: rowKey(), kind: 'header', title: name });
            return next;
        });
        setHeaderAsk(null);
    };

    const patchRow = (rowIndex, next) => {
        setRows((current) => current.map((row, index) => (index === rowIndex ? next : row)));
    };

    const moveRow = (from, to) => {
        setRows((current) => {
            if (from == null || to == null || from < 0 || from >= current.length) return current;
            if (from === to || from + 1 === to) return current;
            const next = current.slice();
            const [item] = next.splice(from, 1);
            const dest = from < to ? to - 1 : to;
            next.splice(dest, 0, item);
            return next;
        });
    };

    const onDragStart = (event, rowIndex) => {
        dragFrom.current = rowIndex;
        dropAtRef.current = null;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(rowIndex));
    };

    const onDragOver = (event, rowIndex) => {
        if (dragFrom.current == null) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const next = event.clientY > rect.top + rect.height / 2 ? rowIndex + 1 : rowIndex;
        dropAtRef.current = next;
        setDropAt(next);
    };

    const onDrop = (event) => {
        event.preventDefault();
        moveRow(dragFrom.current, dropAtRef.current);
        dragFrom.current = null;
        dropAtRef.current = null;
        setDropAt(null);
    };

    const onDragEnd = () => {
        dragFrom.current = null;
        dropAtRef.current = null;
        setDropAt(null);
    };

    const boqStatus = order?.actualBoq?.status || '';
    const pending = boqStatus === 'pending';
    const approved = boqStatus === 'approved';
    const canDecide = pending && Boolean(order?.viewerIsProjectManager);
    const canSave = !pending && !approved;

    const saveBoq = async (mode) => {
        if (saving || !canSave) return;
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

    if (loading) return <p className="text-sm text-slate-500">Loading actual BOQ…</p>;
    if (failed) return <p className="text-sm text-slate-500">Actual BOQ could not be loaded.</p>;
    if (!rows.length) return <p className="text-sm text-slate-500">No actual BOQ lines yet.</p>;

    const cell = 'break-words border border-slate-200 px-1 py-1 align-top font-normal';
    const head = 'break-words border border-slate-200 px-1 py-1 align-bottom font-semibold';

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
                const summary = tableSummary(rows);
                const descriptionKey = descriptionMode === 'old' ? 'descriptionOld' : 'descriptionNew';
                const locked = !canSave;
                return (
                <div>
                <table className="w-full table-fixed border-collapse text-left text-[12px] leading-snug text-slate-700">
                    <colgroup>
                        <col style={{ width: '4%' }} />
                        {ACTUAL_HEAD.map((column) => (
                            <col key={column.key} style={{ width: column.width }} />
                        ))}
                        <col style={{ width: '4%' }} />
                    </colgroup>
                    <thead>
                        <tr className="bg-[#f4f7fb] text-[10px] uppercase tracking-wide text-slate-500">
                            <th className={head} aria-label="Drag row" />
                            {ACTUAL_HEAD.map((column) => (
                                column.key === 'description' ? (
                                    <th key={column.key} className={head}>
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
                                    <th key={column.key} className={`${head} ${column.align === 'right' ? 'text-right' : ''}`}>{column.label}</th>
                                )
                            ))}
                            <th className={head} aria-label="Row actions" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((line, rowIndex) => {
                            const marker = dropAt === rowIndex
                                ? 'shadow-[inset_0_2px_0_0_#2f6fed]'
                                : dropAt === rowIndex + 1 && rowIndex === rows.length - 1
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
                                        onDragStart(event, rowIndex);
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
                                    aria-expanded={menu?.id === `row:${rowIndex}`}
                                    onClick={(event) => openMenu(event, rowIndex)}
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
                                        onDragOver={(event) => onDragOver(event, rowIndex)}
                                        onDrop={onDrop}
                                    >
                                        <td className={`${cell} px-0.5 text-center`}>{dragHandle}</td>
                                        <td colSpan={ACTUAL_SPAN} className={`${cell} px-2 py-2`}>
                                            <div className="flex items-center gap-2">
                                                {locked ? (
                                                    <span className="min-w-0 flex-1 text-[13px] font-semibold text-slate-800">{line.title}</span>
                                                ) : (
                                                    <input
                                                        value={line.title || ''}
                                                        onChange={(event) => patchRow(rowIndex, { ...line, title: event.target.value })}
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
                            return (
                                <tr
                                    key={line.key}
                                    className={marker}
                                    onDragOver={(event) => onDragOver(event, rowIndex)}
                                    onDrop={onDrop}
                                >
                                    <td className={`${cell} px-0.5 text-center`}>{dragHandle}</td>
                                    {CATALOG_FIELDS.map(([field]) => (
                                        <td key={field} className={cell}>
                                            <CellSuggest
                                                value={line[field] || ''}
                                                options={catalogChoices(catalog, line, field)}
                                                readOnly={locked}
                                                onPick={(value) => patchRow(rowIndex, pickCatalogValue(line, field, value, catalog))}
                                            />
                                        </td>
                                    ))}
                                    <td className={cell}>
                                        <textarea
                                            value={description}
                                            readOnly={locked}
                                            rows={Math.min(5, Math.max(2, String(description).split('\n').length || 1))}
                                            onChange={(event) => patchRow(rowIndex, { ...line, [descriptionKey]: event.target.value })}
                                            className="w-full resize-none bg-transparent px-0.5 py-1 text-[12px] leading-snug text-slate-700 outline-none"
                                            aria-label="Description"
                                        />
                                    </td>
                                    {['quantity', 'unitPrice', 'total'].map((field) => (
                                        <td key={field} className={cell}>
                                            <input
                                                value={line[field] ?? ''}
                                                readOnly={locked}
                                                inputMode="decimal"
                                                onChange={(event) => patchRow(rowIndex, editAmount(line, field, event.target.value))}
                                                className={`w-full bg-transparent px-0.5 py-1 text-right text-[12px] tabular-nums text-slate-800 outline-none ${field === 'total' ? 'font-semibold' : ''} ${locked ? 'cursor-default' : ''}`}
                                                aria-label={field === 'unitPrice' ? 'Unit price' : field === 'quantity' ? 'Quantity' : 'Total'}
                                            />
                                        </td>
                                    ))}
                                    <td className={cell}>
                                        <CellSuggest
                                            value={line.vendorName || ''}
                                            options={optionList(vendorNames, line.vendorName)}
                                            readOnly={locked}
                                            onPick={(value) => {
                                                const vendor = vendors.find((row) => sameName(row.name, value));
                                                patchRow(rowIndex, {
                                                    ...line,
                                                    vendorName: value,
                                                    paymentTerms: vendor && String(vendor.paymentTerms || '').trim()
                                                        ? vendor.paymentTerms
                                                        : line.paymentTerms,
                                                });
                                            }}
                                        />
                                    </td>
                                    <td className={cell}>
                                        <CellSuggest
                                            value={line.paymentTerms || ''}
                                            options={optionList(termNames, line.paymentTerms)}
                                            readOnly={locked}
                                            onPick={(value) => patchRow(rowIndex, { ...line, paymentTerms: value })}
                                        />
                                    </td>
                                    <td className={`${cell} text-center`}>{plusButton}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-600">
                    <span>Cash: <span className="font-medium tabular-nums text-slate-800">{money(summary.cash)}</span></span>
                    <span>Credit: <span className="font-medium tabular-nums text-slate-800">{money(summary.credit)}</span></span>
                    <span>Vendor count: <span className="font-medium tabular-nums text-slate-800">{summary.vendorCount}</span></span>
                </p>
                </div>
                );
            })()}
            <div className="flex flex-col gap-3">
                {approved ? (
                    <p className="text-sm font-semibold text-emerald-700">Approved actual BOQ</p>
                ) : null}
                {boqStatus === 'draft' ? (
                    <p className="text-sm text-slate-600">Draft saved. The task and notification are assigned to you.</p>
                ) : null}
                {pending && !canDecide ? (
                    <p className="text-sm text-amber-800">Waiting for {order?.projectManagerName || 'the project manager'}. Their notification opens this actual BOQ, where they can approve or reject.</p>
                ) : null}
                {boqStatus === 'rejected' && order?.actualBoq?.reason ? (
                    <p className="text-sm text-rose-700">Rejected: {order.actualBoq.reason}</p>
                ) : null}
                {canDecide ? (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm text-slate-600">Approve this actual BOQ, or reject it with a description.</p>
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
                    <button type="button" onClick={() => addRow(menu.rowIndex)} className="block w-full px-3 py-1.5 text-left hover:bg-[#f4f7fb]">Add row</button>
                    <button type="button" onClick={() => cloneRow(menu.rowIndex)} className="block w-full px-3 py-1.5 text-left hover:bg-[#f4f7fb]">Clone row</button>
                    <button type="button" onClick={() => askHeader(menu.rowIndex)} className="block w-full px-3 py-1.5 text-left hover:bg-[#f4f7fb]">Insert header</button>
                    <button type="button" onClick={() => deleteRow(menu.rowIndex)} className="block w-full px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50">Delete</button>
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

function MaterialRequest({ order }) {
    const request = order?.materialRequest;
    const tables = Array.isArray(request?.tables) ? request.tables : [];
    const rows = tables.flatMap((table) => {
        const inner = Array.isArray(table?.rows) ? table.rows : [];
        const next = [];
        if (!inner.some((row) => row?.kind === 'header') && String(table?.title || '').trim()) {
            next.push({ kind: 'header', title: table.title });
        }
        inner.forEach((row) => next.push(row));
        return next;
    });
    const lines = rows.filter((row) => row?.kind !== 'header');
    if (request?.status !== 'open' || !lines.length) {
        return <p className="text-sm text-slate-500">No material requests yet.</p>;
    }
    return (
        <div>
            <p className="mb-3 text-sm text-slate-600">
                Material request for the approved actual BOQ
                {request.purchaserName ? `. Assigned to ${request.purchaserName}` : ''}.
            </p>
            <table className="w-full table-fixed border-collapse text-left text-[11px] leading-snug text-slate-700">
                <thead>
                    <tr className="border-b border-slate-200 bg-[#f4f7fb] text-[10px] uppercase tracking-wide text-slate-500">
                        <th className="w-[46%] px-2 py-2 font-semibold">Description</th>
                        <th className="w-[14%] px-2 py-2 text-right font-semibold">Quantity</th>
                        <th className="w-[16%] px-2 py-2 text-right font-semibold">Price</th>
                        <th className="w-[24%] px-2 py-2 font-semibold">Vendor</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        row?.kind === 'header' ? (
                            <tr key={`header-${index}`} className="border-b border-slate-100 bg-slate-50">
                                <td colSpan={4} className="px-2 py-2 text-[12px] font-semibold text-slate-800">{row.title}</td>
                            </tr>
                        ) : (
                        <tr key={`${row.modelNo || 'line'}-${index}`} className="border-b border-slate-100 last:border-0">
                            <td className="whitespace-pre-line break-words px-2 py-2">{printDescription(row)}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{printAmount(row.quantity)}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{printAmount(row.unitPrice)}</td>
                            <td className="break-words px-2 py-2">{row.vendorName || ''}</td>
                        </tr>
                        )
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function WorkOrderQuotationPanel({ order, onOpen, onSaved, initialTab = 'proposed' }) {
    const [boqTab, setBoqTab] = useState(initialTab);
    const quote = savedQuote(order);
    const lines = Array.isArray(quote.lines) ? quote.lines : [];
    const subTotal = Number(quote.valueExclVat) || 0;
    const status = statusLabel(quote.status);
    const hasQuote = Boolean(order?.quotationRef);

    return (
        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <BoqTabs active={boqTab} onChange={setBoqTab} />
                {boqTab === 'proposed' && hasQuote ? (
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
            {boqTab === 'actual' ? <ActualBoqTable order={order} onSaved={onSaved} /> : null}
            {boqTab === 'mr' ? <MaterialRequest order={order} /> : null}
            {boqTab === 'proposed' && !hasQuote ? (
                <p className="text-sm text-slate-500">No quotation is saved on this work order.</p>
            ) : null}
            {boqTab === 'proposed' && hasQuote ? (
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
