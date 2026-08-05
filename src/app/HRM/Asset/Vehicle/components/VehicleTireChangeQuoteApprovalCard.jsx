'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { openAttachmentInNewTab } from '@/utils/attachmentPreview';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import { parseVehicleServiceRemark, normalizeMongoId } from './vehicleServiceUtils';
import VehicleTireChangeFormFieldCell from './VehicleTireChangeFormFieldCell';
import VehicleServiceLockedSection from './VehicleServiceLockedSection';
import { isOilServiceAssignmentPending } from '../utils/vehicleOilServiceAccess';
import { canEditTireChangeQuoteCard, canEditTireChangeQuoteEmployeeRows } from '../utils/vehicleTireChangeWorkflow';
import {
    SHOP_SERVICE_CARD,
    resolveShopServiceCardGate,
} from '../utils/vehicleShopServiceCardGates';
import {
    TIRE_CHANGE_DETAIL_GRID_LAYOUT,
    tireAccent,
    tireBtnDanger,
    tireBtnPrimary,
    tireFieldSelect,
    tireMoneyInput,
    tireSummaryValue,
} from '../utils/vehicleTireChangeDetailUi';
import { applyEmployeePayTargetToRows } from '../utils/vehicleTireChangeDetailForm';
import { quoteKeyToLabel } from '../utils/vehicleTireChangeQuoteDrag';
import {
    buildHrReviewInitiateRemarkPatch,
    syncHrReviewPayCalculation,
    syncHrReviewPayFromEmployeeRows,
} from '../utils/vehicleShopHrReviewPay';

function formatAed(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `${n.toLocaleString()} AED`;
}

function employeeLabel(emp) {
    if (!emp || typeof emp !== 'object') return '—';
    const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
    return name || emp.employeeId || '—';
}

function buildQuoteRows(service, remark) {
    const rows = [];
    const add = (key, label, url, nameKey, amountKey) => {
        const urlVal = service?.[key === 'q1' ? 'attachment' : key === 'q2' ? 'quotation2' : 'quotation3'];
        const name =
            remark?.[nameKey] ||
            (key === 'q1' ? remark?.attachmentName : key === 'q2' ? remark?.quotation2Name : remark?.quotation3Name) ||
            '';
        const amount =
            key === 'q1'
                ? remark?.quotation1Amount ?? remark?.estimatedCost ?? service?.value
                : key === 'q2'
                  ? remark?.quotation2Amount
                  : remark?.quotation3Amount;
        if (urlVal || name) {
            rows.push({ key, label, url: urlVal, name, amount });
        }
    };
    add('q1', 'Quote 1', service?.attachment, 'attachmentName', 'quotation1Amount');
    add('q2', 'Quote 2', service?.quotation2, 'quotation2Name', 'quotation2Amount');
    add('q3', 'Quote 3', service?.quotation3, 'quotation3Name', 'quotation3Amount');
    return rows;
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
    const estimated = Number(remark?.estimatedCost ?? service?.value ?? 0);
    if (Number.isFinite(quoteAmt) && quoteAmt > 0) return quoteAmt;
    return estimated > 0 ? estimated : 0;
}

function buildReviewAmountsFromAssignment(remark, service, approvedRow) {
    const approvedAmount = resolveQuoteAmount(remark, service, approvedRow);
    const paymentByMode = remark?.paymentByMode || 'company';
    const companyPct = Number(remark?.companyPayPercent ?? 0);
    const employeePct = Number(remark?.employeePayPercent ?? 0);
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
        (remark?.hrReviewApprovedAmount != null && remark?.hrReviewApprovedAmount !== '') ||
        remark?.hrReviewCompanyPay != null ||
        remark?.hrReviewEmployeePay != null;
    if (!hasSaved) return assignmentBase;

    const rows =
        Array.isArray(remark?.hrReviewEmployeeRows) && remark.hrReviewEmployeeRows.length
            ? remark.hrReviewEmployeeRows.map((row) => ({
                  employeeId: String(row.employeeId || ''),
                  paidAmount: row.paidAmount != null ? String(row.paidAmount) : '',
              }))
            : Array.isArray(remark?.employeeLiabilityRows) && remark.employeeLiabilityRows.length
              ? remark.employeeLiabilityRows.map((row) => ({
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

export default function VehicleTireChangeQuoteApprovalCard({
    asset,
    service,
    vehicleId,
    serviceId,
    canActHr = false,
    canRespondToWorkflow = false,
    canManageTireChange = false,
    workflowStage = '',
    onUpdated,
    onReviewSummaryChange,
    className = '',
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [rowsSaving, setRowsSaving] = useState(false);
    const [rowsDirty, setRowsDirty] = useState(false);
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

    const remark = useMemo(() => parseVehicleServiceRemark(service) || {}, [service]);
    const assignmentPending = isOilServiceAssignmentPending(remark);
    const quoteRows = useMemo(() => buildQuoteRows(service, remark), [service, remark]);
    const paymentByMode = remark?.paymentByMode || 'company';
    const showCompanyPay = paymentByMode !== 'person';
    const showEmployeePay = paymentByMode !== 'company';

    const wf = asset?.activeServiceWorkflow || {};
    const wfMatch = normalizeMongoId(wf?.serviceRecordId) === normalizeMongoId(serviceId);
    const stage = String(workflowStage || (wfMatch ? String(wf?.stage || '').toLowerCase() : '')).toLowerCase();
    const canEdit = useMemo(
        () =>
            canEditTireChangeQuoteCard(assignmentPending, stage, {
                canActHr,
                canRespondToWorkflow,
            }),
        [assignmentPending, stage, canActHr, canRespondToWorkflow],
    );
    const canEditEmployeeRows = useMemo(
        () =>
            canEditTireChangeQuoteEmployeeRows(assignmentPending, stage, {
                canActHr,
                canManageTireChange,
                canRespondToWorkflow,
            }),
        [assignmentPending, stage, canActHr, canManageTireChange, canRespondToWorkflow],
    );
    // After HR approve, company/employee pay may still be adjusted (with employee rows).
    const canEditPaySplit = canEdit || canEditEmployeeRows;

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
        // Keep local edits while the user is adjusting pay / rows (page reloads must not snap back).
        if (rowsDirty) return;
        const fromAssignment = buildReviewAmountsFromAssignment(remark, service, approvedRow);
        const merged = mergeSavedHrReview(fromAssignment, remark);
        setDisplaySummary({
            approvedAmount: merged.approvedAmount,
            companyPay: merged.companyPay,
            employeePay: merged.employeePay,
        });
        setEmployeeRows(merged.employeeRows);
    }, [
        assignmentPending,
        rowsDirty,
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
            approvedQuoteKey: approvedQuoteKey || '',
        });
    }, [
        approvedQuoteKey,
        displaySummary.approvedAmount,
        displaySummary.companyPay,
        displaySummary.employeePay,
        onReviewSummaryChange,
    ]);

    const resolveEmployeeName = useCallback(
        (employeeId) => {
            const id = String(employeeId || '').trim();
            if (!id) return '—';
            const fromList = employees.find((emp) => String(emp._id) === id);
            if (fromList) return employeeLabel(fromList);
            const assignee = asset?.assignedTo;
            if (assignee && typeof assignee === 'object' && String(assignee._id) === id) {
                return employeeLabel(assignee);
            }
            return '—';
        },
        [asset?.assignedTo, employees],
    );

    const employeeOptions = useMemo(
        () =>
            employees.map((emp) => (
                <option key={emp._id} value={String(emp._id)}>
                    {employeeLabel(emp)}
                </option>
            )),
        [employees],
    );

    const applyApprovedAmountToSplit = useCallback(
        (rawAmount, prevRows) => {
            const amount = Number(rawAmount) || 0;
            const split = computePaySplit(
                amount,
                paymentByMode,
                remark?.companyPayPercent,
                remark?.employeePayPercent,
            );
            const nextRows =
                showEmployeePay && prevRows?.length
                    ? applyEmployeePayTargetToRows(
                          prevRows,
                          amount,
                          remark?.employeePayPercent,
                      )
                    : prevRows;
            return {
                approvedAmount: rawAmount,
                companyPay: String(split.companyPay),
                employeePay: String(split.employeePay),
                employeeRows: nextRows,
            };
        },
        [paymentByMode, remark?.companyPayPercent, remark?.employeePayPercent, showEmployeePay],
    );

    const setReviewField = (field, value) => {
        const synced = syncHrReviewPayCalculation({
            field,
            value,
            approvedAmount: displaySummary.approvedAmount,
            companyPay: displaySummary.companyPay,
            employeePay: displaySummary.employeePay,
            employeeRows,
            paymentByMode,
        });
        setDisplaySummary({
            approvedAmount: synced.approvedAmount,
            companyPay: synced.companyPay,
            employeePay: synced.employeePay,
        });
        if (showEmployeePay) {
            setEmployeeRows(synced.employeeRows);
        }
        setRowsDirty(true);
    };

    const setReviewApprovedAmount = (value) => {
        const synced = syncHrReviewPayCalculation({
            field: 'approvedAmount',
            value,
            approvedAmount: displaySummary.approvedAmount,
            companyPay: displaySummary.companyPay,
            employeePay: displaySummary.employeePay,
            employeeRows,
            paymentByMode,
        });
        setDisplaySummary({
            approvedAmount: synced.approvedAmount,
            companyPay: synced.companyPay,
            employeePay: synced.employeePay,
        });
        if (showEmployeePay) {
            setEmployeeRows(synced.employeeRows);
        }
        setRowsDirty(true);
    };

    const updateReviewEmployeeRow = (index, field, value) => {
        setEmployeeRows((prev) => {
            const rows = [...(prev || [])];
            rows[index] = { ...rows[index], [field]: value };
            if (field === 'paidAmount' && canEditPaySplit) {
                const synced = syncHrReviewPayFromEmployeeRows({
                    employeeRows: rows,
                    approvedAmount: displaySummary.approvedAmount,
                    paymentByMode,
                });
                setDisplaySummary({
                    approvedAmount: synced.approvedAmount,
                    companyPay: synced.companyPay,
                    employeePay: synced.employeePay,
                });
                return synced.employeeRows;
            }
            return rows;
        });
        setRowsDirty(true);
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
        const fallback = Number(remark?.estimatedCost ?? service?.value ?? 0);
        const amount = quoteAmount > 0 ? quoteAmount : fallback;
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

    const handleSaveEmployeeRows = async () => {
        if (!vehicleId || !serviceId || !canEditEmployeeRows) return;
        setRowsSaving(true);
        try {
            const { data } = await axiosInstance.put(
                `/AssetItem/${vehicleId}/service/${serviceId}/tire-change/quote-employees`,
                {
                    employeeRows: buildEmployeeRowsPayload(),
                    approvedAmount: Number(displaySummary.approvedAmount) || 0,
                    companyPay: Number(displaySummary.companyPay) || 0,
                    employeePay: Number(displaySummary.employeePay) || 0,
                },
            );
            toast({
                title: 'Pay amounts saved',
                description: 'Employee / company pay and Initiate Service amounts were updated.',
            });
            setRowsDirty(false);
            if (typeof onUpdated === 'function') onUpdated(data?.asset);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not save employee rows',
                description: error.response?.data?.message || 'Try again.',
            });
        } finally {
            setRowsSaving(false);
        }
    };

    const buildServiceUpdates = useCallback(() => {
        const selected = approvedQuoteKey;
        const approvedAmountNum = Number(displaySummary.approvedAmount) || 0;
        const employeeRowsPayload = buildEmployeeRowsPayload();
        const initiatePatch = buildHrReviewInitiateRemarkPatch({
            approvedAmount: displaySummary.approvedAmount,
            companyPay: displaySummary.companyPay,
            employeePay: displaySummary.employeePay,
            employeeRows: employeeRowsPayload,
            paymentByMode,
        });
        return {
            remark: JSON.stringify({
                ...remark,
                approvedQuotationChoice: selected || undefined,
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
        quoteState,
        remark,
    ]);

    const handleWorkflow = async (action) => {
        if (!vehicleId || !canEdit) return;
        if (action === 'approve') {
            if (!approvedQuoteKey || quoteState[approvedQuoteKey]?.status !== 'approved') {
                toast({
                    variant: 'destructive',
                    title: 'Quotation required',
                    description: 'Select Quote 1, Quote 2, or Quote 3 before continuing.',
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
            setRowsDirty(false);
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

    const { fieldMinHeightPx, gapClass } = TIRE_CHANGE_DETAIL_GRID_LAYOUT;
    const accent = tireAccent;
    const hrGate = resolveShopServiceCardGate({
        assignmentPending,
        workflowStage: String(workflowStage || '').toLowerCase(),
        service,
        cardKey: SHOP_SERVICE_CARD.HR,
    });

    return (
        <div className={`w-full ${className}`.trim()}>
            <VehicleServiceLockedSection locked={hrGate.locked} message={hrGate.message} className="h-full">
            <FineFormCard
                title="HR Approval"
                subtitle={
                    hrGate.locked
                        ? 'Locked until Initiate Service is sent'
                        : canEdit
                          ? 'Select one quotation, then approve once'
                          : canEditEmployeeRows
                            ? 'HR approved — employee rows may still be adjusted'
                            : hrGate.done
                              ? 'HR approved this quotation'
                              : 'Waiting for HR'
                }
                icon={ShieldCheck}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-700"
                className="h-full w-full"
            >
                {assignmentPending ? (
                    <p className="mb-4 text-sm text-gray-500">
                        Upload quotations in the assignment form above and click Send. This section will populate for HR
                        review after the request is submitted.
                    </p>
                ) : (
                    <p className="mb-4 text-sm text-gray-600">
                        Select one quote from Initiate. Only that quote continues to Accounts and later steps;
                        the other quotes are not used.
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
                                ? ` · AED ${Number(approvedRow.amount).toLocaleString()}`
                                : ''}
                            . Other quotes will not continue.
                        </p>
                    ) : null}
                </div>

                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gapClass}`}>
                    <VehicleTireChangeFormFieldCell
                        label="Approved Amount"
                        accentClass={accent(0)}
                        minHeightPx={fieldMinHeightPx}
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
                                      : '—'
                            }
                            onChange={(e) => setReviewApprovedAmount(e.target.value)}
                        />
                    </VehicleTireChangeFormFieldCell>
                    {showCompanyPay ? (
                        <VehicleTireChangeFormFieldCell
                            label="Company Pay"
                            accentClass={accent(1)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <input
                                className={canEditPaySplit ? tireMoneyInput : tireSummaryValue}
                                readOnly={!canEditPaySplit}
                                type={canEditPaySplit ? 'number' : 'text'}
                                min={canEditPaySplit ? '0' : undefined}
                                value={
                                    canEditPaySplit
                                        ? displaySummary.companyPay || ''
                                        : displaySummary.companyPay
                                          ? formatAed(displaySummary.companyPay)
                                          : '—'
                                }
                                onChange={(e) => setReviewField('companyPay', e.target.value)}
                            />
                        </VehicleTireChangeFormFieldCell>
                    ) : null}
                    {showEmployeePay ? (
                        <VehicleTireChangeFormFieldCell
                            label="Employee Pay"
                            accentClass={accent(2)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <input
                                className={canEditPaySplit ? tireMoneyInput : tireSummaryValue}
                                readOnly={!canEditPaySplit}
                                type={canEditPaySplit ? 'number' : 'text'}
                                min={canEditPaySplit ? '0' : undefined}
                                value={
                                    canEditPaySplit
                                        ? displaySummary.employeePay || ''
                                        : displaySummary.employeePay
                                          ? formatAed(displaySummary.employeePay)
                                          : '—'
                                }
                                onChange={(e) => setReviewField('employeePay', e.target.value)}
                            />
                        </VehicleTireChangeFormFieldCell>
                    ) : null}
                    {showEmployeePay ? (
                        <>
                            <VehicleTireChangeFormFieldCell
                                label="Employee Name"
                                accentClass={accent(0)}
                                minHeightPx={fieldMinHeightPx}
                            >
                                <div className="rounded-lg border border-gray-100 bg-white overflow-hidden">
                                    {(employeeRows || []).length ? (
                                        <ul className="divide-y divide-gray-100 text-sm">
                                            {(employeeRows || []).map((row, index) => (
                                                <li key={`emp-name-${index}`} className="p-2">
                                                    {canEditEmployeeRows ? (
                                                        <select
                                                            className={`${tireFieldSelect} min-h-[36px] py-1`}
                                                            value={row.employeeId || ''}
                                                            onChange={(e) =>
                                                                updateReviewEmployeeRow(
                                                                    index,
                                                                    'employeeId',
                                                                    e.target.value,
                                                                )
                                                            }
                                                            disabled={rowsSaving}
                                                        >
                                                            <option value="">Select employee</option>
                                                            {employeeOptions}
                                                        </select>
                                                    ) : (
                                                        <span className="block px-1 py-1 font-semibold text-gray-800">
                                                            {resolveEmployeeName(row.employeeId)}
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="px-3 py-2 text-sm text-gray-400">—</p>
                                    )}
                                </div>
                            </VehicleTireChangeFormFieldCell>
                            <VehicleTireChangeFormFieldCell
                                label="Paid Amount"
                                accentClass={accent(1)}
                                minHeightPx={fieldMinHeightPx}
                            >
                                <div className="rounded-lg border border-gray-100 bg-white overflow-hidden">
                                    {(employeeRows || []).length ? (
                                        <ul className="divide-y divide-gray-100 text-sm">
                                            {(employeeRows || []).map((row, index) => (
                                                <li key={`emp-amt-${index}`} className="p-2">
                                                    {canEditEmployeeRows ? (
                                                        <input
                                                            className={`${tireMoneyInput} min-h-[36px] py-1`}
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
                                                            disabled={rowsSaving}
                                                            placeholder="AED"
                                                        />
                                                    ) : (
                                                        <span className="block px-1 py-1 font-semibold text-gray-800">
                                                            {row.paidAmount
                                                                ? formatAed(row.paidAmount)
                                                                : '—'}
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="px-3 py-2 text-sm text-gray-400">—</p>
                                    )}
                                </div>
                            </VehicleTireChangeFormFieldCell>
                            {canEditEmployeeRows && !canEdit ? (
                                <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                                    <button
                                        type="button"
                                        disabled={rowsSaving || !rowsDirty}
                                        onClick={() => void handleSaveEmployeeRows()}
                                        className={tireBtnPrimary}
                                    >
                                        {rowsSaving ? 'Saving…' : 'Save employee rows'}
                                    </button>
                                </div>
                            ) : null}
                        </>
                    ) : null}
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
            </VehicleServiceLockedSection>
        </div>
    );
}
