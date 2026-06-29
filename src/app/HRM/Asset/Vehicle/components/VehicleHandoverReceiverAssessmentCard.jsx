'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ClipboardCheck, ImageIcon, Loader2, Upload } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    RECEIVER_ASSESSMENT_ITEMS,
    buildAssessmentFormState,
    buildAssessmentPayload,
    isAssessmentFormComplete,
    isReceiverAssessmentMarkedDone,
    mergeAssessmentCompletedIntoEntry,
    mergeReceiverAssessmentIntoEntry,
    resolveAssessmentMediaUrl,
    validateAssessmentForm,
} from '../utils/vehicleHandoverReceiverAssessment';
import VehicleHandoverAssessmentPhotoViewer from './VehicleHandoverAssessmentPhotoViewer';
import VehicleHandoverYesNoToggle from './VehicleHandoverYesNoToggle';

const PHOTO_BOX_HEIGHT_CLASS = 'h-[100px]';
const ASSESSMENT_MUTATION_CONFIG = { skipActionDedupe: true };

function isActionDedupedError(error) {
    return error?.code === 'ACTION_DEDUPED';
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function LandscapePhotoField({
    label,
    photoUrl,
    missing,
    uploading,
    readOnly = false,
    onUpload,
    onPreview,
}) {
    const inputId = `assessment-upload-${label.replace(/\s+/g, '-')}`;

    if (photoUrl) {
        return (
            <div className={`relative w-full ${PHOTO_BOX_HEIGHT_CLASS}`}>
                <button
                    type="button"
                    onClick={onPreview}
                    className="block h-full w-full overflow-hidden rounded-lg border border-gray-200 bg-white text-left transition-colors hover:ring-2 hover:ring-slate-300"
                >
                    <img
                        src={photoUrl}
                        alt={`${label} photo`}
                        className="h-full w-full object-contain"
                    />
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
            <div className={`flex h-full w-full items-center justify-center rounded-lg border border-gray-100 bg-gray-50 ${PHOTO_BOX_HEIGHT_CLASS}`}>
                <ImageIcon size={22} className="text-gray-300" strokeWidth={1.5} />
            </div>
        );
    }

    return (
        <label
            htmlFor={inputId}
            className={`flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-gray-50 transition-colors hover:bg-gray-100 ${
                missing ? 'border-amber-300 text-amber-600' : 'border-gray-200 text-gray-400'
            }`}
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

function AssessmentItemCard({
    label,
    present,
    photo,
    saving,
    uploading,
    readOnly = false,
    onPresentChange,
    onPhotoUpload,
    onPhotoPreview,
}) {
    const photoUrl = resolveAssessmentMediaUrl(photo);
    const showPhoto = present === true;
    const photoMissing = showPhoto && !photoUrl;

    return (
        <div className={`flex h-full min-h-[248px] flex-col rounded-xl border border-gray-100 bg-white p-3 shadow-sm ${readOnly ? 'opacity-95' : ''}`}>
            <div className="flex shrink-0 items-center justify-between gap-2">
                <h5 className="truncate text-sm font-bold text-gray-900">{label}</h5>
                <VehicleHandoverYesNoToggle
                    value={present}
                    onChange={onPresentChange}
                    disabled={readOnly || saving || uploading}
                />
            </div>

            <p
                className={`mt-2 shrink-0 text-[10px] font-bold uppercase tracking-wider ${
                    showPhoto ? 'text-gray-400' : 'text-transparent'
                }`}
            >
                Photo <span className="text-red-500">*</span>
            </p>
            <p
                className={`mt-0.5 shrink-0 text-[11px] leading-snug ${
                    showPhoto ? 'text-gray-500' : 'text-transparent'
                }`}
            >
                Photo required when Yes is selected
            </p>

            <div className={`mt-2 shrink-0 ${PHOTO_BOX_HEIGHT_CLASS}`}>
                {showPhoto ? (
                    <LandscapePhotoField
                        label={label}
                        photoUrl={photoUrl}
                        missing={photoMissing && !readOnly}
                        uploading={uploading}
                        readOnly={readOnly}
                        onUpload={onPhotoUpload}
                        onPreview={photoUrl ? onPhotoPreview : undefined}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-lg border border-gray-100 bg-gray-50 px-2 text-center text-[11px] text-gray-400">
                        {present === false ? 'No photo required' : 'Select Yes or No above'}
                    </div>
                )}
            </div>

            <p className="mt-1.5 min-h-[14px] shrink-0 text-[10px] font-medium text-amber-600">
                {photoMissing ? 'Photo required' : ''}
            </p>
        </div>
    );
}

export default function VehicleHandoverReceiverAssessmentCard({
    historyEntry,
    vehicle,
    onSaved,
    onDone,
    readOnly: readOnlyProp = false,
}) {
    const { toast } = useToast();
    const [localEntry, setLocalEntry] = useState(null);
    const [form, setForm] = useState(() => buildAssessmentFormState(historyEntry, vehicle));
    const [savingKey, setSavingKey] = useState(null);
    const [uploadingKey, setUploadingKey] = useState(null);
    const [completing, setCompleting] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerStartIndex, setViewerStartIndex] = useState(0);
    const photoUploadInFlightRef = useRef(new Set());

    const historyEntryId = historyEntry?._id;

    useEffect(() => {
        setLocalEntry(null);
        setForm(buildAssessmentFormState(historyEntry, vehicle));
    }, [historyEntryId]);

    useEffect(() => {
        if (!vehicle || !historyEntry) return;

        setForm((prev) => {
            const hasAnySelection = RECEIVER_ASSESSMENT_ITEMS.some(
                (item) => prev[item.key]?.present === true || prev[item.key]?.present === false,
            );
            if (hasAnySelection) return prev;

            return buildAssessmentFormState(historyEntry, vehicle);
        });
    }, [vehicle, historyEntry]);

    const displayEntry = localEntry || historyEntry;
    const assessmentCompleted = isReceiverAssessmentMarkedDone(displayEntry);
    const readOnly = readOnlyProp || assessmentCompleted;
    const assessmentComplete = isAssessmentFormComplete(form);

    const mergeSavedAssessmentRow = useCallback(
        (key, row) => {
            const existingAssessment =
                displayEntry?.details?.receiverAssessment &&
                typeof displayEntry.details.receiverAssessment === 'object'
                    ? displayEntry.details.receiverAssessment
                    : {};

            return mergeReceiverAssessmentIntoEntry(displayEntry, {
                ...existingAssessment,
                [key]: {
                    present: row.present === true,
                    photo: row.present === true ? row.photo : null,
                },
            });
        },
        [displayEntry],
    );

    const galleryItems = useMemo(
        () =>
            RECEIVER_ASSESSMENT_ITEMS.map((item) => ({
                key: item.key,
                label: item.label,
                url: resolveAssessmentMediaUrl(form[item.key]?.photo),
            })).filter((item) => item.url),
        [form],
    );

    const persistRow = useCallback(
        async (key, row) => {
            if (readOnly) return null;

            const historyId = historyEntry?._id;
            const isLiveEntry = String(historyId || '').startsWith('live-');
            const payload = {
                [key]: {
                    present: row.present === true,
                    photo: row.present === true ? row.photo : null,
                },
            };

            if (isLiveEntry || !historyId) {
                const merged = mergeSavedAssessmentRow(key, row);
                setLocalEntry(merged);
                onSaved?.(merged);
                return merged;
            }

            setSavingKey(key);
            try {
                await axiosInstance.put(
                    `/AssetItem/history-record/${historyId}/receiver-assessment`,
                    { receiverAssessment: payload, partial: true },
                    ASSESSMENT_MUTATION_CONFIG,
                );
                const merged = mergeSavedAssessmentRow(key, row);
                setLocalEntry(merged);
                onSaved?.(merged);
                return merged;
            } catch (error) {
                if (isActionDedupedError(error)) {
                    const merged = mergeSavedAssessmentRow(key, row);
                    setLocalEntry(merged);
                    return merged;
                }
                toast({
                    variant: 'destructive',
                    title: 'Save failed',
                    description: error.response?.data?.message || 'Could not save this item.',
                });
                throw error;
            } finally {
                setSavingKey((current) => (current === key ? null : current));
            }
        },
        [mergeSavedAssessmentRow, historyEntry?._id, onSaved, readOnly, toast],
    );

    const handlePresentChange = async (key, present) => {
        if (readOnly) return;
        const previousRow = form[key] || { present: null, photo: null };
        const nextRow = {
            present,
            photo: present === true ? previousRow.photo ?? null : null,
        };
        setForm((prev) => ({ ...prev, [key]: nextRow }));
        try {
            await persistRow(key, nextRow);
        } catch {
            setForm((prev) => ({ ...prev, [key]: previousRow }));
        }
    };

    const handlePhotoUpload = async (key, file) => {
        if (readOnly) return;
        if (photoUploadInFlightRef.current.has(key)) return;

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
        const previousRow = form[key] || { present: null, photo: null };
        try {
            const dataUrl = await readFileAsDataUrl(file);
            const nextRow = { present: true, photo: dataUrl };
            setForm((prev) => ({ ...prev, [key]: nextRow }));
            await persistRow(key, nextRow);
            toast({ title: 'Saved', description: 'Photo uploaded successfully.' });
        } catch {
            setForm((prev) => ({ ...prev, [key]: previousRow }));
        } finally {
            photoUploadInFlightRef.current.delete(key);
            setUploadingKey(null);
        }
    };

    const openPhotoViewer = (rowKey) => {
        const galleryIndex = galleryItems.findIndex((item) => item.key === rowKey);
        if (galleryIndex < 0) return;
        setViewerStartIndex(galleryIndex);
        setViewerOpen(true);
    };

    const handleDone = async () => {
        if (readOnly) return;

        const errors = validateAssessmentForm(form);
        if (Object.keys(errors).length > 0) {
            const firstError = Object.values(errors)[0];
            toast({
                variant: 'destructive',
                title: 'Assessment incomplete',
                description: firstError || 'Complete all items before continuing.',
            });
            return;
        }

        const historyId = historyEntry?._id;
        const isLiveEntry = String(historyId || '').startsWith('live-');
        const payload = buildAssessmentPayload(form);

        setCompleting(true);
        try {
            if (isLiveEntry || !historyId) {
                const withAssessment = mergeReceiverAssessmentIntoEntry(displayEntry, payload);
                const merged = mergeAssessmentCompletedIntoEntry(withAssessment);
                setLocalEntry(merged);
                onSaved?.(merged);
                onDone?.(merged);
                toast({ title: 'Next step', description: 'Body Condition Report is now available.' });
                return;
            }

            await axiosInstance.put(
                `/AssetItem/history-record/${historyId}/receiver-assessment`,
                {
                    receiverAssessment: payload,
                    assessmentCompleted: true,
                },
                ASSESSMENT_MUTATION_CONFIG,
            );
            const withAssessment = mergeReceiverAssessmentIntoEntry(displayEntry, payload);
            const merged = mergeAssessmentCompletedIntoEntry(withAssessment);
            setLocalEntry(merged);
            onSaved?.(merged);
            onDone?.(merged);
            toast({ title: 'Next step', description: 'Body Condition Report is now available.' });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not complete assessment',
                description: error.response?.data?.message || 'Please try again.',
            });
        } finally {
            setCompleting(false);
        }
    };

    return (
        <>
            <div className="w-full">
                <div className="mb-3 flex items-center gap-2.5 border-b border-gray-100 pb-3">
                    <div className="rounded-xl bg-slate-50 p-2 text-slate-700">
                        <ClipboardCheck size={20} />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-sm font-bold text-gray-800">Vehicle Assessment Report</h4>
                        <p className="text-xs text-gray-500">By Receiver</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {RECEIVER_ASSESSMENT_ITEMS.map((item) => {
                        const row = form[item.key] || { present: null, photo: null };
                        return (
                            <div key={item.key} className="h-full">
                                <AssessmentItemCard
                                    label={item.label}
                                    present={row.present}
                                    photo={row.photo}
                                    saving={savingKey === item.key}
                                    uploading={uploadingKey === item.key}
                                    readOnly={readOnly}
                                    onPresentChange={(value) => handlePresentChange(item.key, value)}
                                    onPhotoUpload={(file) => handlePhotoUpload(item.key, file)}
                                    onPhotoPreview={() => openPhotoViewer(item.key)}
                                />
                            </div>
                        );
                    })}
                    <div className="flex h-full min-h-[248px] items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-3">
                        <button
                            type="button"
                            onClick={handleDone}
                            disabled={readOnly || completing || !assessmentComplete}
                            className={`inline-flex min-w-[120px] items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                assessmentCompleted
                                    ? 'bg-emerald-600 hover:bg-emerald-700'
                                    : 'bg-slate-900 hover:bg-slate-800'
                            }`}
                        >
                            {completing ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Check size={16} />
                            )}
                            Next Step
                        </button>
                    </div>
                </div>
            </div>

            <VehicleHandoverAssessmentPhotoViewer
                open={viewerOpen}
                items={galleryItems}
                startIndex={viewerStartIndex}
                onClose={() => setViewerOpen(false)}
            />
        </>
    );
}
