'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    getLoggedInUtilityUserKey,
    isEntryActive,
    loadUtilityBillDraft,
    saveUtilityBillDraft,
} from '../utils/utilityBillsStorage';
import { openUtilityAttachment } from '../utils/openUtilityAttachment';
import UtilityBillTotalsBar, { computeRowPayTotals } from './UtilityBillTotalsBar';
import PayByChoiceModal, {
    PayByDoneSummary,
    isPayByComplete,
} from './PayByChoiceModal';
import { usePayByPartyOptions } from './PayByPartySelects';
import AttachmentSourceModal from './AttachmentSourceModal';

const PAY_BY_EMPLOYEE = 'employee';
const PAY_BY_COMPANY = 'company';

function resolvePayShares(payBy, difference) {
    // Never use a negative share — under/over both allocate as a positive amount
    const diff = Math.abs(Number(difference) || 0);
    if (payBy === PAY_BY_COMPANY) {
        return { companyAmount: diff, employeeAmount: 0 };
    }
    if (payBy === PAY_BY_EMPLOYEE) {
        return { companyAmount: 0, employeeAmount: diff };
    }
    return { companyAmount: 0, employeeAmount: 0 };
}

const MAX_ATTACHMENT_BYTES = 1.5 * 1024 * 1024;

function currentMonthTitle(date = new Date()) {
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function currentBillMonthValue(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function nextBillMonthValue(billMonth) {
    if (!/^\d{4}-\d{2}$/.test(String(billMonth || ''))) {
        return currentBillMonthValue();
    }
    const [y, m] = String(billMonth).split('-').map(Number);
    const d = new Date(y, m, 1); // next month (day 1 of month index m)
    return currentBillMonthValue(d);
}

function titleFromBillMonth(billMonth) {
    if (!billMonth || !/^\d{4}-\d{2}$/.test(String(billMonth))) return currentMonthTitle();
    const [y, m] = String(billMonth).split('-').map(Number);
    return currentMonthTitle(new Date(y, m - 1, 1));
}

function billedEntryIdSet(existingBills, billMonth) {
    const set = new Set();
    const ym = String(billMonth || '');
    (existingBills || []).forEach((b) => {
        if (String(b?.billMonth || '') !== ym) return;
        if (String(b?.status || '') === 'Rejected') return;
        const id = String(b?.entryId || '');
        if (id) set.add(id);
    });
    return set;
}

function filterUnbilledEntries(entries, existingBills, billMonth) {
    const billed = billedEntryIdSet(existingBills, billMonth);
    return (entries || []).filter((e) => !billed.has(String(e?.id || '')));
}

/** Prefer draft/current month; skip months where every account is already billed. */
function resolveWorkingMonth(entries, existingBills, preferredMonth) {
    let ym =
        preferredMonth && /^\d{4}-\d{2}$/.test(String(preferredMonth))
            ? String(preferredMonth)
            : currentBillMonthValue();
    for (let i = 0; i < 24; i++) {
        const unbilled = filterUnbilledEntries(entries, existingBills, ym);
        if (unbilled.length > 0) {
            return { billMonth: ym, unbilledEntries: unbilled };
        }
        ym = nextBillMonthValue(ym);
    }
    return { billMonth: preferredMonth || currentBillMonthValue(), unbilledEntries: [] };
}

function formatMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0.00';
    return num.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
    });
}

function entryAccountNo(entry) {
    return String(entry?.values?.accountNumber || '').trim() || '—';
}

function entryContractAmount(entry) {
    const n = Number(entry?.values?.monthlyRental);
    return Number.isFinite(n) ? n : 0;
}

function resolveRowAttachment(rows, index, utilityAttachment) {
    if (index < 0 || index >= rows.length) return null;
    const row = rows[index];
    if (row.attachmentMode === 'new') {
        return row.attachment || null;
    }
    if (row.attachmentMode === 'above') {
        if (index === 0) {
            return utilityAttachment?.name ? utilityAttachment : null;
        }
        return resolveRowAttachment(rows, index - 1, utilityAttachment);
    }
    return null;
}

function buildRowsFromEntries(entries, draftRows = []) {
    const draftByEntry = new Map(
        (draftRows || []).map((r) => [String(r.entryId || ''), r]),
    );
    return (entries || []).map((entry) => {
        const draft = draftByEntry.get(String(entry.id));
        return {
            entryId: entry.id,
            selected: draft ? draft.selected !== false : true,
            accountNo: entryAccountNo(entry),
            contractAmount: entryContractAmount(entry),
            actualAmount:
                draft?.actualAmount != null && draft.actualAmount !== ''
                    ? String(draft.actualAmount)
                    : '',
            payBy: draft?.payBy || '',
            companyDiffAmount: draft?.companyDiffAmount ?? '',
            employeeDiffAmount: draft?.employeeDiffAmount ?? '',
            payByCompanyId: draft?.payByCompanyId || '',
            payByCompanyName: draft?.payByCompanyName || '',
            payByEmployeeId: draft?.payByEmployeeId || '',
            payByEmployeeName: draft?.payByEmployeeName || '',
            attachmentMode: draft?.attachmentMode || null,
            attachment: draft?.attachment || null,
        };
    });
}

/** Clear edits when a row is unchecked — excluded from totals/submit. */
function resetUncheckedRow(row) {
    return {
        ...row,
        selected: false,
        actualAmount: '',
        payBy: '',
        companyDiffAmount: '',
        employeeDiffAmount: '',
        payByCompanyId: '',
        payByCompanyName: '',
        payByEmployeeId: '',
        payByEmployeeName: '',
        attachmentMode: null,
        attachment: null,
    };
}

function openAttachmentView(file, toast) {
    openUtilityAttachment(file, {
        onError: (message) => {
            toast?.({
                variant: 'destructive',
                title: 'Attachment',
                description: message,
            });
        },
    });
}

function collectPayloadRows(rows, utilityAttachment) {
    const payloadRows = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.selected) continue;
        const actual = Number(row.actualAmount);
        if (!Number.isFinite(actual) || row.actualAmount === '' || actual < 0) {
            return {
                error: `Enter a valid actual amount for account ${row.accountNo}.`,
                payloadRows: null,
            };
        }
        const contract = Number(row.contractAmount) || 0;
        // Contract − Actual = Difference
        const difference = contract - actual;
        // Under (green): Pay by is always Company
        const rawPayBy = actual < contract ? PAY_BY_COMPANY : row.payBy;
        const payBy =
            rawPayBy === PAY_BY_COMPANY || rawPayBy === PAY_BY_EMPLOYEE ? rawPayBy : '';
        if (!payBy) {
            return {
                error: `Select Pay by (Company or Employee) for account ${row.accountNo}.`,
                payloadRows: null,
            };
        }
        if (payBy === PAY_BY_COMPANY && !String(row.payByCompanyId || '').trim()) {
            return {
                error: `Select company name for account ${row.accountNo}.`,
                payloadRows: null,
            };
        }
        if (payBy === PAY_BY_EMPLOYEE && !String(row.payByEmployeeId || '').trim()) {
            return {
                error: `Select employee name for account ${row.accountNo}.`,
                payloadRows: null,
            };
        }
        const shares = resolvePayShares(payBy, difference);
        const attachment = resolveRowAttachment(rows, i, utilityAttachment);
        if (row.attachmentMode === 'new' && !row.attachment?.name) {
            return {
                error: `Upload an attachment for account ${row.accountNo}, or choose Use above.`,
                payloadRows: null,
            };
        }
        const payTotals = computeRowPayTotals({
            ...row,
            payBy,
            contractAmount: contract,
            actualAmount: actual,
            companyDiffAmount: shares.companyAmount,
            employeeDiffAmount: shares.employeeAmount,
        });
        payloadRows.push({
            entryId: row.entryId,
            accountNo: row.accountNo,
            contractAmount: contract,
            actualAmount: actual,
            difference,
            payBy,
            // Diff shares (UI) — kept for reference; totals stored for pay
            companyDiffAmount: shares.companyAmount,
            employeeDiffAmount: shares.employeeAmount,
            companyPayAmount: payTotals.companyPayAmount,
            employeePayAmount: payTotals.employeePayAmount,
            payByCompanyId: payBy === PAY_BY_COMPANY ? row.payByCompanyId || '' : '',
            payByCompanyName: payBy === PAY_BY_COMPANY ? row.payByCompanyName || '' : '',
            payByEmployeeId: payBy === PAY_BY_EMPLOYEE ? row.payByEmployeeId || '' : '',
            payByEmployeeName: payBy === PAY_BY_EMPLOYEE ? row.payByEmployeeName || '' : '',
            attachment: attachment || null,
            sendForHr: actual > contract,
        });
    }
    return { error: null, payloadRows };
}

/**
 * Add Bills — Cancel / Draft (per logged-in user) / Submit.
 */
export default function AddBillModal({
    isOpen,
    onClose,
    entries = [],
    existingBills = [],
    utilityType = '',
    utilityAttachment = null,
    monthlyRental = 0,
    onSubmit,
    saving = false,
}) {
    const [rows, setRows] = useState([]);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [attachMenuIndex, setAttachMenuIndex] = useState(null);
    const [payByRowIndex, setPayByRowIndex] = useState(null);
    const [billMonth, setBillMonth] = useState(currentBillMonthValue());
    const [draftLoaded, setDraftLoaded] = useState(false);
    /** Bills submitted in this modal session (entryId+month) until parent prop refreshes. */
    const [sessionBilled, setSessionBilled] = useState([]);
    const fileInputRefs = useRef({});
    const { toast } = useToast();
    const { employeeOptions, companyOptions } = usePayByPartyOptions(isOpen);

    /** Add Bills shows Active records only — deactivated are excluded. */
    const listEntries = useMemo(() => {
        if (!Array.isArray(entries) || !entries.length) return [];
        return entries.filter((e) => isEntryActive(e));
    }, [entries]);

    const mergedBills = useMemo(
        () => [...(existingBills || []), ...(sessionBilled || [])],
        [existingBills, sessionBilled],
    );

    const monthTitle = useMemo(() => titleFromBillMonth(billMonth), [billMonth]);

    useEffect(() => {
        if (!isOpen) return;

        const userKey = getLoggedInUtilityUserKey();
        const draft = userKey ? loadUtilityBillDraft(utilityType) : null;
        const draftRows = Array.isArray(draft?.rows) ? draft.rows : [];
        const preferred = draft?.billMonth || currentBillMonthValue();

        setSessionBilled([]);

        if (listEntries.length) {
            const { billMonth: workingMonth, unbilledEntries } = resolveWorkingMonth(
                listEntries,
                existingBills || [],
                preferred,
            );
            setBillMonth(workingMonth);

            const draftForMonth =
                draft?.billMonth && String(draft.billMonth) === String(workingMonth)
                    ? draftRows
                    : [];
            const unbilledIds = new Set(unbilledEntries.map((e) => String(e.id)));
            // Draft may include unchecked rows — only keep rows still unbilled for this month
            const scopedDraft = draftForMonth.filter((r) =>
                unbilledIds.has(String(r.entryId || '')),
            );
            const rowsForMonth = buildRowsFromEntries(unbilledEntries, scopedDraft);
            setRows(rowsForMonth);

            if (draft?.billMonth && String(draft.billMonth) === String(workingMonth)) {
                setDraftLoaded(true);
                setInfo(
                    `Draft restored for ${titleFromBillMonth(workingMonth)} (only you can see this).`,
                );
            } else if (
                preferred !== workingMonth &&
                billedEntryIdSet(existingBills || [], preferred).size > 0
            ) {
                setDraftLoaded(false);
                setInfo(
                    `${titleFromBillMonth(preferred)} is complete. Showing ${titleFromBillMonth(workingMonth)}.`,
                );
            } else {
                setDraftLoaded(false);
                setInfo('');
            }
        } else {
            const draftRow = draftRows[0];
            setBillMonth(draft?.billMonth || currentBillMonthValue());
            setRows([
                {
                    entryId: draftRow?.entryId || '',
                    selected: draftRow ? draftRow.selected !== false : true,
                    accountNo: '—',
                    contractAmount: Number(monthlyRental) || 0,
                    actualAmount:
                        draftRow?.actualAmount != null && draftRow.actualAmount !== ''
                            ? String(draftRow.actualAmount)
                            : '',
                    payBy: draftRow?.payBy || '',
                    companyDiffAmount: draftRow?.companyDiffAmount ?? '',
                    employeeDiffAmount: draftRow?.employeeDiffAmount ?? '',
                    payByCompanyId: draftRow?.payByCompanyId || '',
                    payByCompanyName: draftRow?.payByCompanyName || '',
                    payByEmployeeId: draftRow?.payByEmployeeId || '',
                    payByEmployeeName: draftRow?.payByEmployeeName || '',
                    attachmentMode: draftRow?.attachmentMode || null,
                    attachment: draftRow?.attachment || null,
                },
            ]);
            if (draft?.billMonth) {
                setDraftLoaded(true);
                setInfo(
                    `Draft restored for ${titleFromBillMonth(draft.billMonth)} (only you can see this).`,
                );
            } else {
                setDraftLoaded(false);
                setInfo('');
            }
        }

        setError('');
        setAttachMenuIndex(null);
        setPayByRowIndex(null);
        // intentionally only re-init when modal opens / entry list type changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, listEntries, monthlyRental, utilityType]);

    const allSelected = rows.length > 0 && rows.every((r) => r.selected);
    const someSelected = rows.some((r) => r.selected);
    const selectedCount = rows.filter((r) => r.selected).length;

    const toggleAll = (checked) => {
        setRows((prev) =>
            prev.map((r) => (checked ? { ...r, selected: true } : resetUncheckedRow(r))),
        );
        if (!checked) {
            setAttachMenuIndex(null);
            setPayByRowIndex(null);
            setError('');
        }
    };

    const setRowSelected = (index, checked) => {
        setRows((prev) => {
            if (!checked) {
                const next = prev.map((r, i) =>
                    i === index ? resetUncheckedRow(r) : r,
                );
                const [moved] = next.splice(index, 1);
                next.push(moved);
                return next;
            }
            return prev.map((r, i) => (i === index ? { ...r, selected: true } : r));
        });
        if (!checked) {
            setAttachMenuIndex(null);
            setPayByRowIndex(null);
            setError('');
        }
    };

    const updateRow = (index, patch) => {
        setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    };

    const handleAttachmentFile = async (index, fileList) => {
        const file = fileList?.[0];
        if (!file) return;
        if (file.size > MAX_ATTACHMENT_BYTES) {
            setError('Attachment must be 1.5 MB or smaller.');
            return;
        }
        try {
            const dataUrl = await readFileAsDataUrl(file);
            updateRow(index, {
                attachmentMode: 'new',
                attachment: {
                    name: file.name,
                    mime: file.type || 'application/octet-stream',
                    dataUrl,
                },
            });
            setAttachMenuIndex(null);
            setError('');
        } catch {
            setError('Could not read the selected file.');
        }
    };

    const chooseUseAbove = (index) => {
        updateRow(index, { attachmentMode: 'above', attachment: null });
        setAttachMenuIndex(null);
        setError('');
    };

    const chooseNewUpload = (index) => {
        updateRow(index, { attachmentMode: 'new' });
        setAttachMenuIndex(null);
        requestAnimationFrame(() => {
            fileInputRefs.current[index]?.click();
        });
    };

    const buildDraftSnapshot = () => ({
        billMonth,
        billMonthLabel: monthTitle,
        utilityType,
        rows: rows.map((r) => ({
            entryId: r.entryId,
            selected: r.selected,
            accountNo: r.accountNo,
            contractAmount: r.contractAmount,
            actualAmount: r.actualAmount,
            payBy: r.payBy,
            companyDiffAmount: r.companyDiffAmount,
            employeeDiffAmount: r.employeeDiffAmount,
            payByCompanyId: r.payByCompanyId || '',
            payByCompanyName: r.payByCompanyName || '',
            payByEmployeeId: r.payByEmployeeId || '',
            payByEmployeeName: r.payByEmployeeName || '',
            attachmentMode: r.attachmentMode,
            attachment: r.attachment,
        })),
    });

    const handleDraft = () => {
        const userKey = getLoggedInUtilityUserKey();
        if (!userKey) {
            setError('Please log in again to save a draft.');
            return;
        }
        if (!utilityType) {
            setError('Utility type is missing.');
            return;
        }
        if (!rows.some((r) => r.selected)) {
            setError('Select at least one account to draft.');
            return;
        }
        const ok = saveUtilityBillDraft(utilityType, buildDraftSnapshot());
        if (!ok) {
            setError('Could not save draft on this device.');
            return;
        }
        setDraftLoaded(true);
        setError('');
        toast({
            title: 'Draft saved',
            description: `Only you will see this ${monthTitle} draft when you open Add Bills again.`,
        });
        onClose?.();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!rows.some((r) => r.selected)) {
            setError('Select at least one account.');
            return;
        }
        const { error: rowError, payloadRows } = collectPayloadRows(rows, utilityAttachment);
        if (rowError) {
            setError(rowError);
            return;
        }

        const snapshotMonth = billMonth;

        try {
            const result = await onSubmit?.({
                billMonth: snapshotMonth,
                billMonthLabel: titleFromBillMonth(snapshotMonth),
                utilityType,
                rows: payloadRows,
                amount: payloadRows[0]?.actualAmount,
                notes: '',
                sendForHr: payloadRows[0]?.sendForHr,
                attachment: payloadRows[0]?.attachment || null,
                monthlyRental: payloadRows[0]?.contractAmount,
                clearDraftOnSuccess: true,
                keepOpen: false,
            });
            if (result === false || result?.ok === false) return;

            toast({
                title: 'Completed',
                description: `${titleFromBillMonth(snapshotMonth)} bills submitted.`,
            });
            onClose?.();
        } catch {
            // Parent toasts errors
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col border border-gray-200">
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 shrink-0 bg-white">
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                            {monthTitle} Bill
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            {utilityType ? (
                                <p className="text-xs font-medium text-teal-700">{utilityType}</p>
                            ) : null}
                            {draftLoaded ? (
                                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                    Draft
                                </span>
                            ) : null}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
                    <div className="px-5 pt-3 pb-1 flex items-center justify-between gap-2 shrink-0">
                        {info ? (
                            <p className="text-xs text-amber-700">{info}</p>
                        ) : (
                            <span />
                        )}
                        <span className="text-xs text-gray-500 tabular-nums shrink-0">
                            {selectedCount} of {rows.length} selected
                        </span>
                    </div>

                    <div className="overflow-auto flex-1 min-h-0 px-4 sm:px-5 pb-3">
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                            <table className="min-w-full text-sm table-fixed">
                                <thead className="sticky top-0 z-10 bg-gray-50">
                                    <tr className="border-b border-gray-200 text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        <th className="w-12 px-3 py-3 text-center font-semibold">
                                            <input
                                                type="checkbox"
                                                checked={allSelected}
                                                ref={(el) => {
                                                    if (el) el.indeterminate = someSelected && !allSelected;
                                                }}
                                                onChange={(e) => toggleAll(e.target.checked)}
                                                className="accent-teal-600 w-4 h-4"
                                                title="Select all"
                                                aria-label="Select all"
                                            />
                                        </th>
                                        <th className="w-[18%] px-4 py-3 text-center font-semibold whitespace-nowrap">
                                            Account No
                                        </th>
                                        <th className="w-[16%] px-4 py-3 text-center font-semibold whitespace-nowrap">
                                            Contract Amount
                                        </th>
                                        <th className="w-[16%] px-4 py-3 text-center font-semibold whitespace-nowrap">
                                            Actual Amount
                                        </th>
                                        <th className="w-[14%] px-4 py-3 text-center font-semibold whitespace-nowrap">
                                            Difference
                                        </th>
                                        <th className="w-[14%] px-2 py-3 text-center font-semibold whitespace-nowrap">
                                            Pay by
                                        </th>
                                        <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">
                                            Attachment
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {rows.map((row, index) => {
                                        const actualNum = Number(row.actualAmount);
                                        const hasActual =
                                            row.actualAmount !== '' && Number.isFinite(actualNum);
                                        // Signed for color (under/over); display always non-negative
                                        const differenceSigned = hasActual
                                            ? Number(row.contractAmount || 0) - actualNum
                                            : 0;
                                        const difference = Math.abs(differenceSigned);
                                        const resolved = resolveRowAttachment(
                                            rows,
                                            index,
                                            utilityAttachment,
                                        );

                                        return (
                                            <tr
                                                key={row.entryId || `row-${index}`}
                                                className={
                                                    row.selected
                                                        ? 'hover:bg-teal-50/30'
                                                        : 'bg-gray-50/80 opacity-60'
                                                }
                                            >
                                                <td className="px-3 py-3.5 text-center align-middle">
                                                    <input
                                                        type="checkbox"
                                                        checked={row.selected}
                                                        onChange={(e) =>
                                                            setRowSelected(index, e.target.checked)
                                                        }
                                                        className="accent-teal-600 w-4 h-4"
                                                    />
                                                </td>
                                                <td className="px-4 py-3.5 text-center align-middle font-semibold text-gray-800 tabular-nums">
                                                    {row.accountNo}
                                                </td>
                                                <td className="px-4 py-3.5 text-center align-middle tabular-nums text-gray-700">
                                                    {formatMoney(row.contractAmount)}
                                                </td>
                                                <td className="px-4 py-3.5 text-center align-middle">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={row.actualAmount}
                                                        disabled={!row.selected}
                                                        onChange={(e) => {
                                                            const nextActual = e.target.value;
                                                            const actualN = Number(nextActual);
                                                            const has =
                                                                nextActual !== '' &&
                                                                Number.isFinite(actualN);
                                                            const contractN = Number(
                                                                row.contractAmount || 0,
                                                            );
                                                            const diff = has
                                                                ? contractN - actualN
                                                                : 0;
                                                            const patch = { actualAmount: nextActual };
                                                            // Green (actual < contract): force Pay by Company
                                                            if (has && actualN < contractN) {
                                                                const shares = resolvePayShares(
                                                                    PAY_BY_COMPANY,
                                                                    diff,
                                                                );
                                                                patch.payBy = PAY_BY_COMPANY;
                                                                patch.companyDiffAmount =
                                                                    shares.companyAmount;
                                                                patch.employeeDiffAmount =
                                                                    shares.employeeAmount;
                                                            } else if (
                                                                row.payBy === PAY_BY_COMPANY ||
                                                                row.payBy === PAY_BY_EMPLOYEE
                                                            ) {
                                                                const shares = resolvePayShares(
                                                                    row.payBy,
                                                                    diff,
                                                                );
                                                                patch.companyDiffAmount =
                                                                    shares.companyAmount;
                                                                patch.employeeDiffAmount =
                                                                    shares.employeeAmount;
                                                            }
                                                            updateRow(index, patch);
                                                            setError('');
                                                        }}
                                                        className="w-28 mx-auto block rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-center text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-400 disabled:bg-gray-100"
                                                        placeholder="0.00"
                                                    />
                                                </td>
                                                <td
                                                    className={`px-4 py-3.5 text-center align-middle tabular-nums font-semibold ${
                                                        !hasActual
                                                            ? 'text-gray-400'
                                                            : actualNum < Number(row.contractAmount || 0)
                                                              ? 'text-emerald-600'
                                                              : 'text-red-600'
                                                    }`}
                                                >
                                                    {hasActual ? formatMoney(difference) : '—'}
                                                </td>
                                                <td className="px-2 py-3.5 text-center align-middle">
                                                    {(() => {
                                                        const isUnder =
                                                            hasActual &&
                                                            actualNum <
                                                                Number(row.contractAmount || 0);
                                                        const canOpen = row.selected && hasActual;
                                                        const done = isPayByComplete(row, {
                                                            isUnder,
                                                        });
                                                        const openPayBy = () => {
                                                            if (!canOpen) return;
                                                            setPayByRowIndex(index);
                                                            setError('');
                                                        };
                                                        if (done) {
                                                            return (
                                                                <PayByDoneSummary
                                                                    row={row}
                                                                    difference={difference}
                                                                    isUnder={isUnder}
                                                                    disabled={!canOpen}
                                                                    onEdit={openPayBy}
                                                                />
                                                            );
                                                        }
                                                        return (
                                                            <button
                                                                type="button"
                                                                disabled={!canOpen}
                                                                title={
                                                                    isUnder
                                                                        ? 'Pay by Company — select company'
                                                                        : 'Choose Pay by'
                                                                }
                                                                onClick={openPayBy}
                                                                className={`w-[5.75rem] mx-auto rounded-lg border px-2 py-1.5 text-xs font-medium ${
                                                                    !canOpen
                                                                        ? 'border-gray-100 bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                        : 'border-teal-200 bg-white text-teal-700 hover:bg-teal-50'
                                                                }`}
                                                            >
                                                                Select
                                                            </button>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3.5 text-center align-middle relative">
                                                    <input
                                                        ref={(el) => {
                                                            fileInputRefs.current[index] = el;
                                                        }}
                                                        type="file"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            handleAttachmentFile(index, e.target.files);
                                                            e.target.value = '';
                                                        }}
                                                    />

                                                    <div className="inline-flex flex-col items-center gap-1.5 min-w-[7.5rem]">
                                                        <button
                                                            type="button"
                                                            disabled={!row.selected}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setAttachMenuIndex(index);
                                                            }}
                                                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold disabled:opacity-40 transition-colors shadow-sm"
                                                        >
                                                            <Upload size={13} strokeWidth={2.25} />
                                                            Upload
                                                        </button>

                                                        {resolved?.name ? (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    openAttachmentView(resolved, toast)
                                                                }
                                                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                                                                title={resolved.name}
                                                            >
                                                                <Eye size={12} />
                                                                View
                                                            </button>
                                                        ) : null}

                                                        {row.attachmentMode === 'above' &&
                                                        !resolved?.name ? (
                                                            <span className="text-[10px] text-gray-400">
                                                                No file above
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {rows.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-10">
                                No accounts to bill.
                            </p>
                        ) : null}
                    </div>

                    <UtilityBillTotalsBar rows={rows} />

                    {error ? (
                        <p className="px-5 pb-2 text-sm text-red-600 shrink-0">{error}</p>
                    ) : null}

                    <div className="px-5 py-3.5 border-t border-gray-100 flex flex-wrap justify-end gap-2 shrink-0 bg-white">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleDraft}
                            disabled={saving || !rows.length}
                            className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-sm font-semibold disabled:opacity-50"
                        >
                            Draft
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !rows.length}
                            className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold disabled:opacity-50 shadow-sm"
                        >
                            {saving ? 'Submitting…' : 'Submit'}
                        </button>
                    </div>
                </form>
            </div>

            <AttachmentSourceModal
                isOpen={attachMenuIndex != null}
                accountNo={
                    attachMenuIndex != null ? rows[attachMenuIndex]?.accountNo || '' : ''
                }
                previousAvailable={
                    attachMenuIndex == null
                        ? false
                        : attachMenuIndex === 0
                          ? Boolean(utilityAttachment?.name)
                          : Boolean(
                                resolveRowAttachment(
                                    rows,
                                    attachMenuIndex - 1,
                                    utilityAttachment,
                                )?.name,
                            )
                }
                previousLabel={
                    attachMenuIndex == null
                        ? ''
                        : attachMenuIndex === 0
                          ? utilityAttachment?.name
                              ? `Use type attachment (${utilityAttachment.name})`
                              : 'No type attachment available'
                          : resolveRowAttachment(
                                  rows,
                                  attachMenuIndex - 1,
                                  utilityAttachment,
                              )?.name
                            ? `Use file from previous row (${
                                  resolveRowAttachment(
                                      rows,
                                      attachMenuIndex - 1,
                                      utilityAttachment,
                                  ).name
                              })`
                            : 'No file on previous row'
                }
                onClose={() => setAttachMenuIndex(null)}
                onUsePrevious={() => {
                    if (attachMenuIndex == null) return;
                    chooseUseAbove(attachMenuIndex);
                }}
                onUseNew={() => {
                    if (attachMenuIndex == null) return;
                    chooseNewUpload(attachMenuIndex);
                }}
            />

            <PayByChoiceModal
                isOpen={payByRowIndex != null}
                onClose={() => setPayByRowIndex(null)}
                accountNo={payByRowIndex != null ? rows[payByRowIndex]?.accountNo : ''}
                differenceAmount={
                    payByRowIndex != null
                        ? Math.abs(
                              Number(rows[payByRowIndex]?.contractAmount || 0) -
                                  Number(rows[payByRowIndex]?.actualAmount || 0),
                          )
                        : 0
                }
                lockedPayBy={
                    payByRowIndex != null &&
                    Number(rows[payByRowIndex]?.actualAmount || 0) <
                        Number(rows[payByRowIndex]?.contractAmount || 0)
                        ? PAY_BY_COMPANY
                        : ''
                }
                initialPayBy={
                    payByRowIndex != null
                        ? Number(rows[payByRowIndex]?.actualAmount || 0) <
                          Number(rows[payByRowIndex]?.contractAmount || 0)
                            ? PAY_BY_COMPANY
                            : rows[payByRowIndex]?.payBy || ''
                        : ''
                }
                initialCompanyId={
                    payByRowIndex != null ? rows[payByRowIndex]?.payByCompanyId || '' : ''
                }
                initialCompanyName={
                    payByRowIndex != null ? rows[payByRowIndex]?.payByCompanyName || '' : ''
                }
                initialEmployeeId={
                    payByRowIndex != null ? rows[payByRowIndex]?.payByEmployeeId || '' : ''
                }
                initialEmployeeName={
                    payByRowIndex != null ? rows[payByRowIndex]?.payByEmployeeName || '' : ''
                }
                companyOptions={companyOptions}
                employeeOptions={employeeOptions}
                onConfirm={(choice) => {
                    if (payByRowIndex == null) return;
                    const row = rows[payByRowIndex];
                    const diff =
                        Number(row?.contractAmount || 0) - Number(row?.actualAmount || 0);
                    const shares = resolvePayShares(choice.payBy, diff);
                    updateRow(payByRowIndex, {
                        payBy: choice.payBy,
                        companyDiffAmount: shares.companyAmount,
                        employeeDiffAmount: shares.employeeAmount,
                        payByCompanyId:
                            choice.payBy === PAY_BY_COMPANY
                                ? choice.payByCompanyId
                                : '',
                        payByCompanyName:
                            choice.payBy === PAY_BY_COMPANY
                                ? choice.payByCompanyName
                                : '',
                        payByEmployeeId:
                            choice.payBy === PAY_BY_EMPLOYEE
                                ? choice.payByEmployeeId
                                : '',
                        payByEmployeeName:
                            choice.payBy === PAY_BY_EMPLOYEE
                                ? choice.payByEmployeeName
                                : '',
                    });
                    setPayByRowIndex(null);
                    setError('');
                }}
            />
        </div>
    );
}
