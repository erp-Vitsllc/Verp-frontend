'use client';

import { useCallback, useMemo, useState } from 'react';
import { Loader2, Package, Plus } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import AddVehicleAccessoryModal from './AddVehicleAccessoryModal';
import {
    RECEIVER_ASSESSMENT_ITEMS,
    buildAccessoryReplacementSavePlan,
    buildFlatLiveAccessoryRows,
    buildFlatOldAccessoryRows,
    buildSyncedAssetAccessories,
    buildVehicleAccessoriesListTableSets,
    resolveAccessoriesListPrimaryHandoverEntry,
    resolveAssessmentMediaUrl,
} from '../utils/vehicleHandoverReceiverAssessment';
import VehicleHandoverAssessmentPhotoViewer from './VehicleHandoverAssessmentPhotoViewer';
import AssessmentMediaImage from './AssessmentMediaImage';

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

function AccessoryImageCell({ row, onPreview }) {
    const photoUrl = row.photoUrl || resolveAssessmentMediaUrl(row.photo);

    if (!photoUrl) {
        return (
            <div className="flex h-[115px] max-w-[220px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-400">
                No image
            </div>
        );
    }

    return (
        <div className="relative w-full max-w-[220px]">
            <button
                type="button"
                onClick={onPreview}
                className="flex h-[115px] w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white transition-shadow hover:shadow-md"
                title={`View ${row.label}`}
            >
                <AssessmentMediaImage
                    photo={row.photo || photoUrl}
                    alt={row.label}
                    fit="contain"
                    className="max-h-full max-w-full object-contain object-center"
                    placeholderClassName="flex h-full w-full items-center justify-center"
                />
            </button>
            {row.status === 'Old' ? (
                <span className="absolute left-1.5 top-1.5 rounded bg-slate-800/75 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    Previous
                </span>
            ) : null}
        </div>
    );
}

function AccessoryTableRow({ row, onPreview }) {
    return (
        <tr className="border-b border-slate-100 last:border-b-0">
            <td className="min-w-[140px] border-r border-slate-100 px-4 py-4 align-middle">
                <span className="text-sm font-semibold text-slate-800">{row.label}</span>
            </td>
            <td className="min-w-[160px] border-r border-slate-100 px-4 py-4 align-top">
                <AccessoryImageCell row={row} onPreview={() => onPreview(row.listKey)} />
            </td>
            <td className="min-w-[100px] px-4 py-4 align-middle">
                <AccessoryStatusBadge status={row.status} />
            </td>
        </tr>
    );
}

const ACCESSORIES_INNER_TABS = [
    { id: 'live', label: 'Live Accessories' },
    { id: 'old', label: 'Old Accessories' },
];

export default function VehicleAccessoriesListTab({
    asset,
    assetHistory = [],
    loading = false,
    canEdit = false,
    onUpdate,
}) {
    const { toast } = useToast();
    const [innerTab, setInnerTab] = useState('live');
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerStartIndex, setViewerStartIndex] = useState(0);
    const [saving, setSaving] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    const { sets: displaySets } = useMemo(
        () => buildVehicleAccessoriesListTableSets(asset, assetHistory),
        [asset, assetHistory],
    );

    const liveRows = useMemo(
        () => buildFlatLiveAccessoryRows(asset, assetHistory),
        [asset, assetHistory],
    );

    const oldRows = useMemo(() => buildFlatOldAccessoryRows(asset), [asset]);

    const tabRows = innerTab === 'live' ? liveRows : oldRows;
    const canAddNew = innerTab === 'live' && canEdit && Boolean(asset?._id);

    const galleryItems = useMemo(
        () =>
            tabRows
                .map((row) => {
                    const url = row.photoUrl || resolveAssessmentMediaUrl(row.photo);
                    if (!url) return null;
                    return { key: row.listKey, label: row.label, url };
                })
                .filter(Boolean),
        [tabRows],
    );

    const openPhotoViewer = useCallback(
        (listKey) => {
            const index = galleryItems.findIndex((item) => item.key === listKey);
            if (index < 0) return;
            setViewerStartIndex(index);
            setViewerOpen(true);
        },
        [galleryItems],
    );

    const handleAddAccessorySubmit = useCallback(
        async ({ accessoryKey, photo, amount, isReplacing }) => {
            setSaving(true);
            try {
                const historyEntry = resolveAccessoriesListPrimaryHandoverEntry(asset, assetHistory);
                const historyId = historyEntry?._id;

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
                    description: isReplacing || plan.isReplacing
                        ? `${label} updated. The previous image is now in Old Accessories.`
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
        [asset, assetHistory, displaySets, onUpdate, toast],
    );

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
                        {canAddNew ? (
                            <button
                                type="button"
                                onClick={() => setShowAddModal(true)}
                                disabled={saving}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                            >
                                <Plus size={14} />
                                Add accessory
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="flex gap-1 border-b border-slate-100 px-5">
                    {ACCESSORIES_INNER_TABS.map((tab) => {
                        const count = tab.id === 'live' ? liveRows.length : oldRows.length;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => {
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

                {tabRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-20 text-slate-400">
                        <Package size={48} strokeWidth={1} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium text-slate-500">
                            {innerTab === 'live'
                                ? 'No live accessories yet. Click Add accessory to upload a type and image.'
                                : 'No old accessories yet. Re-adding the same type moves the current image here.'}
                        </p>
                        {canAddNew && innerTab === 'live' ? (
                            <button
                                type="button"
                                onClick={() => setShowAddModal(true)}
                                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-emerald-700"
                            >
                                <Plus size={14} />
                                Add accessory
                            </button>
                        ) : null}
                    </div>
                ) : (
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
                                {tabRows.map((row) => (
                                    <AccessoryTableRow
                                        key={row.listKey}
                                        row={row}
                                        onPreview={openPhotoViewer}
                                    />
                                ))}
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

            <AddVehicleAccessoryModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSubmit={handleAddAccessorySubmit}
                saving={saving}
                asset={asset}
                displaySets={displaySets}
            />
        </div>
    );
}
