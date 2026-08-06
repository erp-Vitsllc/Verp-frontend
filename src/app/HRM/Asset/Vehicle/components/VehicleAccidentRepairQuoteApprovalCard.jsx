'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileCheck, Plus } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { openAttachmentInNewTab } from '@/utils/attachmentPreview';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import { parseVehicleServiceRemark, normalizeMongoId } from './vehicleServiceUtils';
import VehicleAccidentRepairFormFieldCell from './VehicleAccidentRepairFormFieldCell';
import SearchableEmployeeSelect from './SearchableEmployeeSelect';
import { isOilServiceAssignmentPending } from '../utils/vehicleOilServiceAccess';
import { canEditAccidentRepairQuoteCard } from '../utils/vehicleAccidentRepairWorkflow';
import {
    ACCIDENT_REPAIR_DETAIL_GRID_LAYOUT,
    tireAccent,
    tireBtnDanger,
    tireBtnPrimary,
    tireMoneyInput,
    tireSummaryValue,
} from '../utils/vehicleAccidentRepairDetailUi';
import { applyEmployeePayTargetToRows } from '../utils/vehicleAccidentRepairDetailForm';
import { quoteKeyToLabel } from '../utils/vehicleAccidentRepairQuoteDrag';
import {
    buildHrReviewInitiateRemarkPatch,
    syncHrReviewPayCalculation,
    syncHrReviewPayFromEmployeeRows,
} from '../utils/vehicleShopHrReviewPay';

function formatAed(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    return `${n.toLocaleString()} AED`;
}

function FineSplitToggle({ value, onChange, disabled }) {
    return (
        <div className="inline-flex w-full min-h-[44px] items-stretch rounded-lg border border-gray-200 bg-gray-50 p-1 gap-0.5">
            {[
                { id: 'person', label: 'EMP' },
                { id: 'company', label: 'CMPY' },
                { id: 'split', label: 'EMP & CMPY' },
            ].map((opt) => (
                <button
                    key={opt.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(opt.id)}
                    className={`flex flex-1 items-center justify-center rounded-md px-2.5 py-2.5 text-xs font-bold leading-tight whitespace-nowrap transition-all ${
                        value === opt.id
                            ? 'bg-white text-emerald-700 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                    } disabled:opacity-60`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function employeeLabel(emp) {
    if (!emp || typeof emp !== 'object') return '-';
    const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
    return name || emp.employeeId || '-';
}

function buildQuoteRows(service, remark) {
    const rows = [];
    const garageQuotes = Array.isArray(remark?.accidentGarageQuotes) ? remark.accidentGarageQuotes : [];
    const byKey = new Map(
        garageQuotes
            .filter((row) => row && ['q1', 'q2', 'q3'].includes(String(row.key || '').toLowerCase()))
            .map((row) => [String(row.key).toLowerCase(), row]),
    );

    const add = (key, label, amountFallback) => {
        const found = byKey.get(key);
        const url = found?.url ? String(found.url) : '';
        const name = found?.name ? String(found.name) : '';
        const amount =
            found?.amount != null && found?.amount !== ''
                ? found.amount
                : amountFallback;
        if (url || name) {
            rows.push({ key, label, url, name, amount: amount != null ? amount : '' });
        }
    };

    add('q1', 'Quote 1', remark?.quotation1Amount ?? remark?.estimatedCost ?? service?.value);
    add('q2', 'Quote 2', remark?.quotation2Amount);
    add('q3', 'Quote 3', remark?.quotation3Amount);
    return rows;
}

function resolveAccidentFineTotal(remark) {
    const insurance = Number(remark?.insuranceFineAmount) || 0;
    const police = Number(remark?.policeFineAmount) || 0;
    const other = Number(remark?.otherFineAmount) || 0;
    return insurance + police + other;
}

function computePaySplit(amount, paymentByMode, companyPct, employeePct) {
    const amt = Number(amount) || 0;
    const mode = paymentByMode || 'company';
    if (mode === 'company') return { companyPay: amt, employeePay: 0 };
    if (mode === 'person') return { companyPay: 0, employeePay: amt };
    const cPct = Number(companyPct) || 0;
    const ePct = Number(employeePct) || 0;
    return {
        companyPay: Math.round((amt * cPct) / 100),
        employeePay: Math.round((amt * ePct) / 100),
    };
}

function resolveQuoteAmount(remark, service, approvedRow) {
    const quoteAmt = Number(approvedRow?.amount);
    if (Number.isFinite(quoteAmt) && quoteAmt > 0) return quoteAmt;
    const fineTotal = resolveAccidentFineTotal(remark);
    if (fineTotal > 0) return fineTotal;
    const estimated = Number(remark?.estimatedCost ?? service?.value ?? 0);
    return estimated > 0 ? estimated : 0;
}

function buildReviewAmountsFromAssignment(remark, service, approvedRow, paymentByModeOverride) {
    const approvedAmount = resolveQuoteAmount(remark, service, approvedRow);
    const paymentByMode =
        paymentByModeOverride ||
        remark?.paymentByMode ||
        'company';
    const companyPct = Number(remark?.companyPayPercent ?? (paymentByMode === 'split' ? 50 : paymentByMode === 'person' ? 0 : 100));
    const employeePct = Number(remark?.employeePayPercent ?? (paymentByMode === 'split' ? 50 : paymentByMode === 'person' ? 100 : 0));
    const split = computePaySplit(approvedAmount, paymentByMode, companyPct, employeePct);

    const rowSource =
        Array.isArray(remark?.employeeLiabilityRows) && remark.employeeLiabilityRows.length
            ? remark.employeeLiabilityRows
            : [];
    const employeeRows = rowSource.length
        ? rowSource.map((row) => ({
              employeeId: String(row.employeeId || ''),
              paidAmount: row.paidAmount != null ? String(row.paidAmount) : '',
          }))
        : [
              {
                  employeeId: String(
                      remark?.carDrivenByEmployeeId || remark?.vehicleOwnerEmployeeId || '',
                  ),
                  paidAmount: split.employeePay ? String(split.employeePay) : '',
              },
          ];

    return {
        approvedAmount: approvedAmount ? String(approvedAmount) : '',
        companyPay: String(split.companyPay),
        employeePay: String(split.employeePay),
        employeeRows,
    };
}

function mergeSavedHrReview(assignmentBase, remark) {
    const hasSaved =
        remark?.hrReviewApprovedAmount != null && remark?.hrReviewApprovedAmount !== '';
    if (!hasSaved) return assignmentBase;

    const rows =
        Array.isArray(remark?.hrReviewEmployeeRows) && remark.hrReviewEmployeeRows.length
            ? remark.hrReviewEmployeeRows.map((row) => ({
                  employeeId: String(row.employeeId || ''),
                  paidAmount: row.paidAmount != null ? String(row.paidAmount) : '',
              }))
            : assignmentBase.employeeRows;

    return {
        approvedAmount: String(remark.hrReviewApprovedAmount ?? assignmentBase.approvedAmount),
        companyPay: String(remark.hrReviewCompanyPay ?? assignmentBase.companyPay),
        employeePay: String(remark.hrReviewEmployeePay ?? assignmentBase.employeePay),
        employeeRows: rows,
    };
}

export default function VehicleAccidentRepairQuoteApprovalCard({
    asset,
    service,
    vehicleId,
    serviceId,
    canActHr = false,
    canRespondToWorkflow = false,
    canManageAccidentRepair = false,
    workflowStage = '',
    onUpdated,
    onReviewSummaryChange,
    className = '',
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [quoteState, setQuoteState] = useState({
        q1: { status: '', comment: '' },
        q2: { status: '', comment: '' },
        q3: { status: '', comment: '' },
    });
    const [description, setDescription] = useState('');
    const [displaySummary, setDisplaySummary] = useState({
        approvedAmount: '',
        companyPay: '',
        employeePay: '',
    });
    const [employeeRows, setEmployeeRows] = useState([]);
    const [paymentByMode, setPaymentByMode] = useState('');

    const remark = useMemo(() => parseVehicleServiceRemark(service) || {}, [service]);
    const assignmentPending = isOilServiceAssignmentPending(remark);
    const quoteRows = useMemo(() => buildQuoteRows(service, remark), [service, remark]);
    const showCompanyPay = !paymentByMode || paymentByMode !== 'person';
    const showEmployeePay = paymentByMode === 'person' || paymentByMode === 'split';
    const totalPay =
        (Number(displaySummary.companyPay) || 0) + (Number(displaySummary.employeePay) || 0);

    const wf = asset?.activeServiceWorkflow || {};
    const wfMatch = normalizeMongoId(wf?.serviceRecordId) === normalizeMongoId(serviceId);
    const stage = String(workflowStage || (wfMatch ? String(wf?.stage || '').toLowerCase() : '')).toLowerCase();
    const canEdit = useMemo(
        () =>
            canEditAccidentRepairQuoteCard(assignmentPending, stage, {
                canActHr,
                canRespondToWorkflow,
            }),
        [assignmentPending, stage, canActHr, canRespondToWorkflow],
    );

    useEffect(() => {
        let active = true;
        axiosInstance
            .get('/employee')
            .then(({ data }) => {
                if (!active) return;
                const list = Array.isArray(data) ? data : data?.employees || [];
                setEmployees(list);
            })
            .catch(() => {
                if (active) setEmployees([]);
            });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        const saved = remark?.tireQuoteReview || {};
        const preferredKey = remark?.approvedQuotationChoice || '';
        const approvedFromSaved = ['q1', 'q2', 'q3'].find((k) => saved?.[k]?.status === 'approved') || '';
        const activeKey = ['q1', 'q2', 'q3'].includes(preferredKey) ? preferredKey : approvedFromSaved;
        setQuoteState({
            q1: {
                status: activeKey === 'q1' ? saved?.q1?.status || 'approved' : saved?.q1?.status || '',
                comment: saved?.q1?.comment || '',
            },
            q2: {
                status: activeKey === 'q2' ? saved?.q2?.status || 'approved' : saved?.q2?.status || '',
                comment: saved?.q2?.comment || '',
            },
            q3: {
                status: activeKey === 'q3' ? saved?.q3?.status || 'approved' : saved?.q3?.status || '',
                comment: saved?.q3?.comment || '',
            },
        });
        setDescription(remark?.hrReviewDescription || remark?.quoteReviewDescription || '');
        const modeRaw = String(remark?.paymentByMode || '').toLowerCase();
        setPaymentByMode(
            modeRaw === 'person' || modeRaw === 'company' || modeRaw === 'split' ? modeRaw : '',
        );
    }, [service?._id, service?.remark, remark]);

    const approvedQuoteKey = useMemo(() => {
        const fromRemark = remark?.approvedQuotationChoice;
        if (['q1', 'q2', 'q3'].includes(fromRemark) && quoteState[fromRemark]?.status === 'approved') {
            return fromRemark;
        }
        return ['q1', 'q2', 'q3'].find((k) => quoteState[k]?.status === 'approved') || '';
    }, [quoteState, remark?.approvedQuotationChoice]);

    const approvedRow = useMemo(
        () => (approvedQuoteKey ? quoteRows.find((r) => r.key === approvedQuoteKey) : null),
        [approvedQuoteKey, quoteRows],
    );

    useEffect(() => {
        if (assignmentPending) return;
        const fromAssignment = buildReviewAmountsFromAssignment(
            remark,
            service,
            approvedRow,
            paymentByMode || undefined,
        );
        const merged = mergeSavedHrReview(fromAssignment, remark);
        setDisplaySummary({
            approvedAmount: merged.approvedAmount,
            companyPay: merged.companyPay,
            employeePay: merged.employeePay,
        });
        setEmployeeRows(merged.employeeRows);
        
        // paymentByMode is applied via handleFineSplitChange; do not re-merge on every toggle.
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
    }, [
        assignmentPending,
        service?._id,
        service?.value,
        service?.remark,
        remark,
        approvedRow?.key,
        approvedRow?.amount,
    ]);

    useEffect(() => {
        if (typeof onReviewSummaryChange !== 'function') return;
        onReviewSummaryChange({
            approvedAmount: displaySummary.approvedAmount,
            companyPay: displaySummary.companyPay,
            employeePay: displaySummary.employeePay,
            paymentByMode: paymentByMode || undefined,
            employeeRows: (employeeRows || []).map((row) => ({
                employeeId: String(row.employeeId || ''),
                paidAmount: row.paidAmount != null ? String(row.paidAmount) : '',
            })),
        });
    }, [
        displaySummary.approvedAmount,
        displaySummary.companyPay,
        displaySummary.employeePay,
        employeeRows,
        onReviewSummaryChange,
        paymentByMode,
    ]);

    const resolveEmployeeName = useCallback(
        (employeeId) => {
            const id = String(employeeId || '').trim();
            if (!id) return '-';
            const fromList = employees.find((emp) => String(emp._id) === id);
            if (fromList) return employeeLabel(fromList);
            const assignee = asset?.assignedTo;
            if (assignee && typeof assignee === 'object' && String(assignee._id) === id) {
                return employeeLabel(assignee);
            }
            return '-';
        },
        [asset?.assignedTo, employees],
    );

    const applyApprovedAmountToSplit = useCallback(
        (rawAmount, prevRows, mode = paymentByMode) => {
            const amount = Number(rawAmount) || 0;
            const effectiveMode = mode || 'company';
            const companyPct =
                effectiveMode === 'person' ? 0 : effectiveMode === 'split' ? Number(remark?.companyPayPercent ?? 50) : 100;
            const employeePct =
                effectiveMode === 'person' ? 100 : effectiveMode === 'split' ? Number(remark?.employeePayPercent ?? 50) : 0;
            const split = computePaySplit(amount, effectiveMode, companyPct, employeePct);
            const seedRows =
                prevRows?.length
                    ? prevRows
                    : [
                          {
                              employeeId: String(
                                  remark?.carDrivenByEmployeeId || remark?.vehicleOwnerEmployeeId || '',
                              ),
                              paidAmount: '',
                          },
                      ];
            const nextRows =
                effectiveMode === 'person' || effectiveMode === 'split'
                    ? applyEmployeePayTargetToRows(seedRows, amount, employeePct)
                    : prevRows;
            return {
                approvedAmount: rawAmount,
                companyPay: String(split.companyPay),
                employeePay: String(split.employeePay),
                employeeRows: nextRows,
            };
        },
        [
            paymentByMode,
            remark?.carDrivenByEmployeeId,
            remark?.companyPayPercent,
            remark?.employeePayPercent,
            remark?.vehicleOwnerEmployeeId,
        ],
    );

    const setReviewField = (field, value) => {
        const synced = syncHrReviewPayCalculation({
            field,
            value,
            approvedAmount: displaySummary.approvedAmount,
            companyPay: displaySummary.companyPay,
            employeePay: displaySummary.employeePay,
            employeeRows,
            paymentByMode: paymentByMode || 'company',
        });
        setDisplaySummary({
            approvedAmount: synced.approvedAmount,
            companyPay: synced.companyPay,
            employeePay: synced.employeePay,
        });
        setEmployeeRows(synced.employeeRows);
        if (synced.paymentByMode) {
            setPaymentByMode(synced.paymentByMode);
        }
        
    };

    const setReviewApprovedAmount = (value) => {
        const synced = syncHrReviewPayCalculation({
            field: 'approvedAmount',
            value,
            approvedAmount: displaySummary.approvedAmount,
            companyPay: displaySummary.companyPay,
            employeePay: displaySummary.employeePay,
            employeeRows,
            paymentByMode: paymentByMode || 'company',
        });
        setDisplaySummary({
            approvedAmount: synced.approvedAmount,
            companyPay: synced.companyPay,
            employeePay: synced.employeePay,
        });
        setEmployeeRows(synced.employeeRows);
        
    };

    const handleFineSplitChange = (mode) => {
        if (!canEdit || assignmentPending) return;
        setPaymentByMode(mode);
        const split = applyApprovedAmountToSplit(displaySummary.approvedAmount, employeeRows, mode);
        setDisplaySummary({
            approvedAmount: split.approvedAmount,
            companyPay: split.companyPay,
            employeePay: split.employeePay,
        });
        setEmployeeRows(split.employeeRows);
        
    };

    const syncPayTotalsFromEmployeeRows = useCallback(
        (rows, mode = paymentByMode, companyPayValue = displaySummary.companyPay) => {
            return syncHrReviewPayFromEmployeeRows({
                employeeRows: rows,
                approvedAmount: displaySummary.approvedAmount,
                companyPay: companyPayValue,
                paymentByMode: mode || 'company',
            });
        },
        [displaySummary.approvedAmount, displaySummary.companyPay, paymentByMode],
    );

    const updateReviewEmployeeRow = (index, field, value) => {
        setEmployeeRows((prev) => {
            const rows = [...(prev || [])];
            rows[index] = { ...rows[index], [field]: value };
            if (field === 'paidAmount') {
                const synced = syncPayTotalsFromEmployeeRows(rows);
                setDisplaySummary({
                    approvedAmount: synced.approvedAmount,
                    companyPay: synced.companyPay,
                    employeePay: synced.employeePay,
                });
            }
            return rows;
        });
        
    };

    const addEmployeeRow = () => {
        setEmployeeRows((prev) => [...(prev || []), { employeeId: '', paidAmount: '' }]);
        
    };

    const removeEmployeeRow = (index) => {
        setEmployeeRows((prev) => {
            const rows = [...(prev || [])];
            const nextRows =
                rows.length <= 1
                    ? [{ employeeId: '', paidAmount: '' }]
                    : rows.filter((_, i) => i !== index);
            const synced = syncPayTotalsFromEmployeeRows(nextRows);
            setDisplaySummary({
                approvedAmount: synced.approvedAmount,
                companyPay: synced.companyPay,
                employeePay: synced.employeePay,
            });
            return nextRows;
        });
        
    };

    const setQuoteField = (key, field, value) => {
        setQuoteState((prev) => ({
            ...prev,
            [key]: { ...prev[key], [field]: value },
        }));
    };

    const setQuoteStatus = (key, status) => {
        setQuoteState((prev) => {
            const next = { ...prev, [key]: { ...prev[key], status } };
            if (status === 'approved') {
                ['q1', 'q2', 'q3'].forEach((k) => {
                    if (k !== key && next[k]?.status === 'approved') {
                        next[k] = { ...next[k], status: '' };
                    }
                });
            }
            return next;
        });
    };

    const selectQuote = (row) => {
        if (!canEdit || assignmentPending || !row?.key) return;
        setQuoteStatus(row.key, 'approved');
        const quoteAmount = Number(row.amount);
        const fineTotal = resolveAccidentFineTotal(remark);
        const fallback = Number(remark?.estimatedCost ?? service?.value ?? 0);
        const amount = quoteAmount > 0 ? quoteAmount : fineTotal > 0 ? fineTotal : fallback;
        if (amount > 0) {
            setReviewApprovedAmount(String(amount));
        }
    };

    const handleViewFile = async (row) => {
        if (!row?.url) return;
        const result = await openAttachmentInNewTab(row.url, {
            name: row.name || `${row.label}.pdf`,
            mimeType: 'application/pdf',
        });
        if (!result.ok) {
            toast({
                variant: 'destructive',
                title: 'Cannot open file',
                description: result.error || 'File unavailable.',
            });
        }
    };

    const buildEmployeeRowsPayload = useCallback(
        () =>
            (employeeRows || []).map((row) => ({
                employeeId: row.employeeId,
                paidAmount: Number(row.paidAmount) || 0,
            })),
        [employeeRows],
    );

    const buildServiceUpdates = useCallback(() => {
        const selected = approvedQuoteKey;
        const selectedRow = selected ? quoteRows.find((r) => r.key === selected) : null;
        const approvedAmountNum = Number(displaySummary.approvedAmount) || 0;
        const employeeRowsPayload = buildEmployeeRowsPayload();
        const initiatePatch = buildHrReviewInitiateRemarkPatch({
            approvedAmount: displaySummary.approvedAmount,
            companyPay: displaySummary.companyPay,
            employeePay: displaySummary.employeePay,
            employeeRows: employeeRowsPayload,
            paymentByMode: paymentByMode || undefined,
        });
        return {
            remark: JSON.stringify({
                ...remark,
                approvedQuotationChoice: selected || undefined,
                approvedQuoteKey: selected || undefined,
                approvedQuoteLabel: selectedRow?.label || undefined,
                approvedQuoteUrl: selectedRow?.url || undefined,
                tireQuoteReview: quoteState,
                hrReviewDescription: description.trim() || undefined,
                quoteReviewDescription: description.trim() || undefined,
                ...initiatePatch,
            }),
            ...(selected ? { vendorName: remark?.vendorName || '' } : {}),
            ...(approvedAmountNum > 0 ? { value: approvedAmountNum } : {}),
        };
    }, [
        approvedQuoteKey,
        buildEmployeeRowsPayload,
        description,
        displaySummary,
        paymentByMode,
        quoteRows,
        quoteState,
        remark,
    ]);

    const handleWorkflow = async (action) => {
        if (!vehicleId || !canEdit) return;
        if (action === 'approve' && quoteRows.length > 0) {
            if (!approvedQuoteKey || quoteState[approvedQuoteKey]?.status !== 'approved') {
                toast({
                    variant: 'destructive',
                    title: 'Quotation required',
                    description:
                        'Quotes were uploaded - select one quote below, or remove quotes on Initiate first.',
                });
                return;
            }
        }
        setLoading(true);
        try {
            const payload = {
                action,
                comment: String(description || '').trim() || undefined,
                ...(serviceId ? { serviceRecordId: serviceId } : {}),
            };
            if (action === 'approve' || action === 'save') {
                payload.serviceUpdates = buildServiceUpdates();
            }
            const { data } = await axiosInstance.post(`/AssetItem/${vehicleId}/service-workflow/respond`, payload);
            toast({
                title:
                    action === 'approve'
                        ? 'Approved'
                        : action === 'save'
                          ? 'Saved'
                          : 'Rejected',
                description: data?.message || 'Workflow updated.',
            });
            if (typeof onUpdated === 'function') onUpdated(data?.asset);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Action failed',
                description: error.response?.data?.message || 'Could not update workflow.',
            });
        } finally {
            setLoading(false);
        }
    };

    const { fieldMinHeightPx, gapClass } = ACCIDENT_REPAIR_DETAIL_GRID_LAYOUT;
    const accent = tireAccent;

    return (
        <div className={`w-full ${className}`.trim()}>
            <FineFormCard
                title="HR Approval"
                subtitle={
                    assignmentPending
                        ? 'Available after Initiate Service is sent'
                        : canEdit
                          ? quoteRows.length
                              ? 'Select one quotation, then approve'
                              : 'No quotes uploaded - you can approve without a quotation'
                          : 'Submitted quotation review - view only'
                }
                icon={FileCheck}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
                className="w-full"
            >
                {assignmentPending ? (
                    <p className="mb-4 text-sm text-gray-500">
                        Optional quotes can be uploaded on Initiate Service. After Send, HR can select an
                        approved quote here.
                    </p>
                ) : (
                    <p className="mb-4 text-sm text-gray-600">
                        {quoteRows.length
                            ? 'Select one quote from Initiate. Only that quote continues; other quotes are not used.'
                            : 'No quotes uploaded - you can approve without selecting a quotation.'}
                    </p>
                )}

                <div className="mb-4 space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Quotations
                    </span>
                    {quoteRows.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                            No quotations uploaded on Initiate yet.
                        </p>
                    ) : (
                        <div className="space-y-2" role="radiogroup" aria-label="Select quotation">
                            {quoteRows.map((row) => {
                                const selected = approvedQuoteKey === row.key;
                                const amountLabel =
                                    row.amount != null &&
                                    row.amount !== '' &&
                                    Number.isFinite(Number(row.amount))
                                        ? `AED ${Number(row.amount).toLocaleString()}`
                                        : null;
                                return (
                                    <div
                                        key={row.key}
                                        role="radio"
                                        aria-checked={selected}
                                        tabIndex={canEdit || selected ? 0 : -1}
                                        onClick={() => {
                                            if (!canEdit) return;
                                            selectQuote(row);
                                        }}
                                        onKeyDown={(event) => {
                                            if (!canEdit) return;
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                selectQuote(row);
                                            }
                                        }}
                                        className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                                            selected
                                                ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200'
                                                : 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40'
                                        } ${!canEdit ? 'cursor-default opacity-90' : 'cursor-pointer'}`}
                                    >
                                        <span
                                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                                selected
                                                    ? 'border-emerald-600 bg-emerald-600'
                                                    : 'border-gray-300 bg-white'
                                            }`}
                                            aria-hidden
                                        >
                                            {selected ? (
                                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                            ) : null}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                <span className="text-sm font-bold text-gray-900">
                                                    {row.label}
                                                </span>
                                                {amountLabel ? (
                                                    <span className="text-xs font-semibold text-emerald-700">
                                                        {amountLabel}
                                                    </span>
                                                ) : null}
                                            </span>
                                            {row.name ? (
                                                <span className="mt-0.5 block truncate text-xs text-gray-500">
                                                    {row.name}
                                                </span>
                                            ) : null}
                                        </span>
                                        {row.url ? (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    void handleViewFile(row);
                                                }}
                                                className="shrink-0 text-xs font-semibold text-sky-700 hover:underline"
                                            >
                                                View
                                            </button>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {!assignmentPending && approvedRow ? (
                        <p className="text-xs font-semibold text-emerald-700">
                            Selected {quoteKeyToLabel(approvedQuoteKey)}
                            {approvedRow?.amount != null &&
                            approvedRow.amount !== '' &&
                            Number.isFinite(Number(approvedRow.amount))
                                ? ` - AED ${Number(approvedRow.amount).toLocaleString()}`
                                : ''}
                            . Other quotes will not continue.
                        </p>
                    ) : null}
                </div>

                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${gapClass}`}>
                    <VehicleAccidentRepairFormFieldCell
                        label="Payment to Whom"
                        accentClass={accent(0)}
                        minHeightPx={Math.max(fieldMinHeightPx, 72)}
                        className="sm:col-span-2 min-w-0"
                    >
                        <FineSplitToggle
                            value={paymentByMode || ''}
                            onChange={handleFineSplitChange}
                            disabled={!canEdit}
                        />
                    </VehicleAccidentRepairFormFieldCell>
                    <VehicleAccidentRepairFormFieldCell
                        label="Approved Amount"
                        accentClass={accent(1)}
                        minHeightPx={Math.max(fieldMinHeightPx, 72)}
                    >
                        <input
                            className={canEdit ? tireMoneyInput : tireSummaryValue}
                            readOnly={!canEdit}
                            type={canEdit ? 'number' : 'text'}
                            min={canEdit ? '0' : undefined}
                            value={
                                canEdit
                                    ? displaySummary.approvedAmount || ''
                                    : displaySummary.approvedAmount
                                      ? formatAed(displaySummary.approvedAmount)
                                      : '-'
                            }
                            onChange={(e) => setReviewApprovedAmount(e.target.value)}
                        />
                        {!canEdit && totalPay > 0 ? (
                            <p className="mt-1 text-[10px] font-semibold text-gray-500">
                                Total Pay: {formatAed(totalPay)}
                            </p>
                        ) : null}
                    </VehicleAccidentRepairFormFieldCell>
                    {showCompanyPay ? (
                        <VehicleAccidentRepairFormFieldCell
                            label="Company Pay"
                            accentClass={accent(2)}
                            minHeightPx={Math.max(fieldMinHeightPx, 72)}
                        >
                            <input
                                className={canEdit ? tireMoneyInput : tireSummaryValue}
                                readOnly={!canEdit}
                                type={canEdit ? 'number' : 'text'}
                                min={canEdit ? '0' : undefined}
                                value={
                                    canEdit
                                        ? displaySummary.companyPay || ''
                                        : displaySummary.companyPay
                                          ? formatAed(displaySummary.companyPay)
                                          : '0 AED'
                                }
                                onChange={(e) => setReviewField('companyPay', e.target.value)}
                            />
                        </VehicleAccidentRepairFormFieldCell>
                    ) : null}
                    {showEmployeePay ? (
                        <VehicleAccidentRepairFormFieldCell
                            label="Employee Pay"
                            accentClass={accent(0)}
                            minHeightPx={Math.max(fieldMinHeightPx, 72)}
                        >
                            <input
                                className={canEdit ? tireMoneyInput : tireSummaryValue}
                                readOnly={!canEdit}
                                type={canEdit ? 'number' : 'text'}
                                min={canEdit ? '0' : undefined}
                                value={
                                    canEdit
                                        ? displaySummary.employeePay || ''
                                        : displaySummary.employeePay
                                          ? formatAed(displaySummary.employeePay)
                                          : '0 AED'
                                }
                                onChange={(e) => setReviewField('employeePay', e.target.value)}
                            />
                        </VehicleAccidentRepairFormFieldCell>
                    ) : null}
                    {canEdit && (showCompanyPay || showEmployeePay) ? (
                        <VehicleAccidentRepairFormFieldCell
                            label="Total Pay"
                            accentClass={accent(1)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <input
                                className={tireSummaryValue}
                                readOnly
                                disabled
                                value={totalPay > 0 ? formatAed(totalPay) : '-'}
                            />
                        </VehicleAccidentRepairFormFieldCell>
                    ) : null}
                </div>

                {showEmployeePay ? (
                    <div className="mt-3 rounded-lg border border-gray-200 bg-white overflow-hidden">
                        <div className="grid grid-cols-2 border-b border-gray-200 bg-slate-50">
                            {['Employee Name', 'Amount'].map((heading) => (
                                <div
                                    key={heading}
                                    className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 border-r border-gray-200 last:border-r-0"
                                >
                                    {heading}
                                </div>
                            ))}
                        </div>
                        {(employeeRows || []).length ? (
                            (employeeRows || []).map((row, index) => {
                                const canEditRow = canEdit;
                                const isLastRow = index === (employeeRows || []).length - 1;
                                return (
                                    <div
                                        key={`hr-emp-row-${index}`}
                                        className="grid grid-cols-2 border-b border-gray-100 last:border-b-0"
                                    >
                                        <div className="flex items-center gap-1 border-r border-gray-100 p-2">
                                            {canEditRow ? (
                                                <SearchableEmployeeSelect
                                                    employees={employees}
                                                    value={row.employeeId || ''}
                                                    onChange={(nextId) =>
                                                        updateReviewEmployeeRow(
                                                            index,
                                                            'employeeId',
                                                            nextId,
                                                        )
                                                    }
                                                    disabled={loading}
                                                    placeholder="Select employee"
                                                />
                                            ) : (
                                                <span className="block px-1 py-1 text-sm font-semibold text-gray-800">
                                                    {resolveEmployeeName(row.employeeId)}
                                                </span>
                                            )}
                                            {canEditRow && (employeeRows || []).length > 1 ? (
                                                <button
                                                    type="button"
                                                    onClick={() => removeEmployeeRow(index)}
                                                    className="shrink-0 rounded-md px-1.5 py-1 text-[10px] font-bold text-red-500 hover:bg-red-50"
                                                    title="Remove employee"
                                                    disabled={loading}
                                                >
                                                    {'\u00d7'}
                                                </button>
                                            ) : null}
                                        </div>
                                        <div className="flex items-center gap-1 p-2">
                                            {canEditRow ? (
                                                <input
                                                    className={`${tireMoneyInput} min-h-[36px] py-1 flex-1`}
                                                    type="number"
                                                    min="0"
                                                    value={row.paidAmount || ''}
                                                    onChange={(e) =>
                                                        updateReviewEmployeeRow(
                                                            index,
                                                            'paidAmount',
                                                            e.target.value,
                                                        )
                                                    }
                                                    disabled={loading}
                                                    placeholder="AED"
                                                />
                                            ) : (
                                                <span className="block px-1 py-1 text-sm font-semibold text-gray-800">
                                                    {row.paidAmount ? formatAed(row.paidAmount) : '-'}
                                                </span>
                                            )}
                                            {canEditRow && isLastRow ? (
                                                <button
                                                    type="button"
                                                    onClick={addEmployeeRow}
                                                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 text-[11px] font-bold text-blue-600 hover:bg-blue-100"
                                                    title="Add more employees"
                                                    disabled={loading}
                                                >
                                                    <Plus size={14} />
                                                    Add more emp
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="flex items-center justify-between gap-2 px-3 py-3">
                                <p className="text-sm text-gray-400">Select an employee name</p>
                                {canEdit ? (
                                    <button
                                        type="button"
                                        onClick={addEmployeeRow}
                                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-bold text-blue-600 hover:bg-blue-100"
                                        disabled={loading}
                                    >
                                        <Plus size={14} />
                                        Add more emp
                                    </button>
                                ) : null}
                            </div>
                        )}
                    </div>
                ) : null}

                <div className="mt-4 border-t border-gray-100 pt-4">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Description (optional)
                    </span>
                    <textarea
                        className="mt-1.5 w-full min-h-[88px] resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-50 disabled:text-gray-600"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={!canEdit}
                        placeholder="Enter review notes..."
                    />
                </div>

                {canEdit ? (
                    <div className="mt-4 flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => void handleWorkflow('reject')}
                            className={tireBtnDanger}
                        >
                            Reject
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => void handleWorkflow('save')}
                            className={tireBtnPrimary}
                        >
                            Save
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => void handleWorkflow('approve')}
                            className={tireBtnPrimary}
                        >
                            Approve
                        </button>
                    </div>
                ) : null}
            </FineFormCard>
        </div>
    );
}
