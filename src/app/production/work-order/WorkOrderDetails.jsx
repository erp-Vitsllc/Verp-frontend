'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    FileText,
    FolderPlus,
    Gavel,
    Home,
    Info,
    Link2,
    Paperclip,
    UserRound,
    Zap,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { dubaiDateKey, formatAed, formatWorkOrderDate } from './workOrderNumber';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6fed]/40';

const LPO_MODES = [
    { id: 'required', label: 'Required' },
    { id: 'not_required', label: 'Not required' },
    { id: 'received', label: 'LPO received' },
];

const LIFE_STATUSES = ['Not Started', 'In Progress', 'Completed'];

const RULES = [
    'One quotation and one LPO per Work Order',
    'Multiple invoices allowed',
    'Invoice total cannot exceed work order value',
    'Standalone can later attach to a project',
];

function Skyline() {
    return (
        <svg aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-[120px] w-[min(560px,58%)]" viewBox="0 0 620 150" fill="none">
            <ellipse cx="470" cy="40" rx="180" ry="48" fill="#e7f2fc" />
            <g fill="#c9ddf4">
                <rect x="230" y="84" width="26" height="66" />
                <rect x="260" y="72" width="16" height="78" />
                <path d="M318 150V58h5.5l3.2-24 3.3 24H336V150h-18z" />
                <rect x="344" y="80" width="18" height="70" />
                <rect x="366" y="62" width="11" height="88" />
                <rect x="409" y="74" width="15" height="76" />
                <rect x="454" y="86" width="13" height="64" />
                <rect x="503" y="90" width="12" height="60" />
            </g>
        </svg>
    );
}

function FieldLabel({ children, required }) {
    return (
        <span className="mb-1.5 block text-[12px] font-medium text-slate-500">
            {children}
            {required ? <span className="text-rose-500"> *</span> : null}
        </span>
    );
}

function formatBytes(bytes) {
    const size = Number(bytes) || 0;
    if (size <= 0) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(null);
            return;
        }
        if (file.size > 4 * 1024 * 1024) {
            reject(new Error('Attachment must be 4 MB or smaller'));
            return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve({
            name: file.name,
            mime: file.type || 'application/octet-stream',
            data: String(reader.result || ''),
        });
        reader.onerror = () => reject(new Error('Could not read the attachment'));
        reader.readAsDataURL(file);
    });
}

function downloadAttachment(name, mime, data) {
    if (!data) return;
    const link = document.createElement('a');
    link.href = `data:${mime || 'application/octet-stream'};base64,${data}`;
    link.download = name || 'attachment';
    link.click();
}

function lpoRows(order) {
    return Array.isArray(order?.lpos) ? order.lpos : [];
}

export default function WorkOrderDetails({ id, onBack, focusSection = '' }) {
    const { toast } = useToast();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('Overview');
    const [saving, setSaving] = useState(false);
    const [lpoNo, setLpoNo] = useState('');
    const [lpoDate, setLpoDate] = useState('');
    const [lpoValue, setLpoValue] = useState('');
    const [lpoFile, setLpoFile] = useState(null);
    const [noticeFile, setNoticeFile] = useState(null);
    const [fileKey, setFileKey] = useState(0);
    const [formError, setFormError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await axiosInstance.get(`/WorkOrder/${id}`);
            setOrder(response.data?.workOrder || null);
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not load this work order');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (focusSection !== 'lpo' || !order) return undefined;
        const timer = window.setTimeout(() => {
            document.getElementById('lpo-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
        return () => window.clearTimeout(timer);
    }, [focusSection, order]);

    useEffect(() => {
        const total = Number(order?.value) || 0;
        if (total > 0) setLpoValue((current) => current || total.toFixed(2));
    }, [order]);

    const patch = async (body) => {
        setSaving(true);
        setFormError('');
        try {
            const response = await axiosInstance.patch(`/WorkOrder/${id}`, body);
            setOrder(response.data?.workOrder || null);
            return response.data;
        } catch (err) {
            const message = err?.response?.data?.message || 'Could not update the work order';
            setFormError(message);
            toast({ title: 'Could not update', description: message, variant: 'destructive' });
            return null;
        } finally {
            setSaving(false);
        }
    };

    const changeMode = async (next) => {
        if (!order || order.lpoMode === next || saving) return;
        await patch({ lpoMode: next });
    };

    const changeStatus = async (status) => {
        if (!order || order.status === status || saving) return;
        const saved = await patch({ status });
        if (saved) toast({ title: 'Status updated', description: status });
    };

    const addLpo = async () => {
        const amount = Number(lpoValue);
        const total = Number(order?.value) || 0;
        if (!lpoNo.trim() || !lpoDate || !(amount > 0) || !lpoFile) {
            setFormError('LPO number, date, value and attachment are required.');
            return;
        }
        if (lpoDate > dubaiDateKey()) {
            setFormError('LPO date cannot be after today.');
            return;
        }
        if (total > 0 && Math.abs(amount - total) > 0.009) {
            setFormError('LPO value must match the quotation total.');
            return;
        }
        let attachment = null;
        try {
            attachment = await readFile(lpoFile);
        } catch (err) {
            setFormError(err.message);
            return;
        }
        const saved = await patch({
            lpoMode: 'received',
            lpo: {
                lpoNo: lpoNo.trim(),
                lpoDate,
                lpoValue: Number(lpoValue),
                attachment,
            },
        });
        if (saved) {
            setLpoNo('');
            setLpoDate('');
            setLpoValue('');
            setLpoFile(null);
            setFileKey((key) => key + 1);
            toast({ title: 'LPO added', description: lpoNo.trim() });
        }
    };

    const updateAttachment = async () => {
        if (!noticeFile) {
            setFormError('Attachment is required.');
            return;
        }
        let attachment = null;
        try {
            attachment = await readFile(noticeFile);
        } catch (err) {
            setFormError(err.message);
            return;
        }
        const saved = await patch({
            uploadPendingAttachment: true,
            attachment,
        });
        if (saved) {
            setNoticeFile(null);
            setFileKey((key) => key + 1);
            toast({ title: 'Work order updated', description: order?.workOrderNo || 'Attachment saved.' });
        }
    };

    const sendNotRequired = async () => {
        if (!noticeFile) {
            setFormError('Attachment is required when LPO is not required.');
            return;
        }
        let attachment = null;
        try {
            attachment = await readFile(noticeFile);
        } catch (err) {
            setFormError(err.message);
            return;
        }
        const saved = await patch({
            lpoMode: 'not_required',
            sendNotRequired: true,
            attachment,
        });
        if (saved) {
            setNoticeFile(null);
            setFileKey((key) => key + 1);
            toast({
                title: 'Sent to salesperson',
                description: saved.emailMessage || `${order?.salespersonName || 'The salesperson'} was notified that the LPO was not filled.`,
            });
        }
    };

    if (loading) {
        return <p className="px-2 py-10 text-sm text-slate-500">Loading work order…</p>;
    }

    if (!order) {
        return (
            <div className="rounded-2xl border border-[#e6eef6] bg-white p-6">
                <p className="text-sm text-slate-600">{error || 'Work order was not found.'}</p>
                <button type="button" onClick={onBack} className={`mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-[#e5edf6] px-4 text-sm font-semibold text-slate-600 ${FOCUS}`}>
                    <ChevronLeft size={16} /> Back
                </button>
            </div>
        );
    }

    const mode = order.lpoMode || 'required';
    const rows = lpoRows(order);
    const invoiced = Number(order.invoicedAmount) || 0;
    const total = Number(order.value) || 0;
    const balance = Math.max(0, total - invoiced);
    const match = total > 0 ? Math.min(100, (invoiced / total) * 100) : 0;
    const locked = mode === 'required';

    return (
        <div className="relative text-slate-800">
            <header className="relative mb-4 overflow-hidden">
                <Skyline />
                <div className="relative">
                    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-[#3b82f6]">
                        <Home size={14} />
                        <ChevronRight size={14} className="text-[#93c5fd]" />
                        <button type="button" onClick={onBack} className={`hover:underline ${FOCUS}`}>Work Orders</button>
                        <span className="text-[#93c5fd]">/</span>
                        <span>{order.workOrderNo}</span>
                    </nav>
                    <div className="mt-3 flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2f6fed] text-white shadow-[0_10px_18px_-10px_rgba(47,111,237,0.9)]">
                            <ClipboardList size={22} />
                        </span>
                        <div>
                            <h1 className="text-[24px] font-bold tracking-tight text-slate-900 sm:text-[28px]">Work Order Details</h1>
                            <p className="text-[13px] text-slate-500">Quotation, LPO, invoices and project linkage</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
                <Summary icon={UserRound} tint="bg-violet-50 text-violet-600" label="Customer" value={order.customer || '—'} />
                <Summary icon={ClipboardList} tint="bg-blue-50 text-[#2f6fed]" label="Status" value={order.status || '—'} />
                <Summary icon={ClipboardList} tint="bg-violet-50 text-violet-600" label="Type" value={order.type || '—'} />
                <Summary icon={FileText} tint="bg-sky-50 text-sky-600" label="Total Value" value={formatAed(total)} />
                <Summary icon={CheckCircle2} tint="bg-emerald-50 text-emerald-600" label="Invoiced" value={formatAed(invoiced)} />
                <Summary icon={FileText} tint="bg-orange-50 text-orange-500" label="Balance" value={formatAed(balance)} />
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
                {LIFE_STATUSES.map((status) => (
                    <button
                        key={status}
                        type="button"
                        disabled={saving}
                        onClick={() => changeStatus(status)}
                        className={order.status === status
                            ? `rounded-full bg-[#2f6fed] px-3 py-1.5 text-[12px] font-semibold text-white ${FOCUS}`
                            : `rounded-full border border-[#e5edf6] bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 ${FOCUS}`}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {order.lpoAlert?.message ? (
                <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
                    <p className="font-semibold">LPO was not filled</p>
                    <p className="mt-1">{order.lpoAlert.message}</p>
                    <p className="mt-1 text-[12px] text-orange-800">
                        {order.lpoAlert.emailed
                            ? `Email sent to ${order.lpoAlert.emailTo || order.salespersonName || 'the salesperson'}.`
                            : 'The salesperson notification is saved.'}
                        {order.lpoAlert.attachmentName ? ` Attachment: ${order.lpoAlert.attachmentName}` : ''}
                    </p>
                    {order.lpoAlert.attachmentData ? (
                        <button
                            type="button"
                            onClick={() => downloadAttachment(order.lpoAlert.attachmentName, order.lpoAlert.attachmentMime, order.lpoAlert.attachmentData)}
                            className={`mt-2 text-[13px] font-semibold text-[#2f6fed] hover:underline ${FOCUS}`}
                        >
                            Download attachment
                        </button>
                    ) : null}
                </div>
            ) : null}

            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-4">
                    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-[#e6eef6] bg-white p-1.5">
                        {['Overview', 'LPO', 'Invoices', 'Activity'].map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => setTab(item)}
                                className={tab === item
                                    ? `rounded-xl bg-[#e8f1ff] px-4 py-2 text-sm font-semibold text-[#2f6fed] ${FOCUS}`
                                    : `rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 ${FOCUS}`}
                            >
                                {item}
                            </button>
                        ))}
                    </div>

                    {tab === 'Overview' ? (
                        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                <Info size={16} className="text-[#2f6fed]" /> Work Order Information
                            </h2>
                            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <InfoItem label="Work Order Number" value={order.workOrderNo} />
                                <InfoItem label="Created Date" value={formatWorkOrderDate(order.createdOn)} />
                                <InfoItem label="Salesperson" value={order.salespersonName || '—'} />
                                <InfoItem label="Quotation Ref" value={order.quotationRef || '—'} />
                                <InfoItem label="Order Confirmation Date" value={formatWorkOrderDate(order.confirmationDate)} />
                                <InfoItem label="Quotation Date" value={formatWorkOrderDate(order.quotationDate)} />
                                <InfoItem label="Delivery Location" value={order.location || '—'} />
                                <InfoItem label="Work Order Description" value={order.description || '—'} />
                            </dl>
                        </section>
                    ) : null}

                    {tab === 'Overview' || tab === 'LPO' ? (
                        <section id="lpo-details" className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                <Paperclip size={16} className="text-[#2f6fed]" /> LPO Details
                            </h2>
                            <div role="radiogroup" aria-label="LPO option" className="grid grid-cols-1 gap-1 rounded-xl bg-[#f4f7fb] p-1 sm:grid-cols-3">
                                {LPO_MODES.map((item) => {
                                    const active = mode === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={active}
                                            disabled={saving}
                                            onClick={() => changeMode(item.id)}
                                            className={active
                                                ? `h-11 rounded-lg bg-[#2f6fed] text-sm font-semibold text-white shadow-sm ${FOCUS}`
                                                : `h-11 rounded-lg text-sm font-medium text-slate-600 hover:bg-white disabled:opacity-60 ${FOCUS}`}
                                        >
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="mt-3 text-[13px] leading-5 text-slate-500">
                                {mode === 'required'
                                    ? 'LPO upload is locked. There is no need to add an LPO while Required is selected.'
                                    : mode === 'not_required'
                                        ? (order.attachmentPending
                                            ? 'This work order is already created. The attachment is required. Update saves it on this work order.'
                                            : 'Attachment is required. Send emails the salesperson and notifies them that the LPO number, date and value were left empty.')
                                        : 'Enter the LPO number, date, value and attachment. LPO value comes from the quotation total.'}
                            </p>

                            {formError ? (
                                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>
                            ) : null}

                            {rows.length ? (
                                <div className="mt-4 overflow-x-auto">
                                    <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400">
                                                {['LPO Number', 'LPO Date', 'LPO Value', 'Attachment'].map((column) => (
                                                    <th key={column} className="px-2 py-2 font-medium">{column}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((row) => (
                                                <tr key={row._id || row.lpoNo} className="border-b border-slate-100 last:border-0">
                                                    <td className="px-2 py-3 font-semibold text-[#2f6fed]">{row.lpoNo || '—'}</td>
                                                    <td className="px-2 py-3 text-slate-600">{formatWorkOrderDate(row.lpoDate)}</td>
                                                    <td className="px-2 py-3 text-slate-700">{formatAed(row.lpoValue)}</td>
                                                    <td className="px-2 py-3">
                                                        {row.attachmentName ? (
                                                            <button
                                                                type="button"
                                                                disabled={!row.attachmentData}
                                                                onClick={() => downloadAttachment(row.attachmentName, row.attachmentMime, row.attachmentData)}
                                                                className={`inline-flex items-center gap-1 text-[#2f6fed] hover:underline disabled:cursor-default disabled:no-underline ${FOCUS}`}
                                                            >
                                                                <Paperclip size={14} />
                                                                {row.attachmentName}
                                                                {row.attachmentBytes ? ` (${formatBytes(row.attachmentBytes)})` : ''}
                                                            </button>
                                                        ) : (
                                                            <span className="text-slate-400">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}

                            {mode === 'not_required' && order.attachmentPending ? (
                                <div className="mt-4 rounded-xl border border-[#e6eef6] bg-[#f8fbff] p-4">
                                    <dl className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <InfoItem label="Work Order Number" value={order.workOrderNo} />
                                        <InfoItem label="Customer" value={order.customer || '—'} />
                                        <InfoItem label="Quotation Ref" value={order.quotationRef || '—'} />
                                        <InfoItem label="Total Value" value={formatAed(order.value)} />
                                    </dl>
                                    <label htmlFor="lpo-notice-file" className="block">
                                        <FieldLabel required>Attachment</FieldLabel>
                                        <input
                                            id="lpo-notice-file"
                                            key={`notice-${fileKey}`}
                                            type="file"
                                            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.txt,.csv"
                                            onChange={(event) => setNoticeFile(event.target.files?.[0] || null)}
                                            className={`block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 ${FOCUS}`}
                                        />
                                    </label>
                                    <p className="mt-2 text-[12px] text-slate-500">
                                        This work order is already created. The attachment is required before you update it.
                                    </p>
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={updateAttachment}
                                        className={`mt-3 inline-flex h-11 items-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] disabled:opacity-60 ${FOCUS}`}
                                    >
                                        {saving ? 'Updating…' : 'Update'}
                                    </button>
                                </div>
                            ) : mode === 'not_required' ? (
                                <div className="mt-4 rounded-xl border border-[#e6eef6] bg-[#f8fbff] p-4">
                                    <label htmlFor="lpo-notice-file" className="block">
                                        <FieldLabel required>Attachment</FieldLabel>
                                        <input
                                            id="lpo-notice-file"
                                            key={`notice-${fileKey}`}
                                            type="file"
                                            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.txt,.csv"
                                            onChange={(event) => setNoticeFile(event.target.files?.[0] || null)}
                                            className={`block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 ${FOCUS}`}
                                        />
                                    </label>
                                    <p className="mt-2 text-[12px] text-slate-500">
                                        This file is emailed to {order.salespersonName || 'the salesperson'}, with a notification that the LPO was not filled.
                                    </p>
                                    <button
                                        type="button"
                                        disabled={saving || !order.salespersonId}
                                        onClick={sendNotRequired}
                                        className={`mt-3 inline-flex h-11 items-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] disabled:opacity-60 ${FOCUS}`}
                                    >
                                        {saving ? 'Sending…' : 'Send to salesperson'}
                                    </button>
                                    {!order.salespersonId ? (
                                        <p className="mt-2 text-[12px] text-amber-700">Choose a salesperson on the work order before sending.</p>
                                    ) : null}
                                </div>
                            ) : mode === 'received' && rows.length > 0 ? null : (
                                <fieldset disabled={locked || saving} className={`mt-4 ${locked ? 'opacity-60' : ''}`}>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <label htmlFor="lpo-no">
                                            <FieldLabel required={!locked}>LPO Number</FieldLabel>
                                            <input id="lpo-no" value={lpoNo} onChange={(event) => setLpoNo(event.target.value)} className={`h-11 w-full rounded-xl border border-[#e5edf6] px-3 text-sm outline-none disabled:bg-[#f4f7fb] ${FOCUS}`} />
                                        </label>
                                        <label htmlFor="lpo-date">
                                            <FieldLabel required={!locked}>LPO Date</FieldLabel>
                                            <input id="lpo-date" type="date" max={dubaiDateKey()} value={lpoDate} onChange={(event) => setLpoDate(event.target.value)} className={`h-11 w-full rounded-xl border border-[#e5edf6] px-3 text-sm outline-none disabled:bg-[#f4f7fb] ${FOCUS}`} />
                                        </label>
                                        <label htmlFor="lpo-value">
                                            <FieldLabel required={!locked}>LPO Value</FieldLabel>
                                            <input id="lpo-value" type="number" min="0" step="0.01" value={lpoValue} onChange={(event) => setLpoValue(event.target.value)} className={`h-11 w-full rounded-xl border border-[#e5edf6] px-3 text-sm outline-none disabled:bg-[#f4f7fb] ${FOCUS}`} />
                                        </label>
                                        <label htmlFor="lpo-file">
                                            <FieldLabel required={!locked}>Attachment</FieldLabel>
                                            <input
                                                id="lpo-file"
                                                key={`lpo-${fileKey}`}
                                                type="file"
                                                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.txt,.csv"
                                                onChange={(event) => setLpoFile(event.target.files?.[0] || null)}
                                                className={`block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#f4f7fb] file:px-3 file:py-2 file:text-sm file:font-semibold ${FOCUS}`}
                                            />
                                        </label>
                                    </div>
                                    {locked ? null : (
                                        <button
                                            type="button"
                                            onClick={addLpo}
                                            className={`mt-4 inline-flex h-11 items-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] disabled:cursor-not-allowed disabled:bg-slate-300 ${FOCUS}`}
                                        >
                                            Add LPO
                                        </button>
                                    )}
                                </fieldset>
                            )}
                        </section>
                    ) : null}

                    {tab === 'Overview' || tab === 'Invoices' ? (
                        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                <FileText size={16} className="text-[#2f6fed]" /> Invoice Tracking
                            </h2>
                            <p className="text-sm text-slate-500">No invoice lines yet.</p>
                            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="rounded-xl bg-[#f4f8fd] px-4 py-3">
                                    <p className="text-[12px] text-slate-400">Total Invoiced</p>
                                    <p className="mt-1 text-lg font-bold text-slate-900">{formatAed(invoiced)}</p>
                                </div>
                                <div className="rounded-xl bg-amber-50 px-4 py-3">
                                    <p className="text-[12px] text-amber-700/80">Pending to Invoice</p>
                                    <p className="mt-1 text-lg font-bold text-slate-900">{formatAed(balance)}</p>
                                </div>
                            </div>
                            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#e8eef6]">
                                <div className="h-full rounded-full bg-[#2f6fed]" style={{ width: `${match}%` }} />
                            </div>
                            <p className="mt-2 text-[12px] font-semibold text-[#2f6fed]">Invoice Match: {match.toFixed(1)}%</p>
                        </section>
                    ) : null}

                    {tab === 'Activity' ? (
                        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                            <h2 className="mb-4 text-[15px] font-semibold text-slate-800">Activity</h2>
                            <ul className="space-y-3 text-sm text-slate-600">
                                <li>Created {formatWorkOrderDate(order.createdOn)}{order.createdByName ? ` by ${order.createdByName}` : ''}.</li>
                                <li>Status is {order.status}.</li>
                                {order.lpoAlert?.message ? <li>{order.lpoAlert.message}</li> : null}
                            </ul>
                        </section>
                    ) : null}
                </div>

                <div className="space-y-4">
                    <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)]">
                        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                            <Zap size={16} className="text-[#2f6fed]" /> Quick Actions
                        </h2>
                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                disabled={saving || mode !== 'received' || rows.length > 0}
                                title={mode === 'required' ? 'LPO upload is locked while Required is selected' : undefined}
                                onClick={() => {
                                    setTab('LPO');
                                    document.getElementById('lpo-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}
                                className={`flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2f6fed] text-sm font-semibold text-white hover:bg-[#245fe0] disabled:cursor-not-allowed disabled:bg-slate-300 ${FOCUS}`}
                            >
                                <Link2 size={16} /> Upload LPO
                            </button>
                            {(order.type || 'Standalone') === 'Standalone' ? (
                                <>
                                    <button
                                        type="button"
                                        className={`flex h-11 items-center justify-center gap-2 rounded-xl border border-[#e5edf6] bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 ${FOCUS}`}
                                    >
                                        <FolderPlus size={16} /> Convert to new project
                                    </button>
                                    <button
                                        type="button"
                                        className={`flex h-11 items-center justify-center gap-2 rounded-xl border border-[#e5edf6] bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 ${FOCUS}`}
                                    >
                                        <FileText size={16} /> Add a variation
                                    </button>
                                </>
                            ) : null}
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => changeStatus('Completed')}
                                className={`flex h-11 items-center justify-center gap-2 rounded-xl border border-[#e5edf6] bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 ${FOCUS}`}
                            >
                                <CheckCircle2 size={16} /> Mark Completed
                            </button>
                        </div>
                    </section>
                    <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)]">
                        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                            <Gavel size={16} className="text-[#2f6fed]" /> Business Rules
                        </h2>
                        <ul className="space-y-2.5 rounded-xl bg-[#f4fbf6] px-3 py-3">
                            {RULES.map((rule) => (
                                <li key={rule} className="flex items-start gap-2 text-[13px] leading-5 text-slate-600">
                                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                                    <span>{rule}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                    <button type="button" onClick={onBack} className={`inline-flex h-11 items-center gap-2 rounded-xl border border-[#e5edf6] bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 ${FOCUS}`}>
                        <ChevronLeft size={16} /> Back to dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}

function Summary({ icon: Icon, tint, label, value }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-[#e6eef6] bg-white px-3 py-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}><Icon size={18} /></span>
            <span className="min-w-0">
                <span className="block text-[11px] text-slate-400">{label}</span>
                <span className="block truncate text-sm font-bold text-slate-800">{value}</span>
            </span>
        </div>
    );
}

function InfoItem({ label, value }) {
    return (
        <div>
            <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd>
        </div>
    );
}
