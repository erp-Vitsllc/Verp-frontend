'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ClipboardCheck, Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    RECEIVER_ASSESSMENT_ITEMS,
    buildAssessmentFormState,
    buildAssessmentPayload,
    HANDOVER_ASSESSMENT_GRID_CLASS,
    isAssessmentFormComplete,
    isReceiverAssessmentMarkedDone,
    mergeAssessmentCompletedIntoEntry,
    mergeReceiverAssessmentIntoEntry,
    resolveAssessmentMediaUrl,
    validateAssessmentForm,
} from '../utils/vehicleHandoverReceiverAssessment';
import { hasCurrentReceiverAssessmentData } from '../utils/vehicleHandoverPreviousReports';
import VehicleHandoverAssessmentPhotoViewer from './VehicleHandoverAssessmentPhotoViewer';
import VehicleHandoverLandscapePhotoBox, {
    VehicleHandoverLandscapePhotoPlaceholder,
} from './VehicleHandoverLandscapePhotoBox';
import { buildAssessmentComparisonRows } from '../utils/vehicleHandoverPhotoComparison';
import {
    handoverItemVisualClasses,
    isHandoverApprovedWithoutFine,
    resolveHandoverComparisonChanged,
    resolveHandoverItemFine,
    resolveHandoverItemVisualStatus,
} from '../utils/vehicleHandoverItemFineUtils';
import VehicleHandoverItemFineButton from './VehicleHandoverItemFineButton';
import VehicleHandoverYesNoToggle from './VehicleHandoverYesNoToggle';

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

function AssessmentItemCard({
    label,
    present,
    photo,
    saving,
    uploading,
    readOnly = false,
    visualStatus = 'neutral',
    hasFine = false,
    showFineAction = false,
    onAddFine,
    onPresentChange,
    onPhotoUpload,
    onPhotoPreview,
}) {
    const photoUrl = resolveAssessmentMediaUrl(photo);
    const showPhoto = present === true;
    const photoMissing = showPhoto && !photoUrl;
    const visuals = handoverItemVisualClasses(visualStatus);

    return (
        <div className={`flex flex-col rounded-xl p-3 shadow-sm ${visuals.card} ${readOnly ? 'opacity-95' : ''}`}>
            <div className="flex shrink-0 items-center justify-between gap-2">
                <h5 className="truncate text-sm font-bold text-gray-900">{label}</h5>
                <div className="flex shrink-0 items-center gap-1.5">
                    {visuals.badgeLabel ? (
                        <span
                            className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase ${visuals.badge}`}
                        >
                            {visuals.badgeLabel}
                        </span>
                    ) : null}
                    <VehicleHandoverYesNoToggle
                        value={present}
                        onChange={onPresentChange}
                        disabled={readOnly || saving || uploading}
                    />
                </div>
            </div>

            <div className="mt-2 min-h-[34px] shrink-0">
                {showPhoto ? (
                    <>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Photo <span className="text-red-500">*</span>
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
                            Photo required when Yes is selected
                        </p>
                    </>
                ) : null}
            </div>

            <div className={`mt-2 shrink-0 rounded-lg ${visuals.frame}`}>
                {showPhoto ? (
                    <VehicleHandoverLandscapePhotoBox
                        label={label}
                        photoUrl={photoUrl}
                        missing={photoMissing && !readOnly}
                        uploading={uploading}
                        readOnly={readOnly}
                        onUpload={onPhotoUpload}
                        onPreview={photoUrl ? onPhotoPreview : undefined}
                        inputIdPrefix="assessment-upload"
                    />
                ) : (
                    <VehicleHandoverLandscapePhotoPlaceholder>
                        {present === false ? 'No photo required' : 'Select Yes or No above'}
                    </VehicleHandoverLandscapePhotoPlaceholder>
                )}
            </div>

            <p className="mt-1.5 min-h-[14px] shrink-0 text-[10px] font-medium text-amber-600">
                {photoMissing ? 'Photo required' : ''}
            </p>

            {showFineAction ? (
                <VehicleHandoverItemFineButton hasFine={hasFine} onClick={onAddFine} />
            ) : null}
        </div>
    );
}

export default function VehicleHandoverReceiverAssessmentCard({
    historyEntry,
    vehicle,
    assetHistory = [],
    onSaved,
    onDone,
    onVehicleUpdated,
    inspectionHandover = false,
    readOnly: readOnlyProp = false,
    handoverItemFines = {},
    canManageItemFines = false,
    onOpenItemFine,
}) {
    const { toast } = useToast();
    const [localEntry, setLocalEntry] = useState(null);
    const [form, setForm] = useState(() => buildAssessmentFormState(historyEntry, vehicle, { assetHistory }));
    const [savingKey, setSavingKey] = useState(null);
    const [uploadingKey, setUploadingKey] = useState(null);
    const [completing, setCompleting] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerStartIndex, setViewerStartIndex] = useState(0);
    const photoUploadInFlightRef = useRef(new Set());
    const prefillPersistedRef = useRef(false);

    const historyEntryId = historyEntry?._id;

    const prefilledForm = useMemo(
        () =>
            buildAssessmentFormState(historyEntry, vehicle, {
                assetHistory,
                currentEntry: historyEntry,
            }),
        [assetHistory, historyEntry, historyEntryId, vehicle],
    );

    const prefilledFormHasSelections = useMemo(
        () =>
            RECEIVER_ASSESSMENT_ITEMS.some(
                (item) =>
                    prefilledForm[item.key]?.present === true ||
                    prefilledForm[item.key]?.present === false,
            ),
        [prefilledForm],
    );

    useEffect(() => {
        setLocalEntry(null);
        prefillPersistedRef.current = false;
        setForm(prefilledForm);
    }, [historyEntryId, prefilledForm, historyEntry?.details?.receiverAssessment, historyEntry?.details?.vehicleAssessmentReportByReceiver]);

    useEffect(() => {
        if (!vehicle || !historyEntry || !assetHistory?.length) return;
        if (hasCurrentReceiverAssessmentData(historyEntry)) return;
        if (!prefilledFormHasSelections) return;

        setForm((prev) => {
            const hasAnySelection = RECEIVER_ASSESSMENT_ITEMS.some(
                (item) => prev[item.key]?.present === true || prev[item.key]?.present === false,
            );
            return hasAnySelection ? prev : prefilledForm;
        });
    }, [assetHistory, historyEntry, prefilledForm, prefilledFormHasSelections, vehicle]);

    const displayEntry = localEntry || historyEntry;
    const assessmentCompleted = isReceiverAssessmentMarkedDone(displayEntry);
    const readOnly = readOnlyProp || assessmentCompleted || (
        inspectionHandover &&
        String(vehicle?.vehicleInspectionStatus || '').toLowerCase() !== 'draft'
    );
    const assessmentComplete = isAssessmentFormComplete(form);

    const comparisonByKey = useMemo(() => {
        const rows = buildAssessmentComparisonRows(historyEntry, assetHistory);
        const acceptedWithoutFine = isHandoverApprovedWithoutFine(historyEntry);
        const map = {};
        rows.forEach((row) => {
            const hasBaseline =
                row.previous.present === true ||
                row.previous.present === false ||
                Boolean(row.previous.photoUrl);
            const rawChanged = Boolean(row.changed && hasBaseline);
            map[row.key] = {
                changed: resolveHandoverComparisonChanged(rawChanged, historyEntry),
                hasBaseline,
                acceptedWithoutFine,
            };
        });
        return map;
    }, [assetHistory, historyEntry, historyEntry?.details?.handoverLifecycleStatus, historyEntry?.details?.handoverApprovedWithFine]);

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
                    present: row.present === true ? true : row.present === false ? false : null,
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

    const completeAssessment = useCallback(
        async (formToSubmit) => {
            if (readOnly || isReceiverAssessmentMarkedDone(displayEntry)) return;

            const errors = validateAssessmentForm(formToSubmit);
            if (Object.keys(errors).length > 0) return;

            const historyId = historyEntry?._id;
            const isLiveEntry = String(historyId || '').startsWith('live-');
            const payload = buildAssessmentPayload(formToSubmit);

            setCompleting(true);
            try {
                if (isLiveEntry || !historyId) {
                    const withAssessment = mergeReceiverAssessmentIntoEntry(displayEntry, payload);
                    const merged = mergeAssessmentCompletedIntoEntry(withAssessment);
                    setLocalEntry(merged);
                    onSaved?.(merged);
                    onDone?.(merged);
                    return merged;
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
                toast({ title: 'Assessment saved', description: 'Body Condition Report is now available.' });
                return merged;
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: 'Could not complete assessment',
                    description: error.response?.data?.message || 'Please try again.',
                });
                throw error;
            } finally {
                setCompleting(false);
            }
        },
        [displayEntry, historyEntry?._id, onDone, onSaved, readOnly, toast],
    );

    const tryAutoCompleteAssessment = useCallback(
        async (nextForm) => {
            if (!isAssessmentFormComplete(nextForm)) return;
            try {
                await completeAssessment(nextForm);
            } catch {
                /* keep partial progress */
            }
        },
        [completeAssessment],
    );

    useEffect(() => {
        if (prefillPersistedRef.current || !historyEntry?._id) return;
        if (String(historyEntry._id).startsWith('live-')) return;
        if (hasCurrentReceiverAssessmentData(historyEntry)) {
            setForm(prefilledForm);
            return;
        }
        if (!assetHistory?.length) return;

        const prefillForm = prefilledForm;
        const hasPrefill = prefilledFormHasSelections;
        if (!hasPrefill) return;

        prefillPersistedRef.current = true;
        setForm(prefillForm);

        if (readOnly) return;

        const payload = buildAssessmentPayload(prefillForm);
        void axiosInstance
            .put(
                `/AssetItem/history-record/${historyEntry._id}/receiver-assessment`,
                { receiverAssessment: payload, partial: true },
                ASSESSMENT_MUTATION_CONFIG,
            )
            .then(() => {
                const merged = mergeReceiverAssessmentIntoEntry(historyEntry, payload);
                setLocalEntry(merged);
                onSaved?.(merged, { partial: true, prefilledFromPrevious: true });
                void tryAutoCompleteAssessment(prefillForm);
            })
            .catch(() => {
                prefillPersistedRef.current = false;
            });
    }, [assetHistory, historyEntry, historyEntryId, onSaved, prefilledForm, prefilledFormHasSelections, readOnly, tryAutoCompleteAssessment, vehicle]);

    const persistRow = useCallback(
        async (key, row) => {
            if (readOnly) return null;

            const historyId = historyEntry?._id;
            const isLiveEntry = String(historyId || '').startsWith('live-');
            const payload = {
                [key]: {
                    present: row.present === true ? true : row.present === false ? false : null,
                    photo: row.present === true ? row.photo : null,
                },
            };

            if (isLiveEntry || !historyId) {
                const merged = mergeSavedAssessmentRow(key, row);
                setLocalEntry(merged);
                onSaved?.(merged, { partial: true });
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
                onSaved?.(merged, { partial: true });
                return merged;
            } catch (error) {
                if (isActionDedupedError(error)) {
                    const merged = mergeSavedAssessmentRow(key, row);
                    setLocalEntry(merged);
                    onSaved?.(merged, { partial: true });
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
            await tryAutoCompleteAssessment({ ...form, [key]: nextRow });
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
            const nextForm = { ...form, [key]: nextRow };
            setForm((prev) => ({ ...prev, [key]: nextRow }));
            await persistRow(key, nextRow);
            await tryAutoCompleteAssessment(nextForm);
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
        try {
            await completeAssessment(form);
            toast({ title: 'Next step', description: 'Body Condition Report is now available.' });
        } catch {
            /* toast shown in completeAssessment */
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
                        <p className="text-xs text-gray-500">
                            {inspectionHandover ? 'By Admin Officer' : 'By Receiver'}
                            {' · '}
                            Green = matches previous · Red = changed · Yellow = in fine
                        </p>
                    </div>
                </div>

                {readOnly && !assessmentCompleted ? (
                    <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {inspectionHandover
                            ? 'Only the Admin Officer (or assigned driver with portal access) can edit this inspection report.'
                            : 'Only the handover receiver or Admin Officer can edit this report at the current workflow stage.'}
                    </p>
                ) : null}

                <div className={HANDOVER_ASSESSMENT_GRID_CLASS}>
                    {RECEIVER_ASSESSMENT_ITEMS.map((item) => {
                        const row = form[item.key] || { present: null, photo: null };
                        const comparison = comparisonByKey[item.key];
                        const existingFine = resolveHandoverItemFine(
                            handoverItemFines,
                            'accessory',
                            item.key,
                        );
                        const visualStatus = resolveHandoverItemVisualStatus({
                            changed: comparison?.changed,
                            hasFine: Boolean(existingFine),
                            hasBaseline: comparison?.hasBaseline,
                            acceptedWithoutFine: comparison?.acceptedWithoutFine,
                        });
                        const showFineAction =
                            canManageItemFines &&
                            (visualStatus === 'changed' || visualStatus === 'fined');

                        return (
                            <AssessmentItemCard
                                key={item.key}
                                label={item.label}
                                present={row.present}
                                photo={row.photo}
                                saving={savingKey === item.key}
                                uploading={uploadingKey === item.key}
                                readOnly={readOnly}
                                visualStatus={visualStatus}
                                hasFine={Boolean(existingFine)}
                                showFineAction={showFineAction}
                                onAddFine={
                                    showFineAction
                                        ? () =>
                                              onOpenItemFine?.({
                                                  itemType: 'accessory',
                                                  itemKey: item.key,
                                                  itemLabel: item.label,
                                                  existingFine,
                                              })
                                        : undefined
                                }
                                onPresentChange={(value) => handlePresentChange(item.key, value)}
                                onPhotoUpload={(file) => handlePhotoUpload(item.key, file)}
                                onPhotoPreview={() => openPhotoViewer(item.key)}
                            />
                        );
                    })}
                    <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-3">
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
