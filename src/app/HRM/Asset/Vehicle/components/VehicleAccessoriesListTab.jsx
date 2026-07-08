'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Package, PencilLine, Plus, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import AddVehicleFineModal from '@/app/HRM/Fine/components/AddVehicleFineModal';
import {
    RECEIVER_ASSESSMENT_ITEMS,
    accessoriesAssessmentRowsChanged,
    buildAccessoriesListEditForm,
    buildAssessmentPayload,
    buildEmptyAccessoriesListEditForm,
    buildSyncedAssetAccessories,
    buildVehicleAccessoriesListTableSets,
    resolveAccessoriesListPrimaryHandoverEntry,
    formatVehicleAccessoryPrice,
    resolveAssessmentMediaUrl,
    resolveVehicleAccessoryItemPrice,
    serializeVehicleAccessoriesListEntries,
    serializeVehicleAccessoriesListEntry,
    serializeVehicleAccessoriesListEntryFromRows,
} from '../utils/vehicleHandoverReceiverAssessment';
import {
    buildHandoverItemFineInitialData,
    canManageHandoverItemFines,
    indexHandoverItemFines,
    isHandoverApprovedWithoutFine,
    resolveHandoverItemFine,
} from '../utils/vehicleHandoverItemFineUtils';
import VehicleHandoverItemFineButton from './VehicleHandoverItemFineButton';
import VehicleHandoverAssessmentPhotoViewer from './VehicleHandoverAssessmentPhotoViewer';
import VehicleHandoverLandscapePhotoBox, {
    VehicleHandoverLandscapePhotoPlaceholder,
} from './VehicleHandoverLandscapePhotoBox';

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
                photoUrl={photoUrl}
                uploading={uploading}
                readOnly={false}
                onUpload={onPhotoUpload}
                onPreview={photoUrl ? onPreview : undefined}
                inputIdPrefix="accessories-list-upload"
                uploadLabel="Upload"
                changeLabel="Change"
            />
        );
    }

    if (row.present === false) {
        return (
            <div className={`flex h-[115px] items-center justify-center rounded-lg border border-dashed bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-400 ${hasFine ? 'border-amber-300 bg-amber-50 text-amber-700' : changed ? 'border-red-300 bg-red-50 text-red-500' : 'border-slate-200'}`}>
                No
            </div>
        );
    }

    if (!row.photoUrl) {
        return (
            <div className={`flex h-[115px] items-center justify-center rounded-lg border border-dashed bg-slate-50 text-[11px] font-medium text-slate-400 ${hasFine ? 'border-amber-300 bg-amber-50' : changed ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                {row.present === true ? 'Photo pending' : '—'}
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={() => onPreview(row.key)}
            className={`block h-[115px] w-full overflow-hidden rounded-lg border bg-slate-50 transition-shadow hover:shadow-md ${changedFrame}`}
            title={`View ${row.label}`}
        >
            <img src={row.photoUrl} alt={row.label} className="h-full w-full object-cover" />
        </button>
    );
}

function AccessoryDataRow({
    rowSet,
    editable,
    draft,
    uploadingKey,
    headerColumnCount,
    onPreview,
    onPhotoUpload,
    onAmountChange,
    handoverItemFines = {},
    canManageItemFines = false,
    onOpenItemFine,
    handoverApprovedWithoutFine = false,
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
                    colSpan={headerColumnCount}
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
            <tr className={toneClass}>
                {rowSet.rows.map((row) => {
                    const draftRow = draft[row.key] || {};
                    const uploadId = `${rowSet.id}:${row.key}`;
                    const changed = handoverApprovedWithoutFine
                        ? false
                        : Boolean(row.changed || rowSet.changedByKey?.[row.key]);
                    const existingFine = resolveHandoverItemFine(handoverItemFines, 'accessory', row.key);
                    const hasFine = Boolean(existingFine);
                    const priceClass = hasFine
                        ? 'text-amber-700'
                        : changed
                          ? 'text-red-700'
                          : 'text-emerald-700';
                    const showFineAction =
                        !editable &&
                        canManageItemFines &&
                        rowSet.id === 'new-assignment' &&
                        (changed || hasFine);

                    return (
                        <Fragment key={`${rowSet.id}-${row.key}`}>
                            <td className="border-r border-slate-100 px-4 py-4 align-top">
                                <AccessoryImageCell
                                    row={row}
                                    editable={editable}
                                    draftRow={draftRow}
                                    uploading={uploadingKey === uploadId}
                                    changed={changed}
                                    hasFine={hasFine}
                                    onPreview={() => onPreview(row.key, rowSet.id)}
                                    onPhotoUpload={(file) => onPhotoUpload(row.key, file, rowSet.id)}
                                />
                            </td>
                            <td className="border-r border-slate-100 px-4 py-4 align-middle text-center last:border-r-0">
                                <div className="flex flex-col items-center gap-2">
                                    {editable ? (
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                AED
                                            </span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={draftRow.amount ?? ''}
                                                onChange={(e) => onAmountChange(row.key, e.target.value)}
                                                className={`w-full max-w-[120px] rounded-lg border px-2 py-1.5 text-center text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 ${
                                                    changed
                                                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                                                        : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20'
                                                }`}
                                                placeholder="0"
                                            />
                                        </div>
                                    ) : (
                                        <span className={`text-sm font-bold tabular-nums ${priceClass}`}>
                                            {formatVehicleAccessoryPrice(row.amount)}
                                        </span>
                                    )}
                                    {showFineAction ? (
                                        <VehicleHandoverItemFineButton
                                            hasFine={hasFine}
                                            onClick={() =>
                                                onOpenItemFine?.({
                                                    itemType: 'accessory',
                                                    itemKey: row.key,
                                                    itemLabel: row.label,
                                                    existingFine,
                                                    suggestedAmount: row.amount,
                                                })
                                            }
                                        />
                                    ) : null}
                                </div>
                            </td>
                        </Fragment>
                    );
                })}
            </tr>
        </>
    );
}

export default function VehicleAccessoriesListTab({
    asset,
    assetHistory = [],
    loading = false,
    canEdit = false,
    canManageItemFines = false,
    isFlowchartHr = false,
    onUpdate,
}) {
    const { toast } = useToast();
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerStartIndex, setViewerStartIndex] = useState(0);
    const [mode, setMode] = useState(null);
    const [draft, setDraft] = useState({});
    const [saving, setSaving] = useState(false);
    const [uploadingKey, setUploadingKey] = useState(null);
    const [handoverFines, setHandoverFines] = useState([]);
    const [showItemFineModal, setShowItemFineModal] = useState(false);
    const [itemFineInitialData, setItemFineInitialData] = useState(null);
    const photoUploadInFlightRef = useRef(new Set());

    const historyEntry = useMemo(
        () => resolveAccessoriesListPrimaryHandoverEntry(asset, assetHistory),
        [asset, assetHistory],
    );

    const historyId = historyEntry?._id;

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

    const openItemFine = useCallback(
        ({ itemType, itemKey, itemLabel, existingFine = null, suggestedAmount = null }) => {
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
                }),
            );
            setShowItemFineModal(true);
        },
        [asset, historyEntry],
    );

    const { sets: displaySets, headerRows } = useMemo(
        () => buildVehicleAccessoriesListTableSets(asset, assetHistory),
        [asset, assetHistory],
    );

    const headerColumnCount = headerRows.length * 2;

    const editableSet = useMemo(
        () =>
            displaySets.find((set) => set.id === 'new-assignment') ||
            displaySets.find((set) => set.id === 'primary') ||
            null,
        [displaySets],
    );

    const hasAnyData = displaySets.length > 0;
    const canEditPrimary =
        canEdit &&
        Boolean(editableSet) &&
        historyId &&
        !String(historyId).startsWith('live-');
    const canAddNew = canEdit && Boolean(asset?._id);
    const isEditing = mode === 'edit' || mode === 'new';

    const newRowSet = useMemo(
        () => ({
            id: 'new',
            rows: RECEIVER_ASSESSMENT_ITEMS.map((item) => ({ ...item, photoUrl: null, amount: null })),
        }),
        [],
    );

    const galleryItems = useMemo(() => {
        const collect = [];

        const pushFromDraft = (rowSetId, form) => {
            RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
                const url = resolveAssessmentMediaUrl(form[item.key]?.photo);
                if (url) collect.push({ key: `${rowSetId}:${item.key}`, label: item.label, url });
            });
        };

        if (mode === 'edit' && editableSet) pushFromDraft(editableSet.id, draft);
        if (mode === 'new') pushFromDraft('new', draft);

        displaySets.forEach((set) => {
            set.rows.forEach((row) => {
                if (row.photoUrl) {
                    collect.push({ key: `${set.id}:${row.key}`, label: row.label, url: row.photoUrl });
                }
            });
        });

        return collect;
    }, [draft, displaySets, editableSet, mode]);

    const startEditing = useCallback(() => {
        if (!editableSet) return;
        setDraft(buildAccessoriesListEditForm(editableSet.rows));
        setMode('edit');
    }, [editableSet]);

    const startAdding = useCallback(() => {
        setDraft(buildEmptyAccessoriesListEditForm());
        setMode('new');
    }, []);

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

    const handleAmountChange = (key, value) => {
        setDraft((prev) => ({
            ...prev,
            [key]: {
                ...(prev[key] || {}),
                amount: value,
            },
        }));
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
            } else if (mode === 'new') {
                const entries = serializeVehicleAccessoriesListEntries(asset, draft);
                await axiosInstance.put(`/AssetType/${asset._id}`, {
                    vehicleAccessoriesListEntries: entries,
                });
            }

            toast({
                title: 'Saved',
                description:
                    mode === 'new'
                        ? 'New accessories row added below the current row.'
                        : changed
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

                {!hasAnyData && mode !== 'new' ? (
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
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/80">
                                    {(hasAnyData ? headerRows : RECEIVER_ASSESSMENT_ITEMS).map((row) => (
                                        <Fragment key={row.key}>
                                            <th className="min-w-[140px] border-r border-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-700">
                                                {row.label}
                                            </th>
                                            <th className="min-w-[100px] border-r border-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500 last:border-r-0">
                                                Price
                                            </th>
                                        </Fragment>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {displaySets.map((rowSet) => (
                                    <AccessoryDataRow
                                        key={rowSet.id}
                                        rowSet={rowSet}
                                        editable={
                                            mode === 'edit' &&
                                            editableSet?.id === rowSet.id
                                        }
                                        draft={draft}
                                        uploadingKey={uploadingKey}
                                        headerColumnCount={headerColumnCount}
                                        onPreview={openPhotoViewer}
                                        onPhotoUpload={handlePhotoUpload}
                                        onAmountChange={handleAmountChange}
                                        handoverItemFines={handoverItemFineIndex}
                                        canManageItemFines={canShowItemFines}
                                        onOpenItemFine={openItemFine}
                                        handoverApprovedWithoutFine={handoverApprovedWithoutFine}
                                    />
                                ))}

                                {mode === 'new' ? (
                                    <AccessoryDataRow
                                        rowSet={{
                                            ...newRowSet,
                                            label: 'New row',
                                            changedByKey: {},
                                        }}
                                        editable
                                        draft={draft}
                                        uploadingKey={uploadingKey}
                                        headerColumnCount={headerColumnCount}
                                        onPreview={openPhotoViewer}
                                        onPhotoUpload={handlePhotoUpload}
                                        onAmountChange={handleAmountChange}
                                        handoverItemFines={handoverItemFineIndex}
                                        canManageItemFines={canShowItemFines}
                                        onOpenItemFine={openItemFine}
                                        handoverApprovedWithoutFine={handoverApprovedWithoutFine}
                                    />
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <VehicleHandoverAssessmentPhotoViewer
                open={viewerOpen}
                items={galleryItems}
                startIndex={viewerStartIndex}
                onClose={() => setViewerOpen(false)}
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
            />
        </div>
    );
}
