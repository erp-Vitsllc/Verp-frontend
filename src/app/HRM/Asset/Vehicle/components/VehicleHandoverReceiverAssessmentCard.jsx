'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ClipboardCheck, History, Loader2, RotateCcw, Save, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    RECEIVER_ASSESSMENT_ITEMS,
    applyAssessmentPresentToggle,
    assessmentFormChanged,
    accessoryAssessmentItemChanged,
    accessoryListItemHasImage,
    buildAccessoriesListAssignmentChangeEntry,
    buildAccessoriesComparisonBaselineForm,
    buildAssessmentFormState,
    buildAssessmentPayload,
    buildAccessoriesLiveListForm,
    buildAccessoryHandoverCardSourceForm,
    buildHandoverReceiverAccessoryComparisonBaseline,
    buildPreviousHandoverAccessoryForm,
    buildReceiverAssessmentRemoteSyncKey,
    cloneAssessmentForm,
    HANDOVER_ASSESSMENT_GRID_CLASS,
    hasAssessmentPhoto,
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
import AssessmentMediaImage from './AssessmentMediaImage';
import { buildAssessmentFormComparisonRows } from '../utils/vehicleHandoverPhotoComparison';
import {
    handoverItemVisualClasses,
    indexHandoverItemFineWaivers,
    isHandoverApprovedWithoutFine,
    isHandoverItemFineWaived,
    resolveHandoverComparisonChanged,
    resolveHandoverItemFineForCard,
    resolveHandoverItemVisualStatus,
    shouldShowHandoverItemFineActions,
} from '../utils/vehicleHandoverItemFineUtils';
import VehicleHandoverItemFineButton from './VehicleHandoverItemFineButton';
import VehicleHandoverYesNoToggle from './VehicleHandoverYesNoToggle';
import { uploadHandoverAssessmentPhoto } from '../utils/vehicleHandoverImageUtils';

const ASSESSMENT_MUTATION_CONFIG = { skipActionDedupe: true };

function accessoryYesNoLabel(value) {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return '—';
}

function PreviousAccessoriesModal({ open, items = [], onClose }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    if (!mounted || !open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                            Previous accessories
                        </p>
                        <h3 className="truncate text-lg font-bold text-gray-900">Previous vehicle accessories</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                        aria-label="Close previous accessories"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                    {items.length ? (
                        <div className={HANDOVER_ASSESSMENT_GRID_CLASS}>
                            {items.map((item) => (
                                <div
                                    key={item.key}
                                    className="flex flex-col rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 shadow-sm"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <h5 className="truncate text-sm font-bold text-gray-900">{item.label}</h5>
                                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-800">
                                            {accessoryYesNoLabel(item.present)}
                                        </span>
                                    </div>
                                    <div className="mt-2 h-[100px] min-h-[100px] overflow-hidden rounded-lg border-2 border-emerald-300 bg-white">
                                        {item.photo ? (
                                            <AssessmentMediaImage
                                                photo={item.photo}
                                                alt={`Previous ${item.label}`}
                                                className="h-full w-full object-cover object-center"
                                            />
                                        ) : (
                                            <div className="flex h-full items-center justify-center text-[11px] text-gray-400">
                                                {item.present === false
                                                    ? 'No photo (marked No)'
                                                    : 'No previous photo'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                            No previous accessories were recorded for this vehicle.
                        </p>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}

const AssessmentItemCard = memo(function AssessmentItemCard({
    label,
    present,
    photo,
    listHasImage = false,
    listPhoto = null,
    saving,
    uploading,
    readOnly = false,
    visualStatus = 'neutral',
    hasFine = false,
    isWaived = false,
    showFineAction = false,
    showRemoveFromFine = false,
    onAddFine,
    onRemoveFromFine,
    showFineHint = false,
    showMatchesPrevious = false,
    onPresentChange,
    onPhotoUpload,
    onPhotoPreview,
}) {
    const displayPhoto = photo || listPhoto;
    const photoUrl = resolveAssessmentMediaUrl(displayPhoto);
    const showToggles = listHasImage && !readOnly;
    const showPhoto = listHasImage && present === true;
    const photoMissing = showPhoto && !hasAssessmentPhoto(displayPhoto);
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
                    {showToggles ? (
                        <VehicleHandoverYesNoToggle
                            value={present}
                            onChange={onPresentChange}
                            disabled={readOnly || saving || uploading}
                        />
                    ) : null}
                </div>
            </div>

            <div className="mt-2 min-h-[34px] shrink-0">
                {showPhoto ? (
                    <>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Photo <span className="text-red-500">*</span>
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
                            From live accessories list
                        </p>
                    </>
                ) : null}
            </div>

            <div className={`mt-2 shrink-0 rounded-lg ${visuals.frame}`}>
                {showPhoto ? (
                    <VehicleHandoverLandscapePhotoBox
                        label={label}
                        photo={displayPhoto}
                        photoUrl={photoUrl}
                        missing={photoMissing && !readOnly}
                        uploading={uploading}
                        readOnly={readOnly}
                        onUpload={onPhotoUpload}
                        onPreview={photoUrl || hasAssessmentPhoto(displayPhoto) ? onPhotoPreview : undefined}
                        inputIdPrefix="assessment-upload"
                    />
                ) : (
                    <VehicleHandoverLandscapePhotoPlaceholder>
                        {!listHasImage
                            ? 'No image on accessories list'
                            : present === false
                              ? 'No photo required'
                              : 'Select Yes or No above'}
                    </VehicleHandoverLandscapePhotoPlaceholder>
                )}
            </div>

            <p className="mt-1.5 min-h-[28px] shrink-0 text-[10px] font-medium leading-snug">
                {photoMissing ? (
                    <span className="text-amber-600">Photo required</span>
                ) : showFineHint ? (
                    <span className="text-red-600">This change may result in a fine for you.</span>
                ) : showMatchesPrevious ? (
                    <span className="text-emerald-700">Matches previous accessories.</span>
                ) : null}
            </p>

            {showFineAction ? (
                <VehicleHandoverItemFineButton
                    hasFine={hasFine}
                    isWaived={isWaived}
                    showRemoveFromFine={showRemoveFromFine}
                    onAddFine={onAddFine}
                    onRemoveFromFine={onRemoveFromFine}
                    disabled={saving || uploading}
                />
            ) : null}
        </div>
    );
});

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
    handoverFines = [],
    handoverItemFineWaivers = {},
    canManageItemFines = false,
    isHrApprovalStage = false,
    onOpenItemFine,
    onRemoveItemFine,
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
    const [previousSectionOpen, setPreviousSectionOpen] = useState(false);
    const photoUploadInFlightRef = useRef(new Set());
    const skipRemoteSyncRef = useRef(false);
    const lastAppliedSyncKeyRef = useRef('');

    const historyEntryId = historyEntry?._id;

    const remoteAssessmentSyncKey = useMemo(
        () => buildReceiverAssessmentRemoteSyncKey(historyEntry),
        [
            historyEntryId,
            historyEntry?.details?.receiverAssessment,
            historyEntry?.details?.vehicleAssessmentReportByReceiver,
        ],
    );

    const comparisonBaselineRef = useRef({ key: '', form: null });

    const comparisonBaselineKey = useMemo(() => {
        if (inspectionHandover || !vehicle?._id) return '';
        return String(
            resolveHandoverDeleteHistoryId(historyEntry, vehicle, assetHistory) ||
                historyEntryId ||
                '',
        );
    }, [assetHistory, historyEntry, historyEntryId, inspectionHandover, vehicle?._id]);

    if (!inspectionHandover && comparisonBaselineKey && vehicle?._id) {
        const frozen = comparisonBaselineRef.current;
        if (frozen.key !== comparisonBaselineKey) {
            comparisonBaselineRef.current = {
                key: comparisonBaselineKey,
                form: cloneAssessmentForm(
                    buildHandoverReceiverAccessoryComparisonBaseline(vehicle, historyEntry, {
                        assetHistory,
                    }),
                ),
            };
        }
    }

    const liveAccessoriesListForm = useMemo(() => {
        if (inspectionHandover) {
            return buildAccessoriesComparisonBaselineForm(vehicle, historyEntry, { assetHistory });
        }
        if (!vehicle?._id) {
            return cloneAssessmentForm({});
        }
        return buildAccessoriesLiveListForm(vehicle, historyEntry, { assetHistory });
    }, [assetHistory, historyEntry, inspectionHandover, vehicle]);

    const accessoryComparisonBaselineForm = useMemo(() => {
        if (inspectionHandover) {
            return liveAccessoriesListForm;
        }
        const frozen = comparisonBaselineRef.current;
        if (frozen.key === comparisonBaselineKey && frozen.form) {
            return frozen.form;
        }
        if (!vehicle?._id) {
            return cloneAssessmentForm({});
        }
        return buildHandoverReceiverAccessoryComparisonBaseline(vehicle, historyEntry, { assetHistory });
    }, [
        assetHistory,
        comparisonBaselineKey,
        historyEntry,
        inspectionHandover,
        liveAccessoriesListForm,
        vehicle,
    ]);

    const accessoryCardSourceForm = useMemo(() => {
        if (inspectionHandover || !vehicle?._id) {
            return liveAccessoriesListForm;
        }
        return buildAccessoryHandoverCardSourceForm(vehicle, historyEntry, { assetHistory });
    }, [assetHistory, historyEntry, inspectionHandover, liveAccessoriesListForm, vehicle]);

    const previousHandoverForm = useMemo(
        () =>
            inspectionHandover
                ? liveAccessoriesListForm
                : buildPreviousHandoverAccessoryForm(historyEntry, { assetHistory }),
        [assetHistory, historyEntry, inspectionHandover, liveAccessoriesListForm],
    );

    useEffect(() => {
        if (skipRemoteSyncRef.current) {
            skipRemoteSyncRef.current = false;
            lastAppliedSyncKeyRef.current = remoteAssessmentSyncKey;
            return;
        }
        if (lastAppliedSyncKeyRef.current === remoteAssessmentSyncKey) {
            return;
        }
        lastAppliedSyncKeyRef.current = remoteAssessmentSyncKey;
        setLocalEntry(null);

        const nextForm = cloneAssessmentForm(
            hasCurrentReceiverAssessmentData(historyEntry)
                ? buildAssessmentFormState(historyEntry, vehicle, {
                      assetHistory,
                      currentEntry: historyEntry,
                      asset: vehicle,
                  })
                : buildAccessoryHandoverCardSourceForm(vehicle, historyEntry, { assetHistory }),
        );
        setSavedForm(nextForm);
        setForm(nextForm);
    }, [assetHistory, historyEntry, historyEntryId, remoteAssessmentSyncKey, vehicle]);

    useEffect(() => {
        if (
            inspectionHandover ||
            !vehicle?._id ||
            hasCurrentReceiverAssessmentData(historyEntry) ||
            isReceiverAssessmentMarkedDone(historyEntry)
        ) {
            return;
        }

        const liveForm = cloneAssessmentForm(
            buildAccessoryHandoverCardSourceForm(vehicle, historyEntry, { assetHistory }),
        );
        const hasListData = RECEIVER_ASSESSMENT_ITEMS.some((item) =>
            accessoryListItemHasImage(liveForm, item.key),
        );
        if (!hasListData) return;

        setSavedForm(liveForm);
        setForm(liveForm);
    }, [assetHistory, historyEntry, inspectionHandover, vehicle]);

    const displayEntry = localEntry || historyEntry;
    const assessmentCompleted = isReceiverAssessmentMarkedDone(displayEntry);
    const readOnly = readOnlyProp || assessmentCompleted || (
        inspectionHandover &&
        String(vehicle?.vehicleInspectionStatus || '').toLowerCase() !== 'draft'
    );
    const effectiveAssessmentForm = useMemo(() => {
        const merged = cloneAssessmentForm(form);
        RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
            if (!accessoryListItemHasImage(accessoryCardSourceForm, item.key)) return;
            const listRow = accessoryCardSourceForm[item.key] || {};
            const row = form[item.key] || {};
            merged[item.key] = {
                present: row.present === false ? false : true,
                photo: row.photo || listRow.photo || null,
            };
        });
        return merged;
    }, [accessoryCardSourceForm, form]);

    const comparisonCurrentForm = useMemo(() => {
        if (inspectionHandover) {
            return effectiveAssessmentForm;
        }
        if (assessmentCompleted || hasCurrentReceiverAssessmentData(displayEntry)) {
            return buildAssessmentFormState(displayEntry, vehicle, {
                assetHistory,
                asset: vehicle,
            });
        }
        return form;
    }, [
        assessmentCompleted,
        assetHistory,
        displayEntry,
        effectiveAssessmentForm,
        form,
        inspectionHandover,
        vehicle,
    ]);

    const assessmentFormOptions = useMemo(
        () => ({ liveListForm: accessoryCardSourceForm }),
        [accessoryCardSourceForm],
    );
    const assessmentComplete = isAssessmentFormComplete(effectiveAssessmentForm, assessmentFormOptions);
    const formDirty = useMemo(() => assessmentFormChanged(savedForm, form), [form, savedForm]);
    const differsFromAccessoriesList = useMemo(
        () => assessmentFormChanged(accessoryCardSourceForm, form),
        [accessoryCardSourceForm, form],
    );
    const canCancel = formDirty || differsFromAccessoriesList;
    const hasDraftSelections = useMemo(() => hasAssessmentDraftSelections(form), [form]);
    const actionBusy = savingDraft || completing;
    const canSaveDraft =
        hasDraftSelections &&
        (formDirty || !hasCurrentReceiverAssessmentData(displayEntry));

    const previousHandoverFormForCompare = previousHandoverForm;

    const comparisonByKey = useMemo(() => {
        const acceptedWithoutFine = isHandoverApprovedWithoutFine(displayEntry);

        const rows = buildAssessmentFormComparisonRows(comparisonCurrentForm, displayEntry, assetHistory, {
            initialForm: accessoryComparisonBaselineForm,
            asset: vehicle,
        });
        const map = {};
        rows.forEach((row) => {
            const baselineRow = accessoryComparisonBaselineForm[row.key] || { present: null, photo: null };
            const previousRow = previousHandoverFormForCompare[row.key] || { present: null, photo: null };
            const currentRow = comparisonCurrentForm[row.key] || { present: null, photo: null };
            const hasBaseline =
                Boolean(row.hasBaseline) ||
                baselineRow.present === true ||
                baselineRow.present === false ||
                Boolean(baselineRow.photo);
            const rawChanged =
                accessoryAssessmentItemChanged(baselineRow, currentRow) ||
                Boolean(row.changed && hasBaseline);
            const changed = resolveHandoverComparisonChanged(rawChanged, displayEntry);
            const previousPhotoUrl =
                resolveAssessmentMediaUrl(previousRow.photo) || row.previous.photoUrl || null;
            const currentPhotoUrl = row.current.photoUrl || null;
            map[row.key] = {
                changed,
                hasBaseline,
                usesPreviousHandover: Boolean(row.usesPreviousHandover),
                acceptedWithoutFine,
                photoChanged: row.photoChanged,
                presentChanged: row.presentChanged,
                previousPhotoUrl,
                currentPhotoUrl,
                previousPresent: previousRow.present,
                currentPresent: row.current.present,
                canCompare:
                    !inspectionHandover &&
                    !acceptedWithoutFine &&
                    (hasAssessmentPhoto(previousRow.photo) || Boolean(previousPhotoUrl)),
            };
        });
        return map;
    }, [
        assetHistory,
        accessoryComparisonBaselineForm,
        comparisonCurrentForm,
        displayEntry,
        form,
        inspectionHandover,
        accessoryCardSourceForm,
        liveAccessoriesListForm,
        previousHandoverFormForCompare,
        displayEntry?.details?.handoverLifecycleStatus,
        displayEntry?.details?.handoverApprovedWithFine,
        vehicle,
    ]);

    const hasChangedAccessories = useMemo(
        () => Object.values(comparisonByKey).some((entry) => entry.changed),
        [comparisonByKey],
    );

    const previousAccessoriesItems = useMemo(
        () =>
            RECEIVER_ASSESSMENT_ITEMS.map((item) => {
                const row = previousHandoverForm[item.key] || { present: null, photo: null };
                return {
                    key: item.key,
                    label: item.label,
                    present: row.present ?? null,
                    photo: row.photo ?? null,
                    photoUrl: resolveAssessmentMediaUrl(row.photo),
                };
            }).filter(
                (item) =>
                    item.present === true ||
                    item.present === false ||
                    hasAssessmentPhoto(item.photo),
            ),
        [previousHandoverForm],
    );

    const showPreviousSectionButton =
        !inspectionHandover &&
        (hasChangedAccessories || formDirty) &&
        previousAccessoriesItems.length > 0;

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
                const errors = validateAssessmentForm(formToSave, assessmentFormOptions);
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
                skipRemoteSyncRef.current = true;
                lastAppliedSyncKeyRef.current = buildReceiverAssessmentRemoteSyncKey(merged);
                onSaved?.(merged, { partial: !complete });
                if (complete) onDone?.(merged);
                return merged;
            }

            const { data: savedRecord } = await axiosInstance.put(
                `/AssetItem/history-record/${persistHistoryId}/receiver-assessment`,
                {
                    receiverAssessment: payload,
                    partial: !complete,
                    ...(complete ? { assessmentCompleted: true } : {}),
                },
                ASSESSMENT_MUTATION_CONFIG,
            );

            const merged = savedRecord || mergeAssessmentCompletedIntoEntry(
                mergeReceiverAssessmentIntoEntry(displayEntry, payload),
            );
            setLocalEntry(merged);
            skipRemoteSyncRef.current = true;
            lastAppliedSyncKeyRef.current = buildReceiverAssessmentRemoteSyncKey(merged);
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
        if (readOnly || actionBusy || !canCancel) return;
        const target = cloneAssessmentForm(
            formDirty ? savedForm : accessoryCardSourceForm,
        );
        setForm(target);
        if (!formDirty) {
            setSavedForm(target);
        }
        toast({
            title: 'Changes discarded',
            description: formDirty
                ? 'Accessory selections were restored to the last saved state.'
                : 'Accessory selections were restored to the live accessories list.',
        });
    };

    const handlePresentChange = (key, present) => {
        if (readOnly) return;
        const listPhoto = accessoryCardSourceForm[key]?.photo ?? null;
        setForm((prev) => ({
            ...prev,
            [key]: applyAssessmentPresentToggle(
                prev[key],
                present,
                savedForm[key]?.photo ?? listPhoto ?? null,
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
            const uploaded = await uploadHandoverAssessmentPhoto(file, key);
            const storedPhoto = uploaded.url
                ? { publicId: uploaded.publicId, url: uploaded.url }
                : uploaded.publicId;
            setForm((prev) => ({
                ...prev,
                [key]: {
                    present: true,
                    photo: storedPhoto,
                },
            }));
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Upload failed',
                description: error.response?.data?.message || error.message || 'Could not upload photo.',
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
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <div className="rounded-xl bg-slate-50 p-2 text-slate-700">
                            <ClipboardCheck size={20} />
                        </div>
                        <div className="min-w-0">
                            <h4 className="text-sm font-bold text-gray-800">Vehicle Accessories</h4>
                            <p className="text-xs text-gray-500">
                        {inspectionHandover
                            ? historyEntry?.details?.reinspection === true
                                ? 'Reinspection — only the flowchart Admin Officer can complete this report'
                                : 'Inspection assessment — record current accessories and photos'
                            : 'By Receiver · Green = matches accessories list · Red = changed · Yellow = in fine'}
                            </p>
                        </div>
                    </div>
                    {showPreviousSectionButton ? (
                        <button
                            type="button"
                            onClick={() => setPreviousSectionOpen(true)}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 transition-colors hover:bg-emerald-100"
                        >
                            <History size={14} />
                            Previous accessories
                        </button>
                    ) : null}
                </div>

                {readOnly && !assessmentCompleted ? (
                    <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {inspectionHandover
                            ? historyEntry?.details?.reinspection === true
                                ? 'Only the flowchart Admin Officer can edit this reinspection report.'
                                : 'Only the Admin Officer (or assigned driver with portal access) can edit this inspection report.'
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
                        const comparison = inspectionHandover ? null : comparisonByKey[item.key];
                        const isWaived = inspectionHandover
                            ? false
                            : isHandoverItemFineWaived(handoverItemFineWaivers, 'accessory', item.key);
                        const existingFine = inspectionHandover
                            ? null
                            : resolveHandoverItemFineForCard({
                                  fineIndex: handoverItemFines,
                                  fines: handoverFines,
                                  historyId: displayEntry?._id,
                                  itemType: 'accessory',
                                  itemKey: item.key,
                                  changed: comparison?.changed,
                                  isWaived,
                              });
                        const listRow = accessoryCardSourceForm[item.key] || {};
                        const listHasImage = accessoryListItemHasImage(accessoryCardSourceForm, item.key);
                        const listPhoto = listRow.photo ?? null;
                        const effectivePresent = listHasImage
                            ? row.present === false
                                ? false
                                : true
                            : row.present;
                        const effectivePhoto = row.photo || listPhoto;
                        const isUserSelected = listHasImage
                            ? effectivePresent === true || effectivePresent === false
                            : row.present === true || row.present === false;
                        const visualStatus = inspectionHandover
                            ? 'neutral'
                            : !isUserSelected
                              ? 'neutral'
                              : resolveHandoverItemVisualStatus({
                                    changed: comparison?.changed,
                                    hasFine: Boolean(existingFine),
                                    isWaived,
                                    hasBaseline: comparison?.hasBaseline,
                                    acceptedWithoutFine: comparison?.acceptedWithoutFine,
                                });
                        const showFineAction = inspectionHandover
                            ? false
                            : shouldShowHandoverItemFineActions({
                                  canManageItemFines,
                                  changed: comparison?.changed,
                                  hasFine: Boolean(existingFine),
                                  isWaived,
                              });
                        const showRemoveFromFine =
                            showFineAction && !isWaived && (Boolean(existingFine) || comparison?.changed);

                        const showFineHint =
                            !inspectionHandover &&
                            visualStatus === 'changed' &&
                            !existingFine &&
                            !isWaived;
                        const showMatchesPrevious =
                            !inspectionHandover &&
                            visualStatus === 'unchanged' &&
                            Boolean(comparison?.usesPreviousHandover);

                        return (
                            <AssessmentItemCard
                                key={item.key}
                                label={item.label}
                                present={effectivePresent}
                                photo={effectivePhoto}
                                listHasImage={listHasImage}
                                listPhoto={listPhoto}
                                saving={actionBusy}
                                uploading={uploadingKey === item.key}
                                readOnly={readOnly}
                                visualStatus={visualStatus}
                                hasFine={Boolean(existingFine)}
                                isWaived={isWaived}
                                showFineAction={showFineAction}
                                showRemoveFromFine={showRemoveFromFine}
                                showFineHint={showFineHint}
                                showMatchesPrevious={showMatchesPrevious}
                                onAddFine={
                                    showFineAction
                                        ? () => {
                                              const previousRow = previousHandoverForm[item.key] || {};
                                              const comparison = comparisonByKey[item.key];
                                              onOpenItemFine?.({
                                                  itemType: 'accessory',
                                                  itemKey: item.key,
                                                  itemLabel: item.label,
                                                  existingFine,
                                                  photo: row.photo,
                                                  previousPhoto: previousRow.photo,
                                                  present: row.present,
                                                  previousPresent:
                                                      comparison?.previousPresent ?? previousRow.present,
                                                  photoUrl: comparison?.currentPhotoUrl,
                                                  previousPhotoUrl: comparison?.previousPhotoUrl,
                                                  photoChanged: comparison?.photoChanged,
                                              });
                                          }
                                        : undefined
                                }
                                onRemoveFromFine={
                                    showRemoveFromFine
                                        ? () =>
                                              onRemoveItemFine?.({
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
                                disabled={actionBusy || !canCancel}
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

            <PreviousAccessoriesModal
                open={previousSectionOpen}
                items={previousAccessoriesItems}
                onClose={() => setPreviousSectionOpen(false)}
            />
        </>
    );
}
