'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ClipboardCheck, Loader2, RotateCcw, Save } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    RECEIVER_ASSESSMENT_ITEMS,
    applyAssessmentPresentToggle,
    assessmentFormChanged,
    buildAccessoriesListAssignmentChangeEntry,
    buildAssessmentFormState,
    buildAssessmentPayload,
    buildPreviousHandoverComparisonForm,
    cloneAssessmentForm,
    HANDOVER_ASSESSMENT_GRID_CLASS,
    hasAssessmentDraftSelections,
    isAssessmentFormComplete,
    isReceiverAssessmentMarkedDone,
    mergeAccessoriesListAssignmentChangeEntry,
    mergeAssessmentCompletedIntoEntry,
    mergeReceiverAssessmentIntoEntry,
    resolveAssessmentMediaUrl,
    validateAssessmentForm,
} from '../utils/vehicleHandoverReceiverAssessment';
import { hasCurrentReceiverAssessmentData } from '../utils/vehicleHandoverPreviousReports';
import { resolveHandoverDeleteHistoryId } from '../utils/vehicleHandoverHistory';
import VehicleHandoverAssessmentPhotoViewer from './VehicleHandoverAssessmentPhotoViewer';
import VehicleHandoverLandscapePhotoBox, {
    VehicleHandoverLandscapePhotoPlaceholder,
} from './VehicleHandoverLandscapePhotoBox';
import { buildAssessmentFormComparisonRows } from '../utils/vehicleHandoverPhotoComparison';
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
    showFineHint = false,
    showMatchesPrevious = false,
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

            <p className="mt-1.5 min-h-[28px] shrink-0 text-[10px] font-medium leading-snug">
                {photoMissing ? (
                    <span className="text-amber-600">Photo required</span>
                ) : showFineHint ? (
                    <span className="text-red-600">This change may result in a fine for you.</span>
                ) : showMatchesPrevious ? (
                    <span className="text-emerald-700">Matches previous handover.</span>
                ) : null}
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
    isHrApprovalStage = false,
    onOpenItemFine,
}) {
    const { toast } = useToast();
    const [localEntry, setLocalEntry] = useState(null);
    const [savedForm, setSavedForm] = useState(() =>
        cloneAssessmentForm(
            buildAssessmentFormState(historyEntry, vehicle, { assetHistory, asset: vehicle }),
        ),
    );
    const [form, setForm] = useState(() =>
        buildAssessmentFormState(historyEntry, vehicle, { assetHistory, asset: vehicle }),
    );
    const [uploadingKey, setUploadingKey] = useState(null);
    const [savingDraft, setSavingDraft] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerStartIndex, setViewerStartIndex] = useState(0);
    const photoUploadInFlightRef = useRef(new Set());

    const historyEntryId = historyEntry?._id;

    const baselineForm = useMemo(
        () =>
            buildAssessmentFormState(localEntry || historyEntry, vehicle, {
                assetHistory,
                currentEntry: historyEntry,
                asset: vehicle,
            }),
        [assetHistory, historyEntry, historyEntryId, localEntry, vehicle],
    );

    useEffect(() => {
        setLocalEntry(null);
        const nextBaseline = cloneAssessmentForm(baselineForm);
        setSavedForm(nextBaseline);
        setForm(nextBaseline);
    }, [
        historyEntryId,
        baselineForm,
        historyEntry?.details?.receiverAssessment,
        historyEntry?.details?.vehicleAssessmentReportByReceiver,
    ]);

    const displayEntry = localEntry || historyEntry;
    const assessmentCompleted = isReceiverAssessmentMarkedDone(displayEntry);
    const readOnly = readOnlyProp || assessmentCompleted || (
        inspectionHandover &&
        String(vehicle?.vehicleInspectionStatus || '').toLowerCase() !== 'draft'
    );
    const assessmentComplete = isAssessmentFormComplete(form);
    const formDirty = useMemo(() => assessmentFormChanged(savedForm, form), [form, savedForm]);
    const hasDraftSelections = useMemo(() => hasAssessmentDraftSelections(form), [form]);
    const actionBusy = savingDraft || completing;
    const canSaveDraft =
        hasDraftSelections &&
        (formDirty || !hasCurrentReceiverAssessmentData(displayEntry));

    const previousHandoverForm = useMemo(
        () =>
            buildPreviousHandoverComparisonForm(historyEntry, vehicle, {
                assetHistory,
                currentEntry: historyEntry,
                asset: vehicle,
            }),
        [assetHistory, historyEntry, historyEntryId, vehicle],
    );

    const comparisonByKey = useMemo(() => {
        const rows = buildAssessmentFormComparisonRows(form, displayEntry, assetHistory, {
            initialForm: previousHandoverForm,
        });
        const acceptedWithoutFine = isHandoverApprovedWithoutFine(displayEntry);
        const map = {};
        rows.forEach((row) => {
            const hasBaseline = Boolean(row.hasBaseline);
            const rawChanged = Boolean(row.changed && hasBaseline);
            map[row.key] = {
                changed: resolveHandoverComparisonChanged(rawChanged, displayEntry),
                hasBaseline,
                usesPreviousHandover: Boolean(row.usesPreviousHandover),
                acceptedWithoutFine,
                photoChanged: row.photoChanged,
                presentChanged: row.presentChanged,
            };
        });
        return map;
    }, [
        assetHistory,
        displayEntry,
        form,
        previousHandoverForm,
        displayEntry?.details?.handoverLifecycleStatus,
        displayEntry?.details?.handoverApprovedWithFine,
    ]);

    const galleryItems = useMemo(
        () =>
            RECEIVER_ASSESSMENT_ITEMS.map((item) => ({
                key: item.key,
                label: item.label,
                url: resolveAssessmentMediaUrl(form[item.key]?.photo),
            })).filter((item) => item.url),
        [form],
    );

    const persistAssessmentForm = useCallback(
        async (formToSave, { complete = false } = {}) => {
            if (readOnly || isReceiverAssessmentMarkedDone(displayEntry)) return null;

            if (complete) {
                const errors = validateAssessmentForm(formToSave);
                if (Object.keys(errors).length > 0) {
                    toast({
                        variant: 'destructive',
                        title: 'Complete all items',
                        description: 'Select Yes or No for every accessory and add required photos.',
                    });
                    return null;
                }
            } else if (!hasAssessmentDraftSelections(formToSave)) {
                toast({
                    variant: 'destructive',
                    title: 'Nothing to save',
                    description: 'Select Yes or No for at least one accessory before saving a draft.',
                });
                return null;
            }

            const payload = buildAssessmentPayload(formToSave);
            let persistHistoryId = historyEntry?._id;
            if (String(persistHistoryId || '').startsWith('live-')) {
                const resolved = resolveHandoverDeleteHistoryId(historyEntry, vehicle, assetHistory);
                if (resolved) persistHistoryId = resolved;
            }
            const isLiveEntry = !persistHistoryId || String(persistHistoryId).startsWith('live-');

            if (isLiveEntry) {
                const withAssessment = mergeReceiverAssessmentIntoEntry(displayEntry, payload);
                const merged = complete
                    ? mergeAssessmentCompletedIntoEntry(withAssessment)
                    : withAssessment;
                if (complete) {
                    const changeEntry = buildAccessoriesListAssignmentChangeEntry(
                        formToSave,
                        assetHistory,
                        historyEntry,
                        vehicle,
                    );
                    const nextEntries = mergeAccessoriesListAssignmentChangeEntry(vehicle, changeEntry);
                    if (nextEntries && vehicle?._id) {
                        const { data: updatedVehicle } = await axiosInstance.put(
                            `/AssetType/${vehicle._id}`,
                            { vehicleAccessoriesListEntries: nextEntries },
                            ASSESSMENT_MUTATION_CONFIG,
                        );
                        onVehicleUpdated?.(updatedVehicle);
                    }
                }
                setLocalEntry(merged);
                onSaved?.(merged, { partial: !complete });
                if (complete) onDone?.(merged);
                return merged;
            }

            await axiosInstance.put(
                `/AssetItem/history-record/${persistHistoryId}/receiver-assessment`,
                {
                    receiverAssessment: payload,
                    partial: !complete,
                    ...(complete ? { assessmentCompleted: true } : {}),
                },
                ASSESSMENT_MUTATION_CONFIG,
            );

            const withAssessment = mergeReceiverAssessmentIntoEntry(displayEntry, payload);
            const merged = complete
                ? mergeAssessmentCompletedIntoEntry(withAssessment)
                : withAssessment;
            setLocalEntry(merged);
            onSaved?.(merged, { partial: !complete });
            if (complete) onDone?.(merged);
            return merged;
        },
        [assetHistory, displayEntry, historyEntry, onDone, onSaved, onVehicleUpdated, readOnly, toast, vehicle],
    );

    const handleSaveDraft = async () => {
        if (readOnly || actionBusy) return;
        setSavingDraft(true);
        try {
            const merged = await persistAssessmentForm(form, { complete: false });
            if (!merged) return;
            const nextSaved = cloneAssessmentForm(form);
            setSavedForm(nextSaved);
            toast({
                title: 'Draft saved',
                description: 'Your accessory selections are saved. You can continue editing or process next when ready.',
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Draft save failed',
                description: error.response?.data?.message || 'Could not save draft.',
            });
        } finally {
            setSavingDraft(false);
        }
    };

    const handleProcessNext = async () => {
        if (readOnly || actionBusy || !assessmentComplete) return;
        setCompleting(true);
        try {
            const merged = await persistAssessmentForm(form, { complete: true });
            if (!merged) return;
            const nextSaved = cloneAssessmentForm(form);
            setSavedForm(nextSaved);
            toast({
                title: 'Vehicle accessories saved',
                description:
                    'Body Condition Report is now available. Changed items are listed on the Accessories List tab.',
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not save vehicle accessories',
                description: error.response?.data?.message || 'Please try again.',
            });
        } finally {
            setCompleting(false);
        }
    };

    const handleCancel = () => {
        if (readOnly || actionBusy || !formDirty) return;
        setForm(cloneAssessmentForm(savedForm));
        toast({
            title: 'Changes discarded',
            description: 'Accessory selections were restored to the last saved state.',
        });
    };

    const handlePresentChange = (key, present) => {
        if (readOnly) return;
        setForm((prev) => ({
            ...prev,
            [key]: applyAssessmentPresentToggle(
                prev[key],
                present,
                savedForm[key]?.photo ?? baselineForm[key]?.photo ?? null,
            ),
        }));
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
        try {
            const dataUrl = await readFileAsDataUrl(file);
            setForm((prev) => ({
                ...prev,
                [key]: { present: true, photo: dataUrl },
            }));
        } catch {
            toast({
                variant: 'destructive',
                title: 'Upload failed',
                description: 'Could not read the selected image.',
            });
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

    return (
        <>
            <div className="w-full">
                <div className="mb-3 flex items-center gap-2.5 border-b border-gray-100 pb-3">
                    <div className="rounded-xl bg-slate-50 p-2 text-slate-700">
                        <ClipboardCheck size={20} />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-sm font-bold text-gray-800">Vehicle Accessories</h4>
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

                {!readOnly && formDirty ? (
                    <p className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                        You have unsaved changes. Use Save Draft to keep them, Process Next when all items are complete, or Cancel to restore the last saved accessories.
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

                        const showFineHint = visualStatus === 'changed' && !existingFine;
                        const showMatchesPrevious =
                            visualStatus === 'unchanged' && Boolean(comparison?.usesPreviousHandover);

                        return (
                            <AssessmentItemCard
                                key={item.key}
                                label={item.label}
                                present={row.present}
                                photo={row.photo}
                                saving={actionBusy}
                                uploading={uploadingKey === item.key}
                                readOnly={readOnly}
                                visualStatus={visualStatus}
                                hasFine={Boolean(existingFine)}
                                showFineAction={showFineAction}
                                showFineHint={showFineHint}
                                showMatchesPrevious={showMatchesPrevious}
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
                    {!readOnly ? (
                        <div className="flex flex-col items-stretch justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-3">
                            <button
                                type="button"
                                onClick={handleProcessNext}
                                disabled={actionBusy || !assessmentComplete}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {completing ? (
                                    <Loader2 size={15} className="animate-spin" />
                                ) : (
                                    <Check size={15} />
                                )}
                                Process Next
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveDraft}
                                disabled={actionBusy || !hasDraftSelections || !canSaveDraft}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {savingDraft ? (
                                    <Loader2 size={15} className="animate-spin" />
                                ) : (
                                    <Save size={15} />
                                )}
                                Save Draft
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                disabled={actionBusy || !formDirty}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <RotateCcw size={15} />
                                Cancel
                            </button>
                        </div>
                    ) : assessmentCompleted ? (
                        <div className="flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
                            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-700">
                                <Check size={15} />
                                Vehicle accessories complete
                            </span>
                        </div>
                    ) : null}
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
