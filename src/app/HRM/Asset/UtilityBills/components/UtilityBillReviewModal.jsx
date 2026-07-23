'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Eye, Upload, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    isEntryActive,
} from '../utils/utilityBillsStorage';
import { entryIdsWithOccupiedBillForMonth } from '../utils/utilityBillStats';
import { fetchUtilityConfigs, fetchUtilityEntries } from '../utils/utilityBillsApi';
import { openUtilityAttachment } from '../utils/openUtilityAttachment';
import UtilityBillTotalsBar, {
    computeRowPayTotals,
    summarizeSelectedBillRows,
} from './UtilityBillTotalsBar';
import PayByChoiceModal, {
    PayByDoneSummary,
    assignedPartyDefaults,
    isPayByComplete,
    payByFieldsFromAssignment,
    payByPartyLabel,
    payByShortLabel,
} from './PayByChoiceModal';
import { usePayByPartyOptions } from './PayByPartySelects';
import AttachmentSourceModal from './AttachmentSourceModal';

const PAY_BY_EMPLOYEE = 'employee';
const PAY_BY_COMPANY = 'company';
const MAX_ATTACHMENT_BYTES = 1.5 * 1024 * 1024;

function formatMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0.00';
    return num.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function titleFromBillMonth(billMonth) {
    if (!billMonth || !/^\d{4}-\d{2}$/.test(String(billMonth))) return '';
    const [y, m] = String(billMonth).split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function entryAccountNo(entry) {
    return String(entry?.values?.accountNumber || '').trim() || '—';
}

function entryProvider(entry) {
    return String(entry?.values?.provider || '').trim() || '—';
}

function entryContractAmount(entry) {
    const n = Number(entry?.values?.monthlyRental);
    return Number.isFinite(n) ? n : 0;
}

function normalizePayBy(value) {
    const v = String(value || '').trim();
    if (v === 'employee_balance') return PAY_BY_EMPLOYEE;
    if (v === PAY_BY_COMPANY || v === PAY_BY_EMPLOYEE) return v;
    // Legacy "employee and company" is no longer allowed
    return '';
}

function resolvePayShares(payBy, difference) {
    const diff = Math.abs(Number(difference) || 0);
    if (payBy === PAY_BY_COMPANY) {
        return { companyAmount: diff, employeeAmount: 0 };
    }
    if (payBy === PAY_BY_EMPLOYEE) {
        return { companyAmount: 0, employeeAmount: diff };
    }
    return { companyAmount: 0, employeeAmount: 0 };
}

/**
 * Add-more lines belong to ONE utility bill (account row).
 * After HR Approve they post as line items inside one Zoho bill (each Debits its Account).
 * Batch rows (Etisalat + 3E…) are separate utility bills — not Add-more lines.
 */
function associatedZohoBillsFromRow(row = {}) {
    const baseBillNo = String(row.billNumber || '').trim();
    const sharedZohoBillId = String(
        row.zohoBillId ||
            (Array.isArray(row.zohoBillIds) ? row.zohoBillIds[0] : '') ||
            '',
    ).trim();
    const lines = Array.isArray(row.zohoLineItems) ? row.zohoLineItems : [];
    if (lines.length) {
        return lines.map((line, index) => {
            const amount = Number(line?.amount);
            const qty = Number(line?.quantity);
            return {
                key: `${row.billId || row.entryId || 'row'}-line-${index}`,
                item: String(line?.item || line?.description || `Line ${index + 1}`).trim(),
                accountName: String(line?.accountName || '').trim() || '—',
                accountId: String(line?.accountId || '').trim(),
                quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
                amount: Number.isFinite(amount) ? amount : 0,
                zohoBillId: String(line?.zohoBillId || sharedZohoBillId || '').trim(),
                // Same Zoho bill # for every Add-more line (they are line items, not separate bills).
                billNumber: baseBillNo || '—',
                payByEmployeeName: String(line?.payByEmployeeName || '').trim(),
                payByCompanyName: String(line?.payByCompanyName || '').trim(),
            };
        });
    }

    const ids = Array.from(
        new Set(
            [
                ...(Array.isArray(row.zohoBillIds) ? row.zohoBillIds : []),
                row.zohoBillId,
            ]
                .map((id) => String(id || '').trim())
                .filter(Boolean),
        ),
    );
    if (ids.length <= 1) return [];
    return ids.map((zohoBillId, index) => ({
        key: `${row.billId || row.entryId || 'row'}-zoho-${zohoBillId}`,
        item: `Zoho bill ${index + 1}`,
        accountName: String(row.expenseAccountName || '').trim() || '—',
        accountId: String(row.expenseAccountId || '').trim(),
        quantity: 1,
        amount: 0,
        zohoBillId,
        billNumber: baseBillNo || '—',
    }));
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
    });
}

function resolveRowAttachment(rows, index, utilityAttachment) {
    if (index < 0 || index >= rows.length) return null;
    const row = rows[index];
    if (row.attachmentMode === 'new' || (!row.attachmentMode && row.attachment?.name)) {
        return row.attachment || null;
    }
    if (row.attachmentMode === 'above') {
        if (index === 0) {
            return utilityAttachment?.name ? utilityAttachment : null;
        }
        return resolveRowAttachment(rows, index - 1, utilityAttachment);
    }
    return row.attachment?.name ? row.attachment : null;
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

function readApiError(err, fallback) {
    return (
        err?.response?.data?.message ||
        err?.message ||
        err?.originalError?.response?.data?.message ||
        fallback
    );
}

function buildReviewRows(entries, bills) {
    const billByEntry = new Map((bills || []).map((b) => [String(b.entryId || ''), b]));
    // Extra (not yet billed) rows: Active entries only. Already-submitted batch bills always stay.
    const listEntries = (entries || []).filter(
        (e) => billByEntry.has(String(e?.id)) || isEntryActive(e),
    );
    const entryIds = new Set(listEntries.map((e) => String(e.id)));
    const rows = listEntries.map((entry) => {
        const bill = billByEntry.get(String(entry.id));
        if (bill) {
            const attachment = bill.attachment?.name ? bill.attachment : null;
            const payBy = normalizePayBy(bill.paymentBy);
            const assigned = assignedPartyDefaults(entry);
            return {
                entryId: String(entry.id),
                billId: bill._id,
                selected: true,
                inBatch: true,
                accountNo: bill.accountNo || entryAccountNo(entry),
                provider: bill.provider || entryProvider(entry),
                zohoVendorId: String(bill.zohoVendorId || '').trim(),
                zohoBillId: String(bill.zohoBillId || '').trim(),
                zohoBillIds: Array.isArray(bill.zohoBillIds)
                    ? bill.zohoBillIds.map((id) => String(id || '').trim()).filter(Boolean)
                    : String(bill.zohoBillId || '').trim()
                      ? [String(bill.zohoBillId).trim()]
                      : [],
                zohoLineItems: Array.isArray(bill.zohoLineItems) ? bill.zohoLineItems : [],
                zohoBillStatus: String(bill.zohoBillStatus || '').trim(),
                zohoOrganizationId: String(bill.zohoOrganizationId || '').trim(),
                zohoSyncError: String(bill.zohoSyncError || '').trim(),
                partyAccountId: String(bill.partyAccountId || '').trim(),
                partyAccountName: String(bill.partyAccountName || '').trim(),
                partyAccountCode: String(bill.partyAccountCode || '').trim(),
                expenseAccountId: String(bill.expenseAccountId || '').trim(),
                expenseAccountName: String(bill.expenseAccountName || '').trim(),
                billNumber: String(bill.billNumber || '').trim(),
                billDate: String(bill.billDate || '').trim(),
                assignedToType: assigned.assignedToType,
                assignedToId: assigned.assignedToId,
                assignedToName: assigned.assignedToName,
                contractAmount: Number(bill.monthlyRental) || entryContractAmount(entry),
                actualAmount: String(bill.amount ?? ''),
                originalActualAmount: String(bill.amount ?? ''),
                payBy,
                originalPayBy: payBy,
                companyDiffAmount: bill.companyDiffAmount ?? '',
                employeeDiffAmount: bill.employeeDiffAmount ?? '',
                originalCompanyDiffAmount: bill.companyDiffAmount ?? '',
                originalEmployeeDiffAmount: bill.employeeDiffAmount ?? '',
                payByCompanyId: bill.payByCompanyId || '',
                payByCompanyName: bill.payByCompanyName || '',
                payByEmployeeId: bill.payByEmployeeId || '',
                payByEmployeeName: bill.payByEmployeeName || '',
                originalPayByCompanyId: bill.payByCompanyId || '',
                originalPayByCompanyName: bill.payByCompanyName || '',
                originalPayByEmployeeId: bill.payByEmployeeId || '',
                originalPayByEmployeeName: bill.payByEmployeeName || '',
                attachmentMode: attachment ? 'new' : null,
                attachment,
                originalAttachment: attachment,
                status: bill.status,
                statusLabel: bill.statusLabel,
            };
        }
        const assigned = assignedPartyDefaults(entry);
        const assignedPay = payByFieldsFromAssignment(entry);
        return {
            entryId: String(entry.id),
            billId: null,
            selected: false,
            inBatch: false,
            accountNo: entryAccountNo(entry),
            provider: entryProvider(entry),
            zohoVendorId: '',
            zohoBillId: '',
            zohoBillIds: [],
            zohoLineItems: [],
            zohoBillStatus: '',
            zohoOrganizationId: '',
            zohoSyncError: '',
            partyAccountId: '',
            partyAccountName: '',
            partyAccountCode: '',
            expenseAccountId: '',
            expenseAccountName: '',
            billNumber: '',
            billDate: '',
            assignedToType: assigned.assignedToType,
            assignedToId: assigned.assignedToId,
            assignedToName: assigned.assignedToName,
            contractAmount: entryContractAmount(entry),
            actualAmount: '',
            originalActualAmount: '',
            payBy: assignedPay.payBy,
            originalPayBy: '',
            companyDiffAmount: '',
            employeeDiffAmount: '',
            originalCompanyDiffAmount: '',
            originalEmployeeDiffAmount: '',
            payByCompanyId: assignedPay.payByCompanyId,
            payByCompanyName: assignedPay.payByCompanyName,
            payByEmployeeId: assignedPay.payByEmployeeId,
            payByEmployeeName: assignedPay.payByEmployeeName,
            originalPayByCompanyId: '',
            originalPayByCompanyName: '',
            originalPayByEmployeeId: '',
            originalPayByEmployeeName: '',
            attachmentMode: null,
            attachment: null,
            originalAttachment: null,
            status: '',
            statusLabel: '',
        };
    });

    (bills || []).forEach((bill) => {
        const eid = String(bill.entryId || '');
        if (entryIds.has(eid)) return;
        const attachment = bill.attachment?.name ? bill.attachment : null;
        const payBy = normalizePayBy(bill.paymentBy);
        rows.push({
            entryId: eid,
            billId: bill._id,
            selected: true,
            inBatch: true,
            accountNo: bill.accountNo || '—',
            provider: bill.provider || '—',
            zohoVendorId: String(bill.zohoVendorId || '').trim(),
            zohoBillId: String(bill.zohoBillId || '').trim(),
            zohoBillIds: Array.isArray(bill.zohoBillIds)
                ? bill.zohoBillIds.map((id) => String(id || '').trim()).filter(Boolean)
                : String(bill.zohoBillId || '').trim()
                  ? [String(bill.zohoBillId).trim()]
                  : [],
            zohoLineItems: Array.isArray(bill.zohoLineItems) ? bill.zohoLineItems : [],
            zohoBillStatus: String(bill.zohoBillStatus || '').trim(),
            zohoOrganizationId: String(bill.zohoOrganizationId || '').trim(),
            zohoSyncError: String(bill.zohoSyncError || '').trim(),
            partyAccountId: String(bill.partyAccountId || '').trim(),
            partyAccountName: String(bill.partyAccountName || '').trim(),
            partyAccountCode: String(bill.partyAccountCode || '').trim(),
            expenseAccountId: String(bill.expenseAccountId || '').trim(),
            expenseAccountName: String(bill.expenseAccountName || '').trim(),
            billNumber: String(bill.billNumber || '').trim(),
            billDate: String(bill.billDate || '').trim(),
            assignedToType: '',
            assignedToId: '',
            assignedToName: '',
            contractAmount: Number(bill.monthlyRental) || 0,
            actualAmount: String(bill.amount ?? ''),
            originalActualAmount: String(bill.amount ?? ''),
            payBy,
            originalPayBy: payBy,
            companyDiffAmount: bill.companyDiffAmount ?? '',
            employeeDiffAmount: bill.employeeDiffAmount ?? '',
            originalCompanyDiffAmount: bill.companyDiffAmount ?? '',
            originalEmployeeDiffAmount: bill.employeeDiffAmount ?? '',
            payByCompanyId: bill.payByCompanyId || '',
            payByCompanyName: bill.payByCompanyName || '',
            payByEmployeeId: bill.payByEmployeeId || '',
            payByEmployeeName: bill.payByEmployeeName || '',
            originalPayByCompanyId: bill.payByCompanyId || '',
            originalPayByCompanyName: bill.payByCompanyName || '',
            originalPayByEmployeeId: bill.payByEmployeeId || '',
            originalPayByEmployeeName: bill.payByEmployeeName || '',
            attachmentMode: attachment ? 'new' : null,
            attachment,
            originalAttachment: attachment,
            status: bill.status,
            statusLabel: bill.statusLabel,
        });
    });

    return rows;
}

/**
 * Accounts / HR review — same interactive layout as Add Bills.
 */
export default function UtilityBillReviewModal({
    isOpen,
    batchId,
    onClose,
    onChanged,
    entries: entriesProp = null,
    existingBills: existingBillsProp = null,
    utilityAttachment: utilityAttachmentProp = null,
}) {
    const { toast } = useToast();
    const router = useRouter();
    const fileInputRefs = useRef({});
    const [loading, setLoading] = useState(false);
    const [acting, setActing] = useState(false);
    const [batch, setBatch] = useState(null);
    const [rows, setRows] = useState([]);
    const [utilityAttachment, setUtilityAttachment] = useState(null);
    const [error, setError] = useState('');
    const [attachMenuIndex, setAttachMenuIndex] = useState(null);
    const [payByRowIndex, setPayByRowIndex] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [payMenuOpen, setPayMenuOpen] = useState(false);
    const payMenuRef = useRef(null);
    const { employeeOptions, companyOptions } = usePayByPartyOptions(isOpen);

    useEffect(() => {
        if (!payMenuOpen) return undefined;
        const onDocClick = (e) => {
            if (!payMenuRef.current?.contains(e.target)) setPayMenuOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [payMenuOpen]);

    // Only re-fetch when the batch opens / changes — not when parent entry lists reload
    // (that was re-hitting /UtilityBill/batch and spamming 404s for stale links).
    useEffect(() => {
        if (!isOpen || !batchId) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            setAttachMenuIndex(null);
            setPayByRowIndex(null);
            try {
                const res = await axiosInstance.get(
                    `/UtilityBill/batch/${encodeURIComponent(String(batchId))}`,
                    { skipToast: true },
                );
                if (cancelled) return;
                const data = res.data || null;
                setBatch(data);

                const utilityType = String(data?.utilityType || '').trim();
                let allEntries =
                    Array.isArray(entriesProp) && entriesProp.length ? entriesProp : [];
                if (!allEntries.length) {
                    try {
                        allEntries = await fetchUtilityEntries(
                            utilityType ? { type: utilityType } : {},
                        );
                    } catch {
                        allEntries = [];
                    }
                }
                const typeEntries = allEntries.filter(
                    (e) =>
                        String(e?.type || '')
                            .trim()
                            .toLowerCase() === utilityType.toLowerCase(),
                );

                let typeAttachment = utilityAttachmentProp;
                if (!typeAttachment?.name) {
                    try {
                        const utilities = await fetchUtilityConfigs();
                        const util = utilities.find(
                            (u) =>
                                String(u?.type || '')
                                    .trim()
                                    .toLowerCase() === utilityType.toLowerCase(),
                        );
                        typeAttachment = util?.attachment || null;
                    } catch {
                        typeAttachment = null;
                    }
                }
                setUtilityAttachment(typeAttachment?.name ? typeAttachment : null);

                let billsForType = [];
                if (utilityType) {
                    try {
                        const billsRes = await axiosInstance.get('/UtilityBill', {
                            params: { utilityType },
                            skipToast: true,
                        });
                        billsForType = Array.isArray(billsRes.data?.bills)
                            ? billsRes.data.bills
                            : [];
                    } catch {
                        billsForType = Array.isArray(existingBillsProp)
                            ? existingBillsProp
                            : [];
                    }
                } else if (Array.isArray(existingBillsProp)) {
                    billsForType = existingBillsProp;
                }
                // billsForType used for occupied-month checks below

                const batchBillIds = (data?.bills || [])
                    .map((b) => b?._id)
                    .filter(Boolean)
                    .map(String);
                const blockedEntryIds = entryIdsWithOccupiedBillForMonth(
                    billsForType,
                    data?.billMonth,
                    { excludeBillIds: batchBillIds },
                );

                const built = buildReviewRows(typeEntries, data?.bills || []);
                const withBlocks = built.map((r) => {
                    const blocked = blockedEntryIds.has(String(r.entryId || ''));
                    if (!blocked) return { ...r, blockedByExisting: false };
                    return {
                        ...r,
                        blockedByExisting: true,
                        selected: false,
                    };
                });
                // Move blocked / unchecked rows to the end (same as Add Bills uncheck)
                const active = withBlocks.filter((r) => r.selected);
                const rest = withBlocks.filter((r) => !r.selected);
                setRows([...active, ...rest]);

                if (blockedEntryIds.size > 0) {
                    const payStage =
                        String(data?.status || '') === 'Approved' ||
                        Boolean(data?.canPay);
                    setError(
                        payStage
                            ? `${blockedEntryIds.size} other account(s) already have Approved / Paid for ${
                                  data?.billMonth || 'this month'
                              } — shown grayed out (not part of this Pay batch).`
                            : `${blockedEntryIds.size} account(s) already have Approved / Paid for ${
                                  data?.billMonth || 'this month'
                              } — unchecked and excluded from Approve.`,
                    );
                }
            } catch (err) {
                if (!cancelled) {
                    const status = err?.response?.status || err?.originalError?.response?.status;
                    setError(
                        status === 404
                            ? 'This bill batch no longer exists (it may have been deleted or the link is outdated). Close and open the batch from the list or pending inbox.'
                            : readApiError(err, 'Could not load bill batch.'),
                    );
                    setBatch(null);
                    setRows([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
        // entriesProp / existingBillsProp / utilityAttachmentProp are read once at open;
        // including them re-ran the batch GET whenever the parent list refreshed.
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
    }, [isOpen, batchId, reloadKey]);

    const monthTitle = useMemo(() => titleFromBillMonth(batch?.billMonth), [batch?.billMonth]);
    const headerTitle = monthTitle ? `${monthTitle} Bill` : 'Utility Bill Review';

    const selectedCount = rows.filter((r) => r.selected).length;
    const blockedSelectedCount = rows.filter(
        (r) => r.selected && r.blockedByExisting,
    ).length;
    const canApproveSelected =
        selectedCount > 0 && blockedSelectedCount === 0;

    // Only the user the batch is pending with (Accounts / HR / Pay) may edit or act
    const canEdit = Boolean(batch?.canEdit);
    const canApproveReject = Boolean(batch?.canApproveReject ?? batch?.canEdit);
    const canPay = Boolean(batch?.canPay);
    const needsZohoOpen = Boolean(batch?.needsZohoOpen);
    const isHrStage = String(batch?.status || '') === 'Pending HR';
    const canHrDraft = canApproveReject && isHrStage;
    const isViewerOnly = Boolean(batch) && !canEdit && !canPay && !needsZohoOpen;

    // Pay total = company + employee pay (TOTAL bar), not contract / raw actual
    const selectedPayTotals = useMemo(() => summarizeSelectedBillRows(rows), [rows]);
    const selectedTotal =
        Number(selectedPayTotals.companyTotal || 0) +
        Number(selectedPayTotals.employeeTotal || 0);

    const updateRow = (index, patch) => {
        setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    };

    /** Same as Add Bills: uncheck clears row and moves it to the end; check enables editing. */
    const setRowSelected = (index, checked) => {
        if (!canEdit && !canPay) return;
        if (checked && rows[index]?.blockedByExisting) {
            setError(
                `Account ${rows[index]?.accountNo || ''} already has an Approved / Paid bill for ${
                    batch?.billMonth || 'this month'
                }.`,
            );
            return;
        }
        // Pay stage: only toggle select on existing bills (do not clear values)
        if (canPay && !canEdit) {
            setRows((prev) => {
                if (!prev[index]?.billId || prev[index]?.blockedByExisting) return prev;
                const next = prev.map((r, i) =>
                    i === index ? { ...r, selected: checked } : r,
                );
                if (!checked) {
                    const [moved] = next.splice(index, 1);
                    next.push(moved);
                }
                return next;
            });
            setError('');
            return;
        }
        setRows((prev) => {
            if (!checked) {
                const next = prev.map((r, i) => {
                    if (i !== index) return r;
                    return {
                        ...r,
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
                });
                const [moved] = next.splice(index, 1);
                next.push(moved);
                return next;
            }
            return prev.map((r, i) => {
                if (i !== index) return r;
                if (r.blockedByExisting) return r;
                // Re-check: restore submitted values if this account was in the batch
                if (r.inBatch) {
                    return {
                        ...r,
                        selected: true,
                        actualAmount: r.originalActualAmount ?? '',
                        attachment: r.originalAttachment ?? null,
                        attachmentMode: r.originalAttachment ? 'new' : null,
                        payBy: r.originalPayBy || '',
                        companyDiffAmount: r.originalCompanyDiffAmount ?? '',
                        employeeDiffAmount: r.originalEmployeeDiffAmount ?? '',
                        payByCompanyId: r.originalPayByCompanyId || '',
                        payByCompanyName: r.originalPayByCompanyName || '',
                        payByEmployeeId: r.originalPayByEmployeeId || '',
                        payByEmployeeName: r.originalPayByEmployeeName || '',
                    };
                }
                return { ...r, selected: true };
            });
        });
        if (!checked) {
            setAttachMenuIndex(null);
            setPayByRowIndex(null);
        }
        setError('');
    };

    const toggleAllRows = (checked) => {
        if (!canEdit && !canPay) return;
        if (canPay && !canEdit) {
            setRows((prev) =>
                prev.map((r) =>
                    r.billId && !r.blockedByExisting
                        ? { ...r, selected: checked }
                        : r.blockedByExisting
                          ? { ...r, selected: false }
                          : r,
                ),
            );
            setError('');
            return;
        }
        setRows((prev) =>
            prev.map((r) => {
                if (r.blockedByExisting) {
                    return { ...r, selected: false };
                }
                if (!checked) {
                    return {
                        ...r,
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
                if (r.inBatch) {
                    return {
                        ...r,
                        selected: true,
                        actualAmount: r.originalActualAmount ?? '',
                        attachment: r.originalAttachment ?? null,
                        attachmentMode: r.originalAttachment ? 'new' : null,
                        payBy: r.originalPayBy || '',
                        companyDiffAmount: r.originalCompanyDiffAmount ?? '',
                        employeeDiffAmount: r.originalEmployeeDiffAmount ?? '',
                        payByCompanyId: r.originalPayByCompanyId || '',
                        payByCompanyName: r.originalPayByCompanyName || '',
                        payByEmployeeId: r.originalPayByEmployeeId || '',
                        payByEmployeeName: r.originalPayByEmployeeName || '',
                    };
                }
                return { ...r, selected: true };
            }),
        );
        if (!checked) {
            setAttachMenuIndex(null);
            setPayByRowIndex(null);
        }
        setError('');
    };

    const allSelected = rows.length > 0 && rows.every((r) => r.selected);
    const someSelected = rows.some((r) => r.selected) && !allSelected;

    const handleAttachmentFile = async (index, fileList) => {
        const file = fileList?.[0];
        if (!file) return;
        const isPdf =
            file.type === 'application/pdf' ||
            file.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            setError('Only PDF files are allowed for bill attachment.');
            return;
        }
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
                    mime: 'application/pdf',
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

    const submittedCount = rows.filter((r) => r.inBatch).length;

    const handleRespond = async (decision) => {
        const id = batch?.batchId || batchId;
        if (!id) return;
        const selectedRows = rows.filter((r) => r.selected);
        if ((decision === 'approve' || decision === 'reject') && !selectedRows.length) {
            setError('Select at least one account.');
            return;
        }
        if (decision === 'approve') {
            const blocked = selectedRows.filter((r) => r.blockedByExisting);
            if (blocked.length) {
                setError(
                    `${blocked.length} selected account(s) already have Approved / Paid for ${
                        batch?.billMonth || 'this month'
                    }. Uncheck them to Approve.`,
                );
                return;
            }
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row.selected) continue;
                const actual = Number(row.actualAmount);
                if (!Number.isFinite(actual) || row.actualAmount === '' || actual < 0) {
                    setError(`Enter a valid actual amount for account ${row.accountNo}.`);
                    return;
                }
                const contract = Number(row.contractAmount || 0);
                const rawPayBy = actual < contract ? PAY_BY_COMPANY : row.payBy;
                const payBy =
                    rawPayBy === PAY_BY_COMPANY || rawPayBy === PAY_BY_EMPLOYEE
                        ? rawPayBy
                        : '';
                if (!payBy) {
                    setError(
                        `Select Contract Paid By (Company or Employee) for account ${row.accountNo}.`,
                    );
                    return;
                }
                if (payBy === PAY_BY_COMPANY && !String(row.payByCompanyId || '').trim()) {
                    setError(`Select company name for account ${row.accountNo}.`);
                    return;
                }
                if (payBy === PAY_BY_EMPLOYEE && !String(row.payByEmployeeId || '').trim()) {
                    setError(`Select employee name for account ${row.accountNo}.`);
                    return;
                }
            }
        }
        setActing(true);
        setError('');
        try {
            const body = {
                decision,
                rows: selectedRows.map((r) => {
                    const rowIndex = rows.findIndex(
                        (x) =>
                            (r.billId && x.billId === r.billId) ||
                            (!r.billId && x.entryId === r.entryId),
                    );
                    const attachment = resolveRowAttachment(
                        rows,
                        rowIndex >= 0 ? rowIndex : 0,
                        utilityAttachment,
                    );
                    const actualAmt = Number(r.actualAmount);
                    const contractAmt = Number(r.contractAmount || 0);
                    const difference = contractAmt - actualAmt;
                    const rawPayBy =
                        actualAmt < contractAmt ? PAY_BY_COMPANY : r.payBy;
                    const payBy =
                        rawPayBy === PAY_BY_COMPANY || rawPayBy === PAY_BY_EMPLOYEE
                            ? rawPayBy
                            : '';
                    const shares = resolvePayShares(payBy, difference);
                    const payTotals = computeRowPayTotals({
                        ...r,
                        payBy,
                        companyDiffAmount: shares.companyAmount,
                        employeeDiffAmount: shares.employeeAmount,
                    });
                    return {
                        billId: r.billId || undefined,
                        entryId: r.entryId,
                        actualAmount: actualAmt,
                        contractAmount: r.contractAmount,
                        accountNo: r.accountNo,
                        difference,
                        attachment: attachment || null,
                        payBy,
                        companyDiffAmount: shares.companyAmount,
                        employeeDiffAmount: shares.employeeAmount,
                        // Totals as shown in TOTAL bar — stored in DB
                        companyPayAmount: payTotals.companyPayAmount,
                        employeePayAmount: payTotals.employeePayAmount,
                        payByCompanyId: r.payByCompanyId || '',
                        payByCompanyName: r.payByCompanyName || '',
                        payByEmployeeId:
                            payBy === PAY_BY_EMPLOYEE ? r.payByEmployeeId || '' : '',
                        payByEmployeeName:
                            payBy === PAY_BY_EMPLOYEE ? r.payByEmployeeName || '' : '',
                        expenseAccountId: r.expenseAccountId || '',
                        expenseAccountName: r.expenseAccountName || '',
                        partyAccountId: r.partyAccountId || '',
                        partyAccountName: r.partyAccountName || '',
                        partyAccountCode: r.partyAccountCode || '',
                        billNumber: r.billNumber || '',
                        billDate: r.billDate || '',
                    };
                }),
            };
            const res = await axiosInstance.put(`/UtilityBill/batch/${id}/respond`, body);
            const label = String(res.data?.statusLabel || res.data?.status || '');
            const zohoSync = Array.isArray(res.data?.zohoSync) ? res.data.zohoSync : [];
            const zohoFailed = zohoSync.filter((r) => r && r.ok === false && !r.skipped);
            const zohoCreated = zohoSync.filter((r) => r && r.ok && !r.skipped);
            const differenceFailed = Boolean(res.data?.differenceJournalFailed);
            const differenceMsg = String(res.data?.message || '').trim();

            if ((decision === 'approve' || decision === 'draft') && zohoFailed.length > 0) {
                const firstMsg =
                    zohoFailed[0]?.message ||
                    'Zoho bill was not created. Fix vendor / expense account, then retry.';
                toast({
                    variant: 'destructive',
                    title:
                        decision === 'draft'
                            ? 'Draft saved — Zoho sync failed'
                            : 'Approved — Zoho sync failed',
                    description: firstMsg,
                });
                setError(firstMsg);
                onChanged?.();
                setReloadKey((k) => k + 1);
                return;
            }

            if (decision === 'approve' && differenceFailed) {
                toast({
                    variant: 'destructive',
                    title: 'Bill approved — Chart of Accounts Debit failed',
                    description:
                        differenceMsg ||
                        'Zoho blocked the Difference Debit journal. Re-connect Zoho Books (need accountants.CREATE), then Retry Zoho sync.',
                });
                setError(
                    differenceMsg ||
                        'Chart of Accounts Difference Debit failed. Re-connect Zoho, then Retry Zoho sync.',
                );
                onChanged?.();
                setReloadKey((k) => k + 1);
                return;
            }

            toast({
                title:
                    decision === 'draft'
                        ? 'Saved as Zoho Draft'
                        : decision === 'approve'
                          ? label.toLowerCase() === 'not paid'
                              ? 'Not paid'
                              : 'Approved'
                          : 'Rejected',
                description:
                    decision === 'draft'
                        ? zohoCreated.length > 0
                            ? `${zohoCreated.length} bill(s) stored in Zoho as Draft (not shown in Payments Made until Approve).`
                            : zohoSync.length > 0
                              ? 'Zoho Draft already linked. Approve to mark Open for payment.'
                              : 'Still pending HR. Approve when ready to open in Zoho.'
                        : decision === 'approve' && label.toLowerCase() === 'not paid'
                          ? zohoCreated.length > 0
                              ? `Awaiting Accounts payment. ${zohoCreated.length} bill(s) Open in Zoho. Difference Debit posted to Chart of Accounts.`
                              : zohoSync.length > 0
                                ? 'Awaiting Accounts payment. Zoho bills Open / linked.'
                                : 'Awaiting Accounts payment.'
                          : label,
            });
            onChanged?.();
            onClose?.();
        } catch (err) {
            setError(readApiError(err, 'Action failed.'));
        } finally {
            setActing(false);
        }
    };

    const rowHasZohoBill = (r) =>
        Boolean(
            String(r?.zohoBillId || '').trim() ||
                (Array.isArray(r?.zohoBillIds) &&
                    r.zohoBillIds.some((id) => String(id || '').trim())),
        );

    const needsZohoRetry = useMemo(
        () =>
            needsZohoOpen ||
            rows.some(
                (r) =>
                    r.inBatch &&
                    r.billId &&
                    (String(r.status) === 'Approved' || String(r.status) === 'Pending HR') &&
                    (!rowHasZohoBill(r) ||
                        String(r.zohoBillStatus || '').toLowerCase() === 'draft'),
            ),
        [rows, needsZohoOpen],
    );

    const handleRetryZohoSync = async () => {
        const id = batch?.batchId || batchId;
        if (!id) return;
        setActing(true);
        setError('');
        try {
            const res = await axiosInstance.post(`/UtilityBill/batch/${id}/sync-zoho`);
            const failed = Number(res.data?.failedCount) || 0;
            const created = Number(res.data?.createdCount) || 0;
            if (failed > 0) {
                const first =
                    (Array.isArray(res.data?.zohoSync)
                        ? res.data.zohoSync.find((r) => r && r.ok === false && !r.skipped)
                        : null)?.message ||
                    res.data?.message ||
                    'Zoho sync failed.';
                toast({
                    variant: 'destructive',
                    title: 'Zoho sync incomplete',
                    description: first,
                });
                setError(first);
            } else {
                toast({
                    title: 'Zoho synced',
                    description:
                        res.data?.message ||
                        (created > 0
                            ? `${created} bill(s) created in Zoho Books.`
                            : 'Bills already linked in Zoho.'),
                });
            }
            onChanged?.();
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(readApiError(err, 'Could not sync bills to Zoho.'));
        } finally {
            setActing(false);
        }
    };

    /**
     * Open Accounts → Payments Made /new (Record Payment page) prefilled from the selected bills.
     * mode 'bills'      → amount = total Actual bill amount.
     * mode 'difference' → amount = total |Contract − Actual| difference.
     * Vendor is auto-selected from the bill provider (providers already include Zoho vendors).
     */
    const openPayViaPurchases = (mode) => {
        const payable = rows.filter(
            (r) => r.inBatch && r.billId && String(r.status) === 'Approved',
        );
        if (!payable.length) {
            setError('No bills available to pay.');
            return;
        }
        const missingZoho = payable.filter((r) => !rowHasZohoBill(r));
        if (missingZoho.length) {
            const detail =
                missingZoho
                    .map((r) => r.zohoSyncError)
                    .find(Boolean) ||
                'Approved bills are not in Zoho yet. Use Retry Zoho sync first.';
            setError(detail);
            toast({
                variant: 'destructive',
                title: 'Zoho bill missing',
                description: detail,
            });
            return;
        }
        const stillDraft = payable.filter(
            (r) => String(r.zohoBillStatus || '').toLowerCase() === 'draft',
        );
        if (stillDraft.length) {
            setError(
                'Zoho bill is still Draft. Click “Open Zoho bill” first — then Accounts can pay in Payments Made.',
            );
            return;
        }
        const anySelected = payable.some((r) => r.selected);
        const selected = anySelected ? payable.filter((r) => r.selected) : payable;
        if (!selected.length) {
            setError('Select at least one bill to pay.');
            return;
        }
        setError('');
        setPayMenuOpen(false);

        const total = selected.reduce((sum, r) => {
            const contract = Number(r.contractAmount) || 0;
            const actual = Number(r.actualAmount) || 0;
            return mode === 'difference'
                ? sum + Math.abs(contract - actual)
                : sum + actual;
        }, 0);

        const providers = Array.from(
            new Set(
                selected
                    .map((r) => String(r.provider || '').trim())
                    .filter((p) => p && p !== '—'),
            ),
        );
        const vendorName = providers.length === 1 ? providers[0] : '';

        const vendorIds = Array.from(
            new Set(
                selected
                    .map((r) => String(r.zohoVendorId || '').trim())
                    .filter(Boolean),
            ),
        );
        const vendorId = vendorIds.length === 1 ? vendorIds[0] : '';

        const orgIds = Array.from(
            new Set(
                selected
                    .map((r) => String(r.zohoOrganizationId || '').trim())
                    .filter(Boolean),
            ),
        );
        const organizationId = orgIds.length === 1 ? orgIds[0] : '';
        const companyIds = Array.from(
            new Set(
                selected
                    .map((r) => String(r.payByCompanyId || '').trim())
                    .filter(Boolean),
            ),
        );
        const companyId = companyIds.length === 1 ? companyIds[0] : '';

        const utilityBillLinks = selected
            .filter((r) => r.billId)
            .flatMap((r) => {
                const ids = Array.from(
                    new Set(
                        [
                            ...(Array.isArray(r.zohoBillIds) ? r.zohoBillIds : []),
                            r.zohoBillId,
                        ]
                            .map((id) => String(id || '').trim())
                            .filter(Boolean),
                    ),
                );
                if (!ids.length) {
                    return [
                        {
                            utilityBillId: String(r.billId),
                            zohoBillId: '',
                            billNumber: String(r.billNumber || '').trim(),
                        },
                    ];
                }
                return ids.map((zohoBillId, index) => ({
                    utilityBillId: String(r.billId),
                    zohoBillId,
                    billNumber:
                        ids.length > 1
                            ? `${String(r.billNumber || '').trim()}-${index + 1}`
                            : String(r.billNumber || '').trim(),
                }));
            });
        const zohoBillIds = utilityBillLinks
            .map((link) => link.zohoBillId)
            .filter(Boolean);

        const partyRows = selected.map((r) => {
            const payBy = normalizePayBy(r.payBy);
            const contract = Number(r.contractAmount) || 0;
            const actual = Number(r.actualAmount) || 0;
            const difference = Math.abs(contract - actual);
            const shares = resolvePayShares(payBy, difference);
            const companyAmt =
                mode === 'difference'
                    ? shares.companyAmount
                    : Number(r.companyPayAmount) || 0;
            const employeeAmt =
                mode === 'difference'
                    ? shares.employeeAmount
                    : Number(r.employeePayAmount) || 0;
            const rowAmount =
                mode === 'difference'
                    ? difference
                    : actual > 0
                      ? actual
                      : companyAmt + employeeAmt;
            return {
                utilityBillId: String(r.billId || ''),
                accountNo: String(r.accountNo || '').trim(),
                payBy,
                amount:
                    mode === 'difference'
                        ? payBy === 'company'
                            ? companyAmt
                            : payBy === 'employee'
                              ? employeeAmt
                              : rowAmount
                        : rowAmount,
                companyPayAmount: companyAmt,
                employeePayAmount: employeeAmt,
                payByCompanyId: String(r.payByCompanyId || '').trim(),
                payByCompanyName: String(r.payByCompanyName || '').trim(),
                payByEmployeeId: String(r.payByEmployeeId || '').trim(),
                payByEmployeeName: String(r.payByEmployeeName || '').trim(),
                partyAccountId: String(r.partyAccountId || '').trim(),
                partyAccountName: String(r.partyAccountName || '').trim(),
                partyAccountCode: String(r.partyAccountCode || '').trim(),
                expenseAccountId: String(r.expenseAccountId || '').trim(),
                expenseAccountName: String(r.expenseAccountName || '').trim(),
            };
        });

        const dominantPayBy = (() => {
            const modes = partyRows.map((r) => r.payBy).filter(Boolean);
            if (modes.every((m) => m === 'company')) return 'company';
            if (modes.every((m) => m === 'employee')) return 'employee';
            if (modes.some((m) => m === 'employee') && modes.some((m) => m === 'company')) {
                return 'employee_and_company';
            }
            return modes[0] || '';
        })();
        const employeeNames = Array.from(
            new Set(partyRows.map((r) => r.payByEmployeeName).filter(Boolean)),
        );
        const employeeIds = Array.from(
            new Set(partyRows.map((r) => r.payByEmployeeId).filter(Boolean)),
        );
        const companyNames = Array.from(
            new Set(partyRows.map((r) => r.payByCompanyName).filter(Boolean)),
        );
        const salaryPayableAccounts = Array.from(
            new Map(
                partyRows
                    .filter((r) => r.partyAccountId || r.partyAccountName || r.partyAccountCode)
                    .map((r) => [
                        `${r.partyAccountId}|${r.partyAccountCode}|${r.partyAccountName}`,
                        {
                            id: r.partyAccountId,
                            name: r.partyAccountName || 'Salary Payable',
                            code: r.partyAccountCode,
                            payBy: r.payBy,
                            partyName:
                                r.payBy === 'company'
                                    ? r.payByCompanyName
                                    : r.payByEmployeeName,
                        },
                    ]),
            ).values(),
        );
        const expenseAccounts = Array.from(
            new Map(
                partyRows
                    .filter((r) => r.expenseAccountId || r.expenseAccountName)
                    .map((r) => [
                        r.expenseAccountId || r.expenseAccountName,
                        {
                            id: r.expenseAccountId,
                            name: r.expenseAccountName,
                        },
                    ]),
            ).values(),
        );

        const typeLabel = batch?.utilityType || '';
        const monthLabel = batch?.billMonth || '';
        const accountNos = selected.map((r) => r.accountNo).filter(Boolean).join(', ');

        const paymentDates = Array.from(
            new Set(
                selected
                    .map((r) => String(r.billDate || '').trim())
                    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
            ),
        );
        const paymentDate =
            paymentDates.length === 1
                ? paymentDates[0]
                : monthLabel && /^\d{4}-\d{2}$/.test(monthLabel)
                  ? `${monthLabel}-16`
                  : new Date().toISOString().slice(0, 10);

        const utilityBatchId = String(batch?.batchId || batchId || '');
        const billReference = selected
            .map((row) => String(row.billNumber || '').trim())
            .filter(Boolean)
            .join(', ')
            .slice(0, 100);
        const totalCompanyPay = partyRows.reduce(
            (sum, r) => sum + (Number(r.companyPayAmount) || 0),
            0,
        );
        const totalEmployeePay = partyRows.reduce(
            (sum, r) => sum + (Number(r.employeePayAmount) || 0),
            0,
        );
        const prefill = {
            vendorId,
            vendorName,
            amount: total > 0 ? total.toFixed(2) : '',
            date: paymentDate,
            referenceNumber: billReference || utilityBatchId,
            notes: `Utility ${mode === 'difference' ? 'difference' : 'bill'} payment · ${typeLabel} ${monthLabel}${
                accountNos ? ` · Acc ${accountNos}` : ''
            }`.trim(),
            utilityType: typeLabel,
            billMonth: monthLabel,
            mode,
            billsOnly: true,
            selectedBillIds: zohoBillIds,
            zohoBillIds,
            utilityBatchId,
            utilityBillIds: utilityBillLinks.map((link) => link.utilityBillId),
            utilityBillLinks,
            organizationId,
            companyId,
            payBy: dominantPayBy,
            payByCompanyId: companyId,
            payByCompanyName: companyNames.length === 1 ? companyNames[0] : '',
            payByEmployeeId: employeeIds.length === 1 ? employeeIds[0] : '',
            payByEmployeeName: employeeNames.length === 1 ? employeeNames[0] : '',
            companyPayAmount: totalCompanyPay,
            employeePayAmount: totalEmployeePay,
            partyRows,
            partyAccountId: salaryPayableAccounts[0]?.id || '',
            partyAccountName: salaryPayableAccounts[0]?.name || '',
            partyAccountCode: salaryPayableAccounts[0]?.code || '',
            // Difference settle Debits Paid Through · Credits Acc2 — do not default Paid Through to Acc2.
            paidThroughAccountId: '',
            paidThroughAccountName: '',
            salaryPayableAccounts,
            expenseAccounts,
        };
        sessionStorage.setItem('utilityVendorPaymentPrefill', JSON.stringify(prefill));
        onClose?.();

        const params = new URLSearchParams();
        params.set('addUtilityPay', '1');
        if (vendorId) params.set('vendorId', vendorId);
        if (vendorName) params.set('vendorName', vendorName);
        if (paymentDate) params.set('date', paymentDate);
        if (prefill.amount) params.set('amount', prefill.amount);
        if (utilityBatchId) params.set('batchId', utilityBatchId);
        if (mode) params.set('mode', mode);
        if (typeLabel) params.set('utilityType', typeLabel);
        if (monthLabel) params.set('billMonth', monthLabel);
        if (zohoBillIds.length) params.set('billIds', zohoBillIds.join(','));
        const utilityIds = utilityBillLinks.map((link) => link.utilityBillId).filter(Boolean);
        if (utilityIds.length) params.set('utilityBillIds', utilityIds.join(','));
        if (organizationId) params.set('organizationId', organizationId);
        if (companyId) params.set('companyId', companyId);

        router.push(`/Accounts/PaymentsMade/new?${params.toString()}`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-[100rem] max-h-[95vh] overflow-hidden flex flex-col border border-gray-200">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0 bg-gradient-to-r from-gray-50 to-white">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 tracking-tight">
                            {headerTitle}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            {batch?.utilityType ? (
                                <p className="text-xs font-medium text-teal-700">{batch.utilityType}</p>
                            ) : null}
                            {batch?.statusLabel ? (
                                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                                    {batch.statusLabel}
                                </span>
                            ) : null}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex flex-col min-h-0 flex-1">
                    {loading ? (
                        <p className="text-sm text-gray-500 text-center py-16">Loading…</p>
                    ) : error && !batch ? (
                        <div className="px-5 py-12 text-center space-y-4">
                            <p className="text-sm text-red-600 font-medium">{error}</p>
                            <button
                                type="button"
                                onClick={() => setReloadKey((k) => k + 1)}
                                className="inline-flex items-center justify-center rounded-xl bg-teal-600 text-white text-sm font-semibold px-4 py-2 hover:bg-teal-700"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="px-5 pt-3 pb-1 flex items-center justify-between gap-2 shrink-0">
                                <span className="text-xs text-gray-500">
                                    {needsZohoOpen
                                        ? 'Zoho is still Draft. Click “Open Zoho bill” — then Accounts gets payment and Pay becomes available.'
                                        : canHrDraft
                                          ? 'Draft → stays on HR inbox, Zoho Draft. Approve → Zoho Open, then Accounts can pay.'
                                          : canEdit
                                            ? 'Same as Add Bills — full bill fields, edit Actual / Contract Paid By / Upload before Approve.'
                                            : canPay
                                              ? 'Select bills to pay.'
                                              : isViewerOnly
                                                ? `View only — pending ${batch?.pendingWithName || 'approver'} (${batch?.statusLabel || batch?.status || ''}).`
                                                : ''}
                                </span>
                                <span className="text-xs text-gray-500 tabular-nums shrink-0">
                                    {selectedCount} of {rows.length} selected
                                    {submittedCount < rows.length
                                        ? ` · ${submittedCount} originally submitted`
                                        : ''}
                                </span>
                            </div>

                            <div className="overflow-auto flex-1 min-h-0 px-4 sm:px-5 pb-3">
                                <div className="rounded-xl border border-gray-200 overflow-x-auto">
                                    <table className="min-w-[92rem] w-full text-sm">
                                        <thead className="sticky top-0 z-10 bg-gray-50">
                                            <tr className="border-b border-gray-200 text-[10px] uppercase tracking-wider text-gray-400">
                                                <th className="w-12 px-3 py-3 text-center font-bold">
                                                    <input
                                                        type="checkbox"
                                                        checked={allSelected}
                                                        ref={(el) => {
                                                            if (el) el.indeterminate = someSelected;
                                                        }}
                                                        onChange={(e) =>
                                                            toggleAllRows(e.target.checked)
                                                        }
                                                        disabled={!canEdit && !canPay}
                                                        className="accent-teal-600 w-4 h-4"
                                                        title="Select all"
                                                        aria-label="Select all"
                                                    />
                                                </th>
                                                <th className="px-3 py-3 text-center font-bold whitespace-nowrap">
                                                    Account No
                                                </th>
                                                <th className="px-3 py-3 text-center font-bold whitespace-nowrap">
                                                    Provider
                                                </th>
                                                <th className="px-2 py-3 text-center font-bold whitespace-nowrap min-w-[10rem]">
                                                    Account <span className="text-red-500">*</span>
                                                    <span className="block text-[10px] font-normal text-gray-400 normal-case">
                                                        to vendor
                                                    </span>
                                                </th>
                                                <th className="px-3 py-3 text-center font-bold whitespace-nowrap">
                                                    Bill #
                                                </th>
                                                <th className="px-3 py-3 text-center font-bold whitespace-nowrap">
                                                    Bill Date
                                                </th>
                                                <th className="px-3 py-3 text-center font-bold whitespace-nowrap">
                                                    Contract Amount
                                                </th>
                                                <th className="px-3 py-3 text-center font-bold whitespace-nowrap">
                                                    Actual Amount
                                                </th>
                                                <th className="px-3 py-3 text-center font-bold whitespace-nowrap">
                                                    Difference
                                                </th>
                                                <th className="px-2 py-3 text-center font-bold whitespace-nowrap min-w-[10rem]">
                                                    Account
                                                    <span className="block text-[10px] font-normal text-gray-400 normal-case">
                                                        difference pay here
                                                    </span>
                                                </th>
                                                <th className="px-2 py-3 text-center font-bold whitespace-nowrap min-w-[8rem]">
                                                    Company name
                                                </th>
                                                <th className="px-2 py-3 text-center font-bold whitespace-nowrap">
                                                    Contract Paid By
                                                </th>
                                                <th className="px-3 py-3 text-center font-bold whitespace-nowrap">
                                                    Attach
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {rows.map((row, index) => {
                                                const actualNum = Number(row.actualAmount);
                                                const hasActual =
                                                    row.actualAmount !== '' &&
                                                    Number.isFinite(actualNum);
                                                const differenceSigned = hasActual
                                                    ? Number(row.contractAmount || 0) - actualNum
                                                    : 0;
                                                const difference = Math.abs(differenceSigned);
                                                const rowActive = Boolean(row.selected);
                                                const resolved = resolveRowAttachment(
                                                    rows,
                                                    index,
                                                    utilityAttachment,
                                                );

                                                const isUnder =
                                                    hasActual &&
                                                    actualNum < Number(row.contractAmount || 0);

                                                const associatedBills =
                                                    associatedZohoBillsFromRow(row);
                                                const showAssociated =
                                                    associatedBills.length > 0 &&
                                                    row.inBatch &&
                                                    !row.blockedByExisting;

                                                return (
                                                    <Fragment
                                                        key={
                                                            row.entryId ||
                                                            row.billId ||
                                                            `row-${index}`
                                                        }
                                                    >
                                                    <tr
                                                        className={
                                                            row.selected
                                                                ? 'hover:bg-teal-50/30'
                                                                : 'bg-gray-50/80 opacity-60'
                                                        }
                                                    >
                                                        <td className="px-3 py-3.5 text-center align-middle">
                                                            <input
                                                                type="checkbox"
                                                                checked={Boolean(row.selected)}
                                                                disabled={
                                                                    (!canEdit && !canPay) ||
                                                                    Boolean(row.blockedByExisting)
                                                                }
                                                                title={
                                                                    row.blockedByExisting
                                                                        ? `Already has Approved / Paid for ${
                                                                              batch?.billMonth ||
                                                                              'this month'
                                                                          }`
                                                                        : undefined
                                                                }
                                                                onChange={(e) =>
                                                                    setRowSelected(
                                                                        index,
                                                                        e.target.checked,
                                                                    )
                                                                }
                                                                className="accent-teal-600 w-4 h-4 disabled:opacity-40"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-3.5 text-center align-middle font-semibold text-gray-800 tabular-nums">
                                                            {row.accountNo}
                                                        </td>
                                                        <td
                                                            className="px-3 py-3.5 text-center align-middle text-gray-700 font-medium truncate max-w-[8rem]"
                                                            title={row.provider}
                                                        >
                                                            {row.provider || '—'}
                                                        </td>
                                                        <td
                                                            className="px-2 py-3.5 text-left align-middle text-gray-700 text-xs max-w-[12rem]"
                                                            title={row.expenseAccountName || ''}
                                                        >
                                                            <span className="block truncate font-medium">
                                                                {row.expenseAccountName || '—'}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-3.5 text-center align-middle text-gray-800 text-sm tabular-nums">
                                                            {row.billNumber || '—'}
                                                        </td>
                                                        <td className="px-2 py-3.5 text-center align-middle text-gray-700 text-xs tabular-nums whitespace-nowrap">
                                                            {row.billDate || '—'}
                                                        </td>
                                                        <td className="px-3 py-3.5 text-center align-middle tabular-nums text-gray-700">
                                                            {formatMoney(row.contractAmount)}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center align-middle">
                                                            {canEdit ? (
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={row.actualAmount}
                                                                    disabled={!rowActive}
                                                                    onChange={(e) => {
                                                                        const nextActual =
                                                                            e.target.value;
                                                                        const actualN =
                                                                            Number(nextActual);
                                                                        const has =
                                                                            nextActual !== '' &&
                                                                            Number.isFinite(actualN);
                                                                        const contractN = Number(
                                                                            row.contractAmount || 0,
                                                                        );
                                                                        const diff = has
                                                                            ? contractN - actualN
                                                                            : 0;
                                                                        const patch = {
                                                                            actualAmount: nextActual,
                                                                        };
                                                                        if (has && actualN < contractN) {
                                                                            const shares =
                                                                                resolvePayShares(
                                                                                    PAY_BY_COMPANY,
                                                                                    diff,
                                                                                );
                                                                            patch.companyDiffAmount =
                                                                                shares.companyAmount;
                                                                            patch.employeeDiffAmount =
                                                                                shares.employeeAmount;
                                                                            if (
                                                                                row.assignedToType ===
                                                                                    'Company' &&
                                                                                row.assignedToId
                                                                            ) {
                                                                                patch.payBy =
                                                                                    PAY_BY_COMPANY;
                                                                                patch.payByCompanyId =
                                                                                    row.assignedToId;
                                                                                patch.payByCompanyName =
                                                                                    row.assignedToName ||
                                                                                    '';
                                                                                patch.payByEmployeeId =
                                                                                    '';
                                                                                patch.payByEmployeeName =
                                                                                    '';
                                                                            } else if (
                                                                                row.payBy ===
                                                                                PAY_BY_COMPANY
                                                                            ) {
                                                                                patch.payBy =
                                                                                    PAY_BY_COMPANY;
                                                                            } else if (
                                                                                !String(
                                                                                    row.payBy || '',
                                                                                ).trim() &&
                                                                                row.assignedToType ===
                                                                                    'Employee' &&
                                                                                row.assignedToId
                                                                            ) {
                                                                                Object.assign(
                                                                                    patch,
                                                                                    payByFieldsFromAssignment(
                                                                                        row,
                                                                                    ),
                                                                                );
                                                                            }
                                                                        } else if (
                                                                            !String(row.payBy || '').trim() &&
                                                                            row.assignedToId
                                                                        ) {
                                                                            const assignedPay =
                                                                                payByFieldsFromAssignment(
                                                                                    row,
                                                                                );
                                                                            if (assignedPay.payBy) {
                                                                                const shares =
                                                                                    resolvePayShares(
                                                                                        assignedPay.payBy,
                                                                                        diff,
                                                                                    );
                                                                                Object.assign(
                                                                                    patch,
                                                                                    assignedPay,
                                                                                    {
                                                                                        companyDiffAmount:
                                                                                            shares.companyAmount,
                                                                                        employeeDiffAmount:
                                                                                            shares.employeeAmount,
                                                                                    },
                                                                                );
                                                                            }
                                                                        } else if (
                                                                            row.payBy ===
                                                                                PAY_BY_COMPANY ||
                                                                            row.payBy ===
                                                                                PAY_BY_EMPLOYEE
                                                                        ) {
                                                                            const shares =
                                                                                resolvePayShares(
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
                                                            ) : (
                                                                <span className="tabular-nums text-gray-700">
                                                                    {hasActual
                                                                        ? formatMoney(actualNum)
                                                                        : '—'}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td
                                                            className={`px-4 py-3.5 text-center align-middle tabular-nums font-semibold ${
                                                                !hasActual
                                                                    ? 'text-gray-400'
                                                                    : isUnder
                                                                      ? 'text-emerald-600'
                                                                      : 'text-red-600'
                                                            }`}
                                                        >
                                                            {hasActual
                                                                ? formatMoney(difference)
                                                                : '—'}
                                                        </td>
                                                        <td
                                                            className="px-2 py-3.5 text-left align-middle text-gray-700 text-xs max-w-[12rem]"
                                                            title={
                                                                row.partyAccountName ||
                                                                row.partyAccountCode ||
                                                                ''
                                                            }
                                                        >
                                                            {difference > 0.009 ? (
                                                                <span className="block truncate font-medium">
                                                                    {row.partyAccountName ||
                                                                        row.partyAccountCode ||
                                                                        '—'}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-400">—</span>
                                                            )}
                                                        </td>
                                                        <td
                                                            className="px-2 py-3.5 text-center align-middle text-gray-700 text-xs max-w-[10rem]"
                                                            title={row.payByCompanyName || ''}
                                                        >
                                                            <span className="block truncate font-medium">
                                                                {row.payByCompanyName || '—'}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-3.5 text-center align-middle">
                                                            {canEdit ? (
                                                                (() => {
                                                                    const canOpen =
                                                                        rowActive && hasActual;
                                                                    const done = isPayByComplete(
                                                                        row,
                                                                        { isUnder },
                                                                    );
                                                                    const partyLabel =
                                                                        payByPartyLabel(row);
                                                                    const openPayBy = () => {
                                                                        if (!canOpen) return;
                                                                        setPayByRowIndex(index);
                                                                        setError('');
                                                                    };
                                                                    if (done && hasActual) {
                                                                        return (
                                                                            <PayByDoneSummary
                                                                                row={row}
                                                                                difference={
                                                                                    difference
                                                                                }
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
                                                                                partyLabel
                                                                                    ? `${partyLabel} — click to edit`
                                                                                    : isUnder
                                                                                      ? 'Contract Paid By Company — select company'
                                                                                      : 'Choose Contract Paid By'
                                                                            }
                                                                            onClick={openPayBy}
                                                                            className={`min-w-[5.75rem] max-w-[11rem] mx-auto rounded-lg border px-2 py-1.5 text-xs font-medium truncate ${
                                                                                !canOpen
                                                                                    ? 'border-gray-100 bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                                    : 'border-teal-200 bg-white text-teal-700 hover:bg-teal-50'
                                                                            }`}
                                                                        >
                                                                            {partyLabel || 'Select'}
                                                                        </button>
                                                                    );
                                                                })()
                                                            ) : isPayByComplete(row, {
                                                                  isUnder,
                                                              }) ? (
                                                                <PayByDoneSummary
                                                                    row={row}
                                                                    difference={difference}
                                                                    isUnder={isUnder}
                                                                    disabled
                                                                />
                                                            ) : row.payBy ? (
                                                                <span className="text-xs font-medium text-gray-700">
                                                                    {payByShortLabel(row.payBy)}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-400 text-xs">
                                                                    —
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center align-middle relative">
                                                            {canEdit ? (
                                                                <>
                                                                    <input
                                                                        ref={(el) => {
                                                                            fileInputRefs.current[
                                                                                index
                                                                            ] = el;
                                                                        }}
                                                                        type="file"
                                                                        accept=".pdf,application/pdf"
                                                                        className="hidden"
                                                                        onChange={(e) => {
                                                                            handleAttachmentFile(
                                                                                index,
                                                                                e.target.files,
                                                                            );
                                                                            e.target.value = '';
                                                                        }}
                                                                    />
                                                                    <div className="inline-flex flex-col items-center gap-1.5 min-w-[7.5rem]">
                                                                        <button
                                                                            type="button"
                                                                            disabled={!rowActive}
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                setAttachMenuIndex(
                                                                                    index,
                                                                                );
                                                                            }}
                                                                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold disabled:opacity-40 transition-colors shadow-sm"
                                                                        >
                                                                            <Upload
                                                                                size={13}
                                                                                strokeWidth={2.25}
                                                                            />
                                                                            Upload
                                                                        </button>
                                                                        {resolved?.name ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    openAttachmentView(
                                                                                        resolved,
                                                                                        toast,
                                                                                    )
                                                                                }
                                                                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                                                                                title={
                                                                                    resolved.name
                                                                                }
                                                                            >
                                                                                <Eye size={12} />
                                                                                View
                                                                            </button>
                                                                        ) : null}
                                                                    </div>
                                                                </>
                                                            ) : resolved?.name ||
                                                              resolved?.dataUrl ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        openAttachmentView(
                                                                            resolved ||
                                                                                row.attachment,
                                                                            toast,
                                                                        )
                                                                    }
                                                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                                                                    title={
                                                                        resolved?.name ||
                                                                        row.attachment?.name
                                                                    }
                                                                >
                                                                    <Eye size={12} />
                                                                    View
                                                                </button>
                                                            ) : (
                                                                <span className="text-gray-400 text-xs">
                                                                    —
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                    {showAssociated ? (
                                                        <tr
                                                            key={`${row.entryId || row.billId || index}-zoho-children`}
                                                            className="bg-slate-50/90"
                                                        >
                                                            <td
                                                                colSpan={13}
                                                                className="px-4 py-2.5"
                                                            >
                                                                <div className="ml-6 sm:ml-10 rounded-lg border border-slate-200 bg-white overflow-hidden">
                                                                    <div className="px-3 py-1.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                                            Bills under this
                                                                            account (Add more) —
                                                                            each line Debits its
                                                                            Account in Zoho
                                                                        </p>
                                                                        <span className="text-[10px] text-slate-400 tabular-nums">
                                                                            {associatedBills.length}{' '}
                                                                            Zoho bill
                                                                            {associatedBills.length ===
                                                                            1
                                                                                ? ''
                                                                                : 's'}
                                                                        </span>
                                                                    </div>
                                                                    <table className="w-full text-xs">
                                                                        <thead>
                                                                            <tr className="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                                                                                <th className="px-3 py-1.5 text-left font-semibold">
                                                                                    Bill #
                                                                                </th>
                                                                                <th className="px-3 py-1.5 text-left font-semibold">
                                                                                    Items
                                                                                </th>
                                                                                <th className="px-3 py-1.5 text-left font-semibold">
                                                                                    Account
                                                                                    (Debit)
                                                                                </th>
                                                                                <th className="px-3 py-1.5 text-left font-semibold">
                                                                                    Payable to
                                                                                </th>
                                                                                <th className="px-3 py-1.5 text-center font-semibold">
                                                                                    Qty
                                                                                </th>
                                                                                <th className="px-3 py-1.5 text-right font-semibold">
                                                                                    Amount
                                                                                </th>
                                                                                <th className="px-3 py-1.5 text-left font-semibold">
                                                                                    Zoho
                                                                                </th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {associatedBills.map(
                                                                                (child) => (
                                                                                    <tr
                                                                                        key={
                                                                                            child.key
                                                                                        }
                                                                                        className="border-b border-slate-50 last:border-0"
                                                                                    >
                                                                                        <td className="px-3 py-1.5 font-medium text-slate-700 tabular-nums">
                                                                                            {
                                                                                                child.billNumber
                                                                                            }
                                                                                        </td>
                                                                                        <td className="px-3 py-1.5 text-slate-700">
                                                                                            {
                                                                                                child.item
                                                                                            }
                                                                                        </td>
                                                                                        <td className="px-3 py-1.5 text-slate-700">
                                                                                            {
                                                                                                child.accountName
                                                                                            }
                                                                                        </td>
                                                                                        <td className="px-3 py-1.5 text-slate-700">
                                                                                            {child.payByEmployeeName ||
                                                                                                child.payByCompanyName ||
                                                                                                '—'}
                                                                                        </td>
                                                                                        <td className="px-3 py-1.5 text-center tabular-nums text-slate-600">
                                                                                            {
                                                                                                child.quantity
                                                                                            }
                                                                                        </td>
                                                                                        <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-800">
                                                                                            {formatMoney(
                                                                                                child.amount,
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="px-3 py-1.5 text-slate-600">
                                                                                            {child.zohoBillId ? (
                                                                                                <span
                                                                                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700"
                                                                                                    title={
                                                                                                        child.zohoBillId
                                                                                                    }
                                                                                                >
                                                                                                    Synced
                                                                                                    <span className="font-mono text-slate-400">
                                                                                                        …
                                                                                                        {child.zohoBillId.slice(
                                                                                                            -6,
                                                                                                        )}
                                                                                                    </span>
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="text-[10px] text-amber-700 font-medium">
                                                                                                    Not in Zoho yet
                                                                                                </span>
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                ),
                                                                            )}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : null}
                                                    </Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {rows.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-10">
                                        No accounts to show.
                                    </p>
                                ) : null}
                            </div>

                            <UtilityBillTotalsBar rows={rows} />

                            {needsZohoRetry ? (
                                <div className="mx-5 mb-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shrink-0">
                                    <p className="font-semibold">
                                        {needsZohoOpen
                                            ? 'Zoho bill is still Draft'
                                            : 'Not in Zoho Books yet'}
                                    </p>
                                    <p className="mt-1 text-amber-900/90">
                                        {needsZohoOpen
                                            ? 'Click “Open Zoho bill” to mark it Open in Zoho. Then Accounts gets the payment task and Pay becomes available.'
                                            : 'Vendor bill is not in Zoho yet (vendor name match, expense account, wrong org, or Zoho permissions). Fix that, then Retry / Approve again. Difference Debit on Salary Payable (Account 2) posts as a Journal Debit when Approve runs — check the error lines below if it failed.'}
                                    </p>
                                    {rows
                                        .filter(
                                            (r) =>
                                                r.inBatch &&
                                                (String(r.status) === 'Approved' ||
                                                    String(r.status) === 'Pending HR') &&
                                                (String(r.zohoBillStatus || '').toLowerCase() ===
                                                    'draft' ||
                                                    !rowHasZohoBill(r)) &&
                                                r.zohoSyncError,
                                        )
                                        .slice(0, 2)
                                        .map((r) => (
                                            <p
                                                key={String(r.billId || r.entryId)}
                                                className="mt-1 text-xs text-red-700"
                                            >
                                                {r.accountNo}: {r.zohoSyncError}
                                            </p>
                                        ))}
                                </div>
                            ) : null}

                            {error ? (
                                <p className="px-5 pb-2 text-sm text-red-600 shrink-0">{error}</p>
                            ) : null}

                            <div className="px-5 py-3.5 border-t border-gray-100 flex flex-wrap justify-end gap-2 shrink-0 bg-white">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Close
                                </button>
                                {needsZohoRetry ? (
                                    <button
                                        type="button"
                                        disabled={acting}
                                        onClick={handleRetryZohoSync}
                                        title={
                                            needsZohoOpen
                                                ? 'Mark Zoho bill Open so Accounts can pay in Payments Made'
                                                : undefined
                                        }
                                        className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-100 hover:bg-amber-200 text-amber-950 text-sm font-semibold disabled:opacity-50"
                                    >
                                        {acting
                                            ? 'Opening…'
                                            : needsZohoOpen
                                              ? 'Open Zoho bill'
                                              : 'Retry Zoho sync'}
                                    </button>
                                ) : null}
                                {canApproveReject ? (
                                    <>
                                        <button
                                            type="button"
                                            disabled={acting}
                                            onClick={() => handleRespond('reject')}
                                            className="px-4 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold disabled:opacity-50"
                                        >
                                            Reject
                                        </button>
                                        {canHrDraft ? (
                                            <button
                                                type="button"
                                                disabled={acting || !canApproveSelected}
                                                onClick={() => handleRespond('draft')}
                                                title="Store bill in Zoho as Draft (not payable in Payments Made until Approve)"
                                                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold disabled:opacity-50"
                                            >
                                                {acting ? 'Saving…' : 'Draft'}
                                            </button>
                                        ) : null}
                                        <button
                                            type="button"
                                            disabled={acting || !canApproveSelected}
                                            onClick={() => handleRespond('approve')}
                                            title={
                                                blockedSelectedCount
                                                    ? 'Uncheck accounts that already have Approved / Paid for this month'
                                                    : canHrDraft
                                                      ? 'Approve and mark Zoho bill Open so Accounts can pay'
                                                      : undefined
                                            }
                                            className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold disabled:opacity-50 shadow-sm"
                                        >
                                            {acting ? 'Saving…' : 'Approve'}
                                        </button>
                                    </>
                                ) : null}
                                {canPay ? (
                                    <div className="relative" ref={payMenuRef}>
                                        <button
                                            type="button"
                                            disabled={
                                                acting ||
                                                !rows.some((r) => r.selected && r.billId)
                                            }
                                            onClick={() => setPayMenuOpen((v) => !v)}
                                            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold disabled:opacity-50 shadow-sm"
                                        >
                                            Pay
                                            <ChevronDown
                                                size={16}
                                                className={`transition-transform ${
                                                    payMenuOpen ? 'rotate-180' : ''
                                                }`}
                                            />
                                        </button>
                                        {payMenuOpen ? (
                                            <div className="absolute right-0 bottom-full mb-1.5 w-48 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden z-10">
                                                <button
                                                    type="button"
                                                    onClick={() => openPayViaPurchases('bills')}
                                                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-amber-50"
                                                >
                                                    Pay bills
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openPayViaPurchases('difference')}
                                                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-amber-50 border-t border-gray-100"
                                                >
                                                    Pay difference
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </>
                    )}
                </div>
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
                            : rows[payByRowIndex]?.payBy ||
                              assignedPartyDefaults(rows[payByRowIndex]).defaultPayBy ||
                              ''
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
                assignedToType={
                    payByRowIndex != null ? rows[payByRowIndex]?.assignedToType || '' : ''
                }
                assignedToId={
                    payByRowIndex != null ? rows[payByRowIndex]?.assignedToId || '' : ''
                }
                assignedToName={
                    payByRowIndex != null ? rows[payByRowIndex]?.assignedToName || '' : ''
                }
                companyOptions={companyOptions}
                employeeOptions={employeeOptions}
                onConfirm={(choice) => {
                    if (payByRowIndex == null) return;
                    const idxRow = payByRowIndex;
                    const row = rows[idxRow];
                    const diff =
                        Number(row?.contractAmount || 0) - Number(row?.actualAmount || 0);
                    const shares = resolvePayShares(choice.payBy, diff);
                    updateRow(idxRow, {
                        payBy: choice.payBy,
                        companyDiffAmount: shares.companyAmount,
                        employeeDiffAmount: shares.employeeAmount,
                        payByCompanyId:
                            choice.payBy === PAY_BY_COMPANY
                                ? choice.payByCompanyId
                                : row.payByCompanyId || choice.payByCompanyId || '',
                        payByCompanyName:
                            choice.payBy === PAY_BY_COMPANY
                                ? choice.payByCompanyName
                                : row.payByCompanyName || choice.payByCompanyName || '',
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
