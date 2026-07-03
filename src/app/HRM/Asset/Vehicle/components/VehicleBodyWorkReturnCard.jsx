'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, Loader2, Plus, Upload } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import { openAttachmentInNewTab, extractStorageReference, loadStorageFileBlob } from '@/utils/attachmentPreview';
import { parseVehicleServiceRemark, normalizeMongoId } from './vehicleServiceUtils';
import VehicleBodyWorkFormFieldCell from './VehicleBodyWorkFormFieldCell';
import VehicleShopServiceExtendDateSection from './VehicleShopServiceExtendDateSection';
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
    isBodyWorkReturnFormComplete,
    validateBodyWorkReturnForm,
} from '../utils/vehicleBodyWorkReturnForm';
import {
    BODY_WORK_DETAIL_GRID_LAYOUT,
    tireAccent,
    tireBtnPrimary,
    tireBtnSecondary,
    tireDatePickerClass,
    tireFieldSelect,
    tirePhotoAddBtn,
    tirePhotoThumb,
    tireUploadBtn,
    tireViewBtn,
} from '../utils/vehicleBodyWorkDetailUi';

const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const PHOTO_SLOTS = 8;

function directConditionImageSrc(img) {
    const url = String(img?.url || '').trim();
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) return url;
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
    return (
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
            {!disabled ? (
                <label className={tireUploadBtn}>
                    <Upload size={14} />
                    {fileName || existingUrl ? 'Change' : 'Add'}
                    <input
                        type="file"
                        className="sr-only"
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
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

function PhotoStrip({ existingImages = [], newImages = [], resolvedExistingSrc = {}, disabled, onAdd, onPreview }) {
    const cells = [];
    if (!disabled && typeof onAdd === 'function') {
        cells.push(
            <button key="add" type="button" onClick={onAdd} className={tirePhotoAddBtn} aria-label="Add photo">
                <Plus size={20} />
            </button>,
        );
    }
    (existingImages || []).forEach((img, idx) => {
        const src = resolvedExistingSrc[`existing-${idx}`] || directConditionImageSrc(img);
        if (!src) return;
        cells.push(
            <button key={`ex-${idx}`} type="button" onClick={() => onPreview(src)} className={tirePhotoThumb}>
                <img src={src} alt="" className="w-full h-full object-cover" />
            </button>,
        );
    });
    (newImages || []).forEach((img, idx) => {
        const mime = img?.mimeType || 'image/jpeg';
        const src = img?.data ? `data:${mime};base64,${img.data}` : '';
        if (!src) return;
        cells.push(
            <button key={`nw-${idx}`} type="button" onClick={() => onPreview(src)} className={tirePhotoThumb}>
                <img src={src} alt="" className="w-full h-full object-cover" />
            </button>,
        );
    });
    while (cells.length < PHOTO_SLOTS) {
        cells.push(
            <div key={`empty-${cells.length}`} className={`${tirePhotoThumb} bg-gray-50 border-dashed`} />,
        );
    }
    return <div className="flex flex-wrap gap-2 items-center">{cells.slice(0, PHOTO_SLOTS)}</div>;
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
    const photoInputRef = useRef(null);
    const [saving, setSaving] = useState(false);
    const [lightboxSrc, setLightboxSrc] = useState(null);
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
            } else {
                setFormData((prev) => ({
                    ...prev,
                    returnOtherDocName: f.name,
                    returnOtherDocBase64: base64,
                    returnOtherDocMime: f.type || 'application/pdf',
                    existingReturnOtherDocUrl: '',
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
                toast({ variant: 'destructive', title: 'File too large', description: 'Max 2 MB per image.' });
                return;
            }
            readUploadFile(file, (f, base64) => {
                setFormData((prev) => ({
                    ...prev,
                    newConditionImages: [
                        ...(prev.newConditionImages || []),
                        { name: f.name, data: base64, mimeType: f.type || 'image/jpeg' },
                    ],
                }));
            });
        });
    };

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

    if (!stage && !isComplete) return null;

    const missingFields = !fieldsDisabled && !isBodyWorkReturnFormComplete(formData)
        ? Object.values(validateBodyWorkReturnForm(formData))
        : [];

    return (
        <>
            <div className={`w-full ${className}`.trim()}>
                <FineFormCard
                    title="Service Completed"
                    subtitle={
                        isComplete
                            ? 'Body work completed'
                            : canEditReturn
                              ? 'Admin Officer — upload completion documents, then click Complete'
                              : 'Service completion — extend date or view return details below'
                    }
                    icon={ClipboardCheck}
                    iconBg="bg-teal-50"
                    iconColor="text-teal-600"
                    className={`w-full ${!canEditReturn ? 'opacity-[0.97]' : ''}`}
                >
                    <VehicleShopServiceExtendDateSection
                        asset={asset}
                        service={service}
                        vehicleId={vehicleId}
                        serviceId={serviceId}
                        canManage={canManage}
                        workflowStage={stage}
                        onUpdated={onUpdated}
                        datePickerClass={tireDatePickerClass}
                    />
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
                            label="Garage Invoice"
                            accentClass={accent(1)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <UploadField
                                label="Garage Invoice"
                                fileName={formData.garageInvoiceName}
                                existingUrl={formData.existingGarageInvoiceUrl}
                                disabled={fieldsDisabled}
                                onFile={(file) => handleDocFile('garageInvoice', file)}
                            />
                        </VehicleBodyWorkFormFieldCell>
                        <VehicleBodyWorkFormFieldCell
                            label="Other Document"
                            accentClass={accent(2)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <UploadField
                                label="Other Document"
                                fileName={formData.returnOtherDocName}
                                existingUrl={formData.existingReturnOtherDocUrl}
                                disabled={fieldsDisabled}
                                onFile={(file) => handleDocFile('returnOtherDoc', file)}
                            />
                        </VehicleBodyWorkFormFieldCell>
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
                            />
                        </VehicleBodyWorkFormFieldCell>
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-4">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            New Condition Photos
                        </span>
                        <div className="mt-2">
                            <PhotoStrip
                                existingImages={formData.existingNewConditionImages}
                                newImages={formData.newConditionImages}
                                resolvedExistingSrc={resolvedExistingPhotoSrc}
                                disabled={fieldsDisabled}
                                onAdd={() => photoInputRef.current?.click()}
                                onPreview={setLightboxSrc}
                            />
                            <input
                                ref={photoInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                onChange={(e) => {
                                    appendPhotos(e.target.files);
                                    e.target.value = '';
                                }}
                            />
                        </div>
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-4">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Description
                        </span>
                        <textarea
                            className={`${tireFieldSelect} mt-1.5 resize-y min-h-[88px] font-medium`}
                            rows={4}
                            value={formData.returnDescription || ''}
                            onChange={(e) => set('returnDescription', e.target.value)}
                            disabled={fieldsDisabled}
                            placeholder="Enter review notes..."
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
            </div>

            {lightboxSrc ? (
                <div
                    className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
                    onClick={() => setLightboxSrc(null)}
                >
                    <img src={lightboxSrc} alt="" className="max-h-[90vh] max-w-full rounded-lg" />
                </div>
            ) : null}
        </>
    );
}
