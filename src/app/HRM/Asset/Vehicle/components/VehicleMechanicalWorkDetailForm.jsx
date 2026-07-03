'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, GripVertical, Loader2, Plus, Upload } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    extractStorageReference,
    loadStorageFileBlob,
    openAttachmentInNewTab,
} from '@/utils/attachmentPreview';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import VehicleMechanicalWorkFormFieldCell from './VehicleMechanicalWorkFormFieldCell';
import VehicleHandoverAssessmentPhotoViewer from './VehicleHandoverAssessmentPhotoViewer';
import { isOilServiceAssignmentPending } from '../utils/vehicleOilServiceAccess';
import {
    buildMechanicalWorkDetailFormState,
    buildMechanicalWorkDetailSubmitBody,
    applyEmployeePayTargetToRows,
    applyLinkedSplitPayPercent,
    adjustEmployeeRowsAfterPaidChange,
    buildEmployeeRowBreakdowns,
    computeEmployeePayTarget,
    getMechanicalWorkDetailFormMissingFields,
    isMechanicalWorkDetailFormComplete,
    redistributeEmployeeLiabilityRows,
    sumEmployeeLiabilityRows,
} from '../utils/vehicleMechanicalWorkDetailForm';
import {
    MECHANICAL_WORK_DETAIL_GRID_LAYOUT,
    tireAccent,
    tireBtnPrimary,
    tireBtnSecondary,
    tireFieldSelect,
    tireMoneyInput,
    tirePhotoAddBtn,
    tirePhotoThumb,
    tireUploadBtn,
    tireViewBtn,
} from '../utils/vehicleMechanicalWorkDetailUi';
import {
    buildTireQuoteDragPayload,
    quoteKindToKey,
    TIRE_QUOTE_DRAG_TYPE,
} from '../utils/vehicleMechanicalWorkQuoteDrag';

const PDF_MIME_TYPES = ['application/pdf'];
const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg'];
const MAX_IMAGE_BYTES = 1 * 1024 * 1024;

function directBodyWorkImageSrc(img) {
    const url = String(img?.url || '').trim();
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) return url;
    return '';
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

export default function VehicleMechanicalWorkDetailForm({
    asset,
    service,
    vehicleId,
    serviceId,
    onSaved,
    draftSubmitRef,
    onDraftStateChange,
    canEditAssignment = true,
    className = '',
}) {
    const router = useRouter();
    const { toast } = useToast();
    const photoInputRef = useRef(null);
    const [employees, setEmployees] = useState([]);
    const [saving, setSaving] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerStartIndex, setViewerStartIndex] = useState(0);
    const [resolvedExistingPhotoSrc, setResolvedExistingPhotoSrc] = useState({});
    const [formData, setFormData] = useState(() => buildMechanicalWorkDetailFormState(service, asset));

    const remark = useMemo(() => parseVehicleServiceRemark(service) || {}, [service]);
    const assignmentPending = isOilServiceAssignmentPending(remark);
    const fieldsDisabled = !assignmentPending || saving || !canEditAssignment;

    useEffect(() => {
        setFormData(buildMechanicalWorkDetailFormState(service, asset));
    }, [service?._id, service?.updatedAt, service?.remark, asset]);

    useEffect(() => {
        const existing = formData.existingBodyWorkImages || [];
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
                const direct = directBodyWorkImageSrc(img);
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
    }, [formData.existingBodyWorkImages]);

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

    const set = useCallback((key, value) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    }, []);

    const setPaymentByMode = (mode) => {
        setFormData((prev) => {
            const companyPayPercent = mode === 'company' ? '100' : mode === 'person' ? '0' : '50';
            const employeePayPercent = mode === 'person' ? '100' : mode === 'company' ? '0' : '50';
            return {
                ...prev,
                paymentByMode: mode,
                companyPayPercent,
                employeePayPercent,
                employeeLiabilityRows: applyEmployeePayTargetToRows(
                    prev.employeeLiabilityRows,
                    prev.estimatedCost,
                    employeePayPercent,
                ),
            };
        });
    };

    const setSplitPayPercent = useCallback((changedField, rawValue) => {
        setFormData((prev) => {
            const linked = applyLinkedSplitPayPercent(changedField, rawValue);
            const companyPayPercent =
                linked.companyPayPercent !== undefined ? linked.companyPayPercent : prev.companyPayPercent;
            const employeePayPercent =
                linked.employeePayPercent !== undefined ? linked.employeePayPercent : prev.employeePayPercent;
            return {
                ...prev,
                companyPayPercent,
                employeePayPercent,
                employeeLiabilityRows: applyEmployeePayTargetToRows(
                    prev.employeeLiabilityRows,
                    prev.estimatedCost,
                    employeePayPercent,
                ),
            };
        });
    }, []);

    const estimatedCost = Number(formData.estimatedCost || 0);
    const companyPct = Number(formData.companyPayPercent || 0);
    const employeePct = Number(formData.employeePayPercent || 0);
    const companyPayAmount = Number.isFinite(estimatedCost)
        ? Math.round((estimatedCost * companyPct) / 100)
        : 0;
    const employeePayAmount = Number.isFinite(estimatedCost)
        ? Math.round((estimatedCost * employeePct) / 100)
        : 0;
    const paymentByMode = formData.paymentByMode || 'company';
    const isEmpOnly = paymentByMode === 'person';
    const isCompanyOnly = paymentByMode === 'company';
    const isSplitPayment = paymentByMode === 'split';
    const employeeLiabilitySum = sumEmployeeLiabilityRows(formData.employeeLiabilityRows);
    const rowBreakdowns = useMemo(
        () => buildEmployeeRowBreakdowns(formData.employeeLiabilityRows || []),
        [formData.employeeLiabilityRows],
    );
    const breakdownGrandTotal = useMemo(() => {
        if (isSplitPayment) {
            return employeePayAmount + companyPayAmount;
        }
        return rowBreakdowns.reduce((sum, row) => sum + row.totalPay, 0);
    }, [rowBreakdowns, isSplitPayment, employeePayAmount, companyPayAmount]);
    const showCompanyFields = !isEmpOnly;
    const showEmployeeFields = !isCompanyOnly;
    const showEmployeeLiabilityBreakdown = showEmployeeFields;
    const showCompanyPaymentSummary = isCompanyOnly;
    const costRowGridClass = isSplitPayment
        ? 'sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        : 'sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    const breakdownGridClass = 'grid-cols-3';

    const photoGalleryItems = useMemo(() => {
        const items = [];
        (formData.existingBodyWorkImages || []).forEach((img, idx) => {
            const url = resolvedExistingPhotoSrc[`existing-${idx}`] || directBodyWorkImageSrc(img);
            if (!url) return;
            items.push({
                key: `existing-${idx}`,
                label: `Rectification photo ${items.length + 1}`,
                url,
            });
        });
        (formData.bodyWorkImages || []).forEach((img, idx) => {
            const url = img?.data
                ? `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`
                : '';
            if (!url) return;
            items.push({
                key: `new-${idx}`,
                label: `Rectification photo ${items.length + 1}`,
                url,
            });
        });
        return items;
    }, [formData.existingBodyWorkImages, formData.bodyWorkImages, resolvedExistingPhotoSrc]);

    const openPhotoViewer = useCallback(
        (key) => {
            const index = photoGalleryItems.findIndex((item) => item.key === key);
            if (index < 0) return;
            setViewerStartIndex(index);
            setViewerOpen(true);
        },
        [photoGalleryItems],
    );

    const employeeOptions = employees.map((emp) => (
        <option key={emp._id} value={String(emp._id)}>
            {`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId || 'Employee'}
        </option>
    ));

    const readPdfFile = (file, onDone) => {
        if (!file) return;
        if (!PDF_MIME_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
            toast({ variant: 'destructive', title: 'Invalid file', description: 'Quote must be a PDF.' });
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const raw = String(reader.result || '');
            const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
            onDone(file, base64);
        };
        reader.readAsDataURL(file);
    };

    const handleQuoteFile = (kind, file) => {
        readPdfFile(file, (f, base64) => {
            if (kind === 'attachment') {
                setFormData((prev) => ({
                    ...prev,
                    attachmentName: f.name,
                    attachmentBase64: base64,
                    attachmentMime: f.type || 'application/pdf',
                    existingAttachmentUrl: '',
                    estimatedCost: prev.estimatedCost || String(prev.quotation1Amount || ''),
                }));
            } else if (kind === 'quotation2') {
                setFormData((prev) => ({
                    ...prev,
                    quotation2Name: f.name,
                    quotation2Base64: base64,
                    quotation2Mime: f.type || 'application/pdf',
                    existingQuotation2Url: '',
                }));
            } else if (kind === 'quotation3') {
                setFormData((prev) => ({
                    ...prev,
                    quotation3Name: f.name,
                    quotation3Base64: base64,
                    quotation3Mime: f.type || 'application/pdf',
                    existingQuotation3Url: '',
                }));
            }
        });
    };

    const appendPhotos = (files) => {
        const list = Array.from(files || []);
        list.forEach((file) => {
            if (!IMAGE_MIME_TYPES.includes(file.type) && !/\.(jpe?g|png)$/i.test(file.name)) {
                toast({ variant: 'destructive', title: 'Invalid image', description: 'Use JPG or PNG only.' });
                return;
            }
            if (file.size > MAX_IMAGE_BYTES) {
                toast({ variant: 'destructive', title: 'File too large', description: 'Max 1 MB per image.' });
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                const raw = String(reader.result || '');
                const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
                setFormData((prev) => ({
                    ...prev,
                    bodyWorkImages: [
                        ...(prev.bodyWorkImages || []),
                        { name: file.name, data: base64, mimeType: file.type || 'image/jpeg' },
                    ],
                }));
            };
            reader.readAsDataURL(file);
        });
    };

    const setEmployeeRowPaidAmount = (index, value) => {
        setFormData((prev) => {
            const rows = [...(prev.employeeLiabilityRows || [])];
            const target = computeEmployeePayTarget(prev.estimatedCost, prev.employeePayPercent);
            if (value === '' || value == null) {
                rows[index] = { ...rows[index], paidAmount: value };
                return { ...prev, employeeLiabilityRows: rows };
            }
            const nextRows = adjustEmployeeRowsAfterPaidChange(rows, index, value, target);
            return { ...prev, employeeLiabilityRows: nextRows };
        });
    };

    const finalizeEmployeeRowPaidAmount = (index) => {
        setFormData((prev) => {
            const rows = [...(prev.employeeLiabilityRows || [])];
            const raw = rows[index]?.paidAmount ?? '';
            if (String(raw).trim() !== '') return prev;
            const target = computeEmployeePayTarget(prev.estimatedCost, prev.employeePayPercent);
            const nextRows = adjustEmployeeRowsAfterPaidChange(rows, index, '0', target);
            return { ...prev, employeeLiabilityRows: nextRows };
        });
    };

    const updateEmployeeRow = (index, key, value) => {
        setFormData((prev) => {
            const rows = [...(prev.employeeLiabilityRows || [])];
            rows[index] = { ...rows[index], [key]: value };
            return { ...prev, employeeLiabilityRows: rows };
        });
    };

    const addEmployeeRow = () => {
        setFormData((prev) => {
            const nextRows = [...(prev.employeeLiabilityRows || []), { employeeId: '', paidAmount: '' }];
            const target = computeEmployeePayTarget(prev.estimatedCost, prev.employeePayPercent);
            return {
                ...prev,
                employeeLiabilityRows: redistributeEmployeeLiabilityRows(nextRows, target),
            };
        });
    };

    const removeEmployeeRow = (index) => {
        setFormData((prev) => {
            const rows = [...(prev.employeeLiabilityRows || [])];
            if (rows.length <= 1) return prev;
            rows.splice(index, 1);
            const target = computeEmployeePayTarget(prev.estimatedCost, prev.employeePayPercent);
            return {
                ...prev,
                employeeLiabilityRows: redistributeEmployeeLiabilityRows(rows, target),
            };
        });
    };

    const persistForm = useCallback(
        async ({ submitAfterSave = false } = {}) => {
            if (!vehicleId || !serviceId) return false;
            setSaving(true);
            try {
                const body = buildMechanicalWorkDetailSubmitBody(formData, { keepPending: true });
                await axiosInstance.put(`/AssetItem/${vehicleId}/service/${serviceId}`, body);
                if (submitAfterSave) {
                    const submitRes = await axiosInstance.post(
                        `/AssetItem/${vehicleId}/service/${serviceId}/submit-request`,
                    );
                    toast({
                        title: 'Submitted for approval',
                        description:
                            'Mechanical work assignment was sent. HR was emailed and will see this in the vehicle inbox bell.',
                    });
                    if (typeof onSaved === 'function') onSaved();
                } else {
                    toast({ title: 'Draft saved', description: 'Mechanical work assignment draft saved.' });
                    if (typeof onSaved === 'function') onSaved();
                }
                return true;
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: submitAfterSave ? 'Could not submit' : 'Could not save draft',
                    description: error.response?.data?.message || 'Try again.',
                });
                return false;
            } finally {
                setSaving(false);
            }
        },
        [formData, onSaved, serviceId, toast, vehicleId],
    );

    const handleSubmit = useCallback(async () => {
        if (!assignmentPending || !isMechanicalWorkDetailFormComplete(formData, asset)) return;
        await persistForm({ submitAfterSave: true });
    }, [asset, assignmentPending, formData, persistForm]);

    const handleSaveDraft = async () => {
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
        assignmentPending && !saving && canEditAssignment && isMechanicalWorkDetailFormComplete(formData, asset);
    const missingFields = useMemo(
        () =>
            assignmentPending && canEditAssignment ? getMechanicalWorkDetailFormMissingFields(formData, asset) : [],
        [asset, formData, assignmentPending, canEditAssignment],
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

    const QuoteUpload = ({ label, kind, fileName, existingUrl, amount = '' }) => {
        const hasQuote = !!(fileName || existingUrl);
        const dragKey = quoteKindToKey(kind);

        const handleDragStart = (event) => {
            if (!hasQuote || !dragKey) return;
            event.dataTransfer.setData(
                TIRE_QUOTE_DRAG_TYPE,
                buildTireQuoteDragPayload({
                    key: dragKey,
                    label,
                    fileName: fileName || label,
                    amount,
                }),
            );
            event.dataTransfer.effectAllowed = 'copy';
        };

        const quotesDraggable = hasQuote && !assignmentPending;

        return (
            <div
                className={`flex flex-wrap items-center gap-2 min-h-[40px] rounded-lg border px-2 py-1.5 transition-colors ${
                    hasQuote ? 'border-blue-200 bg-blue-50/40' : 'border-transparent'
                }`}
            >
                {quotesDraggable ? (
                    <span
                        draggable
                        onDragStart={handleDragStart}
                        className="inline-flex cursor-grab items-center rounded-md border border-blue-100 bg-white px-1.5 py-1 text-blue-500 active:cursor-grabbing"
                        title={`Drag ${label} to Approved Quote below`}
                    >
                        <GripVertical size={14} />
                    </span>
                ) : null}
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
                            accept=".pdf,application/pdf"
                            disabled={fieldsDisabled}
                            onChange={(e) => {
                                handleQuoteFile(kind, e.target.files?.[0]);
                                e.target.value = '';
                            }}
                        />
                    </label>
                ) : null}
                {fileName ? <span className="text-[10px] text-gray-500 truncate">{fileName}</span> : null}
            </div>
        );
    };

    const { fieldMinHeightPx, gapClass } = MECHANICAL_WORK_DETAIL_GRID_LAYOUT;
    const accent = tireAccent;

    return (
        <>
            <div className={`flex w-full ${className}`.trim()}>
                <FineFormCard
                    title="Mechanical Work Assignment Details"
                    subtitle={
                        assignmentPending
                            ? 'Complete all fields, then click Submit for Approval'
                            : 'Submitted assignment — drag Quote 1, 2, or 3 below into Quotation Review'
                    }
                    icon={ClipboardList}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    className={`w-full ${assignmentPending ? '' : 'opacity-[0.97]'}`}
                >
                    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gapClass}`}>
                        <VehicleMechanicalWorkFormFieldCell
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
                                <option value="">Select employee</option>
                                {employeeOptions}
                            </select>
                        </VehicleMechanicalWorkFormFieldCell>
                        <VehicleMechanicalWorkFormFieldCell
                            label="Car Driven By"
                            accentClass={accent(1)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <select
                                className={tireFieldSelect}
                                value={formData.carDrivenByEmployeeId || ''}
                                onChange={(e) => set('carDrivenByEmployeeId', e.target.value)}
                                disabled={fieldsDisabled}
                            >
                                <option value="">Select employee</option>
                                {employeeOptions}
                            </select>
                        </VehicleMechanicalWorkFormFieldCell>
                        <VehicleMechanicalWorkFormFieldCell
                            label="Payment By"
                            accentClass={accent(2)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <PaymentByToggle
                                value={formData.paymentByMode || 'company'}
                                onChange={setPaymentByMode}
                                disabled={fieldsDisabled}
                            />
                        </VehicleMechanicalWorkFormFieldCell>

                        <div className={`${costRowGridClass} ${gapClass}`}>
                                    <VehicleMechanicalWorkFormFieldCell
                                        label="Estimated Cost"
                                        accentClass={accent(0)}
                                        minHeightPx={fieldMinHeightPx}
                                    >
                                        <div className="relative">
                                            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                                                AED
                                            </span>
                                            <input
                                                className={`${tireMoneyInput} pl-11`}
                                                type="number"
                                                min="0"
                                                value={formData.estimatedCost || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        estimatedCost: val,
                                                        quotation1Amount: val,
                                                        value: val,
                                                        employeeLiabilityRows: applyEmployeePayTargetToRows(
                                                            prev.employeeLiabilityRows,
                                                            val,
                                                            prev.employeePayPercent,
                                                        ),
                                                    }));
                                                }}
                                                disabled={fieldsDisabled}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </VehicleMechanicalWorkFormFieldCell>
                                    {showCompanyFields ? (
                                        <VehicleMechanicalWorkFormFieldCell
                                            label="Company Pay %"
                                            accentClass={accent(1)}
                                            minHeightPx={fieldMinHeightPx}
                                        >
                                            <input
                                                className={tireMoneyInput}
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={formData.companyPayPercent || ''}
                                                onChange={(e) => setSplitPayPercent('company', e.target.value)}
                                                disabled={fieldsDisabled || !isSplitPayment}
                                            />
                                        </VehicleMechanicalWorkFormFieldCell>
                                    ) : null}
                                    {showEmployeeFields ? (
                                        <VehicleMechanicalWorkFormFieldCell
                                            label="Employee Pay %"
                                            accentClass={accent(2)}
                                            minHeightPx={fieldMinHeightPx}
                                        >
                                            <input
                                                className={tireMoneyInput}
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={formData.employeePayPercent || ''}
                                                onChange={(e) => setSplitPayPercent('employee', e.target.value)}
                                                disabled={fieldsDisabled || !isSplitPayment}
                                            />
                                        </VehicleMechanicalWorkFormFieldCell>
                                    ) : null}
                                    <VehicleMechanicalWorkFormFieldCell
                                        label="Total"
                                        accentClass={accent(0)}
                                        minHeightPx={fieldMinHeightPx}
                                    >
                                        <input
                                            className={tireMoneyInput}
                                            readOnly
                                            value={estimatedCost ? `${estimatedCost.toLocaleString()} AED` : '—'}
                                        />
                                    </VehicleMechanicalWorkFormFieldCell>
                                </div>
                                {showCompanyPaymentSummary ? (
                                    <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-gray-200 bg-white overflow-hidden">
                                        <div className="grid grid-cols-2 border-b border-gray-200 bg-slate-50">
                                            {['Company Pay', 'Paid Amount'].map((heading) => (
                                                <div
                                                    key={heading}
                                                    className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 border-r border-gray-200 last:border-r-0"
                                                >
                                                    {heading}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <div className="border-r border-gray-100 p-2">
                                                <input
                                                    className={`${tireMoneyInput} min-h-[36px] py-1 bg-gray-50`}
                                                    readOnly
                                                    value={
                                                        companyPayAmount
                                                            ? `${companyPayAmount.toLocaleString()} AED`
                                                            : '—'
                                                    }
                                                />
                                            </div>
                                            <div className="p-2">
                                                <input
                                                    className={`${tireMoneyInput} min-h-[36px] py-1 bg-gray-50 font-semibold`}
                                                    readOnly
                                                    value={
                                                        companyPayAmount
                                                            ? `${companyPayAmount.toLocaleString()} AED`
                                                            : '—'
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                                {showEmployeeLiabilityBreakdown ? (
                                    <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-gray-200 bg-white overflow-hidden">
                                        <div className={`grid ${breakdownGridClass} border-b border-gray-200 bg-slate-50`}>
                                            {['Employee Name', 'Paid Amount', 'Total Pay'].map((heading) => (
                                                <div
                                                    key={heading}
                                                    className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 border-r border-gray-200 last:border-r-0"
                                                >
                                                    {heading}
                                                </div>
                                            ))}
                                        </div>
                                        {(formData.employeeLiabilityRows || []).map((row, index) => {
                                            const breakdown = rowBreakdowns[index] || {
                                                paidAmount: 0,
                                                totalPay: 0,
                                            };
                                            const isLastRow =
                                                index === (formData.employeeLiabilityRows || []).length - 1;
                                            return (
                                                <div
                                                    key={`emp-row-${index}`}
                                                    className={`grid ${breakdownGridClass} border-b border-gray-100 last:border-b-0`}
                                                >
                                                    <div className="flex items-center gap-1 border-r border-gray-100 p-2">
                                                        <select
                                                            className={`${tireFieldSelect} min-h-[36px] py-1`}
                                                            value={row.employeeId || ''}
                                                            onChange={(e) =>
                                                                updateEmployeeRow(index, 'employeeId', e.target.value)
                                                            }
                                                            disabled={fieldsDisabled}
                                                        >
                                                            <option value="">Select employee</option>
                                                            {employeeOptions}
                                                        </select>
                                                        {!fieldsDisabled &&
                                                        (formData.employeeLiabilityRows || []).length > 1 ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeEmployeeRow(index)}
                                                                className="shrink-0 rounded-md px-1.5 py-1 text-[10px] font-bold text-red-500 hover:bg-red-50"
                                                                title="Remove row"
                                                            >
                                                                ×
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                    <div className="flex items-center gap-1 border-r border-gray-100 p-2">
                                                        <input
                                                            className={`${tireMoneyInput} min-h-[36px] py-1 flex-1`}
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={row.paidAmount || ''}
                                                            onChange={(e) =>
                                                                setEmployeeRowPaidAmount(index, e.target.value)
                                                            }
                                                            onBlur={() => finalizeEmployeeRowPaidAmount(index)}
                                                            disabled={fieldsDisabled}
                                                            placeholder="AED"
                                                        />
                                                        {!fieldsDisabled && isLastRow ? (
                                                            <button
                                                                type="button"
                                                                onClick={addEmployeeRow}
                                                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
                                                                title="Add employee"
                                                            >
                                                                <Plus size={16} />
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                    <div className="border-l border-gray-100 p-2">
                                                        <input
                                                            className={`${tireMoneyInput} min-h-[36px] py-1 bg-gray-50 font-semibold`}
                                                            readOnly
                                                            value={
                                                                breakdown.totalPay
                                                                    ? `${breakdown.totalPay.toLocaleString()} AED`
                                                                    : '—'
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div
                                            className={`grid ${breakdownGridClass} border-t border-gray-200 bg-slate-50/80`}
                                        >
                                            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500 border-r border-gray-200">
                                                Employee total
                                            </div>
                                            <div className="px-3 py-2 border-r border-gray-200">
                                                <input
                                                    className={`${tireMoneyInput} min-h-[36px] py-1 bg-white font-semibold`}
                                                    readOnly
                                                    value={
                                                        employeePayAmount
                                                            ? `${employeeLiabilitySum.toLocaleString()} / ${employeePayAmount.toLocaleString()} AED`
                                                            : employeeLiabilitySum
                                                              ? `${employeeLiabilitySum.toLocaleString()} AED`
                                                              : '—'
                                                    }
                                                    title="Paid sum / employee liability target"
                                                />
                                            </div>
                                            <div className="px-3 py-2">
                                                <input
                                                    className={`${tireMoneyInput} min-h-[36px] py-1 bg-white font-semibold ${
                                                        isSplitPayment &&
                                                        employeePayAmount > 0 &&
                                                        Math.abs(employeeLiabilitySum - employeePayAmount) > 0.01
                                                            ? 'text-amber-700'
                                                            : ''
                                                    }`}
                                                    readOnly
                                                    value={
                                                        isSplitPayment && employeePayAmount
                                                            ? `${employeePayAmount.toLocaleString()} AED`
                                                            : employeeLiabilitySum
                                                              ? `${employeeLiabilitySum.toLocaleString()} AED`
                                                              : '—'
                                                    }
                                                    title={
                                                        isSplitPayment
                                                            ? 'Employee liability cap from Employee Pay %'
                                                            : 'Sum of employee paid amounts'
                                                    }
                                                />
                                            </div>
                                        </div>
                                        {isSplitPayment ? (
                                            <>
                                                <div
                                                    className={`grid ${breakdownGridClass} border-t border-gray-100 bg-white`}
                                                >
                                                    <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500 border-r border-gray-200">
                                                        Company pay
                                                    </div>
                                                    <div className="px-3 py-2 border-r border-gray-200" />
                                                    <div className="px-3 py-2">
                                                        <input
                                                            className={`${tireMoneyInput} min-h-[36px] py-1 bg-gray-50 font-semibold`}
                                                            readOnly
                                                            value={
                                                                companyPayAmount
                                                                    ? `${companyPayAmount.toLocaleString()} AED`
                                                                    : '—'
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                                <div
                                                    className={`grid ${breakdownGridClass} border-t border-gray-200 bg-slate-50/80`}
                                                >
                                                    <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500 border-r border-gray-200">
                                                        Grand total
                                                    </div>
                                                    <div className="px-3 py-2 border-r border-gray-200" />
                                                    <div className="px-3 py-2">
                                                        <input
                                                            className={`${tireMoneyInput} min-h-[36px] py-1 bg-white font-semibold`}
                                                            readOnly
                                                            value={
                                                                breakdownGrandTotal || estimatedCost
                                                                    ? `${(breakdownGrandTotal || estimatedCost).toLocaleString()} AED`
                                                                    : '—'
                                                            }
                                                            title="Estimated cost (employee cap + company pay)"
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        ) : null}
                                    </div>
                                ) : null}
                                <VehicleMechanicalWorkFormFieldCell
                                    label="Quote 1 (required)"
                                    accentClass={accent(1)}
                                    minHeightPx={fieldMinHeightPx}
                                >
                                    <QuoteUpload
                                        label="Quote 1"
                                        kind="attachment"
                                        fileName={formData.attachmentName}
                                        existingUrl={formData.existingAttachmentUrl}
                                        amount={formData.estimatedCost || formData.quotation1Amount || ''}
                                    />
                                </VehicleMechanicalWorkFormFieldCell>
                                <VehicleMechanicalWorkFormFieldCell
                                    label="Quote 2"
                                    accentClass={accent(2)}
                                    minHeightPx={fieldMinHeightPx}
                                >
                                    <QuoteUpload
                                        label="Quote 2"
                                        kind="quotation2"
                                        fileName={formData.quotation2Name}
                                        existingUrl={formData.existingQuotation2Url}
                                        amount={formData.quotation2Amount || ''}
                                    />
                                </VehicleMechanicalWorkFormFieldCell>
                                <VehicleMechanicalWorkFormFieldCell
                                    label="Quote 3"
                                    accentClass={accent(0)}
                                    minHeightPx={fieldMinHeightPx}
                                >
                                    <QuoteUpload
                                        label="Quote 3"
                                        kind="quotation3"
                                        fileName={formData.quotation3Name}
                                        existingUrl={formData.existingQuotation3Url}
                                        amount={formData.quotation3Amount || ''}
                                    />
                                </VehicleMechanicalWorkFormFieldCell>
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-4">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Rectification Area Photos
                        </span>
                        <div className="mt-2 flex flex-wrap gap-2 items-center">
                            {(formData.existingBodyWorkImages || []).map((img, idx) => {
                                const src =
                                    resolvedExistingPhotoSrc[`existing-${idx}`] ||
                                    directBodyWorkImageSrc(img);
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
                            {(formData.bodyWorkImages || []).map((img, idx) => {
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
                                        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                        className="hidden"
                                        onChange={(e) => {
                                            appendPhotos(e.target.files);
                                            e.target.value = '';
                                        }}
                                    />
                                </>
                            ) : null}
                        </div>
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-4">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Mechanical Work Description
                        </span>
                        <textarea
                            className={`${tireFieldSelect} mt-1.5 resize-y min-h-[88px] font-medium`}
                            value={formData.serviceIssue || ''}
                            onChange={(e) => set('serviceIssue', e.target.value)}
                            disabled={fieldsDisabled}
                            rows={4}
                            placeholder="Enter work description"
                        />
                    </div>

                    {assignmentPending && canEditAssignment && missingFields.length > 0 ? (
                        <p className="mt-4 text-xs text-amber-700">
                            Still required: {missingFields.join(', ')}
                        </p>
                    ) : null}

                    {assignmentPending && canEditAssignment ? (
                        <div className="mt-4 flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => void handleSaveDraft()}
                                className={tireBtnSecondary}
                            >
                                Save Draft
                            </button>
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
                                {saving ? 'Submitting…' : 'Submit for Approval'}
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
