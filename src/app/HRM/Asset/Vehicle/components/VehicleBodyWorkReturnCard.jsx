'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, Loader2, Plus, Upload } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import VehicleServiceLockedSection from './VehicleServiceLockedSection';
import VehicleServiceNewConditionPhotoStrip from './VehicleServiceNewConditionPhotoStrip';
import VehicleHandoverAssessmentPhotoViewer from './VehicleHandoverAssessmentPhotoViewer';
import {
    SHOP_SERVICE_CARD,
    resolveShopServiceCardGate,
} from '../utils/vehicleShopServiceCardGates';
import { openAttachmentInNewTab, extractStorageReference, loadStorageFileBlob } from '@/utils/attachmentPreview';
import { parseVehicleServiceRemark, normalizeMongoId } from './vehicleServiceUtils';
import VehicleBodyWorkFormFieldCell from './VehicleBodyWorkFormFieldCell';
import {
    isOilServiceAssignmentPending,
} from '../utils/vehicleOilServiceAccess';
import {
    canEditBodyWorkReturn,
    BODY_WORK_WORKFLOW_STAGES,
} from '../utils/vehicleBodyWorkWorkflow';
import {
    buildBodyWorkReturnFormState,
    buildBodyWorkReturnUpdateBody,
    createBodyWorkOtherDocRow,
    isBodyWorkReturnFormComplete,
    validateBodyWorkReturnForm,
} from '../utils/vehicleBodyWorkReturnForm';
import {
    labelForServiceBodyPartKey,
} from '../utils/vehicleServiceNewConditionPhotos';
import {
    BODY_WORK_DETAIL_GRID_LAYOUT,
    tireAccent,
    tireBtnPrimary,
    tireBtnSecondary,
    tireDatePickerClass,
    tireFieldSelect,
    tireUploadBtn,
    tireViewBtn,
} from '../utils/vehicleBodyWorkDetailUi';
import {
    ERP_PDF_ACCEPT,
    validateErpPdfFile,
} from '@/utils/uploadFileTypes';

function directConditionImageSrc(img) {
    const url = String(img?.url || img?.data || '').trim();
    if (!url) return '';
    // Only inline/blob URLs in <img>. Wasabi signed URLs fail on many office networks (DNS).
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    return '';
}

function readUploadFile(file, onDone) {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        const raw = String(reader.result || '');
        const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
        onDone(file, base64);
    };
    reader.readAsDataURL(file);
}

function UploadField({ label, fileName, existingUrl, disabled, onFile }) {
    const { toast } = useToast();
    const [viewing, setViewing] = useState(false);

    const handleView = async () => {
        if (!existingUrl || viewing) return;
        setViewing(true);
        try {
            const result = await openAttachmentInNewTab(existingUrl, {
                name: fileName || label || 'Document.pdf',
                mimeType: 'application/pdf',
            });
            if (!result?.ok) {
                toast({
                    variant: 'destructive',
                    title: 'Cannot open document',
                    description: result?.error || 'Attachment is unavailable. Try re-uploading the file.',
                });
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Cannot open document',
                description: error?.message || 'Attachment is unavailable.',
            });
        } finally {
            setViewing(false);
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-2 min-h-[40px]">
            {existingUrl ? (
                <button
                    type="button"
                    className={tireViewBtn}
                    disabled={viewing}
                    onClick={() => void handleView()}
                >
                    {viewing ? 'Opening...' : 'View'}
                </button>
            ) : null}
            {!disabled ? (
                <label className={tireUploadBtn}>
                    <Upload size={14} />
                    {fileName || existingUrl ? 'Change' : 'Add'}
                    <input
                        type="file"
                        className="sr-only"
                        accept={ERP_PDF_ACCEPT}
                        disabled={disabled}
                        onChange={(e) => {
                            onFile(e.target.files?.[0]);
                            e.target.value = '';
                        }}
                    />
                </label>
            ) : null}
            {fileName ? <span className="text-[10px] text-gray-500 truncate max-w-full">{fileName}</span> : null}
        </div>
    );
}

export default function VehicleBodyWorkReturnCard({
    asset,
    service,
    vehicleId,
    serviceId,
    canManage = false,
    workflowStage = '',
    onUpdated,
    className = '',
}) {
    const router = useRouter();
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerStartIndex, setViewerStartIndex] = useState(0);
    const [viewerExtraItems, setViewerExtraItems] = useState([]);
    const [resolvedExistingPhotoSrc, setResolvedExistingPhotoSrc] = useState({});
    const [formData, setFormData] = useState(() => buildBodyWorkReturnFormState(service, asset));

    const remark = useMemo(() => parseVehicleServiceRemark(service) || {}, [service]);
    const assignmentPending = isOilServiceAssignmentPending(remark);
    const stage = String(workflowStage || '').toLowerCase();
    const isComplete =
        stage === BODY_WORK_WORKFLOW_STAGES.COMPLETE ||
        String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live' ||
        (Array.isArray(remark.tireActivityLog) &&
            remark.tireActivityLog.some((entry) => entry.type === 'service_completed'));

    const canEditReturn = canEditBodyWorkReturn(stage, canManage, isComplete, asset);
    const fieldsDisabled = !canEditReturn || saving || assignmentPending;

    const photoGalleryItems = useMemo(() => {
        const items = [];
        (formData.existingNewConditionImages || []).forEach((img, idx) => {
            const thumb =
                resolvedExistingPhotoSrc[`existing-${idx}`] || directConditionImageSrc(img);
            const previewUrl =
                typeof thumb === 'string' &&
                (thumb.startsWith('data:') || thumb.startsWith('blob:'))
                    ? thumb
                    : '';
            if (!img && !previewUrl) return;
            items.push({
                key: `existing-${idx}`,
                label:
                    labelForServiceBodyPartKey(img?.bodyPartKey) ||
                    `Condition photo ${items.length + 1}`,
                // Keep storage ref for proxy; pass ready blob/data as url for instant view.
                photo: img || previewUrl,
                ...(previewUrl ? { url: previewUrl } : {}),
            });
        });
        (formData.newConditionImages || []).forEach((img, idx) => {
            const url = img?.data
                ? `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`
                : '';
            if (!url) return;
            items.push({
                key: `new-${idx}`,
                label:
                    labelForServiceBodyPartKey(img?.bodyPartKey) ||
                    `Condition photo ${items.length + 1}`,
                photo: url,
                url,
            });
        });
        return items;
    }, [
        formData.existingNewConditionImages,
        formData.newConditionImages,
        resolvedExistingPhotoSrc,
    ]);

    const openPhotoViewer = useCallback(
        (key) => {
            if (!key) return;
            const index = photoGalleryItems.findIndex((item) => item.key === key);
            if (index < 0) return;
            setViewerExtraItems([]);
            setViewerStartIndex(index);
            setViewerOpen(true);
        },
        [photoGalleryItems],
    );

    const viewerItems = viewerExtraItems.length ? viewerExtraItems : photoGalleryItems;

    const { fieldMinHeightPx, gapClass } = BODY_WORK_DETAIL_GRID_LAYOUT;
    const accent = tireAccent;

    useEffect(() => {
        setFormData(buildBodyWorkReturnFormState(service, asset));
    }, [service?._id, service?.updatedAt, service?.remark, service?.serviceCompletionReport, service?.shopInvoice, service?.invoice, asset]);

    useEffect(() => {
        const existing = formData.existingNewConditionImages || [];
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
                const direct = directConditionImageSrc(img);
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
            }
        })();

        return () => {
            cancelled = true;
            objectUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [formData.existingNewConditionImages]);

    const set = useCallback((key, value) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleDocFile = (kind, file) => {
        if (!file) return;
        const check = validateErpPdfFile(file);
        if (!check.ok) {
            toast({ variant: 'destructive', title: 'Invalid file', description: check.message });
            return;
        }
        readUploadFile(file, (f, base64) => {
            if (kind === 'garageReport') {
                setFormData((prev) => ({
                    ...prev,
                    garageReportName: f.name,
                    garageReportBase64: base64,
                    garageReportMime: f.type || 'application/pdf',
                    existingGarageReportUrl: '',
                }));
            } else if (kind === 'garageInvoice') {
                setFormData((prev) => ({
                    ...prev,
                    garageInvoiceName: f.name,
                    garageInvoiceBase64: base64,
                    garageInvoiceMime: f.type || 'application/pdf',
                    existingGarageInvoiceUrl: '',
                }));
            }
        });
    };

    const addOtherDocRow = useCallback(() => {
        setFormData((prev) => ({
            ...prev,
            returnOtherDocs: [...(prev.returnOtherDocs || []), createBodyWorkOtherDocRow()],
        }));
    }, []);

    const removeOtherDocRow = useCallback((rowId) => {
        setFormData((prev) => ({
            ...prev,
            returnOtherDocs: (prev.returnOtherDocs || []).filter((row) => row.id !== rowId),
        }));
    }, []);

    const updateOtherDocRow = useCallback((rowId, patch) => {
        setFormData((prev) => ({
            ...prev,
            returnOtherDocs: (prev.returnOtherDocs || []).map((row) =>
                row.id === rowId ? { ...row, ...patch } : row,
            ),
        }));
    }, []);

    const handleOtherDocFile = useCallback(
        (rowId, file) => {
            if (!file) return;
            const check = validateErpPdfFile(file);
            if (!check.ok) {
                toast({ variant: 'destructive', title: 'Invalid file', description: check.message });
                return;
            }
            readUploadFile(file, (f, base64) => {
                updateOtherDocRow(rowId, {
                    name: f.name,
                    base64,
                    mime: f.type || 'application/pdf',
                    existingUrl: '',
                });
            });
        },
        [toast, updateOtherDocRow],
    );

    const setBodyPartNewImage = useCallback((bodyPartKey, image) => {
        const key = String(bodyPartKey || '').trim();
        if (!key || !image) return;
        setFormData((prev) => {
            const list = [...(prev.newConditionImages || [])].filter(
                (img) => String(img?.bodyPartKey || '').trim() !== key,
            );
            list.push({ ...image, bodyPartKey: key });
            return { ...prev, newConditionImages: list };
        });
    }, []);

    const clearBodyPartNewImage = useCallback((bodyPartKey) => {
        const key = String(bodyPartKey || '').trim();
        if (!key) return;
        setFormData((prev) => ({
            ...prev,
            newConditionImages: (prev.newConditionImages || []).filter(
                (img) => String(img?.bodyPartKey || '').trim() !== key,
            ),
        }));
    }, []);

    const handleCancel = () => {
        if (vehicleId) {
            router.push(`/HRM/Asset/Vehicle/details/${vehicleId}?tab=service`);
        } else {
            router.back();
        }
    };

    const handleSubmit = async () => {
        if (!vehicleId || !serviceId || fieldsDisabled) return;
        if (!isBodyWorkReturnFormComplete(formData)) {
            const errors = validateBodyWorkReturnForm(formData);
            toast({
                variant: 'destructive',
                title: 'Complete return details',
                description: Object.values(errors).join(', '),
            });
            return;
        }

        setSaving(true);
        try {
            const body = buildBodyWorkReturnUpdateBody(formData);
            const { data } = await axiosInstance.post(
                `/AssetItem/${vehicleId}/service/${serviceId}/body-work/complete`,
                body,
            );
            toast({
                title: 'Body work completed',
                description: data?.message || 'Service marked complete. Employee fines were created when applicable.',
            });
            if (typeof onUpdated === 'function') onUpdated(data?.asset);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not submit',
                description: error.response?.data?.message || 'Try again.',
            });
        } finally {
            setSaving(false);
        }
    };

    const missingFields = !fieldsDisabled && !isBodyWorkReturnFormComplete(formData)
        ? Object.values(validateBodyWorkReturnForm(formData))
        : [];

    const completeGate = resolveShopServiceCardGate({
        assignmentPending,
        workflowStage: stage,
        service,
        cardKey: SHOP_SERVICE_CARD.COMPLETE,
    });

    return (
        <>
            <div className={`w-full ${className}`.trim()}>
                <VehicleServiceLockedSection
                    locked={completeGate.locked}
                    message={completeGate.message || 'Complete Schedule and Reschedule Service first'}
                >
                <FineFormCard
                    title="Complete Service"
                    subtitle={
                        completeGate.locked
                            ? 'Locked until previous steps are done'
                            : isComplete
                              ? 'Service record completed'
                              : canEditReturn
                                ? 'Fill required fields — then Complete to close this service'
                                : 'Service completion — view return details below'
                    }
                    icon={ClipboardCheck}
                    iconBg="bg-teal-50"
                    iconColor="text-teal-600"
                    className="w-full"
                >
                    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gapClass}`}>
                        <VehicleBodyWorkFormFieldCell
                            label="Garage Report"
                            accentClass={accent(0)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <UploadField
                                label="Garage Report"
                                fileName={formData.garageReportName}
                                existingUrl={formData.existingGarageReportUrl}
                                disabled={fieldsDisabled}
                                onFile={(file) => handleDocFile('garageReport', file)}
                            />
                        </VehicleBodyWorkFormFieldCell>
                        <VehicleBodyWorkFormFieldCell
                            label="Garage Invoice *"
                            accentClass={accent(1)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <UploadField
                                label="Garage Invoice *"
                                fileName={formData.garageInvoiceName}
                                existingUrl={formData.existingGarageInvoiceUrl}
                                disabled={fieldsDisabled}
                                onFile={(file) => handleDocFile('garageInvoice', file)}
                            />
                        </VehicleBodyWorkFormFieldCell>
                        {(formData.returnOtherDocs || []).map((row, index) => (
                            <div
                                key={row.id}
                                className={`relative flex flex-col justify-center rounded-lg border px-3 py-2.5 ${accent((index + 2) % 3)}`}
                                style={{ minHeight: `${fieldMinHeightPx}px` }}
                            >
                                {!fieldsDisabled ? (
                                    <button
                                        type="button"
                                        onClick={() => removeOtherDocRow(row.id)}
                                        className="absolute right-1.5 top-1.5 rounded px-1 text-[11px] font-bold leading-none text-red-500 hover:bg-red-50"
                                        title="Remove"
                                    >
                                        {'\u00d7'}
                                    </button>
                                ) : null}
                                {fieldsDisabled ? (
                                    <span className="pr-4 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                        {row.docType || `Other Document ${index + 1}`}
                                    </span>
                                ) : (
                                    <input
                                        type="text"
                                        className="w-full border-0 bg-transparent p-0 pr-4 text-[10px] font-semibold uppercase tracking-wide text-gray-600 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                        value={row.docType || ''}
                                        onChange={(e) => updateOtherDocRow(row.id, { docType: e.target.value })}
                                        placeholder="File name"
                                    />
                                )}
                                <div className="mt-1.5 min-w-0">
                                    <UploadField
                                        label={row.docType || `Other Document ${index + 1}`}
                                        fileName={row.name}
                                        existingUrl={row.existingUrl}
                                        disabled={fieldsDisabled}
                                        onFile={(file) => handleOtherDocFile(row.id, file)}
                                    />
                                </div>
                            </div>
                        ))}
                        {!fieldsDisabled ? (
                            <div className="flex items-end">
                                <button
                                    type="button"
                                    onClick={addOtherDocRow}
                                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-blue-600 hover:bg-blue-100"
                                    title="Add other document"
                                >
                                    <Plus size={16} />
                                    Add
                                </button>
                            </div>
                        ) : null}
                    </div>

                    <div className={`mt-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gapClass}`}>
                        <VehicleBodyWorkFormFieldCell
                            label="Return Date"
                            accentClass={accent(0)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <DatePicker
                                value={formData.returnDate || ''}
                                onChange={(value) => set('returnDate', value || '')}
                                placeholder="dd/mm/yyyy"
                                className={tireDatePickerClass}
                                disabled={fieldsDisabled}
                                disabledDays={
                                    formData.serviceEndDate
                                        ? {
                                              before: new Date(
                                                  `${String(formData.serviceEndDate).slice(0, 10)}T00:00:00`,
                                              ),
                                          }
                                        : undefined
                                }
                            />
                        </VehicleBodyWorkFormFieldCell>
                        <VehicleBodyWorkFormFieldCell
                            label="Hand Over Date"
                            accentClass={accent(1)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <DatePicker
                                value={formData.handOverDate || ''}
                                onChange={(value) => set('handOverDate', value || '')}
                                placeholder="dd/mm/yyyy"
                                className={tireDatePickerClass}
                                disabled={fieldsDisabled}
                                disabledDays={
                                    formData.serviceEndDate
                                        ? {
                                              before: new Date(
                                                  `${String(formData.serviceEndDate).slice(0, 10)}T00:00:00`,
                                              ),
                                          }
                                        : undefined
                                }
                            />
                        </VehicleBodyWorkFormFieldCell>
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-4">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            New Condition Photos
                        </span>
                        <div className="mt-2">
                            <VehicleServiceNewConditionPhotoStrip
                                existingImages={formData.existingNewConditionImages}
                                newImages={formData.newConditionImages}
                                resolvedExistingSrc={resolvedExistingPhotoSrc}
                                disabled={fieldsDisabled}
                                onPreview={openPhotoViewer}
                                onSetBodyPartImage={setBodyPartNewImage}
                                onClearBodyPartImage={clearBodyPartNewImage}
                            />
                        </div>
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-4">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Description (optional)
                        </span>
                        <textarea
                            className="mt-1.5 w-full min-h-[88px] resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-50 disabled:text-gray-600"
                            rows={3}
                            value={formData.returnDescription || ''}
                            onChange={(e) => set('returnDescription', e.target.value)}
                            disabled={fieldsDisabled}
                            placeholder="Enter completion notes..."
                        />
                    </div>

                    {missingFields.length > 0 ? (
                        <p className="mt-4 text-xs text-amber-700">
                            Still required: {missingFields.join(', ')}
                        </p>
                    ) : null}

                    {canEditReturn ? (
                        <div className="mt-4 flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
                            <button type="button" disabled={saving} onClick={handleCancel} className={tireBtnSecondary}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={saving || fieldsDisabled}
                                onClick={() => void handleSubmit()}
                                className={tireBtnPrimary}
                            >
                                {saving ? 'Completing…' : 'Complete'}
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
                </VehicleServiceLockedSection>
            </div>

            <VehicleHandoverAssessmentPhotoViewer
                open={viewerOpen}
                items={viewerItems}
                startIndex={viewerStartIndex}
                onClose={() => {
                    setViewerOpen(false);
                    setViewerExtraItems([]);
                }}
            />
        </>
    );
}
