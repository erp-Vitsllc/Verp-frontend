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
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import VehicleBodyWorkFormFieldCell from './VehicleBodyWorkFormFieldCell';
import VehicleHandoverAssessmentPhotoViewer from './VehicleHandoverAssessmentPhotoViewer';
import { useDrivingLicenseHolders } from '@/hooks/useDrivingLicenseHolders';
import {
    isOilServiceAssignmentPending,
} from '../utils/vehicleOilServiceAccess';
import {
    resolveFlowchartAdminEmployeeRef,
    resolveVehicleServiceAssignedOwnerId,
} from '../utils/vehicleServiceAssignedOwner';
import {
    buildBodyWorkDetailFormState,
    buildBodyWorkDetailSubmitBody,
    getBodyWorkDetailFormMissingFields,
    isBodyWorkDetailFormComplete,
    sumEmployeeLiabilityRows,
} from '../utils/vehicleBodyWorkDetailForm';
import {
    resolveShopServicePayAmounts,
    syncInitiateServicePayAmounts,
    resolveInitiateAbsolutePayAmounts,
} from '../utils/vehicleShopHrReviewPay';
import {
    BODY_WORK_DETAIL_GRID_LAYOUT,
    tireAccent,
    tireBtnPrimary,
    tireBtnSecondary,
    tireFieldInput,
    tireFieldSelect,
    tireMoneyInput,
    tirePhotoAddBtn,
    tirePhotoThumb,
    tireUploadBtn,
    tireViewBtn,
} from '../utils/vehicleBodyWorkDetailUi';
import {
    ERP_JPEG_ACCEPT,
    ERP_PDF_ACCEPT,
    filterErpUploadFiles,
    validateErpPdfFile,
} from '@/utils/uploadFileTypes';

function directBodyWorkImageSrc(img) {
    const url = String(img?.url || img?.data || '').trim();
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
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

export default function VehicleBodyWorkDetailForm({
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
    const [saving, setSaving] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerStartIndex, setViewerStartIndex] = useState(0);
    const [resolvedExistingPhotoSrc, setResolvedExistingPhotoSrc] = useState({});
    const [formData, setFormData] = useState(() =>
        buildBodyWorkDetailFormState(service, asset, { flowchartRows }),
    );

    const remark = useMemo(() => parseVehicleServiceRemark(service) || {}, [service]);
    const assignmentPending = isOilServiceAssignmentPending(remark);
    // Page gates HR-after-submit; Initiate stays editable until Zoho bill is accepted.
    const canEditInitiateFields = Boolean(canEditAssignment);
    const fieldsDisabled = !canEditInitiateFields || saving;

    useEffect(() => {
        setFormData(buildBodyWorkDetailFormState(service, asset, { flowchartRows }));
    }, [service?._id, service?.updatedAt, service?.remark, asset, flowchartRows]);

    useEffect(() => {
        if (!assignmentPending) return;
        const saved = String(remark.vehicleOwnerEmployeeId || '').trim();
        if (saved) return;
        const nextId = resolveVehicleServiceAssignedOwnerId(asset, flowchartRows, '');
        if (!nextId) return;
        setFormData((prev) => {
            if (String(prev.vehicleOwnerEmployeeId || '').trim()) return prev;
            return { ...prev, vehicleOwnerEmployeeId: nextId };
        });
    }, [assignmentPending, asset, flowchartRows, remark.vehicleOwnerEmployeeId]);

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

    const licensedEmployees = useDrivingLicenseHolders({
        preserveEmployeeId: formData.carDrivenByEmployeeId,
        sourceEmployees: employees,
    });

    const set = useCallback((key, value) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    }, []);

    const setPaymentByMode = (mode) => {
        setFormData((prev) => {
            const cost = Math.max(0, Math.round(Number(prev.estimatedCost || 0)));
            const companyPayPercent = mode === 'company' ? '100' : mode === 'person' ? '0' : '50';
            const employeePayPercent = mode === 'person' ? '100' : mode === 'company' ? '0' : '50';
            const companyPayAmount =
                mode === 'company' ? String(cost) : mode === 'person' ? '0' : String(Math.round(cost / 2));
            const employeePayAmount =
                mode === 'person'
                    ? String(cost)
                    : mode === 'company'
                      ? '0'
                      : String(Math.max(0, cost - Number(companyPayAmount)));
            return {
                ...prev,
                paymentByMode: mode,
                companyPayPercent,
                employeePayPercent,
                companyPayAmount,
                employeePayAmount,
            };
        });
    };

    const applyPayAmountChange = useCallback((field, value) => {
        setFormData((prev) => {
            const absolutePay = resolveInitiateAbsolutePayAmounts({
                estimatedCost: prev.estimatedCost,
                companyPayPercent: prev.companyPayPercent,
                employeePayPercent: prev.employeePayPercent,
                companyPayAmount: prev.companyPayAmount,
                employeePayAmount: prev.employeePayAmount,
            });
            const synced = syncInitiateServicePayAmounts({
                field,
                value,
                estimatedCost: prev.estimatedCost,
                companyPayAmount: absolutePay.companyPayAmount,
                employeePayAmount: absolutePay.employeePayAmount,
                paymentByMode: prev.paymentByMode || 'company',
                employeeLiabilityRows: prev.employeeLiabilityRows,
            });
            return {
                ...prev,
                estimatedCost: synced.estimatedCost,
                quotation1Amount: synced.quotation1Amount,
                value: synced.value,
                companyPayPercent: synced.companyPayPercent,
                employeePayPercent: synced.employeePayPercent,
                companyPayAmount: synced.companyPayAmount,
                employeePayAmount: synced.employeePayAmount,
            };
        });
    }, []);

    const estimatedCost = Number(formData.estimatedCost || 0);
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
                estimatedCost: formData.estimatedCost,
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
        ],
    );
    const companyPayAmount = absolutePayAmounts.companyPayAmount;
    const employeePayAmount = absolutePayAmounts.employeePayAmount;
    // Toggle is source of truth while editing; resolved mode only fills gaps.
    const paymentByMode = formData.paymentByMode || resolvedPayAmounts.paymentByMode || 'company';
    const isEmpOnly = paymentByMode === 'person';
    const isCompanyOnly = paymentByMode === 'company';
    const isSplitPayment = paymentByMode === 'split';
    const showCompanyFields = !isEmpOnly;
    const showEmployeeFields = !isCompanyOnly;
    const employeeLiabilitySum = sumEmployeeLiabilityRows(formData.employeeLiabilityRows);
    const paySplitError =
        isSplitPayment &&
        estimatedCost > 0 &&
        Math.abs(companyPayAmount + employeePayAmount - estimatedCost) > 0.01;
    const employeeRowsError =
        showEmployeeFields &&
        Math.abs(employeeLiabilitySum - employeePayAmount) > 0.01;

    const photoGalleryItems = useMemo(() => {
        const items = [];
        (formData.existingBodyWorkImages || []).forEach((img, idx) => {
            const thumb =
                resolvedExistingPhotoSrc[`existing-${idx}`] || directBodyWorkImageSrc(img);
            const dataUrl = thumb?.startsWith('data:') ? thumb : '';
            // Pass storage photo (not blob:) so the shared handover viewer can proxy-load it.
            const photo = dataUrl || img;
            if (!photo && !thumb) return;
            items.push({
                key: `existing-${idx}`,
                label: `Rectification photo ${items.length + 1}`,
                photo,
                ...(dataUrl ? { url: dataUrl } : {}),
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
                photo: url,
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

    const employeeOptionsForRow = (rowIndex) => {
        const selectedElsewhere = new Set(
            (formData.employeeLiabilityRows || [])
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
                    {`${emp.firstName || ''} ${emp.lastName || ''}`.trim() ||
                        emp.employeeId ||
                        'Employee'}
                </option>
            ));
    };

    const adminOfficerRef = resolveFlowchartAdminEmployeeRef(flowchartRows);
    const adminOfficerInEmployees = Boolean(
        adminOfficerRef.id &&
            employees.some(
                (emp) =>
                    String(emp._id) === String(adminOfficerRef.id) ||
                    String(emp.employeeId || '') === String(adminOfficerRef.code || ''),
            ),
    );

    const drivenByEmployeeOptions = licensedEmployees.map((emp) => (
        <option key={emp._id} value={String(emp._id)}>
            {`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId || 'Employee'}
        </option>
    ));

    const QUOTE_SLOTS = useMemo(
        () => [
            {
                kind: 'attachment',
                nameKey: 'attachmentName',
                base64Key: 'attachmentBase64',
                mimeKey: 'attachmentMime',
                urlKey: 'existingAttachmentUrl',
            },
            {
                kind: 'quotation2',
                nameKey: 'quotation2Name',
                base64Key: 'quotation2Base64',
                mimeKey: 'quotation2Mime',
                urlKey: 'existingQuotation2Url',
            },
            {
                kind: 'quotation3',
                nameKey: 'quotation3Name',
                base64Key: 'quotation3Base64',
                mimeKey: 'quotation3Mime',
                urlKey: 'existingQuotation3Url',
            },
        ],
        [],
    );

    const isQuoteSlotFilled = useCallback(
        (data, slot) => !!(data?.[slot.nameKey] || data?.[slot.urlKey]),
        [],
    );

    const quoteItems = useMemo(
        () =>
            QUOTE_SLOTS.map((slot) => ({
                ...slot,
                fileName: formData[slot.nameKey] || '',
                existingUrl: formData[slot.urlKey] || '',
            })).filter((slot) => slot.fileName || slot.existingUrl),
        [QUOTE_SLOTS, formData],
    );

    const canAddMoreQuotes = quoteItems.length < QUOTE_SLOTS.length;

    const handleQuoteFiles = (fileList) => {
        const files = Array.from(fileList || []);
        if (!files.length) return;

        const validated = [];
        for (const file of files) {
            const check = validateErpPdfFile(file);
            if (!check.ok) {
                toast({
                    variant: 'destructive',
                    title: 'Invalid file',
                    description: check.message,
                });
                continue;
            }
            validated.push(file);
        }
        if (!validated.length) return;

        Promise.all(
            validated.map(
                (file) =>
                    new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const raw = String(reader.result || '');
                            const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
                            resolve({ file, base64 });
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    }),
            ),
        ).then((loaded) => {
            setFormData((prev) => {
                let next = { ...prev };
                let added = 0;
                for (const { file, base64 } of loaded) {
                    const slot = QUOTE_SLOTS.find((s) => !isQuoteSlotFilled(next, s));
                    if (!slot) break;
                    next = {
                        ...next,
                        [slot.nameKey]: file.name,
                        [slot.base64Key]: base64,
                        [slot.mimeKey]: file.type || 'application/pdf',
                        [slot.urlKey]: '',
                    };
                    if (slot.kind === 'attachment') {
                        next.estimatedCost =
                            next.estimatedCost || String(next.quotation1Amount || '');
                    }
                    added += 1;
                }
                if (added < loaded.length) {
                    queueMicrotask(() =>
                        toast({
                            title: 'Quote limit',
                            description: 'You can add up to 3 quotes.',
                        }),
                    );
                }
                return next;
            });
        });
    };

    const clearQuoteSlot = (kind) => {
        const slot = QUOTE_SLOTS.find((s) => s.kind === kind);
        if (!slot) return;
        setFormData((prev) => ({
            ...prev,
            [slot.nameKey]: '',
            [slot.base64Key]: '',
            [slot.mimeKey]: '',
            [slot.urlKey]: '',
        }));
    };

    const appendPhotos = (files) => {
        const { accepted, firstError } = filterErpUploadFiles(files, {
            allowPdf: false,
            allowJpeg: true,
        });
        if (firstError) {
            toast({ variant: 'destructive', title: 'Invalid file', description: firstError });
        }
        accepted.forEach((file) => {
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
            rows[index] = { ...rows[index], paidAmount: value };
            return { ...prev, employeeLiabilityRows: rows };
        });
    };

    const finalizeEmployeeRowPaidAmount = (index) => {
        setFormData((prev) => {
            const rows = [...(prev.employeeLiabilityRows || [])];
            const raw = rows[index]?.paidAmount ?? '';
            if (String(raw).trim() !== '') return prev;
            rows[index] = { ...rows[index], paidAmount: '0' };
            return { ...prev, employeeLiabilityRows: rows };
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
        setFormData((prev) => ({
            ...prev,
            employeeLiabilityRows: [
                ...(prev.employeeLiabilityRows || []),
                { employeeId: '', paidAmount: '0' },
            ],
        }));
    };

    const removeEmployeeRow = (index) => {
        setFormData((prev) => {
            const rows = [...(prev.employeeLiabilityRows || [])];
            if (rows.length <= 1) return prev;
            rows.splice(index, 1);
            return { ...prev, employeeLiabilityRows: rows };
        });
    };

    const persistForm = useCallback(
        async ({ submitAfterSave = false } = {}) => {
            if (!vehicleId || !serviceId) return false;
            setSaving(true);
            try {
                const body = buildBodyWorkDetailSubmitBody(formData, {
                    keepPending: assignmentPending,
                });
                await axiosInstance.put(`/AssetItem/${vehicleId}/service/${serviceId}`, body);
                if (submitAfterSave) {
                    await axiosInstance.post(
                        `/AssetItem/${vehicleId}/service/${serviceId}/submit-request`,
                    );
                    toast({
                        title: 'Submitted for approval',
                        description:
                            'Body work assignment was sent. HR was emailed and will see this in the vehicle inbox bell.',
                    });
                    if (typeof onSaved === 'function') onSaved();
                } else {
                    toast({
                        title: assignmentPending ? 'Draft saved' : 'Initiate updated',
                        description: assignmentPending
                            ? 'Body work assignment draft saved.'
                            : 'Payment and initiate details were saved.',
                    });
                    if (typeof onSaved === 'function') onSaved();
                }
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
        if (!assignmentPending || !isBodyWorkDetailFormComplete(formData, asset)) return;
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
        assignmentPending && !saving && canEditAssignment && isBodyWorkDetailFormComplete(formData, asset);
    const missingFields = useMemo(
        () =>
            canEditInitiateFields ? getBodyWorkDetailFormMissingFields(formData, asset) : [],
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

    const QuotesUpload = () => (
        <div className="space-y-2">
            {quoteItems.length ? (
                <ul className="space-y-1.5">
                    {quoteItems.map((item) => (
                        <li
                            key={item.kind}
                            className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/40 px-2 py-1.5"
                        >
                            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-700">
                                {item.fileName || 'Quote PDF'}
                            </span>
                            {item.existingUrl ? (
                                <button
                                    type="button"
                                    className={tireViewBtn}
                                    onClick={() =>
                                        void openAttachmentInNewTab(item.existingUrl, {
                                            name: item.fileName || 'Quote',
                                        })
                                    }
                                >
                                    View
                                </button>
                            ) : null}
                            {!fieldsDisabled ? (
                                <button
                                    type="button"
                                    onClick={() => clearQuoteSlot(item.kind)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-lg font-bold text-red-500 hover:bg-red-50"
                                    title="Remove quote"
                                >
                                    ×
                                </button>
                            ) : null}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-xs text-gray-400">No quotes added yet</p>
            )}
            {!fieldsDisabled && canAddMoreQuotes ? (
                <label className={tireUploadBtn}>
                    <Upload size={14} />
                    Add quote
                    <input
                        type="file"
                        className="sr-only"
                        accept={ERP_PDF_ACCEPT}
                        multiple
                        disabled={fieldsDisabled}
                        onChange={(e) => {
                            handleQuoteFiles(e.target.files);
                            e.target.value = '';
                        }}
                    />
                </label>
            ) : null}
        </div>
    );

    const { fieldMinHeightPx, gapClass } = BODY_WORK_DETAIL_GRID_LAYOUT;
    const accent = tireAccent;

    return (
        <>
            <div className={`flex w-full ${className}`.trim()}>
                <FineFormCard
                    title="Initiate Service"
                    subtitle={
                        assignmentPending
                            ? 'Complete all fields, then click Send / Submit for Approval'
                            : canEditInitiateFields
                              ? 'HR can edit payment and initiate details until Zoho bill is accepted'
                              : 'Submitted — view only after Zoho bill is accepted.'
                    }
                    icon={ClipboardList}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    className={`w-full ${canEditInitiateFields ? '' : 'opacity-[0.97]'}`}
                >
                    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gapClass}`}>
                        <div className={`sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 ${gapClass}`}>
                        <VehicleBodyWorkFormFieldCell
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
                                {adminOfficerRef.id && !adminOfficerInEmployees ? (
                                    <option value={adminOfficerRef.id}>{adminOfficerRef.label}</option>
                                ) : null}
                                {employeeOptions}
                            </select>
                        </VehicleBodyWorkFormFieldCell>
                        <VehicleBodyWorkFormFieldCell
                            label="Vehicle Driven By"
                            accentClass={accent(1)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <select
                                className={tireFieldSelect}
                                value={formData.carDrivenByEmployeeId || ''}
                                onChange={(e) => set('carDrivenByEmployeeId', e.target.value)}
                                disabled={fieldsDisabled}
                            >
                                <option value="">Select employee with driving license</option>
                                {drivenByEmployeeOptions}
                            </select>
                        </VehicleBodyWorkFormFieldCell>
                        </div>

                        <>
                                <div className="sm:col-span-2 lg:col-span-3">
                                    <VehicleBodyWorkFormFieldCell
                                        label="Quotes (required)"
                                        accentClass={accent(1)}
                                        minHeightPx={fieldMinHeightPx}
                                    >
                                        <QuotesUpload />
                                    </VehicleBodyWorkFormFieldCell>
                                </div>
                        </>
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
                                        accept={ERP_JPEG_ACCEPT}
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

                    <div className="mt-4">
                        <VehicleBodyWorkFormFieldCell
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
                        </VehicleBodyWorkFormFieldCell>
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Payment Details
                        </span>
                        <div className={`grid grid-cols-1 sm:grid-cols-2 ${gapClass}`}>
                            <VehicleBodyWorkFormFieldCell
                                label="Estimated Cost"
                                accentClass={accent(0)}
                                minHeightPx={fieldMinHeightPx}
                            >
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                                        AED
                                    </span>
                                    <input
                                        className={`${tireMoneyInput} pl-11 text-lg font-bold`}
                                        type="number"
                                        min="0"
                                        value={formData.estimatedCost || ''}
                                        onChange={(e) =>
                                            applyPayAmountChange('estimatedCost', e.target.value)
                                        }
                                        disabled={fieldsDisabled}
                                        placeholder="0.00"
                                    />
                                </div>
                            </VehicleBodyWorkFormFieldCell>
                            <VehicleBodyWorkFormFieldCell
                                label="Payment By"
                                accentClass={accent(2)}
                                minHeightPx={fieldMinHeightPx}
                            >
                                <PaymentByToggle
                                    value={paymentByMode || 'company'}
                                    onChange={setPaymentByMode}
                                    disabled={fieldsDisabled}
                                />
                            </VehicleBodyWorkFormFieldCell>
                        </div>
                        {showCompanyFields || showEmployeeFields ? (
                            <div className="w-full rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                                {showCompanyFields ? (
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm font-bold uppercase tracking-wide text-gray-500">
                                            Company payment
                                        </span>
                                        <div className="flex w-[160px] shrink-0 items-center justify-end gap-1">
                                            <input
                                                className="w-full min-w-0 border-0 bg-transparent py-1 text-right text-xl font-bold tabular-nums text-gray-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-gray-500"
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={companyPayAmount || 0}
                                                onChange={(e) =>
                                                    applyPayAmountChange(
                                                        'companyPay',
                                                        e.target.value,
                                                    )
                                                }
                                                disabled={fieldsDisabled}
                                            />
                                            <span className="text-sm font-bold text-gray-500">
                                                AED
                                            </span>
                                        </div>
                                    </div>
                                ) : null}
                                {showEmployeeFields ? (
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
                                                    value={employeePayAmount || 0}
                                                    onChange={(e) =>
                                                        applyPayAmountChange(
                                                            'employeePay',
                                                            e.target.value,
                                                        )
                                                    }
                                                    disabled={fieldsDisabled}
                                                />
                                                <span className="text-sm font-bold text-gray-500">
                                                    AED
                                                </span>
                                            </div>
                                        </div>
                                        {(formData.employeeLiabilityRows || []).map((row, index) => {
                                            const isLastRow =
                                                index ===
                                                (formData.employeeLiabilityRows || []).length - 1;
                                            return (
                                                <div
                                                    key={`emp-row-${index}`}
                                                    className="flex items-center justify-between gap-3"
                                                >
                                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                                        <select
                                                            className="min-h-[40px] w-full max-w-[280px] appearance-none border-0 bg-transparent px-0 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-gray-500"
                                                            value={row.employeeId || ''}
                                                            onChange={(e) =>
                                                                updateEmployeeRow(
                                                                    index,
                                                                    'employeeId',
                                                                    e.target.value,
                                                                )
                                                            }
                                                            disabled={fieldsDisabled}
                                                        >
                                                            <option value="">Select employee</option>
                                                            {employeeOptionsForRow(index)}
                                                        </select>
                                                        {!fieldsDisabled &&
                                                        (formData.employeeLiabilityRows || [])
                                                            .length > 1 ? (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    removeEmployeeRow(index)
                                                                }
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
                                                            value={
                                                                row.paidAmount === '' ||
                                                                row.paidAmount == null
                                                                    ? '0'
                                                                    : row.paidAmount
                                                            }
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
                                    <div className="flex w-[160px] shrink-0 items-center justify-end gap-1">
                                        <input
                                            className="w-full min-w-0 border-0 bg-transparent py-1 text-right text-2xl font-bold tabular-nums text-gray-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-gray-500"
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={estimatedCost || 0}
                                            onChange={(e) =>
                                                applyPayAmountChange(
                                                    'totalAmount',
                                                    e.target.value,
                                                )
                                            }
                                            disabled={fieldsDisabled}
                                        />
                                        <span className="text-sm font-bold text-gray-500">
                                            AED
                                        </span>
                                    </div>
                                </div>
                                {paySplitError || employeeRowsError ? (
                                    <div className="space-y-1 text-xs font-semibold text-amber-700">
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

                    {!assignmentPending && canEditInitiateFields ? (
                        <div className="mt-4 flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
                            <button
                                type="button"
                                disabled={saving}
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
