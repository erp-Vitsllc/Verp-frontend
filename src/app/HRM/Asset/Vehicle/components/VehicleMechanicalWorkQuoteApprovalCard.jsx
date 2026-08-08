'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { openAttachmentInNewTab } from '@/utils/attachmentPreview';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import { parseVehicleServiceRemark, normalizeMongoId } from './vehicleServiceUtils';
import VehicleMechanicalWorkFormFieldCell from './VehicleMechanicalWorkFormFieldCell';
import VehicleCompanyPayPartySelect from './VehicleCompanyPayPartySelect';
import VehicleServiceLockedSection from './VehicleServiceLockedSection';
import { isOilServiceAssignmentPending } from '../utils/vehicleOilServiceAccess';
import { canEditMechanicalWorkQuoteCard, canEditMechanicalWorkQuoteEmployeeRows } from '../utils/vehicleMechanicalWorkWorkflow';
import {
    SHOP_SERVICE_CARD,
    resolveShopServiceCardGate,
} from '../utils/vehicleShopServiceCardGates';
import {
    MECHANICAL_WORK_DETAIL_GRID_LAYOUT,
    tireAccent,
    tireBtnDanger,
    tireBtnPrimary,
    tireMoneyInput,
} from '../utils/vehicleMechanicalWorkDetailUi';
import { quoteKeyToLabel } from '../utils/vehicleMechanicalWorkQuoteDrag';
import {
    buildHrReviewInitiateRemarkPatch,
    syncHrReviewPayCalculation,
} from '../utils/vehicleShopHrReviewPay';
import { sumEmployeeLiabilityRows } from '../utils/vehicleMechanicalWorkDetailForm';

function formatAed(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `${n.toLocaleString()} AED`;
}

function PaymentByToggle({ value, onChange, disabled }) {
    return (
        <div className="inline-flex w-full rounded-lg border border-gray-200 bg-gray-50 p-0.5">
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
                    className={`flex-1 rounded-md px-1 py-1.5 text-[10px] font-bold transition-all ${
                        value === opt.id
                            ? 'bg-white text-emerald-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                    } disabled:opacity-60`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
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
    const companyPay =
        remark?.companyPayAmount != null && remark.companyPayAmount !== ''
            ? Math.max(0, Number(remark.companyPayAmount) || 0)
            : split.companyPay;
    const employeePay =
        remark?.employeePayAmount != null && remark.employeePayAmount !== ''
            ? Math.max(0, Number(remark.employeePayAmount) || 0)
            : split.employeePay;

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
                  paidAmount: employeePay ? String(employeePay) : '0',
              },
          ];

    return {
        approvedAmount: approvedAmount ? String(approvedAmount) : '',
        companyPay: String(companyPay),
        employeePay: String(employeePay),
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

export default function VehicleMechanicalWorkQuoteApprovalCard({
    asset,
    service,
    vehicleId,
    serviceId,
    canActHr = false,
    canRespondToWorkflow = false,
    canManageMechanicalWork = false,
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
    const [companies, setCompanies] = useState([]);
    const [companyPayPartyId, setCompanyPayPartyId] = useState('');
    const [companyPayPartyName, setCompanyPayPartyName] = useState('');
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
    const [paymentByMode, setPaymentByMode] = useState(remark?.paymentByMode || 'company');
    const showCompanyPay = paymentByMode !== 'person';
    const showEmployeePay = paymentByMode !== 'company';

    const wf = asset?.activeServiceWorkflow || {};
    const wfMatch = normalizeMongoId(wf?.serviceRecordId) === normalizeMongoId(serviceId);
    const stage = String(workflowStage || (wfMatch ? String(wf?.stage || '').toLowerCase() : '')).toLowerCase();
    const canEdit = useMemo(
        () =>
            canEditMechanicalWorkQuoteCard(assignmentPending, stage, {
                canActHr,
                canRespondToWorkflow,
            }),
        [assignmentPending, stage, canActHr, canRespondToWorkflow],
    );
    const canEditEmployeeRows = false;
    // Payment split is set on Initiate — HR/Accounts approval cards are view-only for pay.
    const canEditPaySplit = false;

    useEffect(() => {
        let active = true;
        Promise.all([axiosInstance.get('/employee'), axiosInstance.get('/Company')])
            .then(([empRes, companyRes]) => {
                if (!active) return;
                const list = Array.isArray(empRes.data) ? empRes.data : empRes.data?.employees || [];
                setEmployees(list);
                setCompanies(companyRes.data?.companies || companyRes.data || []);
            })
            .catch(() => {
                if (active) {
                    setEmployees([]);
                    setCompanies([]);
                }
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
        if (modeRaw === 'person' || modeRaw === 'company' || modeRaw === 'split') {
            setPaymentByMode(modeRaw);
        } else {
            setPaymentByMode('company');
        }
        setCompanyPayPartyId(String(remark?.companyPayPartyId || '').trim());
        setCompanyPayPartyName(String(remark?.companyPayPartyName || remark?.companyName || '').trim());
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
            paymentByMode: paymentByMode || 'company',
            approvedQuoteKey: approvedQuoteKey || '',
        });
    }, [
        approvedQuoteKey,
        displaySummary.approvedAmount,
        displaySummary.companyPay,
        displaySummary.employeePay,
        paymentByMode,
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

    const employeeOptionsForRow = useCallback(
        (rowIndex) => {
            const selectedElsewhere = new Set(
                (employeeRows || [])
                    .map((row, idx) =>
                        idx === rowIndex ? '' : String(row?.employeeId || '').trim(),
                    )
                    .filter(Boolean),
            );
            return employees
                .filter((emp) => {
                    const id = String(emp._id || '');
                    if (!id) return false;
                    if (selectedElsewhere.has(id)) return false;
                    return true;
                })
                .map((emp) => (
                    <option key={emp._id} value={String(emp._id)}>
                        {employeeLabel(emp)}
                    </option>
                ));
        },
        [employeeRows, employees],
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
        setRowsDirty(true);
    };

    const handlePaymentByModeChange = (mode) => {
        const nextMode = mode || 'company';
        setPaymentByMode(nextMode);
        const amount = Number(displaySummary.approvedAmount) || 0;
        const split = computePaySplit(amount, nextMode, 50, 50);
        setDisplaySummary((prev) => ({
            ...prev,
            companyPay: String(split.companyPay),
            employeePay: String(split.employeePay),
        }));
        if (
            (nextMode === 'person' || nextMode === 'split') &&
            !(employeeRows || []).length
        ) {
            setEmployeeRows([{ employeeId: '', paidAmount: '0' }]);
        }
        setRowsDirty(true);
    };

    const updateReviewEmployeeRow = (index, field, value) => {
        setEmployeeRows((prev) => {
            const rows = [...(prev || [])];
            rows[index] = { ...rows[index], [field]: value };
            return rows;
        });
        setRowsDirty(true);
    };

    const addReviewEmployeeRow = () => {
        setEmployeeRows((prev) => [...(prev || []), { employeeId: '', paidAmount: '0' }]);
        setRowsDirty(true);
    };

    const removeReviewEmployeeRow = (index) => {
        setEmployeeRows((prev) => {
            const rows = [...(prev || [])];
            if (rows.length <= 1) return rows;
            rows.splice(index, 1);
            return rows;
        });
        setRowsDirty(true);
    };

    const employeeLiabilitySum = sumEmployeeLiabilityRows(employeeRows);
    const estimatedCostNum = Number(displaySummary.approvedAmount) || 0;
    const companyPayNum = Number(displaySummary.companyPay) || 0;
    const employeePayNum = Number(displaySummary.employeePay) || 0;
    const paySplitError =
        paymentByMode === 'split' &&
        estimatedCostNum > 0 &&
        Math.abs(companyPayNum + employeePayNum - estimatedCostNum) > 0.01;
    const employeeRowsError =
        showEmployeePay && Math.abs(employeeLiabilitySum - employeePayNum) > 0.01;
    const payValidationMessage = useMemo(() => {
        if (paySplitError) {
            return `Company pay + Employee pay must equal Total (${estimatedCostNum.toLocaleString()} AED)`;
        }
        if (employeeRowsError) {
            return `Employee amounts must total Employee pay (${employeePayNum.toLocaleString()} AED)`;
        }
        if (paymentByMode === 'person' && estimatedCostNum > 0 && Math.abs(employeePayNum - estimatedCostNum) > 0.01) {
            return `Employee pay must equal Estimated cost (${estimatedCostNum.toLocaleString()} AED)`;
        }
        if (paymentByMode === 'company' && estimatedCostNum > 0 && Math.abs(companyPayNum - estimatedCostNum) > 0.01) {
            return `Company pay must equal Estimated cost (${estimatedCostNum.toLocaleString()} AED)`;
        }
        if (showCompanyPay && companyPayNum > 0 && !companyPayPartyName && !companyPayPartyId) {
            return 'Select company under Company payment';
        }
        return '';
    }, [
        paySplitError,
        employeeRowsError,
        paymentByMode,
        estimatedCostNum,
        employeePayNum,
        companyPayNum,
        showCompanyPay,
        companyPayPartyName,
        companyPayPartyId,
    ]);

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
            (employeeRows || []).map((row) => {
                const employeeId = row.employeeId;
                const name = resolveEmployeeName(employeeId);
                return {
                    employeeId,
                    paidAmount: Number(row.paidAmount) || 0,
                    ...(name && name !== '-' ? { employeeName: name } : {}),
                };
            }),
        [employeeRows, resolveEmployeeName],
    );

    const handleSaveEmployeeRows = async () => {
        if (!vehicleId || !serviceId || !canEditEmployeeRows) return;
        if (payValidationMessage) {
            toast({
                variant: 'destructive',
                title: 'Payment amounts invalid',
                description: payValidationMessage,
            });
            return;
        }
        setRowsSaving(true);
        try {
            const { data } = await axiosInstance.put(
                `/AssetItem/${vehicleId}/service/${serviceId}/mechanical-work/quote-employees`,
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
            companyPayPartyId: companyPayPartyId || String(remark?.companyPayPartyId || '').trim() || undefined,
            companyPayPartyName:
                companyPayPartyName ||
                String(remark?.companyPayPartyName || remark?.companyName || '').trim() ||
                undefined,
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
        companyPayPartyId,
        companyPayPartyName,
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
                    description: 'Select a quote before continuing.',
                });
                return;
            }
            if (payValidationMessage) {
                toast({
                    variant: 'destructive',
                    title: 'Payment amounts invalid',
                    description: payValidationMessage,
                });
                return;
            }
            if (showEmployeePay) {
                const missingName = (employeeRows || []).some(
                    (row) => !String(row.employeeId || '').trim(),
                );
                if (missingName) {
                    toast({
                        variant: 'destructive',
                        title: 'Employee required',
                        description: 'Select an employee on every employee payment row.',
                    });
                    return;
                }
                const seen = new Set();
                for (const row of employeeRows || []) {
                    const id = String(row.employeeId || '').trim();
                    if (!id) continue;
                    if (seen.has(id)) {
                        toast({
                            variant: 'destructive',
                            title: 'Duplicate employee',
                            description: 'Each employee can only be selected once.',
                        });
                        return;
                    }
                    seen.add(id);
                }
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

    const { fieldMinHeightPx, gapClass } = MECHANICAL_WORK_DETAIL_GRID_LAYOUT;
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

                {(showCompanyPay || showEmployeePay || estimatedCostNum > 0) ? (
                <div className="mt-4 w-full rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                        {showCompanyPay ? (
                            <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-bold uppercase tracking-wide text-gray-500">
                                    Company payment
                                </span>
                                <span className="text-xl font-bold tabular-nums text-gray-900">
                                    {companyPayNum.toLocaleString()}{' '}
                                    <span className="text-sm font-bold text-gray-500">AED</span>
                                </span>
                            </div>
                            {canEdit && companyPayNum > 0 ? (
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                        <VehicleCompanyPayPartySelect
                                            companies={companies}
                                            value={companyPayPartyId}
                                            error={
                                                companyPayNum > 0 &&
                                                !companyPayPartyName &&
                                                !companyPayPartyId
                                            }
                                            onChange={({
                                                companyPayPartyId: id,
                                                companyPayPartyName: name,
                                            }) => {
                                                setCompanyPayPartyId(id);
                                                setCompanyPayPartyName(name);
                                            }}
                                        />
                                    </div>
                                </div>
                            ) : companyPayPartyName ? (
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-semibold text-gray-800">
                                        {companyPayPartyName}
                                    </span>
                                </div>
                            ) : null}
                            </div>
                        ) : null}
                    {showEmployeePay ? (
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-bold uppercase tracking-wide text-gray-500">
                                    Employee payment
                                </span>
                                <span className="text-xl font-bold tabular-nums text-gray-900">
                                    {employeePayNum.toLocaleString()}{' '}
                                    <span className="text-sm font-bold text-gray-500">AED</span>
                                </span>
                            </div>
                            {(employeeRows || []).map((row, index) => {
                                const paid = Number(row?.paidAmount) || 0;
                                if (!String(row?.employeeId || '').trim() && !(paid > 0)) {
                                    return null;
                                }
                                return (
                                    <div
                                        key={`emp-row-${index}`}
                                        className="flex items-center justify-between gap-3"
                                    >
                                        <span className="text-sm font-semibold text-gray-800">
                                            {resolveEmployeeName(row.employeeId)}
                                        </span>
                                        <span className="text-base font-semibold tabular-nums text-gray-900">
                                            AED {paid.toLocaleString()}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                        <span className="text-sm font-bold uppercase tracking-wide text-gray-500">
                            Total amount
                        </span>
                        <span className="text-2xl font-bold tabular-nums text-gray-900">
                            {estimatedCostNum.toLocaleString()}{' '}
                            <span className="text-sm font-bold text-gray-500">AED</span>
                        </span>
                    </div>
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
            </VehicleServiceLockedSection>
        </div>
    );
}
