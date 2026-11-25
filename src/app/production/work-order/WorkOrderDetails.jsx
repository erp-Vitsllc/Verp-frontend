'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    FileText,
    FolderOpen,
    Gavel,
    History,
    Home,
    Info,
    Link2,
    Paperclip,
    RefreshCw,
    UserRound,
    Wallet,
    Zap,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { isSystemSuperUser } from '@/utils/permissions';
import { dubaiDateKey, formatAed, formatWorkOrderDate } from './workOrderNumber';
import WorkOrderBudgetPanel from './WorkOrderBudgetPanel';
import WorkOrderQuotationModal from './WorkOrderQuotationModal';
import WorkOrderQuotationPanel from './WorkOrderQuotationPanel';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6fed]/40';
const PANEL = 'flex h-full min-w-0 flex-col rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5';

const LPO_MODES = [
    { id: 'required', label: 'Required' },
    { id: 'not_required', label: 'Not required' },
    { id: 'received', label: 'LPO received' },
];

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

function AttachmentLink({ name, mime, data }) {
    if (!name) return '—';
    return (
        <button
            type="button"
            disabled={!data}
            onClick={() => downloadAttachment(name, mime, data)}
            className={`inline-flex max-w-full items-center gap-1 text-left text-[#2f6fed] hover:underline disabled:cursor-default disabled:text-slate-700 disabled:no-underline ${FOCUS}`}
        >
            <Paperclip size={14} className="shrink-0" />
            <span className="truncate">{name}</span>
        </button>
    );
}

function NotRequiredFields({ workOrderNo, note, onNote, noteId, fileId, fileKey, onFile, existingName, existingMime, existingData }) {
    return (
        <div className="grid grid-cols-1 gap-3">
            <InfoItem label="WO no" value={workOrderNo || '—'} />
            <label htmlFor={noteId} className="block">
                <FieldLabel required>Reason</FieldLabel>
                <textarea
                    id={noteId}
                    value={note}
                    onChange={(event) => onNote(event.target.value)}
                    rows={3}
                    className={`w-full resize-y rounded-xl border border-[#e5edf6] bg-white px-3 py-2 text-sm outline-none ${FOCUS}`}
                />
            </label>
            <label htmlFor={fileId} className="block">
                <FieldLabel required>Supporting document</FieldLabel>
                <input
                    id={fileId}
                    key={fileKey}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    onChange={(event) => onFile(event.target.files?.[0] || null)}
                    className={`block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 ${FOCUS}`}
                />
            </label>
            {existingName ? <AttachmentLink name={existingName} mime={existingMime} data={existingData} /> : null}
        </div>
    );
}

function LpoDraftActions({ saving, onDraft, onSubmit }) {
    return (
        <div className="mt-3 flex flex-wrap gap-2">
            <button
                type="button"
                disabled={saving}
                onClick={onDraft}
                className={`inline-flex h-11 items-center rounded-xl border border-[#e5edf6] bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 ${FOCUS}`}
            >
                {saving ? 'Saving…' : 'Save as Draft'}
            </button>
            <button
                type="button"
                disabled={saving}
                onClick={onSubmit}
                className={`inline-flex h-11 items-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] disabled:opacity-60 ${FOCUS}`}
            >
                {saving ? 'Saving…' : 'Submit'}
            </button>
        </div>
    );
}

function NotRequiredSummary({ workOrderNo, reason, name, mime, data }) {
    return (
        <dl className="mt-4 space-y-4">
            <InfoItem label="WO no" value={workOrderNo || '—'} />
            <InfoItem label="Reason" value={reason || '—'} />
            <InfoItem label="Supporting document" value={<AttachmentLink name={name} mime={mime} data={data} />} />
        </dl>
    );
}

function briefChange(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > 90 ? `${text.slice(0, 87)}…` : text;
}

function lpoRows(order) {
    return Array.isArray(order?.lpos) ? order.lpos : [];
}

function historyAssignee(value) {
    return String(value || '').trim();
}

function historySteps(order) {
    const budgets = Array.isArray(order?.budgets) ? order.budgets : [];
    const budgetSave = [...budgets].reverse().find((row) => row.action === 'convert' || row.action === 'rebudget');
    const budgetReview = [...budgets].reverse().find((row) => row.action === 'rebudget' || row.action === 'resync');
    const lpoSent = lpoRows(order).length > 0 || Boolean(String(order?.lpoNo || '').trim());
    return [
        {
            id: 'create',
            label: 'Work order create',
            done: Boolean(order?.createdOn),
            assignee: historyAssignee(order?.createdByName),
        },
        {
            id: 'sales',
            label: 'Sales kick off',
            done: Boolean(order?.confirmationDate),
            assignee: historyAssignee(order?.salespersonName),
        },
        { id: 'mom', label: 'MOM', done: false, assignee: '' },
        { id: 'boq', label: 'Actual BOQ', done: order?.actualBoq?.status === 'approved', assignee: historyAssignee(order?.actualBoq?.status === 'draft' ? order?.actualBoq?.requestedByName : (order?.actualBoq?.status ? order?.projectManagerName : '')) },
        {
            id: 'budget',
            label: 'Budget',
            done: Boolean(order?.budgeted) || budgets.length > 0,
            assignee: historyAssignee(budgetSave?.savedByName),
        },
        { id: 'lpo', label: 'LPO to vendor', done: lpoSent, assignee: '' },
        { id: 'delivery', label: 'Delivery', done: false, assignee: '' },
        {
            id: 'bill',
            label: 'Bill entry',
            done: Array.isArray(order?.invoices) && order.invoices.length > 0,
            assignee: '',
        },
        {
            id: 'review',
            label: 'Budget review',
            done: Boolean(budgetReview),
            assignee: historyAssignee(budgetReview?.savedByName),
        },
        {
            id: 'completion',
            label: 'Completion',
            done: order?.status === 'Completed',
            assignee: '',
        },
    ];
}

function lpoStatusLabel(mode) {
    if (mode === 'received') return 'Received';
    if (mode === 'not_required') return 'Not required';
    if (mode === 'required') return 'Required';
    return '—';
}

function lpoOverviewCopy(order, coordinatorName, mode = order?.lpoMode || 'required') {
    const status = lpoStatusLabel(mode);
    const salesperson = order?.salespersonName || 'the salesperson';
    const coordinator = coordinatorName || order?.lpoAssigneeName || 'the project coordinator';
    const note = mode === 'not_required' && (order?.lpoMode || 'required') === 'not_required'
        ? String(order?.supportingNote || '').trim()
        : '';
    if (mode === 'received') {
        return { status, description: 'LPO is received.' };
    }
    if (mode === 'not_required') {
        return {
            status,
            description: note || `LPO is not required. Waiting for ${salesperson} to add the description and attachment.`,
        };
    }
    return {
        status,
        description: `LPO is required. Waiting for ${coordinator} to fill the details.`,
    };
}

function workOrderDocuments(order) {
    const rows = Array.isArray(order?.oldDocuments) ? order.oldDocuments : [];
    return [...rows].sort((left, right) => String(right.replacedAt || '').localeCompare(String(left.replacedAt || '')));
}

export default function WorkOrderDetails({ id, onBack, focusSection = '' }) {
    const { toast } = useToast();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tab, setTab] = useState(focusSection === 'lpo' ? 'LPO' : (focusSection === 'actual-boq' || focusSection === 'mr') ? 'Quotation' : 'Overview');
    const [saving, setSaving] = useState(false);
    const [lpoNo, setLpoNo] = useState('');
    const [lpoDate, setLpoDate] = useState('');
    const [lpoValue, setLpoValue] = useState('');
    const [invoiceNo, setInvoiceNo] = useState('');
    const [invoiceDate, setInvoiceDate] = useState('');
    const [invoiceAmount, setInvoiceAmount] = useState('');
    const [lpoFile, setLpoFile] = useState(null);
    const [noticeFile, setNoticeFile] = useState(null);
    const [followMode, setFollowMode] = useState('required');
    const [supportingNote, setSupportingNote] = useState('');
    const [supportFile, setSupportFile] = useState(null);
    const [canComplete, setCanComplete] = useState(false);
    const [fileKey, setFileKey] = useState(0);
    const [formError, setFormError] = useState('');
    const [quoteOpen, setQuoteOpen] = useState(false);
    const [quoteSync, setQuoteSync] = useState(null);
    const [updatingQuote, setUpdatingQuote] = useState(false);
    const [budgetSaving, setBudgetSaving] = useState('');
    const [vendors, setVendors] = useState([]);
    const [vendorMessage, setVendorMessage] = useState('');
    const [vendorSaving, setVendorSaving] = useState(false);
    const [openingReceived, setOpeningReceived] = useState(false);
    const [choice, setChoice] = useState('required');
    const [rejectReason, setRejectReason] = useState('');
    const [scrollToReceived, setScrollToReceived] = useState(false);
    const canResyncBudget = isSystemSuperUser();

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await axiosInstance.get(`/WorkOrder/${id}`);
            const next = response.data?.workOrder || null;
            setOrder(next);
            setCanComplete(Boolean(next?.viewerCanCompleteLpo));
            const approval = next?.lpoApproval;
            const draftMode = ['draft', 'pending', 'rejected'].includes(approval?.status) ? approval.mode : '';
            setChoice(draftMode || next?.lpoMode || 'required');
            setFollowMode(draftMode || next?.lpoMode || 'required');
            setSupportingNote(approval?.note || next?.supportingNote || '');
            setLpoNo(approval?.lpoNo || '');
            setLpoDate(approval?.lpoDate || '');
            setLpoValue(approval?.lpoValue ? String(approval.lpoValue) : '');
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not load this work order');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    const loadQuoteSync = useCallback(async () => {
        if (!id) return;
        try {
            const response = await axiosInstance.get(`/WorkOrder/${id}/quotation-changes`, { skipToast: true, timeout: 30000 });
            setQuoteSync(response.data || null);
        } catch {
            setQuoteSync(null);
        }
    }, [id]);

    useEffect(() => {
        if (!order?.quotationRef) {
            setQuoteSync(null);
            return;
        }
        loadQuoteSync();
    }, [order?.quotationRef, loadQuoteSync]);

    useEffect(() => {
        if (tab !== 'Material') return undefined;
        let cancelled = false;
        axiosInstance.get('/WorkOrder/vendors', { skipToast: true }).then((response) => {
            if (cancelled) return;
            const rows = Array.isArray(response.data?.vendors) ? response.data.vendors : [];
            setVendors(rows.filter((row) => row.id && row.name));
            setVendorMessage(rows.length ? '' : 'No vendors have been added in Vendor Management.');
        }).catch((err) => {
            if (cancelled) return;
            setVendors([]);
            setVendorMessage(err?.response?.data?.message || 'Vendors could not be loaded.');
        });
        return () => {
            cancelled = true;
        };
    }, [tab]);

    const saveVendor = async (vendorId) => {
        setVendorSaving(true);
        try {
            const response = await axiosInstance.patch(`/WorkOrder/${id}`, { vendorId }, { skipToast: true });
            if (response.data?.workOrder) setOrder(response.data.workOrder);
            toast({
                title: vendorId ? 'Vendor saved' : 'Vendor cleared',
                description: vendorId ? 'This vendor was added in Vendor Management.' : 'The vendor was removed from this work order.',
            });
        } catch (err) {
            toast({
                title: 'Could not save the vendor',
                description: err?.response?.data?.message || 'Select a vendor that was added in Vendor Management.',
                variant: 'destructive',
            });
        } finally {
            setVendorSaving(false);
        }
    };

    const saveBudget = async (action) => {
        setBudgetSaving(action);
        try {
            const response = await axiosInstance.post(`/WorkOrder/${id}/budget`, { action }, { skipToast: true, timeout: 30000 });
            if (response.data?.workOrder) setOrder(response.data.workOrder);
            setTab('Budget');
            toast({
                title: action === 'convert' ? 'Converted to budget' : action === 'rebudget' ? 'Re budget saved' : 'Budget resynced',
                description: action === 'resync'
                    ? 'The latest budget quotation was updated.'
                    : 'The latest quotation was added to the budget list.',
            });
        } catch (err) {
            toast({
                title: 'Could not update the budget',
                description: err?.response?.data?.message || 'Could not save this budget quotation.',
                variant: 'destructive',
            });
        } finally {
            setBudgetSaving('');
        }
    };

    const updateQuotation = async () => {
        setUpdatingQuote(true);
        try {
            const response = await axiosInstance.post(`/WorkOrder/${id}/quotation-changes`, {}, { skipToast: true, timeout: 30000 });
            if (response.data?.workOrder) setOrder(response.data.workOrder);
            setQuoteSync({ canUpdate: true, changed: false, changes: [] });
            toast({
                title: 'Quotation updated',
                description: response.data?.lpoAdjusted
                    ? 'Zoho changes were saved. The LPO value now matches the quotation total.'
                    : 'Zoho changes were saved on this work order.',
            });
        } catch (err) {
            toast({
                title: 'Could not update',
                description: err?.response?.data?.message || 'Could not update this quotation from Zoho.',
                variant: 'destructive',
            });
        } finally {
            setUpdatingQuote(false);
        }
    };

    useEffect(() => {
        if (focusSection !== 'lpo' || !order) return undefined;
        const timer = window.setTimeout(() => {
            document.getElementById('lpo-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
        return () => window.clearTimeout(timer);
    }, [focusSection, order]);

    useEffect(() => {
        if ((order?.lpoMode || 'required') === 'required') return;
        setOpeningReceived(false);
    }, [order?.lpoMode]);

    useEffect(() => {
        if (!scrollToReceived || tab !== 'LPO') return undefined;
        const timer = window.setTimeout(() => {
            const target = document.getElementById('lpo-received') || document.getElementById('lpo-details');
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setScrollToReceived(false);
        }, 60);
        return () => window.clearTimeout(timer);
    }, [scrollToReceived, tab, openingReceived, followMode]);

    useEffect(() => {
        const total = Number(order?.value) || 0;
        if (total > 0) setLpoValue((current) => current || total.toFixed(2));
    }, [order]);

    const patch = async (body) => {
        setSaving(true);
        setFormError('');
        try {
            const response = await axiosInstance.patch(`/WorkOrder/${id}`, body);
            const next = response.data?.workOrder || null;
            setOrder((current) => {
                if (!next) return current;
                if (!next.lpoAssigneeName && current?.lpoAssigneeName) {
                    next.lpoAssigneeName = current.lpoAssigneeName;
                }
                return next;
            });
            if (next && Object.prototype.hasOwnProperty.call(next, 'viewerCanCompleteLpo')) {
                setCanComplete(Boolean(next.viewerCanCompleteLpo));
            }
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

    const openUploadLpo = () => {
        if (!order) return;
        const savedMode = order.lpoMode || 'required';
        if (savedMode !== 'required' || lpoRows(order).length > 0) return;
        setFormError('');
        if (order.lpoLocked && !order.viewerIsProjectManager) return;
        if (order.lpoApproval?.status === 'pending') return;
        setChoice('received');
        setFollowMode('received');
        setOpeningReceived(true);
        setScrollToReceived(true);
        setTab('LPO');
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
            setOpeningReceived(false);
            setFileKey((key) => key + 1);
            toast({ title: 'LPO received', description: lpoNo.trim() });
        }
    };

    const createInvoice = async () => {
        const amount = Number(invoiceAmount);
        const orderValue = Number(order?.value) || 0;
        const already = (Array.isArray(order?.invoices) ? order.invoices : [])
            .reduce((sum, row) => sum + (Number(row.value) || 0), 0);
        if (!invoiceDate || !invoiceNo.trim() || !(amount > 0)) {
            setFormError('Invoice date, invoice number and value are required.');
            return;
        }
        if (orderValue > 0 && already + amount - orderValue > 0.009) {
            setFormError('Invoice total cannot exceed the work order value.');
            return;
        }
        const saved = await patch({
            invoice: {
                invoiceNo: invoiceNo.trim(),
                invoiceDate,
                value: amount,
            },
        });
        if (saved) {
            setInvoiceNo('');
            setInvoiceDate('');
            setInvoiceAmount('');
            toast({ title: 'Invoice created', description: invoiceNo.trim() });
        }
    };

    const lpoBody = async (mode, { draft = false } = {}) => {
        const body = { lpoMode: mode };
        if (mode === 'not_required') {
            if (!draft && !supportingNote.trim()) {
                setFormError('Reason is required.');
                return null;
            }
            const file = noticeFile || supportFile;
            if (!draft && !file && !order?.lpoApproval?.attachmentData) {
                setFormError('Supporting document is required.');
                return null;
            }
            body.supportingNote = supportingNote.trim();
            if (file) {
                try {
                    body.attachment = await readFile(file);
                } catch (err) {
                    setFormError(err.message);
                    return null;
                }
            }
            return body;
        }
        if (mode !== 'received') return body;
        const amount = Number(lpoValue);
        const total = Number(order?.value) || 0;
        if (!draft && (!lpoNo.trim() || !lpoDate || !(amount > 0) || (!lpoFile && !order?.lpoApproval?.attachmentData))) {
            setFormError('LPO number, date, value and attachment are required.');
            return null;
        }
        if (lpoDate && lpoDate > dubaiDateKey()) {
            setFormError('LPO date cannot be after today.');
            return null;
        }
        if (total > 0 && amount > 0 && Math.abs(amount - total) > 0.009) {
            setFormError('LPO value must match the quotation total.');
            return null;
        }
        body.lpo = {
            lpoNo: lpoNo.trim(),
            lpoDate,
            lpoValue: amount || '',
        };
        if (lpoFile) {
            try {
                body.lpo.attachment = await readFile(lpoFile);
            } catch (err) {
                setFormError(err.message);
                return null;
            }
        }
        return body;
    };

    const saveLpoDraft = async (mode) => {
        const fields = await lpoBody(mode, { draft: true });
        if (!fields) return;
        const updatingPending = order?.lpoApproval?.status === 'pending' && order?.viewerIsProjectManager;
        const saved = await patch({ saveLpoDraft: true, ...fields });
        if (!saved) return;
        setNoticeFile(null);
        setSupportFile(null);
        setLpoFile(null);
        setFileKey((key) => key + 1);
        toast({
            title: 'LPO draft saved',
            description: updatingPending
                ? 'The approval request is updated. Approve applies it, or Submit applies it now.'
                : order?.viewerIsProjectManager
                    ? 'The draft is updated. Submit changes the status.'
                    : 'The status stays the same until Submit.',
        });
    };

    const submitLpoUpdate = async (mode) => {
        const fields = await lpoBody(mode);
        if (!fields) return;
        const saved = await patch({ submitLpoUpdate: true, ...fields });
        if (!saved) return;
        setNoticeFile(null);
        setSupportFile(null);
        setLpoFile(null);
        setFileKey((key) => key + 1);
        setOpeningReceived(false);
        if (saved.approvalSent) {
            toast({
                title: 'Sent for approval',
                description: saved.emailMessage || `Waiting for ${order?.projectManagerName || 'the project manager'} to approve. The status stays unchanged until then.`,
            });
            return;
        }
        toast({
            title: 'LPO updated',
            description: `Status is now ${lpoStatusLabel(mode)}.`,
        });
    };

    const decideLpo = async (decision) => {
        if (decision === 'reject' && !rejectReason.trim()) {
            setFormError('A reason is required to reject the LPO.');
            return;
        }
        const saved = await patch({
            decideLpoApproval: true,
            decision,
            reason: rejectReason.trim(),
        });
        if (!saved) return;
        setRejectReason('');
        toast({
            title: decision === 'approve' ? 'LPO approved' : 'LPO rejected',
            description: decision === 'approve'
                ? 'The status is updated.'
                : 'The status stays the same.',
        });
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

    const completeFollowUp = async () => {
        const body = { completeLpoFollowUp: true, lpoMode: followMode };
        if (followMode === 'not_required') {
            if (!supportingNote.trim()) {
                setFormError('Note is required.');
                return;
            }
            if (!supportFile && !order?.supportingDocument?.name) {
                setFormError('Supporting document is required.');
                return;
            }
            body.supportingNote = supportingNote.trim();
            if (supportFile) {
                try {
                    body.attachment = await readFile(supportFile);
                } catch (err) {
                    setFormError(err.message);
                    return;
                }
            }
        } else if (followMode === 'received') {
            const amount = Number(lpoValue);
            const quoteTotal = Number(order?.value) || 0;
            if (!lpoNo.trim() || !lpoDate || !(amount > 0) || !lpoFile) {
                setFormError('LPO number, date, value and attachment are required.');
                return;
            }
            if (lpoDate > dubaiDateKey()) {
                setFormError('LPO date cannot be after today.');
                return;
            }
            if (quoteTotal > 0 && Math.abs(amount - quoteTotal) > 0.009) {
                setFormError('LPO value must match the quotation total.');
                return;
            }
            try {
                body.lpo = {
                    lpoNo: lpoNo.trim(),
                    lpoDate,
                    lpoValue: amount,
                    attachment: await readFile(lpoFile),
                };
            } catch (err) {
                setFormError(err.message);
                return;
            }
        }
        const saved = await patch(body);
        if (!saved) return;
        setSupportFile(null);
        setLpoFile(null);
        setFileKey((key) => key + 1);
        const nextStatus = saved.workOrder?.status || '';
        toast({
            title: followMode === 'not_required'
                ? 'Work order completed'
                : followMode === 'received'
                    ? 'LPO received'
                    : 'Work order created',
            description: followMode === 'received'
                ? 'The LPO number, date, value and attachment were saved.'
                : (nextStatus || order?.workOrderNo || ''),
        });
    };

    const sendNotRequired = async () => {
        if (!supportingNote.trim()) {
            setFormError('Description is required when LPO is not required.');
            return;
        }
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
            supportingNote: supportingNote.trim(),
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

    const savedLpoMode = order.lpoMode || 'required';
    const coordinatorName = order.lpoAssigneeName || 'the project coordinator';
    const lpoCopy = lpoOverviewCopy(order, coordinatorName);
    const approvalPending = order.lpoApproval?.status === 'pending';
    const approvalRejected = order.lpoApproval?.status === 'rejected';
    const viewerIsProjectManager = Boolean(order.viewerIsProjectManager);
    const canEditLpo = viewerIsProjectManager || (!order.lpoLocked && !approvalPending);
    const canSubmitLpo = canEditLpo && (!order.lpoFollowUp || canComplete || viewerIsProjectManager);
    const mode = order.lpoFollowUp ? followMode : (choice || savedLpoMode);
    const displayMode = mode;
    const showLpo = tab === 'LPO';
    const showInvoice = tab === 'Invoices';
    const stacked = tab === 'Overview';
    const invoiceError = /invoice/i.test(formError);
    const rows = lpoRows(order);
    const canUploadLpo = savedLpoMode === 'required' && rows.length === 0;
    const supportName = savedLpoMode === 'not_required'
        ? (order.supportingDocument?.name || order.lpoAlert?.attachmentName || '')
        : '';
    const supportNote = savedLpoMode === 'not_required' ? String(order.supportingNote || '').trim() : '';
    const supportMime = order.supportingDocument?.name
        ? (order.supportingDocument.mime || '')
        : (order.lpoAlert?.attachmentMime || '');
    const supportData = order.supportingDocument?.name
        ? (order.supportingDocument.data || '')
        : (order.lpoAlert?.attachmentData || '');
    const invoiceRows = Array.isArray(order.invoices) ? order.invoices : [];
    const invoiced = invoiceRows.length
        ? invoiceRows.reduce((sum, row) => sum + (Number(row.value) || 0), 0)
        : (Number(order.invoicedAmount) || 0);
    const total = Number(order.value) || 0;
    const balance = Math.max(0, total - invoiced);
    const totalsMatch = total > 0 && Math.abs(total - invoiced) < 0.01;
    const quotationRefValue = order.quotationRef ? (
        <button
            type="button"
            onClick={() => setQuoteOpen(true)}
            className={`font-semibold text-[#2f6fed] hover:underline ${FOCUS}`}
        >
            {order.quotationRef}
        </button>
    ) : '—';

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

            {order.lpoAlert?.message ? (
                <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
                    <p className="font-semibold">{lpoCopy.status}</p>
                    <p className="mt-1">{lpoCopy.description}</p>
                    {order.lpoAlert.message && order.lpoAlert.message !== lpoCopy.description ? (
                        <p className="mt-1">{order.lpoAlert.message}</p>
                    ) : null}
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

            {order.lpoApproval?.status === 'draft' ? (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                    <p className="font-semibold">LPO draft</p>
                    <p className="mt-1">The status stays {lpoCopy.status} until Submit. The project manager can update this draft.</p>
                </div>
            ) : null}
            {approvalPending ? (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    <p className="font-semibold">Waiting for project manager approval</p>
                    <p className="mt-1">
                        The LPO status stays {lpoCopy.status} until {order.projectManagerName || 'the project manager'} approves.
                    </p>
                </div>
            ) : null}
            {approvalRejected && order.lpoApproval?.reason ? (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    <p className="font-semibold">LPO update rejected</p>
                    <p className="mt-1">{order.lpoApproval.reason}</p>
                </div>
            ) : null}

            {quoteSync?.canUpdate && quoteSync.changed ? (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="font-semibold">This quotation changed in Zoho</p>
                            <p className="mt-1 text-[13px] text-amber-900">
                                The work order still shows the quotation that was saved. Update only when you want those Zoho changes here.
                            </p>
                            {Array.isArray(quoteSync.changes) && quoteSync.changes.length ? (
                                <ul className="mt-2 space-y-1 text-[13px]">
                                    {quoteSync.changes.map((change) => (
                                        <li key={change.label}>
                                            <span className="font-semibold">{change.label}:</span> {briefChange(change.from)} → {briefChange(change.to)}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            disabled={updatingQuote}
                            onClick={updateQuotation}
                            className={`inline-flex h-10 shrink-0 items-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] disabled:opacity-60 ${FOCUS}`}
                        >
                            {updatingQuote ? 'Updating…' : 'Update changes'}
                        </button>
                    </div>
                </div>
            ) : null}

            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-4">
                    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-[#e6eef6] bg-white p-1.5">
                        {['Overview', 'LPO', 'Quotation', 'Invoices', 'BOQ', 'Budget', 'Check list', 'Material', 'Delivery', 'Activity', 'History', 'Old documents'].map((item) => (
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
                        <>
                        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                <Info size={16} className="text-[#2f6fed]" /> Work Order Information
                            </h2>
                            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <InfoItem label="Work Order Number" value={order.workOrderNo} />
                                <InfoItem label="Created Date" value={formatWorkOrderDate(order.createdOn)} />
                                <InfoItem label="Salesperson" value={order.salespersonName || '—'} />
                                <InfoItem label="Quotation Ref" value={quotationRefValue} />
                                <InfoItem label="Order Confirmation Date" value={formatWorkOrderDate(order.confirmationDate)} />
                                <InfoItem label="Quotation Date" value={formatWorkOrderDate(order.quotationDate)} />
                                <InfoItem label="Delivery Location" value={order.location || '—'} />
                                <InfoItem label="Work Order Description" value={order.description || '—'} />
                            </dl>
                        </section>
                        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
                            <section className={PANEL}>
                                <h2 className="mb-4 flex min-h-11 items-center gap-2 text-[15px] font-semibold text-slate-800">
                                    <FileText size={16} className="text-[#2f6fed]" /> Quote
                                </h2>
                                <dl className="space-y-4">
                                    <InfoItem label="Quote no" value={quotationRefValue} />
                                    <InfoItem label="Quote value" value={formatAed(total)} />
                                    <InfoItem label="Salesperson" value={order.salespersonName || '—'} />
                                </dl>
                            </section>
                            <section className={PANEL}>
                                <div className="mb-4 flex min-h-11 items-center justify-between gap-3">
                                    <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                        <FileText size={16} className="text-[#2f6fed]" /> Invoice
                                    </h2>
                                    <p className="text-right text-[12px] leading-4 text-slate-500">
                                        Remaining amount
                                        <span className="mt-0.5 block text-sm font-semibold text-slate-800">{formatAed(balance)}</span>
                                    </p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-[13px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400">
                                                <th className="py-2 pr-2 font-medium">Invoice no</th>
                                                <th className="px-2 py-2 font-medium">Value</th>
                                                <th className="py-2 pl-2 font-medium">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoiceRows.length ? invoiceRows.map((row, index) => (
                                                <tr key={`${row.invoiceNo}-${row.invoiceDate}-${index}`} className="border-b border-slate-100 last:border-0">
                                                    <td className="py-2.5 pr-2 font-semibold text-slate-800">{row.invoiceNo || '—'}</td>
                                                    <td className="px-2 py-2.5 whitespace-nowrap text-slate-700">{formatAed(row.value)}</td>
                                                    <td className="py-2.5 pl-2 whitespace-nowrap text-slate-600">{formatWorkOrderDate(row.invoiceDate)}</td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={3} className="py-4 text-sm text-slate-500">No invoices yet.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-4 border-t border-slate-100 pt-3">
                                    <p className="text-[12px] text-slate-400">Total invoiced amount</p>
                                    <p className="mt-1 text-base font-bold text-slate-900">{formatAed(invoiced)}</p>
                                </div>
                            </section>
                            <section className={PANEL}>
                                <h2 className="mb-4 flex min-h-11 items-center gap-2 text-[15px] font-semibold text-slate-800">
                                    <Paperclip size={16} className="text-[#2f6fed]" /> LPO
                                </h2>
                                <dl className="space-y-4">
                                    <InfoItem label="Status" value={lpoCopy.status} />
                                    {savedLpoMode === 'not_required' ? (
                                        <>
                                            <InfoItem label="WO no" value={order.workOrderNo || '—'} />
                                            {supportNote ? <InfoItem label="Reason" value={supportNote} /> : null}
                                            {supportName ? (
                                                <InfoItem
                                                    label="Supporting document"
                                                    value={<AttachmentLink name={supportName} mime={supportMime} data={supportData} />}
                                                />
                                            ) : null}
                                            {!supportNote || !supportName ? (
                                                <div>
                                                    <p className="text-sm font-medium text-slate-800">
                                                        Waiting for {order.salespersonName || 'the salesperson'} to fill the following
                                                    </p>
                                                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-600">
                                                        {!supportNote ? <li>Reason</li> : null}
                                                        {!supportName ? <li>Supporting document</li> : null}
                                                    </ul>
                                                </div>
                                            ) : null}
                                        </>
                                    ) : (
                                        <InfoItem label="Description" value={lpoCopy.description} />
                                    )}
                                    {order.lpoApproval?.status === 'draft' ? (
                                        <InfoItem label="Draft" value="Saved. The status changes on Submit." />
                                    ) : null}
                                    {approvalPending ? (
                                        <InfoItem label="Approval" value={`Waiting for ${order.projectManagerName || 'the project manager'}`} />
                                    ) : null}
                                    {approvalRejected && order.lpoApproval?.reason ? (
                                        <InfoItem label="Rejection reason" value={order.lpoApproval.reason} />
                                    ) : null}
                                    {savedLpoMode === 'received' || rows.length > 0 ? (
                                        (rows.length ? rows : [null]).map((row, index) => (
                                            <div key={row?._id || row?.lpoNo || `lpo-${index}`} className="space-y-4">
                                                <InfoItem label="LPO no" value={row?.lpoNo || '—'} />
                                                <InfoItem label="Date" value={row ? formatWorkOrderDate(row.lpoDate) : '—'} />
                                                <InfoItem label="Value" value={row ? formatAed(row.lpoValue) : '—'} />
                                                <InfoItem
                                                    label="Attachment"
                                                    value={row?.attachmentName
                                                        ? <AttachmentLink name={row.attachmentName} mime={row.attachmentMime} data={row.attachmentData} />
                                                        : '—'}
                                                />
                                            </div>
                                        ))
                                    ) : null}
                                </dl>
                            </section>
                        </div>
                        </>
                    ) : null}

                    <div className="contents">
                    {showLpo ? (
                        <section id="lpo-details" className="min-w-0 rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                <Paperclip size={16} className="text-[#2f6fed]" /> LPO Details
                            </h2>
                            <div role="radiogroup" aria-label="LPO option" className="inline-flex max-w-full flex-wrap gap-1 rounded-full bg-[#f4f7fb] p-1">
                                {LPO_MODES.map((item) => {
                                    const active = displayMode === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={active}
                                            disabled={saving || !canSubmitLpo}
                                            onClick={() => {
                                                if (!canSubmitLpo) return;
                                                setFormError('');
                                                if (order.lpoFollowUp) {
                                                    setFollowMode(item.id);
                                                    return;
                                                }
                                                setChoice(item.id);
                                                setOpeningReceived(item.id === 'received');
                                            }}
                                            className={active
                                                ? `h-8 rounded-full bg-[#2f6fed] px-3 text-[13px] font-semibold text-white ${FOCUS}`
                                                : `h-8 rounded-full px-3 text-[13px] font-medium text-slate-600 hover:bg-white disabled:opacity-60 ${FOCUS}`}
                                        >
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="mt-3 text-[13px] leading-5 text-slate-500">
                                Saved status: {lpoCopy.status}. Save as Draft stores this LPO without changing the status. Submit sends it after the required fields are complete.
                                {viewerIsProjectManager
                                    ? ' As project manager, you can update the draft, and Submit changes the status.'
                                    : ` Submit sends it to ${order.projectManagerName || 'the project manager'}. They can update the draft, then approve. A rejection needs a reason.`}
                            </p>
                            {order.lpoLocked && !viewerIsProjectManager ? (
                                <p className="mt-2 text-sm leading-6 text-slate-600">Only the project manager can update the LPO.</p>
                            ) : null}
                            {approvalPending && viewerIsProjectManager ? (
                                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                                    <p className="text-sm font-semibold text-amber-950">
                                        {order.lpoApproval?.requestedByName || 'An employee'} asked to set this LPO to {lpoStatusLabel(order.lpoApproval?.mode)}.
                                    </p>
                                    <p className="mt-2 text-sm text-amber-950">Change the fields below and Save as Draft, then Approve. Submit applies your changes now.</p>
                                    {order.lpoApproval?.note ? <p className="mt-2 text-sm text-amber-950">Reason: {order.lpoApproval.note}</p> : null}
                                    {order.lpoApproval?.lpoNo ? (
                                        <p className="mt-2 text-sm text-amber-950">
                                            {order.lpoApproval.lpoNo} · {formatWorkOrderDate(order.lpoApproval.lpoDate)} · {formatAed(order.lpoApproval.lpoValue)}
                                        </p>
                                    ) : null}
                                    {order.lpoApproval?.attachmentName ? (
                                        <button
                                            type="button"
                                            className={`mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#2f6fed] hover:underline ${FOCUS}`}
                                            onClick={() => downloadAttachment(order.lpoApproval.attachmentName, order.lpoApproval.attachmentMime, order.lpoApproval.attachmentData)}
                                        >
                                            <Paperclip size={14} />
                                            {order.lpoApproval.attachmentName}
                                        </button>
                                    ) : null}
                                    <label htmlFor="lpo-reject-reason" className="mt-3 block">
                                        <FieldLabel>Rejection reason</FieldLabel>
                                        <textarea
                                            id="lpo-reject-reason"
                                            value={rejectReason}
                                            onChange={(event) => setRejectReason(event.target.value)}
                                            rows={3}
                                            className={`w-full resize-y rounded-xl border border-[#e5edf6] bg-white px-3 py-2 text-sm outline-none ${FOCUS}`}
                                        />
                                    </label>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            disabled={saving}
                                            onClick={() => decideLpo('approve')}
                                            className={`inline-flex h-11 items-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] disabled:opacity-60 ${FOCUS}`}
                                        >
                                            {saving ? 'Saving…' : 'Approve'}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={saving}
                                            onClick={() => decideLpo('reject')}
                                            className={`inline-flex h-11 items-center rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 ${FOCUS}`}
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                            {approvalPending && !viewerIsProjectManager ? (
                                <p className="mt-3 text-sm leading-6 text-slate-600">
                                    Waiting for {order.projectManagerName || 'the project manager'} to approve. The status stays {lpoCopy.status}.
                                </p>
                            ) : null}

                            {formError && !invoiceError ? (
                                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>
                            ) : null}

                            {rows.length ? (
                                stacked ? (
                                    <dl className="mt-4 space-y-4">
                                        {rows.map((row) => (
                                            <div key={row._id || row.lpoNo} className="space-y-4">
                                                <InfoItem label="LPO Number" value={row.lpoNo || '—'} />
                                                <InfoItem label="LPO Date" value={formatWorkOrderDate(row.lpoDate)} />
                                                <InfoItem label="LPO Value" value={formatAed(row.lpoValue)} />
                                                <InfoItem
                                                    label="Attachment"
                                                    value={row.attachmentName ? (
                                                        <button
                                                            type="button"
                                                            disabled={!row.attachmentData}
                                                            onClick={() => downloadAttachment(row.attachmentName, row.attachmentMime, row.attachmentData)}
                                                            className={`inline-flex items-center gap-1 text-[#2f6fed] hover:underline disabled:cursor-default disabled:no-underline ${FOCUS}`}
                                                        >
                                                            <Paperclip size={14} />
                                                            {row.attachmentName}
                                                        </button>
                                                    ) : '—'}
                                                />
                                            </div>
                                        ))}
                                    </dl>
                                ) : (
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
                                )
                            ) : null}

                            {displayMode === 'required' ? (
                                canSubmitLpo ? (
                                    <LpoDraftActions
                                        saving={saving}
                                        onDraft={() => saveLpoDraft('required')}
                                        onSubmit={() => submitLpoUpdate('required')}
                                    />
                                ) : null
                            ) : order.lpoFollowUp ? (
                                canSubmitLpo ? (
                                    <div className="mt-4 rounded-xl border border-[#e6eef6] bg-[#f8fbff] p-4">
                                        {mode === 'not_required' ? (
                                            <NotRequiredFields
                                                workOrderNo={order.workOrderNo}
                                                note={supportingNote}
                                                onNote={setSupportingNote}
                                                noteId="lpo-support-note"
                                                fileId="lpo-support-file"
                                                fileKey={`support-${fileKey}`}
                                                onFile={setSupportFile}
                                                existingName={order.lpoApproval?.attachmentName || order.supportingDocument?.name}
                                                existingMime={order.lpoApproval?.attachmentMime || order.supportingDocument?.mime}
                                                existingData={order.lpoApproval?.attachmentData || order.supportingDocument?.data}
                                            />
                                        ) : mode === 'received' ? (
                                            <div id="lpo-received" className={stacked ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 gap-3 sm:grid-cols-2'}>
                                                <label htmlFor="lpo-no">
                                                    <FieldLabel required>LPO Number</FieldLabel>
                                                    <input id="lpo-no" value={lpoNo} onChange={(event) => setLpoNo(event.target.value)} className={`h-11 w-full rounded-xl border border-[#e5edf6] px-3 text-sm outline-none ${FOCUS}`} />
                                                </label>
                                                <label htmlFor="lpo-date">
                                                    <FieldLabel required>LPO Date</FieldLabel>
                                                    <input id="lpo-date" type="date" max={dubaiDateKey()} value={lpoDate} onChange={(event) => setLpoDate(event.target.value)} className={`h-11 w-full rounded-xl border border-[#e5edf6] px-3 text-sm outline-none ${FOCUS}`} />
                                                </label>
                                                <label htmlFor="lpo-value">
                                                    <FieldLabel required>LPO Value</FieldLabel>
                                                    <input id="lpo-value" type="number" min="0" step="0.01" value={lpoValue} onChange={(event) => setLpoValue(event.target.value)} className={`h-11 w-full rounded-xl border border-[#e5edf6] px-3 text-sm outline-none ${FOCUS}`} />
                                                </label>
                                                <label htmlFor="lpo-file">
                                                    <FieldLabel required>Attachment</FieldLabel>
                                                    <input
                                                        id="lpo-file"
                                                        key={`lpo-${fileKey}`}
                                                        type="file"
                                                        accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.txt,.csv"
                                                        onChange={(event) => setLpoFile(event.target.files?.[0] || null)}
                                                        className={`block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#f4f7fb] file:px-3 file:py-2 file:text-sm file:font-semibold ${FOCUS}`}
                                                    />
                                                    {order.lpoApproval?.attachmentName ? (
                                                        <span className="mt-1 block text-[12px] text-slate-500">Saved file: {order.lpoApproval.attachmentName}</span>
                                                    ) : null}
                                                </label>
                                            </div>
                                        ) : null}
                                        <LpoDraftActions
                                            saving={saving}
                                            onDraft={() => saveLpoDraft(mode)}
                                            onSubmit={() => submitLpoUpdate(mode)}
                                        />
                                    </div>
                                ) : displayMode === 'not_required' && (supportName || supportNote) ? (
                                    <NotRequiredSummary
                                        workOrderNo={order.workOrderNo}
                                        reason={supportNote}
                                        name={supportName}
                                        mime={supportMime}
                                        data={supportData}
                                    />
                                ) : (
                                    <p className="mt-3 text-sm leading-6 text-slate-600">
                                        {lpoOverviewCopy(order, coordinatorName, displayMode).description}
                                    </p>
                                )
                            ) : displayMode === 'not_required' && (supportName || supportNote) && !order.attachmentPending && !canSubmitLpo ? (
                                <NotRequiredSummary
                                    workOrderNo={order.workOrderNo}
                                    reason={supportNote}
                                    name={supportName}
                                    mime={supportMime}
                                    data={supportData}
                                />
                            ) : displayMode === 'not_required' && canSubmitLpo ? (
                                <div className="mt-4 rounded-xl border border-[#e6eef6] bg-[#f8fbff] p-4">
                                    <NotRequiredFields
                                        workOrderNo={order.workOrderNo}
                                        note={supportingNote}
                                        onNote={setSupportingNote}
                                        noteId="lpo-notice-note"
                                        fileId="lpo-notice-file"
                                        fileKey={`notice-${fileKey}`}
                                        onFile={setNoticeFile}
                                        existingName={order.lpoApproval?.attachmentName || supportName}
                                        existingMime={order.lpoApproval?.attachmentMime || supportMime}
                                        existingData={order.lpoApproval?.attachmentData || supportData}
                                    />
                                    <p className="mt-2 text-[12px] text-slate-500">
                                        Save as Draft can be incomplete. Submit needs the reason and supporting document.
                                    </p>
                                    <LpoDraftActions
                                        saving={saving}
                                        onDraft={() => saveLpoDraft('not_required')}
                                        onSubmit={() => submitLpoUpdate('not_required')}
                                    />
                                </div>
                            ) : displayMode === 'received' && rows.length === 0 && canSubmitLpo ? (
                                <fieldset id="lpo-received" disabled={saving} className="mt-4">
                                    <div className={stacked ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 gap-3 sm:grid-cols-2'}>
                                        <label htmlFor="lpo-no">
                                            <FieldLabel required>LPO Number</FieldLabel>
                                            <input id="lpo-no" value={lpoNo} onChange={(event) => setLpoNo(event.target.value)} className={`h-11 w-full rounded-xl border border-[#e5edf6] px-3 text-sm outline-none disabled:bg-[#f4f7fb] ${FOCUS}`} />
                                        </label>
                                        <label htmlFor="lpo-date">
                                            <FieldLabel required>LPO Date</FieldLabel>
                                            <input id="lpo-date" type="date" max={dubaiDateKey()} value={lpoDate} onChange={(event) => setLpoDate(event.target.value)} className={`h-11 w-full rounded-xl border border-[#e5edf6] px-3 text-sm outline-none disabled:bg-[#f4f7fb] ${FOCUS}`} />
                                        </label>
                                        <label htmlFor="lpo-value">
                                            <FieldLabel required>LPO Value</FieldLabel>
                                            <input id="lpo-value" type="number" min="0" step="0.01" value={lpoValue} onChange={(event) => setLpoValue(event.target.value)} className={`h-11 w-full rounded-xl border border-[#e5edf6] px-3 text-sm outline-none disabled:bg-[#f4f7fb] ${FOCUS}`} />
                                        </label>
                                        <label htmlFor="lpo-file">
                                            <FieldLabel required>Attachment</FieldLabel>
                                            <input
                                                id="lpo-file"
                                                key={`lpo-${fileKey}`}
                                                type="file"
                                                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.txt,.csv"
                                                onChange={(event) => setLpoFile(event.target.files?.[0] || null)}
                                                className={`block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#f4f7fb] file:px-3 file:py-2 file:text-sm file:font-semibold ${FOCUS}`}
                                            />
                                            {order.lpoApproval?.attachmentName ? (
                                                <span className="mt-1 block text-[12px] text-slate-500">Saved file: {order.lpoApproval.attachmentName}</span>
                                            ) : null}
                                        </label>
                                    </div>
                                    <LpoDraftActions
                                        saving={saving}
                                        onDraft={() => saveLpoDraft('received')}
                                        onSubmit={() => submitLpoUpdate('received')}
                                    />
                                </fieldset>
                            ) : null}
                        </section>
                    ) : null}

                    {tab === 'Quotation' ? (
                        <WorkOrderQuotationPanel
                            order={order}
                            onOpen={() => setQuoteOpen(true)}
                            onSaved={setOrder}
                            initialTab={focusSection === 'mr' ? 'mr' : focusSection === 'actual-boq' ? 'actual' : 'proposed'}
                        />
                    ) : null}

                    {showInvoice ? (
                        <section className="min-w-0 rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                <FileText size={16} className="text-[#2f6fed]" /> Invoice
                            </h2>
                            {formError && invoiceError ? (
                                <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>
                            ) : null}
                            <div className={stacked ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 gap-3 sm:grid-cols-3'}>
                                <label htmlFor="invoice-date">
                                    <FieldLabel required>Invoice date</FieldLabel>
                                    <input id="invoice-date" type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} className={`h-11 w-full rounded-xl border border-[#e5edf6] px-3 text-sm outline-none ${FOCUS}`} />
                                </label>
                                <label htmlFor="invoice-no">
                                    <FieldLabel required>Invoice number</FieldLabel>
                                    <input id="invoice-no" value={invoiceNo} onChange={(event) => setInvoiceNo(event.target.value)} className={`h-11 w-full rounded-xl border border-[#e5edf6] px-3 text-sm outline-none ${FOCUS}`} />
                                </label>
                                <label htmlFor="invoice-value">
                                    <FieldLabel required>Value</FieldLabel>
                                    <input id="invoice-value" type="number" min="0" step="0.01" value={invoiceAmount} onChange={(event) => setInvoiceAmount(event.target.value)} className={`h-11 w-full rounded-xl border border-[#e5edf6] px-3 text-sm outline-none ${FOCUS}`} />
                                </label>
                            </div>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={createInvoice}
                                className={`mt-4 inline-flex h-11 items-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] disabled:opacity-60 ${FOCUS}`}
                            >
                                {saving ? 'Saving…' : 'Create'}
                            </button>
                            <div className="mt-4 space-y-4">
                                {invoiceRows.length ? invoiceRows.map((row, index) => (
                                    <dl key={`${row.invoiceNo}-${row.invoiceDate}-${index}`} className="space-y-3 border-t border-slate-100 pt-4">
                                        <InfoItem label="Invoice date" value={formatWorkOrderDate(row.invoiceDate)} />
                                        <InfoItem label="Invoice number" value={row.invoiceNo || '—'} />
                                        <InfoItem label="Value" value={formatAed(row.value)} />
                                    </dl>
                                )) : (
                                    <p className="border-t border-slate-100 pt-4 text-sm text-slate-500">No invoices yet.</p>
                                )}
                            </div>
                            <div className={stacked ? 'mt-4 grid grid-cols-1 gap-3' : 'mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3'}>
                                <div className="rounded-xl bg-[#f4f8fd] px-4 py-3">
                                    <p className="text-[12px] text-slate-400">Order value</p>
                                    <p className="mt-1 text-lg font-bold text-slate-900">{formatAed(total)}</p>
                                </div>
                                <div className="rounded-xl bg-[#f4f8fd] px-4 py-3">
                                    <p className="text-[12px] text-slate-400">Invoice value</p>
                                    <p className="mt-1 text-lg font-bold text-slate-900">{formatAed(invoiced)}</p>
                                </div>
                                <div className="rounded-xl bg-amber-50 px-4 py-3">
                                    <p className="text-[12px] text-amber-700/80">Pending value</p>
                                    <p className="mt-1 text-lg font-bold text-slate-900">{formatAed(balance)}</p>
                                </div>
                            </div>
                            {totalsMatch ? (
                                <button
                                    type="button"
                                    onClick={() => setTab('BOQ')}
                                    className={`mt-4 inline-flex h-11 items-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] ${FOCUS}`}
                                >
                                    Create BOQ
                                </button>
                            ) : null}
                        </section>
                    ) : null}
                    </div>

                    {tab === 'BOQ' ? (
                        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                <ClipboardList size={16} className="text-[#2f6fed]" /> BOQ
                            </h2>
                            {totalsMatch ? (
                                <button
                                    type="button"
                                    onClick={() => setTab('BOQ')}
                                    className={`inline-flex h-11 items-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] ${FOCUS}`}
                                >
                                    Create BOQ
                                </button>
                            ) : (
                                <p className="text-sm text-slate-500">Create BOQ appears when the invoice total matches the order value.</p>
                            )}
                            <p className="mt-4 text-sm text-slate-500">No BOQ lines yet.</p>
                        </section>
                    ) : null}

                    {tab === 'Budget' ? <WorkOrderBudgetPanel order={order} /> : null}

                    {tab === 'Check list' ? (
                        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                <ClipboardList size={16} className="text-[#2f6fed]" /> Check list
                            </h2>
                            <p className="text-sm text-slate-500">No checklist items yet.</p>
                        </section>
                    ) : null}

                    {tab === 'Material' ? (
                        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                <FileText size={16} className="text-[#2f6fed]" /> Material
                            </h2>
                            <label htmlFor="wo-vendor" className="block max-w-md">
                                <span className="mb-1.5 block text-[12px] font-medium text-slate-500">Vendor</span>
                                <select
                                    id="wo-vendor"
                                    value={order.vendorId || ''}
                                    disabled={vendorSaving}
                                    onChange={(event) => saveVendor(event.target.value)}
                                    className={`h-11 w-full rounded-xl border border-[#e5edf6] bg-white px-3 text-sm text-slate-800 outline-none disabled:bg-[#f4f7fb] ${FOCUS}`}
                                >
                                    <option value="">Select vendor</option>
                                    {order.vendorId && !vendors.some((row) => row.id === order.vendorId) ? (
                                        <option value={order.vendorId}>{order.vendorName || 'Saved vendor'}</option>
                                    ) : null}
                                    {vendors.map((row) => (
                                        <option key={row.id} value={row.id}>
                                            {row.status === 'Inactive' ? `${row.name} (Inactive)` : row.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {vendorMessage ? <p className="mt-2 text-sm text-amber-700">{vendorMessage}</p> : null}
                            <p className="mt-4 text-sm text-slate-500">No materials yet.</p>
                        </section>
                    ) : null}

                    {tab === 'Delivery' ? (
                        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                <ClipboardList size={16} className="text-[#2f6fed]" /> Delivery
                            </h2>
                            <p className="text-sm text-slate-500">No deliveries yet.</p>
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

                    {tab === 'History' ? (
                        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                            <h2 className="mb-5 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                <History size={16} className="text-[#2f6fed]" /> History
                            </h2>
                            <ol>
                                {historySteps(order).map((step, index, steps) => (
                                    <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
                                        {index < steps.length - 1 ? (
                                            <span className="absolute bottom-0 left-[11px] top-6 w-px bg-[#d7e3f4]" aria-hidden="true" />
                                        ) : null}
                                        <input
                                            type="checkbox"
                                            checked={step.done}
                                            readOnly
                                            tabIndex={-1}
                                            aria-label={step.label}
                                            className="pointer-events-none relative z-10 mt-0.5 h-[22px] w-[22px] shrink-0 rounded border-[#c5d4e8] accent-[#2f6fed]"
                                        />
                                        <span className="min-w-0 pt-0.5">
                                            <span className="block text-sm font-semibold text-slate-800">{step.label}</span>
                                            {step.assignee ? (
                                                <span className="mt-0.5 block text-[13px] text-slate-500">{step.assignee}</span>
                                            ) : null}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </section>
                    ) : null}

                    {tab === 'Old documents' ? (
                        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                <FolderOpen size={16} className="text-[#2f6fed]" /> Old documents
                            </h2>
                            {workOrderDocuments(order).length ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400">
                                                {['Document', 'Type', 'Old status', 'LPO status', 'Stored', 'File'].map((column) => (
                                                    <th key={column} className="px-2 py-2 font-medium">{column}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {workOrderDocuments(order).map((document, index) => (
                                                <tr key={`${document.kind}-${document.name}-${document.replacedAt || index}`} className="border-b border-slate-100 last:border-0">
                                                    <td className="px-2 py-3">
                                                        <span className="block font-semibold text-slate-800">{document.name || '—'}</span>
                                                        {document.note ? <span className="mt-0.5 block text-[12px] text-slate-500">{document.note}</span> : null}
                                                    </td>
                                                    <td className="px-2 py-3 text-slate-600">{document.kind || '—'}</td>
                                                    <td className="px-2 py-3 text-slate-600">{document.fromStatus || '—'}</td>
                                                    <td className="px-2 py-3 whitespace-nowrap text-slate-600">{lpoStatusLabel(document.fromLpoMode)}</td>
                                                    <td className="px-2 py-3 whitespace-nowrap text-slate-600">{formatWorkOrderDate(document.replacedAt)}</td>
                                                    <td className="px-2 py-3">
                                                        {document.data ? (
                                                            <AttachmentLink name={document.name} mime={document.mime} data={document.data} />
                                                        ) : (
                                                            <span className="text-slate-400">—</span>
                                                        )}
                                                        {document.bytes ? <span className="ml-1 text-slate-400">({formatBytes(document.bytes)})</span> : null}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">No old documents yet. Files from the previous LPO or status are kept here when either one changes.</p>
                            )}
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
                                disabled={saving || !canUploadLpo}
                                title={canUploadLpo ? 'Open LPO received and save the LPO' : 'Upload LPO is available only when LPO is required'}
                                onClick={openUploadLpo}
                                className={`flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2f6fed] text-sm font-semibold text-white hover:bg-[#245fe0] disabled:cursor-not-allowed disabled:bg-slate-300 ${FOCUS}`}
                            >
                                <Link2 size={16} /> Upload LPO
                            </button>
                            <button
                                type="button"
                                disabled={Boolean(budgetSaving) || !order.quotationRef}
                                title={order.quotationRef ? undefined : 'A quotation is required'}
                                onClick={() => saveBudget(order.budgeted ? 'rebudget' : 'convert')}
                                className={`flex h-11 items-center justify-center gap-2 rounded-xl border border-[#e5edf6] bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`}
                            >
                                <Wallet size={16} />
                                {budgetSaving === 'convert' || budgetSaving === 'rebudget'
                                    ? 'Saving…'
                                    : order.budgeted ? 'Re budget' : 'Convert to budget'}
                            </button>
                            {order.budgeted && canResyncBudget ? (
                                <button
                                    type="button"
                                    disabled={Boolean(budgetSaving)}
                                    onClick={() => saveBudget('resync')}
                                    className={`flex h-11 items-center justify-center gap-2 rounded-xl border border-[#e5edf6] bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`}
                                >
                                    <RefreshCw size={16} />
                                    {budgetSaving === 'resync' ? 'Resyncing…' : 'Resync'}
                                </button>
                            ) : null}
                            {(order.type || 'Standalone') === 'Standalone' ? (
                                <button
                                    type="button"
                                    className={`flex h-11 items-center justify-center gap-2 rounded-xl border border-[#e5edf6] bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 ${FOCUS}`}
                                >
                                    <FileText size={16} /> Add a variation
                                </button>
                            ) : null}
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
            {quoteOpen && order.quotationRef ? (
                <WorkOrderQuotationModal
                    workOrderId={order._id}
                    quotationRef={order.quotationRef}
                    quotationId={order.quotationId}
                    onClose={() => setQuoteOpen(false)}
                />
            ) : null}
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
            <dd className="mt-1 break-words text-sm font-medium text-slate-800">{value}</dd>
        </div>
    );
}
