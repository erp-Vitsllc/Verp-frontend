'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Package, PencilLine, Plus, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import AddVehicleAccessoryModal from './AddVehicleAccessoryModal';
import AddVehicleFineModal from '@/app/HRM/Fine/components/AddVehicleFineModal';
import {
    RECEIVER_ASSESSMENT_ITEMS,
    accessoriesAssessmentRowsChanged,
    buildAccessoriesListEditForm,
    buildAccessoryReplacementSavePlan,
    buildAssessmentPayload,
    buildLostDetachedAccessoryRows,
    buildLiveAccessoriesListView,
    buildLostAccessoriesTabView,
    buildReplacedLiveAccessoryRows,
    buildSyncedAssetAccessories,
    buildVehicleAccessoriesListTableSets,
    classifyVehicleHandoverAccessoryKeys,
    resolveAccessoriesListPrimaryHandoverEntry,
    resolveAssessmentMediaUrl,
    serializeVehicleAccessoriesListEntry,
    serializeVehicleAccessoriesListEntryFromRows,
} from '../utils/vehicleHandoverReceiverAssessment';
import {
    buildHandoverItemFineInitialData,
    HANDOVER_DAMAGE_FINE_MODAL_PROPS,
    canManageHandoverItemFines,
    indexHandoverItemFineWaivers,
    indexHandoverItemFines,
    isHandoverApprovedWithoutFine,
    isHandoverItemFineWaived,
    resolveHandoverItemFine,
    resolveHandoverItemFineDisplayAmount,
    shouldShowHandoverItemFineActions,
    updateHandoverItemFineWaiver,
} from '../utils/vehicleHandoverItemFineUtils';
import VehicleHandoverItemFineButton from './VehicleHandoverItemFineButton';
import VehicleHandoverAssessmentPhotoViewer from './VehicleHandoverAssessmentPhotoViewer';
import VehicleHandoverLandscapePhotoBox, {
    VehicleHandoverLandscapePhotoPlaceholder,
} from './VehicleHandoverLandscapePhotoBox';
import AssessmentMediaImage from './AssessmentMediaImage';

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function AccessoryImageCell({
    row,
    editable,
    draftRow,
    uploading,
    changed = false,
    hasFine = false,
    onPreview,
    onPhotoUpload,
}) {
    const changedFrame = hasFine
        ? 'ring-2 ring-amber-400 border-amber-300'
        : changed
          ? 'ring-2 ring-red-400 border-red-300'
          : 'border-slate-200';

    if (editable) {
        const photoUrl = resolveAssessmentMediaUrl(draftRow?.photo);
        const showPhoto = draftRow?.present !== false;

        if (!showPhoto) {
            return (
                <VehicleHandoverLandscapePhotoPlaceholder>
                    Marked as not included
                </VehicleHandoverLandscapePhotoPlaceholder>
            );
        }

        return (
            <VehicleHandoverLandscapePhotoBox
                label={row.label}
                photo={draftRow?.photo}
                photoUrl={photoUrl}
                uploading={uploading}
                readOnly={false}
                onUpload={onPhotoUpload}
                onPreview={photoUrl ? onPreview : undefined}
                inputIdPrefix="accessories-list-upload"
                uploadLabel="Upload"
                changeLabel="Change"
                imageObjectFit="contain"
            />
        );
    }

    if (row.present === false) {
        const historicalUrl = row.lostDisplayPhotoUrl || row.photoUrl;
        if (!historicalUrl) {
            return (
                <div className={`flex h-[115px] items-center justify-center rounded-lg border border-dashed bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-400 ${hasFine ? 'border-amber-300 bg-amber-50 text-amber-700' : changed ? 'border-red-300 bg-red-50 text-red-500' : 'border-slate-200'}`}>
                    No
                </div>
            );
        }
    }

    const displayPhoto = row.photo || (row.lostDisplayPhotoUrl ? null : row.photoUrl);

    if (!displayPhoto && !row.lostDisplayPhotoUrl && !row.photoUrl) {
        return (
            <div className={`flex h-[115px] items-center justify-center rounded-lg border border-dashed bg-slate-50 text-[11px] font-medium text-slate-400 ${hasFine ? 'border-amber-300 bg-amber-50' : changed ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                {row.present === true ? 'Photo pending' : '—'}
            </div>
        );
    }

    return (
        <div className="relative w-full max-w-[220px]">
            <button
                type="button"
                onClick={() => onPreview(row.key)}
                className={`flex h-[115px] w-full items-center justify-center overflow-hidden rounded-lg border bg-white transition-shadow hover:shadow-md ${changedFrame}`}
                title={`View ${row.label}`}
            >
                {displayPhoto ? (
                    <AssessmentMediaImage
                        photo={displayPhoto}
                        alt={row.label}
                        fit="contain"
                        className="max-h-full max-w-full object-contain object-center"
                        placeholderClassName="flex h-full w-full items-center justify-center"
                    />
                ) : (
                    <AssessmentMediaImage
                        photo={row.lostDisplayPhotoUrl || row.photoUrl}
                        alt={row.label}
                        fit="contain"
                        className="max-h-full max-w-full object-contain object-center"
                        placeholderClassName="flex h-full w-full items-center justify-center"
                    />
                )}
            </button>
            {row.showLostHistoricalImage ? (
                <span className="absolute left-1.5 top-1.5 rounded bg-slate-800/75 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    Previous
                </span>
            ) : null}
        </div>
    );
}

function resolveAccessoryRowStatus(rowSet, lostItemView) {
    if (rowSet.id === 'previous-handover') return 'Old';
    if (lostItemView) return 'Old';
    return 'Live';
}

function AccessoryStatusBadge({ status }) {
    const isLive = status === 'Live';
    return (
        <span
            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                isLive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
            }`}
        >
            {status}
        </span>
    );
}

function AccessoryDataRow({
    rowSet,
    editable,
    draft,
    uploadingKey,
    onPreview,
    onPhotoUpload,
    handoverItemFines = {},
    handoverItemFineWaivers = {},
    canManageItemFines = false,
    onOpenItemFine,
    onRemoveItemFine,
    handoverApprovedWithoutFine = false,
    lostItemView = false,
}) {
    const toneClass =
        rowSet.id === 'new-assignment'
            ? 'bg-red-50/30'
            : rowSet.id === 'previous-handover'
              ? 'bg-emerald-50/20'
              : rowSet.highlight
                ? 'bg-emerald-50/40'
                : 'border-t border-slate-100';

    return (
        <>
            <tr className={toneClass}>
                <td
                    colSpan={3}
                    className="border-b border-slate-100 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500"
                >
                    <span className="inline-flex items-center gap-2">
                        {rowSet.label}
                        {rowSet.id === 'new-assignment' ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold tracking-wide text-red-700">
                                Changed from previous
                            </span>
                        ) : null}
                    </span>
                </td>
            </tr>
            {rowSet.rows.map((row) => {
                const draftRow = draft[row.key] || {};
                const uploadId = `${rowSet.id}:${row.key}`;
                const rowChanged = Boolean(row.changed || rowSet.changedByKey?.[row.key]);
                const changed = lostItemView
                    ? row.present === false || rowChanged
                    : handoverApprovedWithoutFine
                      ? false
                      : rowChanged;
                const existingFine = resolveHandoverItemFine(handoverItemFines, 'accessory', row.key);
                const isWaived = isHandoverItemFineWaived(handoverItemFineWaivers, 'accessory', row.key);
                const hasFine = Boolean(existingFine);
                const displayAmount = resolveHandoverItemFineDisplayAmount(existingFine, row.amount);
                const showFineAction =
                    !editable &&
                    !row.isDetachedCatalog &&
                    !row.isReplacedArchive &&
                    lostItemView &&
                    shouldShowHandoverItemFineActions({
                        canManageItemFines,
                        changed: rowChanged || row.present === false,
                        hasFine,
                        isWaived,
                    }) &&
                    (rowSet.id === 'new-assignment' ||
                        rowSet.id === 'primary' ||
                        rowSet.id === 'current-accessories' ||
                        rowSet.id === 'lost-accessories');
                const showRemoveFromFine =
                    showFineAction && !isWaived && (hasFine || rowChanged || row.present === false);
                const rowStatus = row.isReplacedArchive
                    ? 'Old'
                    : resolveAccessoryRowStatus(rowSet, lostItemView);

                return (
                    <tr key={`${rowSet.id}-${row.key}`} className={`${toneClass} border-b border-slate-100 last:border-b-0`}>
                        <td className="min-w-[140px] border-r border-slate-100 px-4 py-4 align-middle">
                            <div>
                                <span className="text-sm font-semibold text-slate-800">{row.label}</span>
                                {row.accessoryId ? (
                                    <p className="mt-0.5 font-mono text-xs text-slate-500">{row.accessoryId}</p>
                                ) : null}
                                {showFineAction ? (
                                    <VehicleHandoverItemFineButton
                                        hasFine={hasFine}
                                        isWaived={isWaived}
                                        showRemoveFromFine={showRemoveFromFine}
                                        className="mt-2"
                                        onAddFine={() =>
                                            onOpenItemFine?.({
                                                itemType: 'accessory',
                                                itemKey: row.key,
                                                itemLabel: row.label,
                                                existingFine,
                                                suggestedAmount: displayAmount ?? row.amount,
                                                photo: row.photo || row.lostDisplayPhotoUrl,
                                                present: row.present,
                                                previousPresent: row.previousPresent,
                                            })
                                        }
                                        onRemoveFromFine={() =>
                                            onRemoveItemFine?.({
                                                itemType: 'accessory',
                                                itemKey: row.key,
                                                itemLabel: row.label,
                                                existingFine,
                                            })
                                        }
                                    />
                                ) : null}
                            </div>
                        </td>
                        <td className="min-w-[160px] border-r border-slate-100 px-4 py-4 align-top">
                            <AccessoryImageCell
                                row={row}
                                editable={editable}
                                draftRow={draftRow}
                                uploading={uploadingKey === uploadId}
                                changed={lostItemView ? changed : changed && !isWaived && !hasFine}
                                hasFine={hasFine}
                                onPreview={() => onPreview(row.key, rowSet.id)}
                                onPhotoUpload={(file) => onPhotoUpload(row.key, file, rowSet.id)}
                            />
                        </td>
                        <td className="min-w-[100px] px-4 py-4 align-middle">
                            <AccessoryStatusBadge status={rowStatus} />
                        </td>
                    </tr>
                );
            })}
        </>
    );
}

const ACCESSORIES_INNER_TABS = [
    { id: 'live', label: 'Live Accessories' },
    { id: 'lost', label: 'Lost Accessories' },
];

export default function VehicleAccessoriesListTab({
    asset,
    assetHistory = [],
    loading = false,
    canEdit = false,
    canManageItemFines = false,
    isFlowchartHr = false,
    onUpdate,
    onHistoryUpdated,
}) {
    const { toast } = useToast();
    const [innerTab, setInnerTab] = useState('live');
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerStartIndex, setViewerStartIndex] = useState(0);
    const [mode, setMode] = useState(null);
    const [draft, setDraft] = useState({});
    const [saving, setSaving] = useState(false);
    const [uploadingKey, setUploadingKey] = useState(null);
    const [handoverFines, setHandoverFines] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showItemFineModal, setShowItemFineModal] = useState(false);
    const [itemFineInitialData, setItemFineInitialData] = useState(null);
    const photoUploadInFlightRef = useRef(new Set());

    const historyEntry = useMemo(
        () => resolveAccessoriesListPrimaryHandoverEntry(asset, assetHistory),
        [asset, assetHistory],
    );

    const historyId = historyEntry?._id;

    const { sets: displaySets, headerRows } = useMemo(
        () => buildVehicleAccessoriesListTableSets(asset, assetHistory),
        [asset, assetHistory],
    );

    const fetchHandoverFines = useCallback(async () => {
        if (!asset?._id) return;
        try {
            const [byObjectIdResp, byAssetCodeResp] = await Promise.all([
                axiosInstance.get('/Fine', { params: { vehicleId: asset._id } }),
                asset.assetId
                    ? axiosInstance.get('/Fine', { params: { assetId: asset.assetId } })
                    : Promise.resolve({ data: { fines: [] } }),
            ]);
            const merged = [
                ...(byObjectIdResp?.data?.fines || []),
                ...(byAssetCodeResp?.data?.fines || []),
            ];
            const seen = new Set();
            setHandoverFines(
                merged.filter((fine) => {
                    const id = String(fine?._id || '');
                    if (!id || seen.has(id)) return false;
                    seen.add(id);
                    return true;
                }),
            );
        } catch {
            setHandoverFines([]);
        }
    }, [asset?._id, asset?.assetId]);

    useEffect(() => {
        void fetchHandoverFines();
    }, [fetchHandoverFines]);

    const handoverItemFineIndex = useMemo(
        () => indexHandoverItemFines(handoverFines, historyId),
        [handoverFines, historyId],
    );

    const handoverItemFineWaiverIndex = useMemo(
        () => indexHandoverItemFineWaivers(historyEntry),
        [historyEntry],
    );

    const finedAccessoryKeys = useMemo(
        () =>
            RECEIVER_ASSESSMENT_ITEMS.filter((item) =>
                resolveHandoverItemFine(handoverItemFineIndex, 'accessory', item.key),
            ).map((item) => item.key),
        [handoverItemFineIndex],
    );

    const waivedAccessoryKeys = useMemo(
        () =>
            RECEIVER_ASSESSMENT_ITEMS.filter((item) =>
                isHandoverItemFineWaived(handoverItemFineWaiverIndex, 'accessory', item.key),
            ).map((item) => item.key),
        [handoverItemFineWaiverIndex],
    );

    const { liveKeys, lostKeys } = useMemo(
        () =>
            classifyVehicleHandoverAccessoryKeys(displaySets, {
                finedKeys: finedAccessoryKeys,
                waivedKeys: waivedAccessoryKeys,
            }),
        [displaySets, finedAccessoryKeys, waivedAccessoryKeys],
    );

    const detachedLostRows = useMemo(() => buildLostDetachedAccessoryRows(asset), [asset]);
    const replacedLiveRows = useMemo(() => buildReplacedLiveAccessoryRows(asset), [asset]);

    const { sets: tabDisplaySets } = useMemo(() => {
        if (innerTab === 'live') {
            return buildLiveAccessoriesListView(displaySets, headerRows, liveKeys);
        }
        return buildLostAccessoriesTabView(displaySets, headerRows, lostKeys, asset);
    }, [asset, displaySets, headerRows, innerTab, liveKeys, lostKeys]);

    const handoverApprovedWithoutFine = useMemo(
        () => isHandoverApprovedWithoutFine(historyEntry),
        [historyEntry, historyEntry?.details?.handoverLifecycleStatus, historyEntry?.details?.handoverApprovedWithFine],
    );

    const canShowItemFines = useMemo(
        () =>
            canManageItemFines &&
            canManageHandoverItemFines({ isFlowchartHr, vehicle: asset, historyEntry }),
        [asset, canManageItemFines, historyEntry, isFlowchartHr],
    );

    const fineModalVehicles = useMemo(
        () =>
            asset
                ? [
                      {
                          _id: asset._id,
                          assetId: asset.assetId || '',
                          name: asset.name || asset.assetId || 'Vehicle',
                          plateNumber: asset.plateNumber || '',
                      },
                  ]
                : [],
        [asset],
    );

    const fineModalEmployees = useMemo(() => {
        const assignee = historyEntry?.assignedTo || asset?.assignedTo;
        if (!assignee?.employeeId) return [];
        return [
            {
                employeeId: assignee.employeeId,
                firstName: assignee.firstName || '',
                lastName: assignee.lastName || '',
                company: assignee.company || null,
            },
        ];
    }, [asset?.assignedTo, historyEntry?.assignedTo]);

    const removeItemFine = useCallback(
        async ({ itemType, itemKey, itemLabel }) => {
            if (!historyId || String(historyId).startsWith('live-')) {
                toast({
                    variant: 'destructive',
                    title: 'Cannot remove fine',
                    description: 'Save the handover record before updating item fines.',
                });
                return;
            }
            try {
                const updated = await updateHandoverItemFineWaiver(axiosInstance, historyId, {
                    itemType,
                    itemKey,
                    waived: true,
                });
                onHistoryUpdated?.(updated);
                await fetchHandoverFines();
                toast({
                    title: 'Removed from fine',
                    description: `${itemLabel || itemKey} is no longer included in the handover fine.`,
                });
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: 'Could not remove from fine',
                    description: error.response?.data?.message || error.message || 'Please try again.',
                });
            }
        },
        [fetchHandoverFines, historyId, onHistoryUpdated, toast],
    );

    const openItemFine = useCallback(
        ({
            itemType,
            itemKey,
            itemLabel,
            existingFine = null,
            suggestedAmount = null,
            photo = null,
            previousPhoto = null,
            present = null,
            previousPresent = null,
        }) => {
            let resolvedPreviousPhoto = previousPhoto;
            let resolvedPreviousPresent = previousPresent;
            const previousSet = displaySets.find((set) => set.id === 'previous-handover');
            const previousRow = previousSet?.rows?.find((row) => row.key === itemKey);
            if (previousRow) {
                if (!resolvedPreviousPhoto) {
                    resolvedPreviousPhoto = previousRow.photo ?? null;
                }
                if (resolvedPreviousPresent == null) {
                    resolvedPreviousPresent = previousRow.present ?? null;
                }
            }

            setItemFineInitialData(
                buildHandoverItemFineInitialData({
                    vehicle: asset,
                    historyEntry,
                    itemType,
                    itemKey,
                    itemLabel,
                    suggestedAmount,
                    existingFine,
                    assignee: historyEntry?.assignedTo || asset?.assignedTo,
                    photo,
                    previousPhoto: resolvedPreviousPhoto,
                    present,
                    previousPresent: resolvedPreviousPresent,
                }),
            );
            setShowItemFineModal(true);
        },
        [asset, displaySets, historyEntry],
    );

    const editableSet = useMemo(
        () =>
            displaySets.find((set) => set.id === 'new-assignment') ||
            displaySets.find((set) => set.id === 'primary') ||
            null,
        [displaySets],
    );

    const hasAnyData = displaySets.length > 0;
    const tabHasHandoverData = tabDisplaySets.length > 0;
    const tabHasData = tabHasHandoverData;
    const canEditPrimary =
        innerTab === 'live' &&
        canEdit &&
        Boolean(editableSet) &&
        historyId &&
        !String(historyId).startsWith('live-');
    const canAddNew = innerTab === 'live' && canEdit && Boolean(asset?._id);
    const isEditing = mode === 'edit';

    const galleryItems = useMemo(() => {
        const collect = [];

        const pushFromDraft = (rowSetId, form) => {
            RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
                const url = resolveAssessmentMediaUrl(form[item.key]?.photo);
                if (url) collect.push({ key: `${rowSetId}:${item.key}`, label: item.label, url });
            });
        };

        if (mode === 'edit' && editableSet) pushFromDraft(editableSet.id, draft);

        tabDisplaySets.forEach((set) => {
            set.rows.forEach((row) => {
                const url = row.lostDisplayPhotoUrl || row.photoUrl;
                if (url) {
                    collect.push({ key: `${set.id}:${row.key}`, label: row.label, url });
                }
            });
        });

        return collect;
    }, [draft, editableSet, mode, tabDisplaySets]);

    const startEditing = useCallback(() => {
        if (!editableSet) return;
        setDraft(buildAccessoriesListEditForm(editableSet.rows));
        setMode('edit');
    }, [editableSet]);

    const startAdding = useCallback(() => {
        setShowAddModal(true);
    }, []);

    const handleAddAccessorySubmit = useCallback(
        async ({ accessoryKey, photo, amount, isReplacing }) => {
            setSaving(true);
            try {
                const plan = buildAccessoryReplacementSavePlan({
                    asset,
                    historyEntry,
                    displaySets,
                    accessoryKey,
                    photo,
                    amount,
                });

                if (historyId && !String(historyId).startsWith('live-')) {
                    await axiosInstance.put(
                        `/AssetItem/history-record/${historyId}/receiver-assessment`,
                        { receiverAssessment: plan.assessmentPayload, partial: true },
                        { skipActionDedupe: true },
                    );
                }

                const syncedAccessories = buildSyncedAssetAccessories(asset, plan.mergedForm);
                const assetPayload = {
                    vehicleAccessoriesListEntries: plan.nextEntries,
                };
                if (syncedAccessories) {
                    assetPayload.accessories = syncedAccessories;
                }
                await axiosInstance.put(`/AssetType/${asset._id}`, assetPayload);

                const label =
                    RECEIVER_ASSESSMENT_ITEMS.find((item) => item.key === accessoryKey)?.label ||
                    'Accessory';
                toast({
                    title: 'Saved',
                    description: isReplacing
                        ? `${label} updated. The previous image is now in Lost Accessories.`
                        : `${label} added to Live Accessories.`,
                });
                setShowAddModal(false);
                onUpdate?.();
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: 'Save failed',
                    description:
                        error.response?.data?.message ||
                        error.message ||
                        'Could not save accessory.',
                });
            } finally {
                setSaving(false);
            }
        },
        [asset, displaySets, historyEntry, historyId, onUpdate, toast],
    );

    const cancelEditing = useCallback(() => {
        setMode(null);
        setDraft({});
        setUploadingKey(null);
    }, []);

    const openPhotoViewer = (key, rowSetId) => {
        const galleryKey = `${rowSetId}:${key}`;
        const index = galleryItems.findIndex((item) => item.key === galleryKey);
        if (index < 0) return;
        setViewerStartIndex(index);
        setViewerOpen(true);
    };

    const handlePhotoUpload = async (key, file, rowSetId) => {
        if (!isEditing || photoUploadInFlightRef.current.has(key)) return;

        if (!file.type.startsWith('image/')) {
            toast({
                variant: 'destructive',
                title: 'Invalid file',
                description: 'Please upload an image file.',
            });
            return;
        }

        const uploadId = `${rowSetId}:${key}`;
        photoUploadInFlightRef.current.add(key);
        setUploadingKey(uploadId);
        try {
            const dataUrl = await readFileAsDataUrl(file);
            setDraft((prev) => ({
                ...prev,
                [key]: {
                    ...(prev[key] || {}),
                    present: true,
                    photo: dataUrl,
                },
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

    const handleSave = async () => {
        setSaving(true);
        let changed = false;
        try {
            if (mode === 'edit') {
                if (!historyId || String(historyId).startsWith('live-')) {
                    throw new Error('No handover record is available to update.');
                }

                const payload = buildAssessmentPayload(draft);
                changed = editableSet
                    ? accessoriesAssessmentRowsChanged(editableSet.rows, draft)
                    : false;

                let nextEntries = Array.isArray(asset?.vehicleAccessoriesListEntries)
                    ? asset.vehicleAccessoriesListEntries.map((entry) => {
                          const serialized = {
                              createdAt: entry.createdAt || new Date().toISOString(),
                              kind: entry.kind || 'manual',
                          };
                          if (entry._id) serialized._id = entry._id;
                          if (entry.sourceHistoryId) serialized.sourceHistoryId = entry.sourceHistoryId;
                          RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
                              const row = entry[item.key];
                              if (!row) return;
                              serialized[item.key] = {
                                  present: row.present ?? null,
                                  photo: row.photo ?? null,
                                  amount: row.amount ?? null,
                              };
                          });
                          return serialized;
                      })
                    : [];

                if (changed && editableSet) {
                    nextEntries = [
                        ...nextEntries,
                        serializeVehicleAccessoriesListEntryFromRows(editableSet.rows, {
                            kind: 'edit_snapshot',
                            sourceHistoryId: historyId,
                        }),
                        serializeVehicleAccessoriesListEntry(draft, {
                            kind: 'assignment_change',
                            sourceHistoryId: historyId,
                        }),
                    ];
                }

                await axiosInstance.put(
                    `/AssetItem/history-record/${historyId}/receiver-assessment`,
                    { receiverAssessment: payload, partial: true },
                    { skipActionDedupe: true },
                );

                const syncedAccessories = buildSyncedAssetAccessories(asset, draft);
                const assetPayload = {};
                if (changed) {
                    assetPayload.vehicleAccessoriesListEntries = nextEntries;
                }
                if (syncedAccessories) {
                    assetPayload.accessories = syncedAccessories;
                }
                if (Object.keys(assetPayload).length > 0) {
                    await axiosInstance.put(`/AssetType/${asset._id}`, assetPayload);
                }
            }

            toast({
                title: 'Saved',
                description: changed
                    ? 'Previous row kept and updated values saved as a new row.'
                    : 'Accessories list updated successfully.',
            });
            setMode(null);
            setDraft({});
            onUpdate?.();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Save failed',
                description:
                    error.response?.data?.message ||
                    error.message ||
                    'Could not save accessories list.',
            });
        } finally {
            setSaving(false);
        }
    };

    if (!asset) {
        return (
            <div className="py-16 text-center text-sm font-medium text-slate-500">
                Loading accessories…
            </div>
        );
    }

    if (loading) {
        return (
            <div className="py-16 text-center text-sm font-medium text-slate-500">
                Loading accessories list…
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-full px-2">
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
                        <Package size={18} className="text-blue-600" />
                        Accessories List
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Vehicle Accessories
                        </span>
                        {isEditing ? (
                            <>
                                <button
                                    type="button"
                                    onClick={cancelEditing}
                                    disabled={saving}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                                >
                                    <X size={14} />
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving || Boolean(uploadingKey)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                                    Save
                                </button>
                            </>
                        ) : (
                            <>
                                {canAddNew ? (
                                    <button
                                        type="button"
                                        onClick={startAdding}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 transition-colors hover:bg-emerald-100"
                                    >
                                        <Plus size={14} />
                                        New
                                    </button>
                                ) : null}
                                {canEditPrimary ? (
                                    <button
                                        type="button"
                                        onClick={startEditing}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-700 transition-colors hover:bg-slate-50"
                                    >
                                        <PencilLine size={14} />
                                        Edit
                                    </button>
                                ) : null}
                            </>
                        )}
                    </div>
                </div>

                <div className="flex gap-1 border-b border-slate-100 px-5">
                    {ACCESSORIES_INNER_TABS.map((tab) => {
                        const count =
                            tab.id === 'live'
                                ? liveKeys.length
                                : lostKeys.length + detachedLostRows.length + replacedLiveRows.length;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => {
                                    if (isEditing) cancelEditing();
                                    if (showAddModal) setShowAddModal(false);
                                    setInnerTab(tab.id);
                                }}
                                className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                                    innerTab === tab.id
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {tab.label}
                                {count > 0 ? (
                                    <span className="ml-1.5 text-xs font-bold text-slate-400">
                                        ({count})
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>

                {!hasAnyData ? (
                    <div className="flex flex-col items-center justify-center px-6 py-20 text-slate-400">
                        <Package size={48} strokeWidth={1} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium text-slate-500">
                            No accessories recorded yet. Complete a handover assessment or click New to add a row.
                        </p>
                        {canAddNew ? (
                            <button
                                type="button"
                                onClick={startAdding}
                                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-emerald-700"
                            >
                                <Plus size={14} />
                                New
                            </button>
                        ) : null}
                    </div>
                ) : !tabHasData ? (
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-slate-400">
                        <Package size={40} strokeWidth={1} className="mb-3 opacity-20" />
                        <p className="text-sm font-medium text-slate-500">
                            {innerTab === 'live'
                                ? 'No live accessories recorded on this vehicle yet.'
                                : 'No lost or missing accessories recorded.'}
                        </p>
                    </div>
                ) : tabHasHandoverData ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/80">
                                    <th className="min-w-[140px] border-r border-slate-100 px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-700">
                                        Type
                                    </th>
                                    <th className="min-w-[160px] border-r border-slate-100 px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-700">
                                        Image
                                    </th>
                                    <th className="min-w-[100px] px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-700">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {tabDisplaySets.map((rowSet) => (
                                    <AccessoryDataRow
                                        key={rowSet.id}
                                        rowSet={rowSet}
                                        editable={
                                            mode === 'edit' &&
                                            innerTab === 'live' &&
                                            (editableSet?.id === rowSet.id ||
                                                (rowSet.id === 'current-accessories' && Boolean(editableSet)))
                                        }
                                        draft={draft}
                                        uploadingKey={uploadingKey}
                                        onPreview={openPhotoViewer}
                                        onPhotoUpload={handlePhotoUpload}
                                        handoverItemFines={handoverItemFineIndex}
                                        handoverItemFineWaivers={handoverItemFineWaiverIndex}
                                        canManageItemFines={canShowItemFines}
                                        onOpenItemFine={openItemFine}
                                        onRemoveItemFine={removeItemFine}
                                        handoverApprovedWithoutFine={handoverApprovedWithoutFine}
                                        lostItemView={innerTab === 'lost'}
                                    />
                                ))}

                            </tbody>
                        </table>
                    </div>
                ) : null}
            </div>

            <VehicleHandoverAssessmentPhotoViewer
                open={viewerOpen}
                items={galleryItems}
                startIndex={viewerStartIndex}
                onClose={() => setViewerOpen(false)}
            />

            <AddVehicleAccessoryModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSubmit={handleAddAccessorySubmit}
                saving={saving}
                displaySets={displaySets}
            />

            <AddVehicleFineModal
                isOpen={showItemFineModal}
                onClose={() => {
                    setShowItemFineModal(false);
                    setItemFineInitialData(null);
                }}
                onSuccess={() => {
                    void fetchHandoverFines();
                    setShowItemFineModal(false);
                    setItemFineInitialData(null);
                }}
                initialData={itemFineInitialData}
                employees={fineModalEmployees}
                vehicles={fineModalVehicles}
                {...HANDOVER_DAMAGE_FINE_MODAL_PROPS}
            />
        </div>
    );
}
