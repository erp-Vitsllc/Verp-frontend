'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Paperclip, Printer } from 'lucide-react';
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
    { key: 'slNo', label: 'Sl no', width: '4%' },
    { key: 'category', label: 'Category', width: '8%' },
    { key: 'subcategory', label: 'Subcategory', width: '9%' },
    { key: 'item', label: 'Item', width: '8%' },
    { key: 'brand', label: 'Brand', width: '7%' },
    { key: 'modelNo', label: 'Model no', width: '8%' },
    { key: 'quantity', label: 'Qty', width: '5%', align: 'right' },
    { key: 'unitPrice', label: 'Unit price', width: '7%', align: 'right' },
    { key: 'total', label: 'Total', width: '7%', align: 'right' },
    { key: 'vendorName', label: 'Vendor name', width: '8%' },
    { key: 'paymentTerms', label: 'Payment terms', width: '7%' },
];

const ACTUAL_CELLS = [
    { key: 'slNo', numeric: true },
    { key: 'category' },
    { key: 'subcategory' },
    { key: 'item' },
    { key: 'brand' },
    { key: 'modelNo' },
    { key: 'descriptionNew', pre: true },
    { key: 'descriptionOld', pre: true },
    { key: 'quantity', numeric: true, money: true },
    { key: 'unitPrice', numeric: true, money: true },
    { key: 'total', numeric: true, money: true, strong: true },
    { key: 'vendorName' },
    { key: 'paymentTerms' },
];

function rowKey() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyActualRow() {
    return {
        key: rowKey(),
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

function actualCellText(column, line) {
    const value = line?.[column.key];
    if (value === '' || value == null) return '';
    if (column.money) return money(value);
    return value;
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

async function downloadActualBoqPdf(order, tables) {
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
        if (tables.length > 1) {
            if (y + 8 > pageH - 12) {
                pdf.addPage();
                y = 16;
            }
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.setTextColor(15, 23, 42);
            pdf.text(`Table ${tableIndex + 1}`, margin, y + 4);
            y += 7;
        }
        drawHeaderRow();
        (table.rows || []).forEach((row, rowIndex) => {
            const cells = [
                printDescription(row),
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
            if (rowIndex % 2 === 1) {
                pdf.setFillColor(244, 247, 251);
                pdf.rect(margin, y, usable, rowH, 'F');
            }
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

function ActualBoqTable({ order, onSaved }) {
    const { toast } = useToast();
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [menu, setMenu] = useState(null);
    const [printing, setPrinting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [rejectNote, setRejectNote] = useState('');
    const capturedAt = order?.quotationSnapshot?.capturedAt || '';
    const savedStatus = order?.actualBoq?.status || '';
    const savedStamp = order?.actualBoq?.requestedAt || order?.actualBoq?.decidedAt || '';

    useEffect(() => {
        const saved = Array.isArray(order?.actualBoq?.tables) ? order.actualBoq.tables : [];
        if (saved.length) {
            setTables(saved.map((table) => ({
                id: rowKey(),
                rows: (Array.isArray(table?.rows) ? table.rows : []).map((line) => ({ ...line, key: rowKey() })),
            })));
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
                setTables(lines.length
                    ? [{ id: rowKey(), rows: lines.map((line) => ({ ...line, key: rowKey() })) }]
                    : []);
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

    const openMenu = (event, tableId, rowIndex, columnKey) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const id = `${tableId}:${rowIndex}:${columnKey}`;
        const width = 148;
        const height = 116;
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        const below = rect.bottom + 4;
        const top = below + height > window.innerHeight ? Math.max(8, rect.top - height - 4) : below;
        setMenu((current) => (current?.id === id ? null : { id, tableId, rowIndex, top, left }));
    };

    const addRow = (tableId, rowIndex) => {
        setTables((current) => current.map((table) => {
            if (table.id !== tableId) return table;
            const rows = table.rows.slice();
            rows.splice(rowIndex + 1, 0, emptyActualRow());
            return { ...table, rows };
        }));
        setMenu(null);
    };

    const copyRow = (tableId, rowIndex) => {
        setTables((current) => current.map((table) => {
            if (table.id !== tableId) return table;
            const source = table.rows[rowIndex];
            if (!source) return table;
            const rows = table.rows.slice();
            rows.splice(rowIndex + 1, 0, { ...source, key: rowKey() });
            return { ...table, rows };
        }));
        setMenu(null);
    };

    const insertHeader = (tableId) => {
        setTables((current) => {
            const index = current.findIndex((table) => table.id === tableId);
            if (index < 0) return current;
            const next = current.slice();
            next.splice(index + 1, 0, { id: rowKey(), rows: [emptyActualRow()] });
            return next;
        });
        setMenu(null);
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
                actualBoqTables: tables.map((table) => ({
                    rows: table.rows.map(({ key, ...row }) => row),
                })),
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
    if (!tables.length) return <p className="text-sm text-slate-500">No actual BOQ lines yet.</p>;

    const cell = 'relative break-words px-1 py-1 align-top font-normal';
    const head = 'break-words px-1 py-1 align-bottom font-semibold';

    const printPdf = async () => {
        if (printing || !tables.length) return;
        setPrinting(true);
        try {
            await downloadActualBoqPdf(order, tables);
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
            {tables.map((table) => {
                const summary = tableSummary(table.rows);
                return (
                <div key={table.id}>
                <table className="w-full table-fixed border-collapse text-left text-[10px] leading-snug text-slate-700">
                    <colgroup>
                        {ACTUAL_HEAD.slice(0, 6).map((column) => (
                            <col key={column.key} style={{ width: column.width }} />
                        ))}
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '11%' }} />
                        {ACTUAL_HEAD.slice(6).map((column) => (
                            <col key={column.key} style={{ width: column.width }} />
                        ))}
                    </colgroup>
                    <thead>
                        <tr className="border-b border-slate-200 bg-[#f4f7fb] text-[9px] uppercase tracking-wide text-slate-500">
                            {ACTUAL_HEAD.slice(0, 6).map((column) => (
                                <th key={column.key} rowSpan={2} className={head}>{column.label}</th>
                            ))}
                            <th colSpan={2} className={`${head} text-center`}>Description</th>
                            {ACTUAL_HEAD.slice(6).map((column) => (
                                <th key={column.key} rowSpan={2} className={`${head} ${column.align === 'right' ? 'text-right' : ''}`}>{column.label}</th>
                            ))}
                        </tr>
                        <tr className="border-b border-slate-200 bg-[#f4f7fb] text-[9px] uppercase tracking-wide text-slate-500">
                            <th className={`${head} text-center`}>New</th>
                            <th className={`${head} text-center`}>Old</th>
                        </tr>
                    </thead>
                    <tbody>
                        {table.rows.map((line, rowIndex) => (
                            <tr key={line.key} className="border-b border-slate-100 last:border-0">
                                {ACTUAL_CELLS.map((column) => (
                                    <td
                                        key={column.key}
                                        className={`${cell} ${column.numeric ? 'tabular-nums' : ''} ${column.strong ? 'font-medium text-slate-800' : ''} ${column.key === 'slNo' ? 'text-slate-500' : ''}`}
                                    >
                                        <span className={`block pr-3 ${column.pre ? 'whitespace-pre-line' : ''} ${column.numeric ? 'text-right' : ''}`}>
                                            {actualCellText(column, line)}
                                        </span>
                                        <button
                                            type="button"
                                            data-boq-plus=""
                                            aria-label="Row actions"
                                            aria-expanded={menu?.id === `${table.id}:${rowIndex}:${column.key}`}
                                            onClick={(event) => openMenu(event, table.id, rowIndex, column.key)}
                                            className="absolute right-0 top-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded border border-[#2f6fed] bg-white text-[11px] font-bold leading-none text-[#2f6fed] hover:bg-[#e8f1ff]"
                                        >
                                            +
                                        </button>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                    <span>Cash: <span className="font-medium tabular-nums text-slate-800">{money(summary.cash)}</span></span>
                    <span>Credit: <span className="font-medium tabular-nums text-slate-800">{money(summary.credit)}</span></span>
                    <span>Vendor count: <span className="font-medium tabular-nums text-slate-800">{summary.vendorCount}</span></span>
                </p>
                </div>
                );
            })}
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
                    className="fixed z-50 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left text-[12px] text-slate-700 shadow-lg"
                    style={{ top: menu.top, left: menu.left }}
                >
                    <button type="button" onClick={() => addRow(menu.tableId, menu.rowIndex)} className="block w-full px-3 py-1.5 text-left hover:bg-[#f4f7fb]">Add row</button>
                    <button type="button" onClick={() => copyRow(menu.tableId, menu.rowIndex)} className="block w-full px-3 py-1.5 text-left hover:bg-[#f4f7fb]">Copy row</button>
                    <button type="button" onClick={() => insertHeader(menu.tableId)} className="block w-full px-3 py-1.5 text-left hover:bg-[#f4f7fb]">Insert header</button>
                </div>,
                document.body,
            ) : null}
        </div>
    );
}

function MaterialRequest({ order }) {
    const request = order?.materialRequest;
    const tables = Array.isArray(request?.tables) ? request.tables : [];
    const rows = tables.flatMap((table) => (Array.isArray(table?.rows) ? table.rows : []));
    if (request?.status !== 'open' || !rows.length) {
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
                        <tr key={`${row.modelNo || 'line'}-${index}`} className="border-b border-slate-100 last:border-0">
                            <td className="whitespace-pre-line break-words px-2 py-2">{printDescription(row)}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{printAmount(row.quantity)}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{printAmount(row.unitPrice)}</td>
                            <td className="break-words px-2 py-2">{row.vendorName || ''}</td>
                        </tr>
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
