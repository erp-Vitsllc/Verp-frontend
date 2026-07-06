'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Car, Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import {
    BODY_CONDITION_VIEW_FIELDS,
    buildBodyConditionFormState,
    buildBodyConditionPayload,
    getBodyConditionRowChunks,
    isBodyConditionFormComplete,
    isBodyConditionMarkedDone,
    mergeBodyConditionCompletedIntoEntry,
    mergeBodyConditionIntoEntry,
    mergeBodyConditionRowIntoEntry,
    validateBodyConditionForm,
} from '../utils/vehicleHandoverBodyCondition';
import { hasCurrentBodyConditionData } from '../utils/vehicleHandoverPreviousReports';
import {
    buildBodyConditionComparisonRows,
    photosDiffer,
} from '../utils/vehicleHandoverPhotoComparison';
import {
    buildAssessmentFormState,
    HANDOVER_BODY_CONDITION_GRID_CLASS,
    HANDOVER_BODY_CONDITION_PHOTO_BOX_CLASS,
    hasAssessmentPhoto,
    isAssessmentFormComplete,
    isReceiverAssessmentMarkedDone,
    resolveAssessmentMediaUrl,
} from '../utils/vehicleHandoverReceiverAssessment';
import VehicleHandoverAssessmentPhotoViewer from './VehicleHandoverAssessmentPhotoViewer';
import VehicleHandoverPhotoCompareViewer from './VehicleHandoverPhotoCompareViewer';
import VehicleHandoverLandscapePhotoBox from './VehicleHandoverLandscapePhotoBox';
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

function ViewCellEditor({
    view,
    row,
    comparison,
    saving,
    uploading,
    readOnly,
    visualStatus = 'neutral',
    hasFine = false,
    showFineAction = false,
    onAddFine,
    onCommentBlur,
    onPhotoUpload,
    onPhotoPreview,
    onCompare,
}) {
    const photoUrl = resolveAssessmentMediaUrl(row?.photo);
    const photoMissing = !photoUrl;
    const visuals = handoverItemVisualClasses(visualStatus);

    return (
        <div className={`flex min-w-0 flex-col rounded-xl p-2.5 ${visuals.card}`}>
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
                Comment <span className="font-normal normal-case">(optional)</span>
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
                    disabled={saving || uploading}
                    rows={1}
                    placeholder="Add comment..."
                    className="mt-1 min-h-[32px] w-full resize-none rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-700 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
                />
            )}

            <p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-gray-400">
                Photo <span className="text-red-500">*</span>
            </p>
            <div className={`mt-1 shrink-0 rounded-lg ${visuals.frame}`}>
                <VehicleHandoverLandscapePhotoBox
                    label={view.label}
                    photoUrl={photoUrl}
                    missing={photoMissing && !readOnly}
                    uploading={uploading}
                    readOnly={readOnly}
                    onUpload={onPhotoUpload}
                    onPreview={photoUrl ? onPhotoPreview : undefined}
                    inputIdPrefix="body-upload"
                    uploadLabel="Upload"
                    boxClassName={HANDOVER_BODY_CONDITION_PHOTO_BOX_CLASS}
                />
            </div>

            {comparison?.status === 'changed' && comparison?.canCompare ? (
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

            <p className="mt-1 min-h-[12px] text-[9px] font-medium text-amber-600">
                {photoMissing && !readOnly ? 'Photo required' : ''}
            </p>
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
    onOpenItemFine,
}) {
    const { toast } = useToast();
    const [localEntry, setLocalEntry] = useState(null);
    const [form, setForm] = useState(() =>
        buildBodyConditionFormState(historyEntry, { assetHistory, currentEntry: historyEntry }),
    );
    const [savingKey, setSavingKey] = useState(null);
    const [uploadingKey, setUploadingKey] = useState(null);
    const [completing, setCompleting] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerStartIndex, setViewerStartIndex] = useState(0);
    const [compareView, setCompareView] = useState(null);
    const photoUploadInFlightRef = useRef(new Set());
    const prefillPersistedRef = useRef(false);

    const historyEntryId = historyEntry?._id;
    const displayEntry = localEntry || historyEntry;
    const sectionLocked = isBodyConditionMarkedDone(displayEntry);
    const inspectionStatus = String(vehicle?.vehicleInspectionStatus || '').toLowerCase();
    const inspectionSubmitted = inspectionHandover && inspectionStatus === 'pending_hr';
    const isEditingDisabled = readOnly || sectionLocked;
    const formComplete = useMemo(() => {
        if (isBodyConditionFormComplete(form)) return true;
        return isBodyConditionFormComplete(
            buildBodyConditionFormState(displayEntry, { assetHistory, currentEntry: historyEntry }),
        );
    }, [form, displayEntry, assetHistory]);

    const bodyConditionRows = useMemo(() => getBodyConditionRowChunks(), []);

    const comparisonByKey = useMemo(() => {
        const baseRows = buildBodyConditionComparisonRows(historyEntry, assetHistory);
        const acceptedWithoutFine = isHandoverApprovedWithoutFine(historyEntry);
        const map = {};
        baseRows.forEach((row) => {
            const formRow = form[row.key] || {};
            const currentPhoto = formRow.photo ?? row.current.photo;
            const currentComment = String(formRow.comment ?? row.current.comment ?? '').trim();
            const photoChanged = photosDiffer(row.previous.photo, currentPhoto);
            const commentChanged = String(row.previous.comment || '').trim() !== currentComment;
            const hasPreviousBaseline =
                Boolean(row.previous.photoUrl) || Boolean(String(row.previous.comment || '').trim());
            const rawChanged = hasPreviousBaseline && (photoChanged || commentChanged);
            const changed = resolveHandoverComparisonChanged(rawChanged, historyEntry);

            map[row.key] = {
                status: !hasPreviousBaseline ? 'neutral' : changed ? 'changed' : 'unchanged',
                changed,
                acceptedWithoutFine,
                canCompare: hasPreviousBaseline && rawChanged && !acceptedWithoutFine,
                showCompare: Boolean(row.previous.photoUrl),
                previousPhotoUrl: row.previous.photoUrl,
                currentPhotoUrl: resolveAssessmentMediaUrl(currentPhoto),
                previousComment: row.previous.comment,
                currentComment,
            };
        });
        return map;
    }, [assetHistory, form, historyEntry, historyEntry?.details?.handoverLifecycleStatus, historyEntry?.details?.handoverApprovedWithFine]);

    useEffect(() => {
        setLocalEntry(null);
        prefillPersistedRef.current = false;
        setForm(
            buildBodyConditionFormState(historyEntry, { assetHistory, currentEntry: historyEntry }),
        );
    }, [
        historyEntryId,
        assetHistory,
        historyEntry?.details?.bodyConditionReport,
        historyEntry?.details?.bodyCondition,
    ]);

    useEffect(() => {
        if (!historyEntry || !assetHistory?.length) return;

        setForm((prev) => {
            const hasAnyPhoto = BODY_CONDITION_VIEW_FIELDS.some((field) =>
                hasAssessmentPhoto(prev[field.key]?.photo),
            );
            if (hasAnyPhoto) return prev;
            if (hasCurrentBodyConditionData(historyEntry)) return prev;

            return buildBodyConditionFormState(historyEntry, { assetHistory, currentEntry: historyEntry });
        });
    }, [historyEntry, assetHistory]);

    useEffect(() => {
        if (prefillPersistedRef.current || !historyEntry?._id) return;
        if (String(historyEntry._id).startsWith('live-')) return;
        if (hasCurrentBodyConditionData(historyEntry)) return;
        if (!assetHistory?.length) return;

        const prefillForm = buildBodyConditionFormState(historyEntry, {
            assetHistory,
            currentEntry: historyEntry,
        });
        const hasPrefill = BODY_CONDITION_VIEW_FIELDS.some((field) =>
            hasAssessmentPhoto(prefillForm[field.key]?.photo),
        );
        if (!hasPrefill) return;

        prefillPersistedRef.current = true;
        setForm(prefillForm);

        if (isEditingDisabled) return;

        const payload = buildBodyConditionPayload(prefillForm);
        void axiosInstance
            .put(
                `/AssetItem/history-record/${historyEntry._id}/body-condition`,
                { bodyConditionReport: payload, partial: true },
                BODY_MUTATION_CONFIG,
            )
            .then(() => {
                const merged = mergeBodyConditionIntoEntry(historyEntry, payload);
                setLocalEntry(merged);
                onSaved?.(merged, { partial: true, prefilledFromPrevious: true });
            })
            .catch(() => {
                prefillPersistedRef.current = false;
            });
    }, [assetHistory, historyEntry, historyEntryId, isEditingDisabled, onSaved]);

    useEffect(() => {
        if (savingKey || uploadingKey || completing) return;
        const fromServer = buildBodyConditionFormState(historyEntry, {
            assetHistory,
            currentEntry: historyEntry,
        });
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
    }, [assetHistory, historyEntry?.details?.bodyConditionReport, historyEntry?.details?.bodyConditionCompleted, savingKey, uploadingKey, completing]);

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

    const openCompareViewer = (viewKey) => {
        const comparison = comparisonByKey[viewKey];
        if (!comparison?.showCompare) return;
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
                    title: 'Vehicle Assessment required',
                    description:
                        'Complete all Yes/No items and required photos in Vehicle Assessment Report first.',
                });
                onGoToAssessment?.();
                return;
            }
        }

        const serverForm = buildBodyConditionFormState(displayEntry, {
            assetHistory,
            currentEntry: historyEntry,
        });
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
                subtitle="Green = matches previous · Red = changed · Yellow = in fine · click red to compare 50/50"
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
                                const visualStatus = resolveHandoverItemVisualStatus({
                                    changed: comparison?.status === 'changed',
                                    hasFine: Boolean(existingFine),
                                    hasBaseline: comparison?.status !== 'neutral',
                                    acceptedWithoutFine: comparison?.acceptedWithoutFine,
                                });
                                const showFineAction =
                                    canManageItemFines &&
                                    (visualStatus === 'changed' || visualStatus === 'fined');

                                return (
                                    <ViewCellEditor
                                        key={view.key}
                                        view={view}
                                        row={form[view.key]}
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
                                        onPhotoUpload={(file) => handlePhotoUpload(view.key, file)}
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
