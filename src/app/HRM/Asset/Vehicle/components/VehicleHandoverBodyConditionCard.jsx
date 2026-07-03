'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Car, ImageIcon, Loader2, Upload } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import {
    BODY_CONDITION_VIEW_FIELDS,
    buildBodyConditionFormState,
    buildBodyConditionPayload,
    isBodyConditionFormComplete,
    isBodyConditionMarkedDone,
    mergeBodyConditionCompletedIntoEntry,
    mergeBodyConditionIntoEntry,
    mergeBodyConditionRowIntoEntry,
    validateBodyConditionForm,
} from '../utils/vehicleHandoverBodyCondition';
import {
    buildAssessmentFormState,
    HANDOVER_ASSESSMENT_CARD_MIN_HEIGHT_CLASS,
    HANDOVER_LANDSCAPE_PHOTO_BOX_CLASS,
    hasAssessmentPhoto,
    isAssessmentFormComplete,
    isReceiverAssessmentMarkedDone,
    resolveAssessmentMediaUrl,
} from '../utils/vehicleHandoverReceiverAssessment';
import VehicleHandoverAssessmentPhotoViewer from './VehicleHandoverAssessmentPhotoViewer';

const BODY_PHOTO_BOX_CLASS = HANDOVER_LANDSCAPE_PHOTO_BOX_CLASS;
const BODY_MUTATION_CONFIG = { skipActionDedupe: true };

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function BodyPhotoField({
    label,
    photoUrl,
    missing,
    uploading,
    readOnly,
    onUpload,
    onPreview,
}) {
    const inputId = `body-upload-${label.replace(/\s+/g, '-')}`;

    if (photoUrl) {
        return (
            <div className={`relative w-full ${BODY_PHOTO_BOX_CLASS}`}>
                <button
                    type="button"
                    onClick={onPreview}
                    className="block h-full w-full overflow-hidden rounded-lg border border-gray-200 bg-white text-left transition-colors hover:ring-2 hover:ring-slate-300"
                >
                    <img src={photoUrl} alt={`${label} photo`} className="h-full w-full object-contain" />
                </button>
                {!readOnly ? (
                    <label
                        htmlFor={`${inputId}-replace`}
                        className="absolute bottom-2 right-2 inline-flex cursor-pointer items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[10px] font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-white"
                    >
                        <Upload size={12} />
                        Change
                        <input
                            id={`${inputId}-replace`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploading}
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) onUpload(file);
                                event.target.value = '';
                            }}
                        />
                    </label>
                ) : null}
            </div>
        );
    }

    if (readOnly) {
        return (
            <div
                className={`flex h-full w-full items-center justify-center rounded-lg border border-gray-100 bg-gray-50 ${BODY_PHOTO_BOX_CLASS}`}
            >
                <ImageIcon size={22} className="text-gray-300" strokeWidth={1.5} />
            </div>
        );
    }

    return (
        <label
            htmlFor={inputId}
            className={`flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-gray-50 transition-colors hover:bg-gray-100 ${
                missing ? 'border-amber-300 text-amber-600' : 'border-gray-200 text-gray-400'
            } ${BODY_PHOTO_BOX_CLASS}`}
        >
            {uploading ? (
                <Loader2 size={22} className="animate-spin" />
            ) : (
                <>
                    <ImageIcon size={22} strokeWidth={1.5} />
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
                        <Upload size={14} />
                        Upload photo
                    </span>
                </>
            )}
            <input
                id={inputId}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onUpload(file);
                    event.target.value = '';
                }}
            />
        </label>
    );
}

function ViewCellEditor({
    view,
    row,
    saving,
    uploading,
    readOnly,
    onCommentBlur,
    onPhotoUpload,
    onPhotoPreview,
}) {
    const photoUrl = resolveAssessmentMediaUrl(row?.photo);
    const photoMissing = !photoUrl;

    return (
        <div className={`flex h-full ${HANDOVER_ASSESSMENT_CARD_MIN_HEIGHT_CLASS} flex-col rounded-xl border border-gray-100 bg-white p-3 shadow-sm`}>
            <h5 className="text-sm font-bold leading-tight text-gray-900">{view.label}</h5>

            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Comment <span className="font-normal normal-case">(optional)</span>
            </p>
            {readOnly ? (
                <p className="mt-1 min-h-[52px] rounded-lg border border-gray-100 bg-gray-50 px-2 py-2 text-xs leading-snug text-gray-600">
                    {row?.comment || '—'}
                </p>
            ) : (
                <textarea
                    defaultValue={row?.comment || ''}
                    key={`${view.key}-comment-${row?.comment || ''}`}
                    onBlur={(event) => onCommentBlur(view.key, event.target.value)}
                    disabled={saving || uploading}
                    rows={2}
                    placeholder="Add comment..."
                    className="mt-1 w-full resize-none rounded-lg border border-gray-200 px-2 py-2 text-xs text-gray-700 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
                />
            )}

            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Photo <span className="text-red-500">*</span>
            </p>
            <div className={`mt-2 shrink-0 ${BODY_PHOTO_BOX_CLASS}`}>
                <BodyPhotoField
                    label={view.label}
                    photoUrl={photoUrl}
                    missing={photoMissing && !readOnly}
                    uploading={uploading}
                    readOnly={readOnly}
                    onUpload={onPhotoUpload}
                    onPreview={photoUrl ? onPhotoPreview : undefined}
                />
            </div>
            {photoMissing && !readOnly ? (
                <p className="mt-1.5 text-[10px] font-medium text-amber-600">Photo required</p>
            ) : (
                <p className="mt-1.5 min-h-[14px]" />
            )}
        </div>
    );
}

export default function VehicleHandoverBodyConditionCard({
    historyEntry,
    vehicle = null,
    onSaved,
    readOnly = false,
    onGoToApproval,
    onGoToAssessment,
    inspectionHandover = false,
    onVehicleUpdated,
}) {
    const { toast } = useToast();
    const [localEntry, setLocalEntry] = useState(null);
    const [form, setForm] = useState(() => buildBodyConditionFormState(historyEntry));
    const [savingKey, setSavingKey] = useState(null);
    const [uploadingKey, setUploadingKey] = useState(null);
    const [completing, setCompleting] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerStartIndex, setViewerStartIndex] = useState(0);
    const photoUploadInFlightRef = useRef(new Set());

    const historyEntryId = historyEntry?._id;
    const displayEntry = localEntry || historyEntry;
    const sectionLocked = isBodyConditionMarkedDone(displayEntry);
    const inspectionStatus = String(vehicle?.vehicleInspectionStatus || '').toLowerCase();
    const inspectionSubmitted = inspectionHandover && inspectionStatus === 'pending_hr';
    const isEditingDisabled = readOnly || sectionLocked;
    const formComplete = useMemo(() => {
        if (isBodyConditionFormComplete(form)) return true;
        return isBodyConditionFormComplete(buildBodyConditionFormState(displayEntry));
    }, [form, displayEntry]);

    useEffect(() => {
        setLocalEntry(null);
        setForm(buildBodyConditionFormState(historyEntry));
    }, [historyEntryId]);

    useEffect(() => {
        if (savingKey || uploadingKey || completing) return;
        const fromServer = buildBodyConditionFormState(historyEntry);
        setForm((prev) => {
            const merged = { ...fromServer };
            BODY_CONDITION_VIEW_FIELDS.forEach((field) => {
                const localPhoto = prev[field.key]?.photo;
                const serverPhoto = fromServer[field.key]?.photo;
                if (hasAssessmentPhoto(localPhoto) && !hasAssessmentPhoto(serverPhoto)) {
                    merged[field.key] = { ...fromServer[field.key], photo: localPhoto };
                }
            });
            return merged;
        });
    }, [historyEntry?.details?.bodyConditionReport, historyEntry?.details?.bodyConditionCompleted]);

    const views = useMemo(
        () => BODY_CONDITION_VIEW_FIELDS.map((field) => ({ ...field, ...form[field.key] })),
        [form],
    );

    const galleryItems = useMemo(
        () =>
            BODY_CONDITION_VIEW_FIELDS.map((field) => ({
                key: field.key,
                label: field.label,
                url: resolveAssessmentMediaUrl(form[field.key]?.photo),
            })).filter((item) => item.url),
        [form],
    );

    const persistRow = useCallback(
        async (key, row) => {
            if (isEditingDisabled) return null;

            const historyId = historyEntry?._id;
            const isLiveEntry = String(historyId || '').startsWith('live-');
            const payload = {
                [key]: {
                    comment: String(row?.comment || '').trim(),
                    photo: row?.photo || null,
                },
            };

            if (isLiveEntry || !historyId) {
                const merged = mergeBodyConditionRowIntoEntry(displayEntry, key, row);
                setLocalEntry(merged);
                onSaved?.(merged, { partial: true });
                return merged;
            }

            setSavingKey(key);
            try {
                await axiosInstance.put(
                    `/AssetItem/history-record/${historyId}/body-condition`,
                    { bodyConditionReport: payload, partial: true },
                    BODY_MUTATION_CONFIG,
                );
                const merged = mergeBodyConditionRowIntoEntry(displayEntry, key, row);
                setLocalEntry(merged);
                onSaved?.(merged, { partial: true });
                return merged;
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: 'Save failed',
                    description: error.response?.data?.message || 'Could not save this view.',
                });
                throw error;
            } finally {
                setSavingKey((current) => (current === key ? null : current));
            }
        },
        [displayEntry, historyEntry?._id, isEditingDisabled, onSaved, toast],
    );

    const handleCommentBlur = async (key, comment) => {
        if (isEditingDisabled) return;
        const previousRow = form[key] || { comment: '', photo: null };
        const trimmed = String(comment || '').trim();
        if (trimmed === String(previousRow.comment || '').trim()) return;

        const nextRow = { ...previousRow, comment: trimmed };
        setForm((prev) => ({ ...prev, [key]: nextRow }));
        try {
            await persistRow(key, nextRow);
        } catch {
            setForm((prev) => ({ ...prev, [key]: previousRow }));
        }
    };

    const handlePhotoUpload = async (key, file) => {
        if (isEditingDisabled || photoUploadInFlightRef.current.has(key)) return;

        if (!file.type.startsWith('image/')) {
            toast({
                variant: 'destructive',
                title: 'Invalid file',
                description: 'Please upload an image file.',
            });
            return;
        }

        photoUploadInFlightRef.current.add(key);
        setUploadingKey(key);
        const previousRow = form[key] || { comment: '', photo: null };
        try {
            const dataUrl = await readFileAsDataUrl(file);
            const nextRow = { ...previousRow, photo: dataUrl };
            setForm((prev) => ({ ...prev, [key]: nextRow }));
            await persistRow(key, nextRow);
        } catch {
            setForm((prev) => ({ ...prev, [key]: previousRow }));
        } finally {
            photoUploadInFlightRef.current.delete(key);
            setUploadingKey(null);
        }
    };

    const openPhotoViewer = (viewKey) => {
        const index = galleryItems.findIndex((item) => item.key === viewKey);
        if (index < 0) return;
        setViewerStartIndex(index);
        setViewerOpen(true);
    };

    const handleGoToApproval = async () => {
        if (inspectionHandover && sectionLocked) {
            onGoToApproval?.();
            return;
        }

        if (isEditingDisabled && !inspectionHandover) {
            onGoToApproval?.();
            return;
        }

        if (!isReceiverAssessmentMarkedDone(displayEntry)) {
            const assessmentForm = buildAssessmentFormState(displayEntry, vehicle);
            if (!isAssessmentFormComplete(assessmentForm)) {
                toast({
                    variant: 'destructive',
                    title: 'Vehicle Assessment required',
                    description:
                        'Complete all Yes/No items and required photos in Vehicle Assessment Report first.',
                });
                onGoToAssessment?.();
                return;
            }
        }

        const serverForm = buildBodyConditionFormState(displayEntry);
        const mergedForSubmit = { ...serverForm };
        BODY_CONDITION_VIEW_FIELDS.forEach((field) => {
            const localPhoto = form[field.key]?.photo;
            if (hasAssessmentPhoto(localPhoto)) {
                mergedForSubmit[field.key] = {
                    comment: String(form[field.key]?.comment ?? serverForm[field.key]?.comment ?? '').trim(),
                    photo: localPhoto,
                };
            }
        });
        const submitErrors = validateBodyConditionForm(mergedForSubmit);
        if (Object.keys(submitErrors).length > 0) {
            toast({
                variant: 'destructive',
                title: 'Body condition incomplete',
                description: 'Upload a photo for every vehicle view before continuing.',
            });
            return;
        }

        const historyId = historyEntry?._id;
        const isLiveEntry = String(historyId || '').startsWith('live-');

        setCompleting(true);
        try {
            const payload = buildBodyConditionPayload(mergedForSubmit);

            if (isLiveEntry || !historyId) {
                const merged = mergeBodyConditionCompletedIntoEntry(
                    mergeBodyConditionIntoEntry(displayEntry, payload),
                );
                setLocalEntry(merged);
                onSaved?.(merged);
            } else {
                await axiosInstance.put(
                    `/AssetItem/history-record/${historyId}/body-condition`,
                    { bodyConditionReport: payload, bodyConditionCompleted: true },
                    BODY_MUTATION_CONFIG,
                );
                const merged = mergeBodyConditionCompletedIntoEntry(
                    mergeBodyConditionIntoEntry(displayEntry, payload),
                );
                setLocalEntry(merged);
                onSaved?.(merged);
            }

            if (inspectionHandover) {
                toast({
                    title: 'Next step',
                    description: 'Scroll up to the summary and use Send to HR when ready.',
                });
            }
            onGoToApproval?.();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not continue',
                description: error.response?.data?.message || 'Please try again.',
            });
        } finally {
            setCompleting(false);
        }
    };

    const showFooterButton = !inspectionSubmitted;
    const footerButtonLabel = (() => {
        if (inspectionHandover) {
            return sectionLocked ? 'Go to Summary' : 'Next Step';
        }
        if (sectionLocked) return 'Go to Approval';
        return 'Go to Approval';
    })();

    return (
        <>
            <FineFormCard
                title="Body Condition Report"
                subtitle="Photo and comments per vehicle view"
                icon={Car}
                iconBg="bg-slate-50"
                iconColor="text-slate-700"
                className="w-full"
            >
                <div className="grid grid-cols-2 gap-2">
                    {views.map((view) => (
                        <ViewCellEditor
                            key={view.key}
                            view={view}
                            row={form[view.key]}
                            saving={savingKey === view.key}
                            uploading={uploadingKey === view.key}
                            readOnly={isEditingDisabled}
                            onCommentBlur={handleCommentBlur}
                            onPhotoUpload={(file) => handlePhotoUpload(view.key, file)}
                            onPhotoPreview={() => openPhotoViewer(view.key)}
                        />
                    ))}
                </div>

                {showFooterButton ? (
                    <div className="mt-6 flex justify-center border-t border-gray-100 pt-5">
                        <button
                            type="button"
                            onClick={handleGoToApproval}
                            disabled={
                                completing ||
                                (sectionLocked && inspectionHandover
                                    ? false
                                    : readOnly || !formComplete)
                            }
                            className="inline-flex min-w-[200px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {completing ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <ArrowUp size={16} />
                            )}
                            {footerButtonLabel}
                        </button>
                    </div>
                ) : null}
            </FineFormCard>

            <VehicleHandoverAssessmentPhotoViewer
                open={viewerOpen}
                items={galleryItems}
                startIndex={viewerStartIndex}
                onClose={() => setViewerOpen(false)}
            />
        </>
    );
}
