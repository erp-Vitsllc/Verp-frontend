'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Car, Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import {
    BODY_CONDITION_PHOTO_SOURCE,
    BODY_CONDITION_VIEW_FIELDS,
    buildBodyConditionEditableFormState,
    buildBodyConditionPayload,
    buildBodyConditionPreviousFormState,
    getBodyConditionRowChunks,
    isBodyConditionFormComplete,
    isBodyConditionMarkedDone,
    mergeBodyConditionCompletedIntoEntry,
    mergeBodyConditionIntoEntry,
    mergeBodyConditionRowIntoEntry,
    normalizeBodyConditionFormRow,
    validateBodyConditionForm,
} from '../utils/vehicleHandoverBodyCondition';
import {
    buildBodyConditionComparisonRows,
} from '../utils/vehicleHandoverPhotoComparison';
import {
    buildAssessmentFormState,
    HANDOVER_BODY_CONDITION_GRID_CLASS,
    hasAssessmentPhoto,
    isAssessmentFormComplete,
    isReceiverAssessmentMarkedDone,
    resolveAssessmentMediaUrl,
} from '../utils/vehicleHandoverReceiverAssessment';
import VehicleHandoverAssessmentPhotoViewer from './VehicleHandoverAssessmentPhotoViewer';
import VehicleHandoverPhotoCompareViewer from './VehicleHandoverPhotoCompareViewer';
import VehicleHandoverBodyConditionPhotoCell, {
    BodyConditionPhotoPickerOverlay,
} from './VehicleHandoverBodyConditionPhotoCell';
import {
    handoverItemVisualClasses,
    isHandoverApprovedWithoutFine,
    resolveHandoverComparisonChanged,
    resolveHandoverItemFine,
    resolveHandoverItemVisualStatus,
} from '../utils/vehicleHandoverItemFineUtils';
import VehicleHandoverItemFineButton from './VehicleHandoverItemFineButton';

const BODY_MUTATION_CONFIG = { skipActionDedupe: true };

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function useImagePreload(url) {
    const [state, setState] = useState({ loading: false, ready: false, failed: false });

    useEffect(() => {
        if (!url) {
            setState({ loading: false, ready: false, failed: false });
            return undefined;
        }

        let cancelled = false;
        setState({ loading: true, ready: false, failed: false });
        const img = new Image();
        img.onload = () => {
            if (!cancelled) setState({ loading: false, ready: true, failed: false });
        };
        img.onerror = () => {
            if (!cancelled) setState({ loading: false, ready: false, failed: true });
        };
        img.src = url;

        return () => {
            cancelled = true;
        };
    }, [url]);

    return state;
}

function resolveBodyConditionCardVisualStatus({
    photoSource,
    comparison,
    hasFine,
    acceptedWithoutFine,
    hasPhoto,
}) {
    if (hasFine) return 'fined';
    if (!hasPhoto) return 'neutral';
    if (photoSource === BODY_CONDITION_PHOTO_SOURCE.PREVIOUS) return 'unchanged';
    if (photoSource === BODY_CONDITION_PHOTO_SOURCE.NEW) {
        if (acceptedWithoutFine && comparison?.hasPreviousBaseline) return 'unchanged';
        if (comparison?.hasPreviousBaseline) return 'changed';
        return 'neutral';
    }
    return resolveHandoverItemVisualStatus({
        changed: comparison?.changed,
        hasFine,
        hasBaseline: comparison?.hasPreviousBaseline,
        acceptedWithoutFine,
    });
}

function ViewCellEditor({
    view,
    row,
    previousRow,
    comparison,
    saving,
    uploading,
    readOnly,
    visualStatus = 'neutral',
    hasFine = false,
    showFineAction = false,
    onAddFine,
    onCommentBlur,
    onChoosePreviousPhoto,
    onChooseNewPhoto,
    onPhotoPreview,
    onCompare,
}) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const photoUrl = resolveAssessmentMediaUrl(row?.photo);
    const previousPhotoUrl = resolveAssessmentMediaUrl(previousRow?.photo);
    const hasStoredPreviousPhoto = hasAssessmentPhoto(previousRow?.photo);
    const {
        loading: previousPhotoLoading,
        failed: previousPhotoFailed,
    } = useImagePreload(hasStoredPreviousPhoto ? previousPhotoUrl : null);
    const photoMissing = !photoUrl;
    const commentRequired =
        row?.photoSource === BODY_CONDITION_PHOTO_SOURCE.PREVIOUS
            ? false
            : row?.photoSource === BODY_CONDITION_PHOTO_SOURCE.NEW && Boolean(photoUrl);
    const commentMissing = commentRequired && !String(row?.comment || '').trim();
    const visuals = handoverItemVisualClasses(visualStatus);

    return (
        <div className={`relative flex min-w-0 flex-col rounded-xl p-2.5 ${visuals.card}`}>
            <div className={pickerOpen ? 'pointer-events-none blur-[2px]' : ''}>
                <div className="flex shrink-0 items-start justify-between gap-2">
                    <h5 className="truncate text-xs font-bold leading-tight text-gray-900" title={view.label}>
                        {view.label}
                    </h5>
                    {visuals.badgeLabel ? (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase ${visuals.badge}`}>
                            {visuals.badgeLabel}
                        </span>
                    ) : null}
                </div>

                <p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-gray-400">
                    Comment{' '}
                    {commentRequired ? (
                        <span className="text-red-500">*</span>
                    ) : (
                        <span className="font-normal normal-case">(optional)</span>
                    )}
                </p>
                {readOnly ? (
                    <p className="mt-1 min-h-[32px] rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5 text-[11px] leading-snug text-gray-600">
                        {row?.comment || '—'}
                    </p>
                ) : (
                    <textarea
                        defaultValue={row?.comment || ''}
                        key={`${view.key}-comment-${row?.comment || ''}`}
                        onBlur={(event) => onCommentBlur(view.key, event.target.value)}
                        disabled={saving || uploading || pickerOpen}
                        rows={1}
                        placeholder={commentRequired ? 'Comment required for new image…' : 'Add comment...'}
                        className={`mt-1 min-h-[32px] w-full resize-none rounded-lg border bg-white px-2 py-1.5 text-[11px] text-gray-700 outline-none focus:ring-1 ${
                            commentMissing
                                ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
                                : 'border-gray-200 focus:border-violet-400 focus:ring-violet-200'
                        }`}
                    />
                )}
                {commentMissing && !readOnly ? (
                    <p className="mt-0.5 text-[9px] font-medium text-red-600">Comment required for new image</p>
                ) : null}

                <p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-gray-400">
                    Photo <span className="text-red-500">*</span>
                </p>
                <div className={`mt-1 shrink-0 rounded-lg ${visuals.frame}`}>
                    <VehicleHandoverBodyConditionPhotoCell
                        label={view.label}
                        photoUrl={photoUrl}
                        missing={photoMissing && !readOnly}
                        uploading={uploading}
                        readOnly={readOnly}
                        onPreview={photoUrl ? onPhotoPreview : undefined}
                        onOpenPicker={() => !readOnly && !uploading && setPickerOpen(true)}
                    />
                </div>

                {comparison?.canCompare ? (
                    <button
                        type="button"
                        onClick={onCompare}
                        className="mt-2 w-full rounded-lg border border-red-300 bg-white px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-red-700 transition-colors hover:bg-red-50"
                    >
                        Compare to Previous
                    </button>
                ) : null}

                {showFineAction ? (
                    <VehicleHandoverItemFineButton hasFine={hasFine} onClick={onAddFine} />
                ) : null}

                <p className="mt-1 min-h-[24px] text-[9px] font-medium leading-snug">
                    {photoMissing && !readOnly ? (
                        <span className="text-amber-600">Photo required</span>
                    ) : row?.photoSource === BODY_CONDITION_PHOTO_SOURCE.PREVIOUS && photoUrl ? (
                        <span className="text-emerald-700">Matches previous handover.</span>
                    ) : row?.photoSource === BODY_CONDITION_PHOTO_SOURCE.NEW &&
                      comparison?.hasPreviousBaseline &&
                      photoUrl &&
                      !hasFine &&
                      !readOnly ? (
                        <span className="text-red-600">
                            This change may result in a fine for you.
                        </span>
                    ) : null}
                </p>
            </div>

            {pickerOpen ? (
                <BodyConditionPhotoPickerOverlay
                    hasPreviousPhoto={hasStoredPreviousPhoto && !previousPhotoLoading}
                    showNewImageFineHint={hasStoredPreviousPhoto}
                    previousPhotoLoading={hasStoredPreviousPhoto && previousPhotoLoading}
                    previousPhotoUnavailable={hasStoredPreviousPhoto && previousPhotoFailed && !previousPhotoLoading}
                    onChoosePrevious={() => {
                        setPickerOpen(false);
                        onChoosePreviousPhoto?.();
                    }}
                    onChooseNew={(file) => {
                        setPickerOpen(false);
                        onChooseNewPhoto?.(file);
                    }}
                    onCancel={() => setPickerOpen(false)}
                />
            ) : null}
        </div>
    );
}

export default function VehicleHandoverBodyConditionCard({
    historyEntry,
    vehicle = null,
    assetHistory = [],
    onSaved,
    readOnly = false,
    onGoToApproval,
    onGoToAssessment,
    inspectionHandover = false,
    onVehicleUpdated,
    handoverItemFines = {},
    canManageItemFines = false,
    isHrApprovalStage = false,
    onOpenItemFine,
}) {
    const { toast } = useToast();
    const [localEntry, setLocalEntry] = useState(null);
    const formOptions = useMemo(
        () => ({ assetHistory, currentEntry: historyEntry }),
        [assetHistory, historyEntry],
    );
    const [form, setForm] = useState(() =>
        buildBodyConditionEditableFormState(historyEntry, formOptions),
    );
    const [savingKey, setSavingKey] = useState(null);
    const [uploadingKey, setUploadingKey] = useState(null);
    const [completing, setCompleting] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerStartIndex, setViewerStartIndex] = useState(0);
    const [compareView, setCompareView] = useState(null);
    const photoUploadInFlightRef = useRef(new Set());
    const skipFormResetRef = useRef(false);

    const historyEntryId = historyEntry?._id;
    const displayEntry = localEntry || historyEntry;
    const sectionLocked = isBodyConditionMarkedDone(displayEntry);
    const inspectionStatus = String(vehicle?.vehicleInspectionStatus || '').toLowerCase();
    const inspectionSubmitted = inspectionHandover && inspectionStatus === 'pending_hr';
    const isEditingDisabled = readOnly || sectionLocked;
    const previousBaseline = useMemo(
        () => buildBodyConditionPreviousFormState(historyEntry, formOptions),
        [formOptions, historyEntry, historyEntryId],
    );
    const formComplete = useMemo(() => isBodyConditionFormComplete(form), [form]);

    const bodyConditionRows = useMemo(() => getBodyConditionRowChunks(), []);

    const comparisonByKey = useMemo(() => {
        const baseRows = buildBodyConditionComparisonRows(historyEntry, assetHistory);
        const acceptedWithoutFine = isHandoverApprovedWithoutFine(historyEntry);
        const map = {};
        baseRows.forEach((row) => {
            const formRow = form[row.key] || {};
            const hasPreviousBaseline =
                hasAssessmentPhoto(row.previous.photo) || Boolean(row.previous.photoUrl);
            const photoSource = formRow.photoSource ?? null;
            const hasCurrentPhoto = hasAssessmentPhoto(formRow.photo);
            const changed =
                hasCurrentPhoto &&
                photoSource === BODY_CONDITION_PHOTO_SOURCE.NEW &&
                hasPreviousBaseline;

            map[row.key] = {
                hasPreviousBaseline,
                status: !hasPreviousBaseline
                    ? 'neutral'
                    : !hasCurrentPhoto
                      ? 'neutral'
                      : photoSource === BODY_CONDITION_PHOTO_SOURCE.PREVIOUS
                        ? 'unchanged'
                        : photoSource === BODY_CONDITION_PHOTO_SOURCE.NEW
                          ? 'changed'
                          : 'neutral',
                changed: resolveHandoverComparisonChanged(changed, historyEntry),
                acceptedWithoutFine,
                canCompare:
                    hasPreviousBaseline &&
                    hasCurrentPhoto &&
                    photoSource === BODY_CONDITION_PHOTO_SOURCE.NEW &&
                    !acceptedWithoutFine,
                showCompare: Boolean(row.previous.photoUrl),
                previousPhotoUrl: row.previous.photoUrl,
                currentPhotoUrl: resolveAssessmentMediaUrl(formRow.photo),
                previousComment: row.previous.comment,
                currentComment: String(formRow.comment || '').trim(),
            };
        });
        return map;
    }, [assetHistory, form, historyEntry, historyEntry?.details?.handoverLifecycleStatus, historyEntry?.details?.handoverApprovedWithFine]);

    useEffect(() => {
        if (skipFormResetRef.current) {
            skipFormResetRef.current = false;
            return;
        }
        setLocalEntry(null);
        setForm(buildBodyConditionEditableFormState(historyEntry, formOptions));
    }, [
        formOptions,
        historyEntryId,
        historyEntry?.details?.bodyConditionReport,
        historyEntry?.details?.bodyCondition,
        historyEntry?.details?.bodyConditionCompleted,
    ]);

    const galleryItems = useMemo(
        () =>
            BODY_CONDITION_VIEW_FIELDS.map((field) => {
                const url = resolveAssessmentMediaUrl(form[field.key]?.photo);
                const comparison = comparisonByKey[field.key];
                return {
                    key: field.key,
                    label: field.label,
                    url,
                    compare: comparison?.showCompare
                        ? {
                              viewLabel: field.label,
                              previousPhotoUrl: comparison.previousPhotoUrl,
                              currentPhotoUrl: comparison.currentPhotoUrl,
                              previousComment: comparison.previousComment,
                              currentComment: comparison.currentComment,
                              changed: comparison.changed,
                          }
                        : null,
                };
            }).filter((item) => item.url),
        [form, comparisonByKey],
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
                    photoSource:
                        row?.photoSource === BODY_CONDITION_PHOTO_SOURCE.PREVIOUS ||
                        row?.photoSource === BODY_CONDITION_PHOTO_SOURCE.NEW
                            ? row.photoSource
                            : null,
                    ...(row?.userSelected === true ||
                    String(row?.comment || '').trim() ||
                    row?.photoSource === BODY_CONDITION_PHOTO_SOURCE.PREVIOUS ||
                    row?.photoSource === BODY_CONDITION_PHOTO_SOURCE.NEW
                        ? { userSelected: true }
                        : {}),
                },
            };

            if (isLiveEntry || !historyId) {
                const merged = mergeBodyConditionRowIntoEntry(displayEntry, key, row);
                setLocalEntry(merged);
                skipFormResetRef.current = true;
                onSaved?.(merged, { partial: true });
                return merged;
            }

            setSavingKey(key);
            try {
                const { data: savedRecord } = await axiosInstance.put(
                    `/AssetItem/history-record/${historyId}/body-condition`,
                    { bodyConditionReport: payload, partial: true },
                    BODY_MUTATION_CONFIG,
                );
                const merged = mergeBodyConditionRowIntoEntry(
                    savedRecord || displayEntry,
                    key,
                    row,
                );
                setLocalEntry(merged);
                skipFormResetRef.current = true;
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

        const nextRow = normalizeBodyConditionFormRow({
            ...previousRow,
            comment: trimmed,
            userSelected: true,
        });
        setForm((prev) => ({ ...prev, [key]: nextRow }));
        try {
            await persistRow(key, nextRow);
        } catch {
            setForm((prev) => ({ ...prev, [key]: previousRow }));
        }
    };

    const handleChoosePreviousPhoto = async (key) => {
        if (isEditingDisabled) return;

        const baseline = previousBaseline[key] || { comment: '', photo: null };
        if (!hasAssessmentPhoto(baseline.photo)) {
            toast({
                variant: 'destructive',
                title: 'No previous image',
                description: 'There is no saved photo from the previous assignment for this view.',
            });
            return;
        }

        const baselineUrl = resolveAssessmentMediaUrl(baseline.photo);
        if (!baselineUrl) {
            toast({
                variant: 'destructive',
                title: 'Previous image unavailable',
                description: 'Could not load the photo from the previous assignment. Use New image instead.',
            });
            return;
        }

        const previousRow = form[key] || { comment: '', photo: null, photoSource: null };
        const nextRow = normalizeBodyConditionFormRow({
            comment: previousRow.comment || baseline.comment || '',
            photo: baseline.photo,
            photoSource: BODY_CONDITION_PHOTO_SOURCE.PREVIOUS,
            userSelected: true,
        });

        setForm((prev) => ({ ...prev, [key]: nextRow }));
        try {
            await persistRow(key, nextRow);
        } catch {
            setForm((prev) => ({ ...prev, [key]: previousRow }));
        }
    };

    const handleChooseNewPhoto = async (key, file) => {
        if (isEditingDisabled || photoUploadInFlightRef.current.has(key)) return;

        if (!file.type.startsWith('image/')) {
            toast({
                variant: 'destructive',
                title: 'Invalid file',
                description: 'Please choose an image from your gallery or device.',
            });
            return;
        }

        photoUploadInFlightRef.current.add(key);
        setUploadingKey(key);
        const previousRow = form[key] || { comment: '', photo: null, photoSource: null };
        try {
            const dataUrl = await readFileAsDataUrl(file);
            const nextRow = normalizeBodyConditionFormRow({
                ...previousRow,
                photo: dataUrl,
                photoSource: BODY_CONDITION_PHOTO_SOURCE.NEW,
                userSelected: true,
            });
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

    const openCompareViewer = (viewKey) => {
        const comparison = comparisonByKey[viewKey];
        if (!comparison?.canCompare) return;
        const view = BODY_CONDITION_VIEW_FIELDS.find((field) => field.key === viewKey);
        setCompareView({
            viewLabel: view?.label || viewKey,
            previousPhotoUrl: comparison.previousPhotoUrl,
            currentPhotoUrl: comparison.currentPhotoUrl,
            previousComment: comparison.previousComment,
            currentComment: comparison.currentComment,
        });
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
            const assessmentForm = buildAssessmentFormState(displayEntry, vehicle, { assetHistory });
            if (!isAssessmentFormComplete(assessmentForm)) {
                toast({
                    variant: 'destructive',
                    title: 'Vehicle Accessories required',
                    description:
                        'Complete all Yes/No items and required photos in Vehicle Accessories first.',
                });
                onGoToAssessment?.();
                return;
            }
        }

        const serverForm = buildBodyConditionEditableFormState(displayEntry, formOptions);
        const mergedForSubmit = { ...serverForm };
        BODY_CONDITION_VIEW_FIELDS.forEach((field) => {
            const localRow = form[field.key];
            if (!localRow) return;
            mergedForSubmit[field.key] = normalizeBodyConditionFormRow({
                comment: localRow.comment ?? serverForm[field.key]?.comment ?? '',
                photo: hasAssessmentPhoto(localRow.photo)
                    ? localRow.photo
                    : serverForm[field.key]?.photo ?? null,
                photoSource: localRow.photoSource ?? serverForm[field.key]?.photoSource ?? null,
            });
        });
        const submitErrors = validateBodyConditionForm(mergedForSubmit);
        if (Object.keys(submitErrors).length > 0) {
            const needsComment = Object.values(submitErrors).some((msg) =>
                String(msg).toLowerCase().includes('comment'),
            );
            toast({
                variant: 'destructive',
                title: needsComment ? 'Comments required' : 'Body condition incomplete',
                description: needsComment
                    ? 'Add a comment for every view where you uploaded a new image.'
                    : 'Upload a photo for every vehicle view before continuing.',
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
                subtitle="Tap Add on each view — choose Previous image (no change) or New image (may be fined)"
                icon={Car}
                iconBg="bg-slate-50"
                iconColor="text-slate-700"
                className="w-full"
            >
                <div className="space-y-2">
                    {bodyConditionRows.map((rowKeys) => (
                        <div key={rowKeys.join('-')} className={HANDOVER_BODY_CONDITION_GRID_CLASS}>
                            {rowKeys.map((viewKey) => {
                                const view = BODY_CONDITION_VIEW_FIELDS.find((field) => field.key === viewKey);
                                if (!view) return null;
                                const comparison = comparisonByKey[view.key];
                                const existingFine = resolveHandoverItemFine(
                                    handoverItemFines,
                                    'body',
                                    view.key,
                                );
                                const formRow = form[view.key] || { comment: '', photo: null, photoSource: null };
                                const visualStatus = resolveBodyConditionCardVisualStatus({
                                    photoSource: formRow.photoSource,
                                    comparison,
                                    hasFine: Boolean(existingFine),
                                    acceptedWithoutFine: comparison?.acceptedWithoutFine,
                                    hasPhoto: hasAssessmentPhoto(formRow.photo),
                                });
                                const showFineAction =
                                    canManageItemFines &&
                                    (visualStatus === 'changed' || visualStatus === 'fined');

                                return (
                                    <ViewCellEditor
                                        key={view.key}
                                        view={view}
                                        row={formRow}
                                        previousRow={previousBaseline[view.key]}
                                        comparison={comparison}
                                        saving={savingKey === view.key}
                                        uploading={uploadingKey === view.key}
                                        readOnly={isEditingDisabled}
                                        visualStatus={visualStatus}
                                        hasFine={Boolean(existingFine)}
                                        showFineAction={showFineAction}
                                        onAddFine={
                                            showFineAction
                                                ? () =>
                                                      onOpenItemFine?.({
                                                          itemType: 'body',
                                                          itemKey: view.key,
                                                          itemLabel: view.label,
                                                          existingFine,
                                                      })
                                                : undefined
                                        }
                                        onCommentBlur={handleCommentBlur}
                                        onChoosePreviousPhoto={() => handleChoosePreviousPhoto(view.key)}
                                        onChooseNewPhoto={(file) => handleChooseNewPhoto(view.key, file)}
                                        onPhotoPreview={() => openPhotoViewer(view.key)}
                                        onCompare={() => openCompareViewer(view.key)}
                                    />
                                );
                            })}
                        </div>
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
                onCompare={(item) => {
                    if (!item?.compare) return;
                    setViewerOpen(false);
                    setCompareView({
                        viewLabel: item.compare.viewLabel,
                        previousPhotoUrl: item.compare.previousPhotoUrl,
                        currentPhotoUrl: item.compare.currentPhotoUrl,
                        previousComment: item.compare.previousComment,
                        currentComment: item.compare.currentComment,
                    });
                }}
            />

            <VehicleHandoverPhotoCompareViewer
                open={Boolean(compareView)}
                viewLabel={compareView?.viewLabel}
                previousPhotoUrl={compareView?.previousPhotoUrl}
                currentPhotoUrl={compareView?.currentPhotoUrl}
                previousComment={compareView?.previousComment}
                currentComment={compareView?.currentComment}
                onClose={() => setCompareView(null)}
            />
        </>
    );
}
