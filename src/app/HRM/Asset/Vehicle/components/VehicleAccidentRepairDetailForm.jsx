'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Loader2, Plus, Upload } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    extractStorageReference,
    loadStorageFileBlob,
    openAttachmentInNewTab,
} from '@/utils/attachmentPreview';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import { DatePicker } from '@/components/ui/date-picker';
import VehicleAccidentRepairFormFieldCell from './VehicleAccidentRepairFormFieldCell';
import VehicleCarDrivenBySelect from './VehicleCarDrivenBySelect';
import SearchableEmployeeSelect from './SearchableEmployeeSelect';
import VehicleCompanyPayPartySelect from './VehicleCompanyPayPartySelect';
import VehicleHandoverAssessmentPhotoViewer from './VehicleHandoverAssessmentPhotoViewer';
import { numberInputNoScrollProps } from '../utils/vehicleNumberInput';
import { getInitiatePayValidationMessage, companyPayPartyLabel } from '../utils/vehicleInitiatePayValidation';
import { formatDisplayDate } from './VehicleAccidentRepairForm';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import { formatVehicleServiceReqNo } from '../utils/vehicleServiceReqNo';
import { useDrivingLicenseHolders } from '@/hooks/useDrivingLicenseHolders';
import {
    isOilServiceAssignmentPending,
} from '../utils/vehicleOilServiceAccess';
import {
    resolveFlowchartAdminEmployeeRef,
    resolveVehicleServiceAssignedOwnerId,
} from '../utils/vehicleServiceAssignedOwner';
import {
    buildAccidentRepairDetailFormState,
    buildAccidentRepairDetailSubmitBody,
    getAccidentRepairDetailFormMissingFields,
    isAccidentRepairDetailFormComplete,
    validateAccidentRepairDetailForm,
    applyEmployeePayTargetToRows,
    sumEmployeeLiabilityRows,
    sumOtherFineRows,
} from '../utils/vehicleAccidentRepairDetailForm';
import { resolveShopServicePayAmounts, syncInitiateServicePayAmounts, resolveInitiateAbsolutePayAmounts } from '../utils/vehicleShopHrReviewPay';
import {
    ACCIDENT_REPAIR_DETAIL_GRID_LAYOUT,
    tireAccent,
    tireBtnPrimary,
    tireBtnSecondary,
    tireDatePickerClass,
    tireFieldInput,
    tireFieldSelect,
    tireMoneyInput,
    tirePhotoAddBtn,
    tirePhotoThumb,
    tireUploadBtn,
    tireViewBtn,
} from '../utils/vehicleAccidentRepairDetailUi';
import { applyCarDrivenBySelection } from '../utils/vehicleCarDrivenBySelect';
import {
    ERP_JPEG_ACCEPT,
    ERP_PDF_ACCEPT,
    filterErpUploadFiles,
    validateErpJpegFile,
    validateErpPdfFile,
} from '@/utils/uploadFileTypes';
const GARAGE_QUOTE_SLOTS = [
    {
        key: 'q1',
        label: 'Quote 1',
        kind: 'garageQuote1',
        name: 'garageQuote1Name',
        existing: 'existingGarageQuote1Url',
        amount: 'garageQuote1Amount',
        base64: 'garageQuote1Base64',
        mime: 'garageQuote1Mime',
    },
    {
        key: 'q2',
        label: 'Quote 2',
        kind: 'garageQuote2',
        name: 'garageQuote2Name',
        existing: 'existingGarageQuote2Url',
        amount: 'garageQuote2Amount',
        base64: 'garageQuote2Base64',
        mime: 'garageQuote2Mime',
    },
    {
        key: 'q3',
        label: 'Quote 3',
        kind: 'garageQuote3',
        name: 'garageQuote3Name',
        existing: 'existingGarageQuote3Url',
        amount: 'garageQuote3Amount',
        base64: 'garageQuote3Base64',
        mime: 'garageQuote3Mime',
    },
];

function countVisibleGarageQuotes(data = {}) {
    let count = 0;
    for (let i = 0; i < GARAGE_QUOTE_SLOTS.length; i += 1) {
        const slot = GARAGE_QUOTE_SLOTS[i];
        const hasFile = String(data[slot.name] || '').trim() || String(data[slot.existing] || '').trim();
        const hasAmount = String(data[slot.amount] || '').trim() !== '';
        if (hasFile || hasAmount) count = i + 1;
    }
    return count;
}

const ASSET_CONTROLLER_VALUE = '__asset_controller__';
const PDF_ATTACHMENT_KINDS = new Set(['attachment', 'quotation2', 'quotation3']);
const JPEG_ATTACHMENT_KINDS = new Set(['tireCondition']);
const GARAGE_QUOTE_KIND_FIELDS = {
    garageQuote1: {
        name: 'garageQuote1Name',
        base64: 'garageQuote1Base64',
        mime: 'garageQuote1Mime',
        existing: 'existingGarageQuote1Url',
        amount: 'garageQuote1Amount',
    },
    garageQuote2: {
        name: 'garageQuote2Name',
        base64: 'garageQuote2Base64',
        mime: 'garageQuote2Mime',
        existing: 'existingGarageQuote2Url',
        amount: 'garageQuote2Amount',
    },
    garageQuote3: {
        name: 'garageQuote3Name',
        base64: 'garageQuote3Base64',
        mime: 'garageQuote3Mime',
        existing: 'existingGarageQuote3Url',
        amount: 'garageQuote3Amount',
    },
};

function normalizeControllerEmployeeId(rawId) {
    const id = String(rawId || '').trim();
    if (!id) return '';
    if (id.startsWith('flowchart_')) return id.replace(/^flowchart_/, '').trim();
    return id;
}

function formatShortDate(isoOrDate) {
    if (!isoOrDate) return '—';
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
}

function directAccidentImageSrc(img) {
    const url = String(img?.url || img?.data || '').trim();
    if (!url) return '';
    // Only inline/blob URLs in <img>. Wasabi signed URLs fail on many office networks (DNS).
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    return '';
}

function AccidentPartyToggle({ value, onChange, disabled }) {
    return (
        <div className="inline-flex w-full rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {[
                { id: 'self', label: 'SELF' },
                { id: 'thirdParty', label: 'OTHER PARTY DAMAGE' },
            ].map((opt) => (
                <button
                    key={opt.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(opt.id)}
                    className={`flex-1 rounded-md px-1 py-1.5 text-[10px] font-bold transition-all ${
                        value === opt.id
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                    } disabled:opacity-60`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
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
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                    } disabled:opacity-60`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function AutoFillField({ value, placeholder = 'Auto Fill' }) {
    const display = value != null && String(value).trim() !== '' ? String(value) : '';
    return (
        <input
            type="text"
            readOnly
            value={display}
            placeholder={placeholder}
            className={`${tireFieldInput} text-gray-900 font-semibold placeholder:text-gray-400`}
        />
    );
}

export default function VehicleAccidentRepairDetailForm({
    asset,
    service,
    vehicleId,
    serviceId,
    onSaved,
    draftSubmitRef,
    onDraftStateChange,
    canEditAssignment = true,
    workflowStage = '',
    flowchartRows = [],
    liveHrReview = null,
    className = '',
}) {
    const router = useRouter();
    const { toast } = useToast();
    const photoInputRef = useRef(null);
    const [employees, setEmployees] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [saving, setSaving] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerStartIndex, setViewerStartIndex] = useState(0);
    const [resolvedExistingPhotoSrc, setResolvedExistingPhotoSrc] = useState({});
    const [formData, setFormData] = useState(() =>
        buildAccidentRepairDetailFormState(service, asset, { flowchartRows }),
    );
    const [visibleQuoteCount, setVisibleQuoteCount] = useState(() =>
        countVisibleGarageQuotes(
            buildAccidentRepairDetailFormState(service, asset, { flowchartRows }),
        ),
    );

    const remark = useMemo(() => parseVehicleServiceRemark(service) || {}, [service]);
    const assignmentPending = isOilServiceAssignmentPending(remark);
    // Page gates HR-after-submit; Initiate stays editable until Zoho bill is accepted.
    const canEditInitiateFields = Boolean(canEditAssignment);
    const fieldsDisabled = !canEditInitiateFields || saving;

    const assetController = asset?.assetController || null;
    const assetControllerId = asset?.assetControllerId || null;
    const resolvedAssetControllerEmployeeId = normalizeControllerEmployeeId(
        assetController?._id || assetController?.id || assetController?.employeeId || assetControllerId,
    );

    const adminOfficerRef = resolveFlowchartAdminEmployeeRef(flowchartRows);

    const assetControllerName = useMemo(() => {
        const toLabel = (emp) => {
            if (!emp) return '';
            if (typeof emp === 'string') return emp.trim();
            const nm = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
            return nm || emp.employeeName || emp.name || emp.employeeId || '';
        };

        const direct = toLabel(assetController);
        if (direct) return direct;

        const lookupId = resolvedAssetControllerEmployeeId || String(assetControllerId || '').trim();
        if (lookupId) {
            const byId = (employees || []).find((emp) => String(emp?._id || emp?.id || '') === lookupId);
            const byEmpCode = (employees || []).find((emp) => String(emp?.employeeId || '') === lookupId);
            const label = toLabel(byId || byEmpCode);
            if (label) return label;
        }

        const byRole = (employees || []).find((emp) => {
            const department = String(emp?.department || '').toLowerCase();
            const designation = String(emp?.designation || '').toLowerCase();
            const role = String(emp?.role || '').toLowerCase();
            return (
                department.includes('asset controller') ||
                designation.includes('asset controller') ||
                role.includes('asset controller')
            );
        });
        return toLabel(byRole) || 'Asset Controller';
    }, [assetController, assetControllerId, employees, resolvedAssetControllerEmployeeId]);

    const hasResolvedControllerInEmployees = useMemo(() => {
        const target = String(resolvedAssetControllerEmployeeId || '').trim();
        if (!target) return false;
        return (employees || []).some(
            (emp) =>
                String(emp?._id || emp?.id || '') === target ||
                String(emp?.employeeId || '') === target,
        );
    }, [employees, resolvedAssetControllerEmployeeId]);

    useEffect(() => {
        const next = buildAccidentRepairDetailFormState(service, asset, { flowchartRows });
        setFormData(next);
        setVisibleQuoteCount(countVisibleGarageQuotes(next));
    }, [service?._id, service?.updatedAt, service?.remark, asset, flowchartRows]);

    useEffect(() => {
        if (!assignmentPending) return;
        const saved = String(remark.vehicleOwnerEmployeeId || '').trim();
        if (saved && saved !== ASSET_CONTROLLER_VALUE) return;
        const nextId = resolveVehicleServiceAssignedOwnerId(asset, flowchartRows, '');
        if (!nextId) return;
        setFormData((prev) => {
            const cur = String(prev.vehicleOwnerEmployeeId || '').trim();
            if (cur && cur !== ASSET_CONTROLLER_VALUE) return prev;
            return { ...prev, vehicleOwnerEmployeeId: nextId };
        });
    }, [assignmentPending, asset, flowchartRows, remark.vehicleOwnerEmployeeId]);

    useEffect(() => {
        const existing = formData.existingAccidentImages || [];
        if (!existing.length) {
            setResolvedExistingPhotoSrc({});
            return undefined;
        }

        let cancelled = false;
        const objectUrls = [];

        (async () => {
            const next = {};
            for (let idx = 0; idx < existing.length; idx += 1) {
                const img = existing[idx];
                const direct = directAccidentImageSrc(img);
                const key = `existing-${idx}`;
                if (direct) {
                    next[key] = direct;
                    continue;
                }
                const storageKey = extractStorageReference(img)?.key;
                if (!storageKey) continue;
                try {
                    const blob = await loadStorageFileBlob(storageKey);
                    const objectUrl = URL.createObjectURL(blob);
                    objectUrls.push(objectUrl);
                    next[key] = objectUrl;
                } catch {
                    /* storage key could not be loaded */
                }
            }
            if (!cancelled) {
                setResolvedExistingPhotoSrc(next);
            } else {
                objectUrls.forEach((url) => URL.revokeObjectURL(url));
            }
        })();

        return () => {
            cancelled = true;
            objectUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [formData.existingAccidentImages]);

    useEffect(() => {
        let active = true;
        Promise.all([
            axiosInstance.get('/employee'),
            axiosInstance.get('/Company'),
        ])
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

    const licensedEmployees = useDrivingLicenseHolders({
        preserveEmployeeId: formData.carDrivenByEmployeeId,
        sourceEmployees: employees,
    });

    useEffect(() => {
        if (!asset?.documents) return;
        const insDocs = asset.documents.filter((d) => d.type === 'Insurance');
        if (!insDocs.length) return;
        insDocs.sort((a, b) => new Date(b.issueDate || b.createdAt) - new Date(a.issueDate || a.createdAt));
        const doc = insDocs[0];
        let parsed = {};
        try {
            parsed = doc.description ? JSON.parse(doc.description) : {};
        } catch {
            parsed = {};
        }
        setFormData((prev) => {
            const next = { ...prev };
            if (!prev.insuranceCompany) next.insuranceCompany = parsed.company || doc.issueAuthority || '';
            if (!prev.policyNumber) next.policyNumber = parsed.policy || '';
            if (!prev.insuranceExpiryDate && doc.expiryDate) {
                next.insuranceExpiryDate = new Date(doc.expiryDate).toISOString().slice(0, 10);
            }
            if (
                prev.accidentOwnerType !== 'thirdParty' &&
                prev.insuranceFineAmount === '' &&
                parsed.excessCharge != null
            ) {
                next.insuranceFineAmount = String(parsed.excessCharge);
            }
            return next;
        });
    }, [asset?._id, asset?.documents, formData.accidentOwnerType]);

    useEffect(() => {
        if (formData.accidentOwnerType !== 'thirdParty') return;
        setFormData((prev) => {
            const updates = {};
            if (prev.policeFineAmount) updates.policeFineAmount = '';
            return Object.keys(updates).length ? { ...prev, ...updates } : prev;
        });
    }, [formData.accidentOwnerType]);

    const set = useCallback((key, value) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    }, []);

    const isSelfParty = formData.accidentOwnerType !== 'thirdParty';
    const insuranceExcess = isSelfParty ? Number(formData.insuranceFineAmount || 0) : 0;
    const policeFine = Number(formData.policeFineAmount || 0);
    const otherFine = sumOtherFineRows(formData.otherFineRows);
    const totalFines = insuranceExcess + policeFine + otherFine;

    const setPaymentByMode = useCallback(
        (mode) => {
            setFormData((prev) => {
                const costBase =
                    Number(prev.estimatedCost) > 0
                        ? Math.round(Number(prev.estimatedCost))
                        : totalFines > 0
                          ? Math.round(totalFines)
                          : 0;
                const companyPayPercent = mode === 'company' ? '100' : mode === 'person' ? '0' : '50';
                const employeePayPercent = mode === 'person' ? '100' : mode === 'company' ? '0' : '50';
                const companyPayAmount =
                    mode === 'company'
                        ? String(costBase)
                        : mode === 'person'
                          ? '0'
                          : String(Math.round(costBase / 2));
                const employeePayAmount =
                    mode === 'person'
                        ? String(costBase)
                        : mode === 'company'
                          ? '0'
                          : String(Math.max(0, costBase - Number(companyPayAmount)));
                return {
                    ...prev,
                    paymentByMode: mode,
                    companyPayPercent,
                    employeePayPercent,
                    companyPayAmount,
                    employeePayAmount,
                    estimatedCost: costBase > 0 ? String(costBase) : prev.estimatedCost || '',
                    employeeLiabilityRows: applyEmployeePayTargetToRows(
                        prev.employeeLiabilityRows,
                        costBase,
                        employeePayPercent,
                    ),
                };
            });
        },
        [totalFines],
    );

    const applyPayAmountChange = useCallback(
        (field, value) => {
            setFormData((prev) => {
                const costBase = totalFines > 0 ? totalFines : prev.estimatedCost;
                const absolutePay = resolveInitiateAbsolutePayAmounts({
                    estimatedCost: costBase,
                    companyPayPercent: prev.companyPayPercent,
                    employeePayPercent: prev.employeePayPercent,
                    companyPayAmount: prev.companyPayAmount,
                    employeePayAmount: prev.employeePayAmount,
                });
                const synced = syncInitiateServicePayAmounts({
                    field: field === 'totalAmount' ? 'companyPay' : field,
                    value: field === 'totalAmount' ? String(absolutePay.companyPayAmount) : value,
                    estimatedCost: costBase,
                    companyPayAmount: absolutePay.companyPayAmount,
                    employeePayAmount: absolutePay.employeePayAmount,
                    paymentByMode: prev.paymentByMode || 'company',
                    employeeLiabilityRows: prev.employeeLiabilityRows,
                });
                return {
                    ...prev,
                    estimatedCost: totalFines > 0 ? String(totalFines) : synced.estimatedCost,
                    companyPayPercent: synced.companyPayPercent,
                    employeePayPercent: synced.employeePayPercent,
                    companyPayAmount: synced.companyPayAmount,
                    employeePayAmount: synced.employeePayAmount,
                };
            });
        },
        [totalFines],
    );

    useEffect(() => {
        if (!formData.paymentByMode) return;
        if (!(totalFines > 0)) return;
        const liveAmt = Number(liveHrReview?.approvedAmount);
        if (Number.isFinite(liveAmt) && liveAmt > 0) return;
        setFormData((prev) => {
            const current = Number(prev.estimatedCost) || 0;
            if (current === totalFines) return prev;
            return {
                ...prev,
                estimatedCost: String(totalFines),
                employeeLiabilityRows: applyEmployeePayTargetToRows(
                    prev.employeeLiabilityRows,
                    totalFines,
                    prev.employeePayPercent,
                ),
            };
        });
    }, [formData.paymentByMode, liveHrReview?.approvedAmount, totalFines]);

    // Mirror live HR Approval edits into Initiate Service (mode, amounts, employees).
    useEffect(() => {
        if (!liveHrReview) return;
        const modeRaw = String(liveHrReview.paymentByMode || '').toLowerCase();
        const mode =
            modeRaw === 'person' || modeRaw === 'company' || modeRaw === 'split' ? modeRaw : '';
        const approvedNum = Number(liveHrReview.approvedAmount);
        const companyNum =
            liveHrReview.companyPay != null && liveHrReview.companyPay !== ''
                ? Number(liveHrReview.companyPay) || 0
                : null;
        const employeeNum =
            liveHrReview.employeePay != null && liveHrReview.employeePay !== ''
                ? Number(liveHrReview.employeePay) || 0
                : null;
        const hasAmount =
            (Number.isFinite(approvedNum) && approvedNum > 0) ||
            companyNum != null ||
            employeeNum != null;
        const liveRows = Array.isArray(liveHrReview.employeeRows)
            ? liveHrReview.employeeRows.map((row) => ({
                  employeeId: String(row?.employeeId || ''),
                  paidAmount: row?.paidAmount != null ? String(row.paidAmount) : '',
              }))
            : null;
        if (!mode && !hasAmount && !liveRows) return;

        setFormData((prev) => {
            const companyPay = companyNum != null ? companyNum : 0;
            const employeePay = employeeNum != null ? employeeNum : 0;
            const base =
                Number.isFinite(approvedNum) && approvedNum > 0
                    ? approvedNum
                    : companyPay + employeePay > 0
                      ? companyPay + employeePay
                      : Number(prev.estimatedCost) || 0;
            const nextMode = mode || prev.paymentByMode || '';
            let companyPayPercent = prev.companyPayPercent;
            let employeePayPercent = prev.employeePayPercent;
            if (nextMode === 'company') {
                companyPayPercent = '100';
                employeePayPercent = '0';
            } else if (nextMode === 'person') {
                companyPayPercent = '0';
                employeePayPercent = '100';
            } else if (nextMode === 'split' && base > 0) {
                const pct = Math.round((companyPay / base) * 100);
                companyPayPercent = String(Math.min(100, Math.max(0, pct)));
                employeePayPercent = String(Math.max(0, 100 - Number(companyPayPercent)));
            }

            const nextRows = liveRows
                ? liveRows.length
                    ? liveRows
                    : prev.employeeLiabilityRows
                : prev.employeeLiabilityRows;

            const next = {
                ...prev,
                ...(nextMode ? { paymentByMode: nextMode } : {}),
                ...(base > 0 ? { estimatedCost: String(base) } : {}),
                companyPayPercent,
                employeePayPercent,
                employeeLiabilityRows: nextRows,
            };

            const sameRows =
                JSON.stringify(next.employeeLiabilityRows || []) ===
                JSON.stringify(prev.employeeLiabilityRows || []);
            if (
                next.paymentByMode === prev.paymentByMode &&
                next.estimatedCost === prev.estimatedCost &&
                next.companyPayPercent === prev.companyPayPercent &&
                next.employeePayPercent === prev.employeePayPercent &&
                sameRows
            ) {
                return prev;
            }
            return next;
        });
    }, [
        liveHrReview?.approvedAmount,
        liveHrReview?.companyPay,
        liveHrReview?.employeePay,
        liveHrReview?.paymentByMode,
        // Serialize rows so employee edits from HR update Initiate without object-identity traps.
        Array.isArray(liveHrReview?.employeeRows)
            ? liveHrReview.employeeRows
                  .map((row) => `${row?.employeeId || ''}:${row?.paidAmount ?? ''}`)
                  .join('|')
            : '',
    ]);

    const estimatedCost = Number(formData.estimatedCost || 0) || totalFines || 0;
    const companyPct = Number(formData.companyPayPercent || 0);
    const employeePct = Number(formData.employeePayPercent || 0);
    const resolvedPayAmounts = useMemo(
        () =>
            resolveShopServicePayAmounts({
                estimatedCost,
                companyPayPercent: companyPct,
                employeePayPercent: employeePct,
                paymentByMode: formData.paymentByMode,
                remark,
                liveHrReview,
            }),
        [estimatedCost, companyPct, employeePct, formData.paymentByMode, remark, liveHrReview],
    );
    const absolutePayAmounts = useMemo(
        () =>
            resolveInitiateAbsolutePayAmounts({
                estimatedCost: formData.estimatedCost || estimatedCost,
                companyPayPercent: formData.companyPayPercent,
                employeePayPercent: formData.employeePayPercent,
                companyPayAmount: formData.companyPayAmount,
                employeePayAmount: formData.employeePayAmount,
            }),
        [
            formData.estimatedCost,
            formData.companyPayPercent,
            formData.employeePayPercent,
            formData.companyPayAmount,
            formData.employeePayAmount,
            estimatedCost,
        ],
    );
    const paymentByMode = formData.paymentByMode || resolvedPayAmounts.paymentByMode || '';
    const companyPayAmount = absolutePayAmounts.companyPayAmount;
    const employeePayAmount = absolutePayAmounts.employeePayAmount;
    const showFineSplitAmounts = Boolean(paymentByMode);
    const showCompanyPay = paymentByMode && paymentByMode !== 'person';
    const showEmployeePay = paymentByMode && paymentByMode !== 'company';
    const isSplitPayment = paymentByMode === 'split';
    const employeeLiabilitySum = sumEmployeeLiabilityRows(formData.employeeLiabilityRows);
    const paySplitError =
        isSplitPayment &&
        estimatedCost > 0 &&
        Math.abs(companyPayAmount + employeePayAmount - estimatedCost) > 0.01;
    const employeeRowsError =
        showEmployeePay && Math.abs(employeeLiabilitySum - employeePayAmount) > 0.01;
    const companyPartyError =
        showCompanyPay &&
        companyPayAmount > 0 &&
        !String(formData.companyPayPartyId || '').trim() &&
        !String(formData.companyPayPartyName || '').trim();
    const finesTotalError = Math.abs((totalFines || 0) - (estimatedCost || 0)) > 0.01;
    const payTableTotal = useMemo(() => {
        const companyPart = showCompanyPay ? Number(companyPayAmount) || 0 : 0;
        const employeePart = showEmployeePay
            ? employeeLiabilitySum > 0
                ? employeeLiabilitySum
                : Number(employeePayAmount) || 0
            : 0;
        return companyPart + employeePart;
    }, [showCompanyPay, showEmployeePay, companyPayAmount, employeePayAmount, employeeLiabilitySum]);

    useEffect(() => {
        const c = asset?.assignedCompany;
        if (!c) return;
        const id = String(c._id || c.id || '').trim();
        if (!id) return;
        setFormData((prev) => {
            if (String(prev.companyPayPartyId || '').trim()) return prev;
            return {
                ...prev,
                companyPayPartyId: id,
                companyPayPartyName: companyPayPartyLabel(c),
            };
        });
    }, [asset?.assignedCompany]);

    const applyEmployeeRowsToPayTotals = useCallback((prev, rows) => {
        return { ...prev, employeeLiabilityRows: rows };
    }, []);

    const setEmployeeRowPaidAmount = useCallback((index, value) => {
        setFormData((prev) => {
            const rows = [...(prev.employeeLiabilityRows || [])];
            rows[index] = { ...rows[index], paidAmount: value };
            return applyEmployeeRowsToPayTotals(prev, rows);
        });
    }, [applyEmployeeRowsToPayTotals]);

    const finalizeEmployeeRowPaidAmount = useCallback((index) => {
        setFormData((prev) => {
            const rows = [...(prev.employeeLiabilityRows || [])];
            const raw = rows[index]?.paidAmount ?? '';
            if (String(raw).trim() !== '') return prev;
            rows[index] = { ...rows[index], paidAmount: '0' };
            return applyEmployeeRowsToPayTotals(prev, rows);
        });
    }, [applyEmployeeRowsToPayTotals]);

    const updateEmployeeRow = useCallback((index, key, value) => {
        setFormData((prev) => {
            const rows = [...(prev.employeeLiabilityRows || [])];
            rows[index] = { ...rows[index], [key]: value };
            return { ...prev, employeeLiabilityRows: rows };
        });
    }, []);

    const addEmployeeRow = useCallback(() => {
        setFormData((prev) => {
            const nextRows = [...(prev.employeeLiabilityRows || []), { employeeId: '', paidAmount: '' }];
            return { ...prev, employeeLiabilityRows: nextRows };
        });
    }, []);

    const removeEmployeeRow = useCallback((index) => {
        setFormData((prev) => {
            const rows = [...(prev.employeeLiabilityRows || [])];
            if (rows.length <= 1) {
                return applyEmployeeRowsToPayTotals(prev, [{ employeeId: '', paidAmount: '' }]);
            }
            rows.splice(index, 1);
            return applyEmployeeRowsToPayTotals(prev, rows);
        });
    }, [applyEmployeeRowsToPayTotals]);

    const headerDateLabel = useMemo(() => formatDisplayDate(formData.date), [formData.date]);

    const handleFileChange = useCallback(
        (e, kind = 'attachment') => {
            const file = e.target.files?.[0];
            if (!file) return;

            if (PDF_ATTACHMENT_KINDS.has(kind)) {
                const check = validateErpPdfFile(file);
                if (!check.ok) {
                    toast({
                        variant: 'destructive',
                        title: 'Invalid file',
                        description: check.message,
                    });
                    if (e.target) e.target.value = '';
                    return;
                }
            } else if (JPEG_ATTACHMENT_KINDS.has(kind)) {
                const check = validateErpJpegFile(file);
                if (!check.ok) {
                    toast({
                        variant: 'destructive',
                        title: 'Invalid file',
                        description: check.message,
                    });
                    if (e.target) e.target.value = '';
                    return;
                }
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = String(reader.result || '').split(',')[1] || '';
                if (kind === 'quotation2') {
                    setFormData((prev) => ({
                        ...prev,
                        quotation2Name: file.name,
                        quotation2Base64: base64,
                        quotation2Mime: file.type || 'application/pdf',
                        existingQuotation2Url: '',
                    }));
                } else if (kind === 'quotation3') {
                    setFormData((prev) => ({
                        ...prev,
                        quotation3Name: file.name,
                        quotation3Base64: base64,
                        quotation3Mime: file.type || 'application/pdf',
                        existingQuotation3Url: '',
                    }));
                } else if (kind === 'tireCondition') {
                    setFormData((prev) => ({
                        ...prev,
                        tireConditionName: file.name,
                        tireConditionBase64: base64,
                        tireConditionMime: file.type || 'application/pdf',
                        existingTireConditionUrl: '',
                    }));
                } else {
                    setFormData((prev) => ({
                        ...prev,
                        attachmentName: file.name,
                        attachmentBase64: base64,
                        attachmentMime: file.type || 'application/pdf',
                        existingAttachmentUrl: '',
                        remarkAttachmentName: '',
                    }));
                }
            };
            reader.readAsDataURL(file);
        },
        [toast],
    );

    const handleGarageQuoteFile = useCallback(
        (kind, file) => {
            if (!file) return;
            const fields = GARAGE_QUOTE_KIND_FIELDS[kind];
            if (!fields) return;
            const check = validateErpPdfFile(file);
            if (!check.ok) {
                toast({
                    variant: 'destructive',
                    title: 'Invalid file',
                    description: check.message,
                });
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = String(reader.result || '').split(',')[1] || '';
                setFormData((prev) => ({
                    ...prev,
                    [fields.name]: file.name,
                    [fields.base64]: base64,
                    [fields.mime]: file.type || 'application/pdf',
                    [fields.existing]: '',
                }));
            };
            reader.readAsDataURL(file);
        },
        [toast],
    );

    const appendAccidentImagesFromFiles = useCallback(
        (fileList) => {
            const { accepted, firstError } = filterErpUploadFiles(fileList, {
                allowPdf: false,
                allowJpeg: true,
            });
            if (firstError) {
                toast({
                    variant: 'destructive',
                    title: 'Invalid file',
                    description: firstError,
                });
            }
            accepted.forEach((file) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = String(reader.result || '').split(',')[1] || '';
                    if (!base64) return;
                    setFormData((prev) => ({
                        ...prev,
                        accidentImages: [
                            ...(prev.accidentImages || []),
                            { name: file.name, data: base64, mimeType: file.type || 'image/jpeg' },
                        ],
                    }));
                };
                reader.readAsDataURL(file);
            });
        },
        [toast],
    );

    const photoGalleryItems = useMemo(() => {
        const items = [];
        (formData.existingAccidentImages || []).forEach((img, idx) => {
            const thumb =
                resolvedExistingPhotoSrc[`existing-${idx}`] || directAccidentImageSrc(img);
            const dataUrl = thumb?.startsWith('data:') ? thumb : '';
            // Pass storage photo (not blob:) so the shared handover viewer can proxy-load it.
            const photo = dataUrl || img;
            if (!photo && !thumb) return;
            items.push({
                key: `existing-${idx}`,
                label: `Accident photo ${items.length + 1}`,
                photo,
                ...(dataUrl ? { url: dataUrl } : {}),
            });
        });
        (formData.accidentImages || []).forEach((img, idx) => {
            const url = img?.data
                ? `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`
                : '';
            if (!url) return;
            items.push({
                key: `new-${idx}`,
                label: `Accident photo ${items.length + 1}`,
                photo: url,
                url,
            });
        });
        return items;
    }, [formData.existingAccidentImages, formData.accidentImages, resolvedExistingPhotoSrc]);

    const openPhotoViewer = useCallback(
        (key) => {
            const index = photoGalleryItems.findIndex((item) => item.key === key);
            if (index < 0) return;
            setViewerStartIndex(index);
            setViewerOpen(true);
        },
        [photoGalleryItems],
    );

    const errors = useMemo(() => {
        if (!assignmentPending || !canEditAssignment) return {};
        return validateAccidentRepairDetailForm(formData, asset);
    }, [asset, assignmentPending, canEditAssignment, formData]);

    const persistForm = useCallback(
        async ({ submitAfterSave = false } = {}) => {
            if (!vehicleId || !serviceId) return false;
            setSaving(true);
            try {
                const body = buildAccidentRepairDetailSubmitBody(formData, {
                    keepPending: assignmentPending && !submitAfterSave,
                });
                await axiosInstance.put(`/AssetItem/${vehicleId}/service/${serviceId}`, body);
                if (submitAfterSave) {
                    await axiosInstance.post(
                        `/AssetItem/${vehicleId}/service/${serviceId}/submit-request`,
                    );
                    toast({
                        title: 'Submitted',
                        description:
                            'Vehicle Accident Form was sent. Admin Officer was emailed to complete Garage / Service Details.',
                    });
                } else {
                    toast({
                        title: assignmentPending ? 'Draft saved' : 'Initiate updated',
                        description: assignmentPending
                            ? 'Accident repair assignment draft saved.'
                            : 'Payment and initiate details were saved.',
                    });
                }
                if (typeof onSaved === 'function') onSaved();
                return true;
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: submitAfterSave ? 'Could not submit' : 'Could not save',
                    description: error.response?.data?.message || 'Try again.',
                });
                return false;
            } finally {
                setSaving(false);
            }
        },
        [assignmentPending, formData, onSaved, serviceId, toast, vehicleId],
    );

    const handleSubmit = useCallback(async () => {
        if (!assignmentPending || !isAccidentRepairDetailFormComplete(formData, asset)) return;
        await persistForm({ submitAfterSave: true });
    }, [asset, assignmentPending, formData, persistForm]);

    const handleSaveDraft = async () => {
        if (!assignmentPending) {
            const blocking = getAccidentRepairDetailFormMissingFields(formData, asset);
            if (blocking.length > 0) {
                toast({
                    variant: 'destructive',
                    title: 'Cannot save',
                    description: blocking.join(', '),
                });
                return;
            }
        }
        await persistForm({ submitAfterSave: false });
    };

    const handleCancel = () => {
        if (vehicleId) {
            router.push(`/HRM/Asset/Vehicle/details/${vehicleId}?tab=service`);
        } else {
            router.back();
        }
    };

    const canRequest =
        assignmentPending && !saving && canEditAssignment && isAccidentRepairDetailFormComplete(formData, asset);
    const missingFields = useMemo(
        () =>
            canEditInitiateFields ? getAccidentRepairDetailFormMissingFields(formData, asset) : [],
        [asset, formData, canEditInitiateFields],
    );

    const submitHandlerRef = useRef(handleSubmit);
    submitHandlerRef.current = handleSubmit;
    if (draftSubmitRef) {
        draftSubmitRef.current = canRequest ? submitHandlerRef.current : null;
    }

    useEffect(() => {
        if (typeof onDraftStateChange !== 'function') return;
        onDraftStateChange({ canRequest, requesting: saving });
    }, [canRequest, onDraftStateChange, saving]);

    const employeeOptions = employees.map((emp) => (
        <option key={emp._id} value={String(emp._id)}>
            {`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId || 'Employee'}
        </option>
    ));

    const UploadField = ({ label, kind, fileName, existingUrl }) => (
        <div className="flex flex-wrap items-center gap-2 min-h-[40px]">
            {existingUrl ? (
                <button
                    type="button"
                    className={tireViewBtn}
                    onClick={() => void openAttachmentInNewTab(existingUrl, { name: fileName || label })}
                >
                    View
                </button>
            ) : null}
            {!fieldsDisabled ? (
                <label className={tireUploadBtn}>
                    <Upload size={14} />
                    {fileName || existingUrl ? 'Change' : 'Upload'}
                    <input
                        type="file"
                        className="sr-only"
                        accept={kind === 'tireCondition' ? ERP_JPEG_ACCEPT : ERP_PDF_ACCEPT}
                        disabled={fieldsDisabled}
                        onChange={(e) => {
                            handleFileChange(e, kind);
                            e.target.value = '';
                        }}
                    />
                </label>
            ) : null}
            {fileName ? <span className="text-[10px] text-gray-500 truncate">{fileName}</span> : null}
        </div>
    );

    const GarageQuoteUpload = ({ label, kind, fileName, existingUrl }) => {
        const hasQuote = !!(fileName || existingUrl);

        return (
            <div
                className={`flex flex-wrap items-center gap-2 min-h-[40px] rounded-lg border px-2 py-1.5 transition-colors ${
                    hasQuote ? 'border-blue-200 bg-blue-50/40' : 'border-transparent'
                }`}
            >
                {existingUrl ? (
                    <button
                        type="button"
                        className={tireViewBtn}
                        onClick={() => void openAttachmentInNewTab(existingUrl, { name: fileName || label })}
                    >
                        View
                    </button>
                ) : null}
                {!fieldsDisabled ? (
                    <label className={tireUploadBtn}>
                        <Upload size={14} />
                        {fileName || existingUrl ? 'Change' : 'Add'}
                        <input
                            type="file"
                            className="sr-only"
                            accept={ERP_PDF_ACCEPT}
                            disabled={fieldsDisabled}
                            onChange={(e) => {
                                handleGarageQuoteFile(kind, e.target.files?.[0]);
                                e.target.value = '';
                            }}
                        />
                    </label>
                ) : null}
                {fileName ? <span className="text-[10px] text-gray-500 truncate">{fileName}</span> : null}
            </div>
        );
    };

    const { fieldMinHeightPx, gapClass } = ACCIDENT_REPAIR_DETAIL_GRID_LAYOUT;
    const accent = tireAccent;

    return (
        <>
            <div className={`flex w-full ${className}`.trim()}>
                <FineFormCard
                    title="Initiate Service"
                    subtitle={
                        assignmentPending
                            ? `Dated: ${headerDateLabel || '—'} · Complete all fields, then click Send`
                            : canEditInitiateFields
                              ? `Dated: ${headerDateLabel || '—'} · HR can edit payment and initiate details until Zoho bill is accepted`
                              : `Dated: ${headerDateLabel || '—'} · Submitted — view only after Zoho bill is accepted.`
                    }
                    icon={ClipboardList}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    className={`w-full ${canEditInitiateFields ? '' : 'opacity-[0.97]'}`}
                >
                    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gapClass}`}>
                        <VehicleAccidentRepairFormFieldCell
                            label="Accident Date"
                            accentClass={accent(0)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <DatePicker
                                value={formData.accidentDate}
                                onChange={(v) => set('accidentDate', v || '')}
                                placeholder="dd/mm/yyyy"
                                disabled={fieldsDisabled}
                                className={tireDatePickerClass}
                            />
                            {errors.accidentDate ? (
                                <p className="text-[10px] text-red-500 font-bold mt-1">{errors.accidentDate}</p>
                            ) : null}
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Accident Time"
                            accentClass={accent(1)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <input
                                type="time"
                                value={formData.accidentTime || ''}
                                onChange={(e) => set('accidentTime', e.target.value)}
                                disabled={fieldsDisabled}
                                className={tireFieldInput}
                            />
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Accident Location"
                            accentClass={accent(2)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <input
                                type="text"
                                value={formData.accidentLocation || ''}
                                onChange={(e) => set('accidentLocation', e.target.value)}
                                disabled={fieldsDisabled}
                                className={tireFieldInput}
                            />
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Vehicle Assigned"
                            accentClass={accent(0)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <select
                                className={tireFieldSelect}
                                value={formData.vehicleOwnerEmployeeId || ''}
                                onChange={(e) => set('vehicleOwnerEmployeeId', e.target.value)}
                                disabled={fieldsDisabled}
                            >
                                {adminOfficerRef.id ? (
                                    <option value={adminOfficerRef.id}>{adminOfficerRef.label}</option>
                                ) : null}
                                {resolvedAssetControllerEmployeeId && !hasResolvedControllerInEmployees ? (
                                    <option value={resolvedAssetControllerEmployeeId}>{assetControllerName}</option>
                                ) : null}
                                <option value={ASSET_CONTROLLER_VALUE}>{assetControllerName}</option>
                                {employeeOptions}
                            </select>
                            {errors.vehicleOwnerEmployeeId ? (
                                <p className="text-[10px] text-red-500 font-bold mt-1">{errors.vehicleOwnerEmployeeId}</p>
                            ) : null}
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Vehicle Driven By"
                            accentClass={accent(1)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <VehicleCarDrivenBySelect
                                formData={formData}
                                employees={licensedEmployees}
                                companies={companies}
                                disabled={fieldsDisabled}
                                className={tireFieldSelect}
                                placeholder="Select employee with driving license"
                                onChange={(selection) => {
                                    setFormData((prev) =>
                                        applyCarDrivenBySelection(prev, selection, { companies }),
                                    );
                                }}
                            />
                            {errors.carDrivenByEmployeeId ? (
                                <p className="text-[10px] text-red-500 font-bold mt-1">{errors.carDrivenByEmployeeId}</p>
                            ) : null}
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="VSR No"
                            accentClass={accent(2)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <input
                                className={tireFieldInput}
                                type="text"
                                readOnly
                                disabled
                                value={formatVehicleServiceReqNo(service, asset)}
                            />
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Accident Party"
                            accentClass={accent(2)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <AccidentPartyToggle
                                value={formData.accidentOwnerType || 'self'}
                                onChange={(v) => set('accidentOwnerType', v)}
                                disabled={fieldsDisabled}
                            />
                            {errors.accidentOwnerType ? (
                                <p className="text-[10px] text-red-500 font-bold mt-1">{errors.accidentOwnerType}</p>
                            ) : null}
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Insurance Company"
                            accentClass={accent(0)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <AutoFillField value={formData.insuranceCompany} />
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Policy Number"
                            accentClass={accent(1)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <AutoFillField value={formData.policyNumber} />
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Insurance Expiry Date"
                            accentClass={accent(2)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <AutoFillField
                                value={
                                    formData.insuranceExpiryDate
                                        ? formatShortDate(formData.insuranceExpiryDate)
                                        : ''
                                }
                            />
                        </VehicleAccidentRepairFormFieldCell>
                    </div>

                    <div className={`mt-2.5 flex flex-wrap items-start ${gapClass}`}>
                        {GARAGE_QUOTE_SLOTS.slice(0, visibleQuoteCount).map((slot, index) => (
                            <div key={slot.key} className="w-full min-w-[200px] flex-1 basis-[220px] max-w-sm">
                                <VehicleAccidentRepairFormFieldCell
                                    label={`${slot.label} (optional)`}
                                    accentClass={accent(index % 3)}
                                    minHeightPx={fieldMinHeightPx}
                                >
                                    <div className="flex items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                            <GarageQuoteUpload
                                                label={slot.label}
                                                kind={slot.kind}
                                                fileName={formData[slot.name]}
                                                existingUrl={formData[slot.existing]}
                                            />
                                        </div>
                                        {!fieldsDisabled ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData((prev) => {
                                                        const kept = GARAGE_QUOTE_SLOTS.map((s) => ({
                                                            name: prev[s.name] || '',
                                                            existing: prev[s.existing] || '',
                                                            amount: prev[s.amount] || '',
                                                            base64: prev[s.base64] || '',
                                                            mime: prev[s.mime] || '',
                                                        })).filter((_, i) => i !== index);
                                                        while (kept.length < GARAGE_QUOTE_SLOTS.length) {
                                                            kept.push({
                                                                name: '',
                                                                existing: '',
                                                                amount: '',
                                                                base64: '',
                                                                mime: '',
                                                            });
                                                        }
                                                        const next = { ...prev };
                                                        GARAGE_QUOTE_SLOTS.forEach((s, i) => {
                                                            next[s.name] = kept[i].name;
                                                            next[s.existing] = kept[i].existing;
                                                            next[s.amount] = kept[i].amount;
                                                            next[s.base64] = kept[i].base64;
                                                            next[s.mime] = kept[i].mime;
                                                        });
                                                        return next;
                                                    });
                                                    setVisibleQuoteCount((prev) => Math.max(0, prev - 1));
                                                }}
                                                className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                                                title={`Remove ${slot.label}`}
                                            >
                                                ×
                                            </button>
                                        ) : null}
                                    </div>
                                </VehicleAccidentRepairFormFieldCell>
                            </div>
                        ))}
                        {!fieldsDisabled && visibleQuoteCount < GARAGE_QUOTE_SLOTS.length ? (
                            <div className="flex items-center pt-6">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setVisibleQuoteCount((prev) =>
                                            Math.min(GARAGE_QUOTE_SLOTS.length, prev + 1),
                                        )
                                    }
                                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-blue-600 hover:bg-blue-100"
                                    title="Add quote"
                                >
                                    <Plus size={16} />
                                    Add Quote
                                </button>
                            </div>
                        ) : null}
                    </div>

                    <div className={`grid grid-cols-1 sm:grid-cols-3 ${gapClass} mt-2.5`}>
                        <VehicleAccidentRepairFormFieldCell
                            label="Police Report"
                            accentClass={accent(1)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <UploadField
                                label="Police Report"
                                kind="attachment"
                                fileName={formData.attachmentName || formData.remarkAttachmentName}
                                existingUrl={formData.existingAttachmentUrl}
                            />
                            {errors.attachment ? (
                                <p className="text-[10px] text-red-500 font-bold mt-1">{errors.attachment}</p>
                            ) : null}
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Police Fine Document"
                            accentClass={accent(2)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <UploadField
                                label="Police Fine Document"
                                kind="quotation3"
                                fileName={formData.quotation3Name}
                                existingUrl={formData.existingQuotation3Url}
                            />
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Other Document"
                            accentClass={accent(0)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <UploadField
                                label="Other Document"
                                kind="tireCondition"
                                fileName={formData.tireConditionName}
                                existingUrl={formData.existingTireConditionUrl}
                            />
                        </VehicleAccidentRepairFormFieldCell>
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-4">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Accident Photos
                        </span>
                        <div className="mt-2 flex flex-wrap gap-2 items-center">
                            {(formData.existingAccidentImages || []).map((img, idx) => {
                                const src =
                                    resolvedExistingPhotoSrc[`existing-${idx}`] || directAccidentImageSrc(img);
                                if (!src) return null;
                                return (
                                    <button
                                        key={`existing-photo-${idx}`}
                                        type="button"
                                        onClick={() => openPhotoViewer(`existing-${idx}`)}
                                        className={tirePhotoThumb}
                                    >
                                        <img src={src} alt="" className="w-full h-full object-cover" />
                                    </button>
                                );
                            })}
                            {(formData.accidentImages || []).map((img, idx) => {
                                const src = img?.data
                                    ? `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`
                                    : '';
                                if (!src) return null;
                                return (
                                    <button
                                        key={`new-photo-${idx}`}
                                        type="button"
                                        onClick={() => openPhotoViewer(`new-${idx}`)}
                                        className={tirePhotoThumb}
                                    >
                                        <img src={src} alt="" className="w-full h-full object-cover" />
                                    </button>
                                );
                            })}
                            {!fieldsDisabled ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => photoInputRef.current?.click()}
                                        className={tirePhotoAddBtn}
                                    >
                                        <Plus size={20} />
                                    </button>
                                    <input
                                        ref={photoInputRef}
                                        type="file"
                                        multiple
                                        accept={ERP_JPEG_ACCEPT}
                                        className="hidden"
                                        onChange={(e) => {
                                            appendAccidentImagesFromFiles(e.target.files);
                                            e.target.value = '';
                                        }}
                                    />
                                </>
                            ) : null}
                        </div>
                        {errors.accidentImages ? (
                            <p className="text-[10px] text-red-500 font-bold mt-1">{errors.accidentImages}</p>
                        ) : null}
                    </div>

                    <div className="mt-4">
                        <VehicleAccidentRepairFormFieldCell
                            label="Description (optional)"
                            accentClass={accent(0)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <textarea
                                className={`${tireFieldInput} min-h-[88px] w-full resize-y`}
                                value={formData.serviceIssue || ''}
                                onChange={(e) => set('serviceIssue', e.target.value)}
                                disabled={fieldsDisabled}
                                placeholder="Optional notes"
                                rows={3}
                            />
                        </VehicleAccidentRepairFormFieldCell>
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Payment Details
                        </span>

                        <div className={`grid grid-cols-1 sm:grid-cols-2 ${gapClass}`}>
                            {isSelfParty ? (
                                <div
                                    className={`flex items-stretch overflow-hidden rounded-lg border ${accent(0)}`}
                                    style={{ minHeight: `${fieldMinHeightPx}px` }}
                                >
                                    <div className="flex w-[42%] min-w-[110px] items-center border-r border-gray-200 bg-white px-3 text-xs font-bold text-gray-700">
                                        Insurance Excess
                                    </div>
                                    <div className="relative flex min-w-0 flex-1 items-center p-2">
                                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                                            AED
                                        </span>
                                        <input
                                            type="text"
                                            readOnly
                                            disabled
                                            value={
                                                formData.insuranceFineAmount !== '' &&
                                                formData.insuranceFineAmount != null
                                                    ? formData.insuranceFineAmount
                                                    : ''
                                            }
                                            placeholder="0.00"
                                            className={`${tireMoneyInput} pl-11 bg-gray-50`}
                                        />
                                    </div>
                                </div>
                            ) : null}

                            <div
                                className={`flex items-stretch overflow-hidden rounded-lg border ${accent(1)}`}
                                style={{ minHeight: `${fieldMinHeightPx}px` }}
                            >
                                <div className="flex w-[42%] min-w-[110px] items-center border-r border-gray-200 bg-white px-3 text-xs font-bold text-gray-700">
                                    Police Fine
                                </div>
                                <div className="flex min-w-0 flex-1 items-center gap-2 p-2">
                                    <div className="relative min-w-0 flex-1">
                                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                                            AED
                                        </span>
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={formData.policeFineAmount}
                                            onChange={(e) => set('policeFineAmount', e.target.value)}
                                            disabled={fieldsDisabled || formData.accidentOwnerType !== 'self'}
                                            placeholder="0.00"
                                            className={`${tireMoneyInput} pl-11`}
                                            {...numberInputNoScrollProps}
                                        />
                                    </div>
                                    {!fieldsDisabled ? (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    otherFineRows: [
                                                        ...(Array.isArray(prev.otherFineRows)
                                                            ? prev.otherFineRows
                                                            : []),
                                                        { name: '', amount: '' },
                                                    ],
                                                }))
                                            }
                                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
                                            title="Add other fine"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                            {errors.policeFineAmount ? (
                                <p className="sm:col-span-2 -mt-1 text-[10px] font-bold text-red-500">
                                    {errors.policeFineAmount}
                                </p>
                            ) : null}

                            {(formData.otherFineRows || []).map((row, index) => (
                                <div
                                    key={`other-fine-${index}`}
                                    className={`flex items-stretch overflow-hidden rounded-lg border ${accent(index % 3)}`}
                                    style={{ minHeight: `${fieldMinHeightPx}px` }}
                                >
                                    <div className="flex w-[42%] min-w-[110px] items-center border-r border-gray-200 bg-white p-2">
                                        <input
                                            type="text"
                                            value={row.name || ''}
                                            onChange={(e) =>
                                                setFormData((prev) => {
                                                    const rows = [
                                                        ...(Array.isArray(prev.otherFineRows)
                                                            ? prev.otherFineRows
                                                            : []),
                                                    ];
                                                    rows[index] = {
                                                        ...rows[index],
                                                        name: e.target.value,
                                                    };
                                                    return { ...prev, otherFineRows: rows };
                                                })
                                            }
                                            disabled={fieldsDisabled}
                                            placeholder="Fine name"
                                            className={`${tireFieldInput} border-0 bg-transparent px-1 shadow-none focus:ring-0`}
                                        />
                                    </div>
                                    <div className="flex min-w-0 flex-1 items-center gap-2 p-2">
                                        <div className="relative min-w-0 flex-1">
                                            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                                                AED
                                            </span>
                                            <input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={row.amount || ''}
                                                onChange={(e) =>
                                                    setFormData((prev) => {
                                                        const rows = [
                                                            ...(Array.isArray(prev.otherFineRows)
                                                                ? prev.otherFineRows
                                                                : []),
                                                        ];
                                                        rows[index] = {
                                                            ...rows[index],
                                                            amount: e.target.value,
                                                        };
                                                        return { ...prev, otherFineRows: rows };
                                                    })
                                                }
                                                disabled={fieldsDisabled}
                                                placeholder="0.00"
                                                className={`${tireMoneyInput} pl-11`}
                                                {...numberInputNoScrollProps}
                                            />
                                        </div>
                                        {!fieldsDisabled ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setFormData((prev) => {
                                                        const rows = [
                                                            ...(Array.isArray(prev.otherFineRows)
                                                                ? prev.otherFineRows
                                                                : []),
                                                        ];
                                                        rows.splice(index, 1);
                                                        return { ...prev, otherFineRows: rows };
                                                    })
                                                }
                                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                                                title="Remove fine"
                                            >
                                                ×
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            ))}

                            <div
                                className={`sm:col-span-2 flex items-stretch overflow-hidden rounded-lg border ${accent(1)}`}
                                style={{ minHeight: `${fieldMinHeightPx}px` }}
                            >
                                <div className="flex w-[42%] min-w-[110px] max-w-[220px] items-center border-r border-gray-200 bg-white px-3 text-xs font-bold uppercase tracking-wide text-gray-700">
                                    Total
                                </div>
                                <div className="relative flex min-w-0 flex-1 items-center p-2">
                                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                                        AED
                                    </span>
                                    <input
                                        type="text"
                                        readOnly
                                        value={totalFines ? String(totalFines) : ''}
                                        className={`${tireMoneyInput} pl-11 bg-gray-50 font-semibold`}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={`grid grid-cols-1 sm:grid-cols-2 ${gapClass}`}>
                            <VehicleAccidentRepairFormFieldCell
                                label="Payment By"
                                accentClass={accent(2)}
                                minHeightPx={fieldMinHeightPx}
                            >
                                <PaymentByToggle
                                    value={paymentByMode || ''}
                                    onChange={setPaymentByMode}
                                    disabled={fieldsDisabled}
                                />
                            </VehicleAccidentRepairFormFieldCell>
                        </div>

                        {showFineSplitAmounts ? (
                            <div className="w-full rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                                {showCompanyPay ? (
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-bold uppercase tracking-wide text-gray-500">
                                                Company payment
                                            </span>
                                            <div
                                                className={`flex w-[160px] shrink-0 items-center justify-end gap-1 ${
                                                    paySplitError || companyPartyError
                                                        ? 'text-amber-700'
                                                        : ''
                                                }`}
                                            >
                                                <input
                                                    className="w-full min-w-0 border-0 bg-transparent py-1 text-right text-xl font-bold tabular-nums text-gray-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-gray-500"
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={formData.companyPayAmount ?? ''}
                                                    onChange={(e) =>
                                                        applyPayAmountChange('companyPay', e.target.value)
                                                    }
                                                    disabled={fieldsDisabled}
                                                    {...numberInputNoScrollProps}
                                                />
                                                <span className="text-sm font-bold text-gray-500">AED</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                                <VehicleCompanyPayPartySelect
                                                    companies={companies}
                                                    value={formData.companyPayPartyId || ''}
                                                    disabled={fieldsDisabled}
                                                    error={
                                                        Boolean(errors?.companyPayPartyId) ||
                                                        companyPartyError
                                                    }
                                                    onChange={({
                                                        companyPayPartyId,
                                                        companyPayPartyName,
                                                    }) =>
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            companyPayPartyId,
                                                            companyPayPartyName,
                                                        }))
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                {showEmployeePay ? (
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-bold uppercase tracking-wide text-gray-500">
                                                Employee payment
                                            </span>
                                            <div
                                                className={`flex w-[160px] shrink-0 items-center justify-end gap-1 ${
                                                    paySplitError || employeeRowsError
                                                        ? 'text-amber-700'
                                                        : ''
                                                }`}
                                            >
                                                <input
                                                    className="w-full min-w-0 border-0 bg-transparent py-1 text-right text-xl font-bold tabular-nums text-gray-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-gray-500"
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={formData.employeePayAmount ?? ''}
                                                    onChange={(e) =>
                                                        applyPayAmountChange('employeePay', e.target.value)
                                                    }
                                                    disabled={fieldsDisabled}
                                                    {...numberInputNoScrollProps}
                                                />
                                                <span className="text-sm font-bold text-gray-500">AED</span>
                                            </div>
                                        </div>
                                        {(formData.employeeLiabilityRows || []).map((row, index) => {
                                            const isLastRow =
                                                index === (formData.employeeLiabilityRows || []).length - 1;
                                            return (
                                                <div
                                                    key={`emp-row-${index}`}
                                                    className="flex items-center justify-between gap-3"
                                                >
                                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                                        <div className="min-w-0 w-full max-w-[320px]">
                                                            <SearchableEmployeeSelect
                                                                employees={employees}
                                                                value={row.employeeId || ''}
                                                                onChange={(nextId) =>
                                                                    updateEmployeeRow(
                                                                        index,
                                                                        'employeeId',
                                                                        nextId,
                                                                    )
                                                                }
                                                                disabled={fieldsDisabled}
                                                                placeholder="Select employee"
                                                            />
                                                        </div>
                                                        {!fieldsDisabled &&
                                                        (formData.employeeLiabilityRows || []).length >
                                                            1 ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeEmployeeRow(index)}
                                                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-red-500 hover:bg-red-50"
                                                                title="Remove"
                                                            >
                                                                ×
                                                            </button>
                                                        ) : null}
                                                        {!fieldsDisabled && isLastRow ? (
                                                            <button
                                                                type="button"
                                                                onClick={addEmployeeRow}
                                                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
                                                                title="Add employee"
                                                            >
                                                                <Plus size={18} />
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                    <div className="flex w-[140px] shrink-0 items-center justify-end gap-1">
                                                        <span className="text-xs font-semibold text-gray-400">
                                                            AED
                                                        </span>
                                                        <input
                                                            className="w-full min-w-0 border-0 bg-transparent py-2 text-right text-xl font-bold tabular-nums text-gray-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-gray-500"
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={row.paidAmount ?? ''}
                                                            onChange={(e) =>
                                                                setEmployeeRowPaidAmount(
                                                                    index,
                                                                    e.target.value,
                                                                )
                                                            }
                                                            onBlur={() =>
                                                                finalizeEmployeeRowPaidAmount(index)
                                                            }
                                                            disabled={fieldsDisabled}
                                                            placeholder="0"
                                                            {...numberInputNoScrollProps}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : null}

                                <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                                    <span className="text-sm font-bold uppercase tracking-wide text-gray-500">
                                        Total amount
                                    </span>
                                    <div
                                        className={`flex w-[160px] shrink-0 items-center justify-end gap-1 ${
                                            paySplitError ? 'text-amber-700' : ''
                                        }`}
                                    >
                                        <input
                                            className="w-full min-w-0 border-0 bg-transparent py-1 text-right text-2xl font-bold tabular-nums text-gray-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-gray-500"
                                            type="number"
                                            min="0"
                                            step="1"
                                            readOnly
                                            value={estimatedCost || payTableTotal || 0}
                                            disabled={fieldsDisabled}
                                            {...numberInputNoScrollProps}
                                        />
                                        <span className="text-sm font-bold text-gray-500">AED</span>
                                    </div>
                                </div>
                                {paySplitError || employeeRowsError || finesTotalError || companyPartyError ? (
                                    <div className="space-y-1 text-xs font-semibold text-amber-700">
                                        {finesTotalError ? (
                                            <p>
                                                {getInitiatePayValidationMessage(formData, {
                                                    requirePayable: true,
                                                    requireFinesTotalMatch: true,
                                                    finesTotal: totalFines,
                                                }) ||
                                                    `TOTAL and TOTAL AMOUNT must be equal (${totalFines.toLocaleString()} AED)`}
                                            </p>
                                        ) : null}
                                        {companyPartyError ? (
                                            <p>Select company under Company payment</p>
                                        ) : null}
                                        {paySplitError ? (
                                            <p>
                                                Company pay + Employee pay must equal Total (
                                                {estimatedCost.toLocaleString()} AED)
                                            </p>
                                        ) : null}
                                        {employeeRowsError ? (
                                            <p>
                                                Employee amounts must total Employee pay (
                                                {employeePayAmount.toLocaleString()} AED)
                                            </p>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </div>

                    {canEditInitiateFields && missingFields.length > 0 ? (
                        <p className="mt-4 text-xs text-amber-700">
                            Still required: {missingFields.join(', ')}
                        </p>
                    ) : null}

                    {assignmentPending && canEditAssignment ? (
                        <div className="mt-4 flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
                            <button
                                type="button"
                                disabled={saving}
                                onClick={handleCancel}
                                className={tireBtnSecondary}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={saving || !canRequest}
                                onClick={() => void handleSubmit()}
                                className={tireBtnPrimary}
                            >
                                {saving ? 'Sending…' : 'Send'}
                            </button>
                        </div>
                    ) : null}

                    {!assignmentPending && canEditInitiateFields ? (
                        <div className="mt-4 flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
                            <button
                                type="button"
                                disabled={saving || missingFields.length > 0}
                                onClick={() => void handleSaveDraft()}
                                className={tireBtnPrimary}
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    ) : null}

                    {saving ? (
                        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                            <Loader2 size={16} className="animate-spin" />
                            Saving…
                        </div>
                    ) : null}
                </FineFormCard>
            </div>

            <VehicleHandoverAssessmentPhotoViewer
                open={viewerOpen}
                items={photoGalleryItems}
                startIndex={viewerStartIndex}
                onClose={() => setViewerOpen(false)}
            />
        </>
    );
}
