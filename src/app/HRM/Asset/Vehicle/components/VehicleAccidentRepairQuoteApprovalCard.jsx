'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileCheck, GripVertical } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { openAttachmentInNewTab } from '@/utils/attachmentPreview';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import { parseVehicleServiceRemark, normalizeMongoId } from './vehicleServiceUtils';
import VehicleAccidentRepairFormFieldCell from './VehicleAccidentRepairFormFieldCell';
import { isOilServiceAssignmentPending } from '../utils/vehicleOilServiceAccess';
import { canEditAccidentRepairQuoteCard, canEditAccidentRepairQuoteEmployeeRows } from '../utils/vehicleAccidentRepairWorkflow';
import {
    ACCIDENT_REPAIR_DETAIL_GRID_LAYOUT,
    tireAccent,
    tireBtnDanger,
    tireBtnPrimary,
    tireFieldSelect,
    tireMoneyInput,
    tireSummaryValue,
    tireViewBtn,
} from '../utils/vehicleAccidentRepairDetailUi';
import { applyEmployeePayTargetToRows } from '../utils/vehicleAccidentRepairDetailForm';
import {
    buildTireQuoteDragPayload,
    parseTireQuoteDragPayload,
    quoteKeyToLabel,
    TIRE_QUOTE_DRAG_TYPE,
} from '../utils/vehicleAccidentRepairQuoteDrag';

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
    const push = (key, label, url, name) => {
        if (url || name) {
            rows.push({ key, label, url: url || '', name: name || '', amount: '' });
        }
    };

    push(
        'q1',
        'Police Report',
        service?.attachment,
        remark?.policeReportName || remark?.attachmentName || remark?.remarkAttachmentName,
    );
    push(
        'q2',
        'Police Fine Document',
        service?.quotation3,
        remark?.insuranceFineCopyName || remark?.quotation3Name,
    );
    push('q3', 'Other Document', service?.tireCondition, remark?.tireConditionName);

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
    className = '',
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [rowsSaving, setRowsSaving] = useState(false);
    const [rowsDirty, setRowsDirty] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
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
            canEditAccidentRepairQuoteCard(assignmentPending, stage, {
                canActHr,
                canRespondToWorkflow,
            }),
        [assignmentPending, stage, canActHr, canRespondToWorkflow],
    );
    const canEditEmployeeRows = useMemo(
        () =>
            canEditAccidentRepairQuoteEmployeeRows(assignmentPending, stage, {
                canActHr,
                canManageAccidentRepair,
                canRespondToWorkflow,
            }),
        [assignmentPending, stage, canActHr, canManageAccidentRepair, canRespondToWorkflow],
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
        const fromAssignment = buildReviewAmountsFromAssignment(remark, service, approvedRow);
        const merged = mergeSavedHrReview(fromAssignment, remark);
        setDisplaySummary({
            approvedAmount: merged.approvedAmount,
            companyPay: merged.companyPay,
            employeePay: merged.employeePay,
        });
        setEmployeeRows(merged.employeeRows);
        setRowsDirty(false);
    }, [
        assignmentPending,
        service?._id,
        service?.value,
        service?.remark,
        remark,
        approvedRow?.key,
        approvedRow?.amount,
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
        setDisplaySummary((prev) => ({ ...prev, [field]: value }));
    };

    const setReviewApprovedAmount = (value) => {
        const split = applyApprovedAmountToSplit(value, employeeRows);
        setDisplaySummary({
            approvedAmount: split.approvedAmount,
            companyPay: split.companyPay,
            employeePay: split.employeePay,
        });
        if (showEmployeePay && split.employeeRows) {
            setEmployeeRows(split.employeeRows);
        }
    };

    const updateReviewEmployeeRow = (index, field, value) => {
        setEmployeeRows((prev) => {
            const rows = [...(prev || [])];
            rows[index] = { ...rows[index], [field]: value };
            return rows;
        });
        if (!canEdit) {
            setRowsDirty(true);
        }
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

    const handleDragOver = (event) => {
        if (!canEdit || assignmentPending) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (event) => {
        event.preventDefault();
        setIsDragOver(false);
        if (!canEdit || assignmentPending) return;

        const payload = parseTireQuoteDragPayload(event.dataTransfer);
        if (!payload?.key) return;

        const row = quoteRows.find((r) => r.key === payload.key);
        if (!row) {
            toast({
                variant: 'destructive',
                title: 'Quote not available',
                description: `${payload.label} must be uploaded in the assignment form first.`,
            });
            return;
        }

        setQuoteStatus(payload.key, 'approved');
        const dragAmount = Number(payload.amount);
        const fineTotal = resolveAccidentFineTotal(remark);
        const fallback = Number(remark?.estimatedCost ?? service?.value ?? 0);
        const amount = dragAmount > 0 ? dragAmount : fineTotal > 0 ? fineTotal : fallback;
        if (amount > 0) {
            setReviewApprovedAmount(String(amount));
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
                `/AssetItem/${vehicleId}/service/${serviceId}/accident-repair/quote-employees`,
                { employeeRows: buildEmployeeRowsPayload() },
            );
            toast({
                title: 'Employee rows saved',
                description: 'Paid amounts were updated without changing the approved quote totals.',
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
        return {
            remark: JSON.stringify({
                ...remark,
                approvedQuotationChoice: selected || undefined,
                tireQuoteReview: quoteState,
                hrReviewDescription: description.trim() || undefined,
                quoteReviewDescription: description.trim() || undefined,
                hrReviewApprovedAmount: approvedAmountNum || undefined,
                hrReviewCompanyPay: Number(displaySummary.companyPay) || 0,
                hrReviewEmployeePay: Number(displaySummary.employeePay) || 0,
                hrReviewEmployeeRows: employeeRowsPayload,
                employeeLiabilityRows: employeeRowsPayload,
                employeeLiabilityTotal: employeeRowsPayload.reduce(
                    (sum, row) => sum + (Number(row.paidAmount) || 0),
                    0,
                ),
                estimatedCost: approvedAmountNum || remark?.estimatedCost,
            }),
            ...(selected ? { vendorName: remark?.vendorName || '' } : {}),
            ...(approvedAmountNum > 0 ? { value: approvedAmountNum } : {}),
        };
    }, [
        approvedQuoteKey,
        buildEmployeeRowsPayload,
        description,
        displaySummary,
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
                    description: 'Drag a quote into Approved Quote and mark it Approved before continuing.',
                });
                return;
            }
            if (!String(description || '').trim()) {
                toast({
                    variant: 'destructive',
                    title: 'Description required',
                    description: 'Enter a description before approval.',
                });
                return;
            }
        }
        setLoading(true);
        try {
            const payload = {
                action,
                comment: String(description || '').trim() || undefined,
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
                title="Quotation Review"
                subtitle={
                    assignmentPending
                        ? 'Available after the assignment is sent'
                        : canEdit
                          ? 'Drag a document from Vehicle Accident Form into Approved Quote, then approve'
                          : 'Submitted quotation review — view only'
                }
                icon={FileCheck}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
                className="w-full"
            >
                {assignmentPending ? (
                    <p className="mb-4 text-sm text-gray-500">
                        Upload quotations in the assignment form above and click Send. This section will populate for HR
                        review after the request is submitted.
                    </p>
                ) : null}

                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`mb-4 rounded-xl border-2 border-dashed p-4 transition-colors ${
                        isDragOver
                            ? 'border-emerald-400 bg-emerald-50/80'
                            : approvedRow
                              ? 'border-emerald-200 bg-white'
                              : 'border-gray-200 bg-gray-50/70'
                    }`}
                >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Approved Quote</p>

                    {!approvedRow ? (
                        <div className="mt-3 flex min-h-[120px] flex-col items-center justify-center rounded-lg border border-gray-100 bg-white/80 px-4 py-6 text-center">
                            <GripVertical size={22} className="mb-2 text-gray-300" />
                            <p className="text-sm font-semibold text-gray-600">
                                Drag Police Report, Police Fine Document, or Other Document here
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                                From Vehicle Accident Form above
                            </p>
                        </div>
                    ) : (
                        <div className="mt-3 space-y-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-bold text-gray-800">
                                    {approvedRow.label || quoteKeyToLabel(approvedQuoteKey)}
                                    {approvedRow.name ? (
                                        <span className="ml-2 text-xs font-medium text-gray-500">
                                            ({approvedRow.name})
                                        </span>
                                    ) : null}
                                </p>
                                {approvedRow?.amount != null && approvedRow.amount !== '' ? (
                                    <p className="text-[11px] font-semibold text-emerald-700">
                                        Amount: {formatAed(approvedRow.amount)}
                                    </p>
                                ) : null}
                            </div>
                            <button
                                type="button"
                                disabled={!approvedRow?.url}
                                onClick={() => void handleViewFile(approvedRow)}
                                className={`${tireViewBtn} w-full justify-center min-h-[36px]`}
                            >
                                View File
                            </button>
                            <div className="inline-flex w-full rounded-lg border border-gray-200 bg-gray-50 p-0.5 min-h-[36px]">
                                <button
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => setQuoteStatus(approvedQuoteKey, 'approved')}
                                    className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-bold transition-all ${
                                        quoteState[approvedQuoteKey]?.status === 'approved'
                                            ? 'bg-white text-emerald-600 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                    } disabled:opacity-50`}
                                >
                                    Approved
                                </button>
                                <button
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => setQuoteStatus(approvedQuoteKey, 'rejected')}
                                    className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-bold transition-all ${
                                        quoteState[approvedQuoteKey]?.status === 'rejected'
                                            ? 'bg-white text-orange-600 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                    } disabled:opacity-50`}
                                >
                                    Rejected
                                </button>
                            </div>
                            <input
                                type="text"
                                className={tireFieldSelect}
                                value={quoteState[approvedQuoteKey]?.comment || ''}
                                onChange={(e) => setQuoteField(approvedQuoteKey, 'comment', e.target.value)}
                                disabled={!canEdit}
                                placeholder="Comment"
                            />
                            {canEdit ? (
                                <p className="text-[10px] text-gray-400">
                                    Drag another quote from the assignment card to replace this selection.
                                </p>
                            ) : null}
                        </div>
                    )}
                </div>

                <div className={`grid grid-cols-1 sm:grid-cols-2 ${gapClass}`}>
                    <VehicleAccidentRepairFormFieldCell
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
                    </VehicleAccidentRepairFormFieldCell>
                    <VehicleAccidentRepairFormFieldCell
                        label="Company Pay"
                        accentClass={accent(1)}
                        minHeightPx={fieldMinHeightPx}
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
                </div>

                <div className="mt-4 border-t border-gray-100 pt-4">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Description
                    </span>
                    <textarea
                        className={`${tireFieldSelect} mt-1.5 resize-y min-h-[88px] font-medium`}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={!canEdit}
                        placeholder="Enter review notes..."
                        rows={3}
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
