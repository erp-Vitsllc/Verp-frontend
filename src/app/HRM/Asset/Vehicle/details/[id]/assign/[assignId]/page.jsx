'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ListReturnBackButton from '@/components/ListReturnBackButton';
import { useListReturnBack } from '@/hooks/useListReturnBack';
import axiosInstance from '@/utils/axios';
import { Loader2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import VehicleHandoverAssignGrid from '../../../../components/VehicleHandoverAssignGrid';
import VehicleHandoverAssignWorkflowPanel from '../../../../components/VehicleHandoverAssignWorkflowPanel';
import VehicleHandoverReceiverAssessmentCard from '../../../../components/VehicleHandoverReceiverAssessmentCard';
import VehicleHandoverBodyConditionCard from '../../../../components/VehicleHandoverBodyConditionCard';
import AddVehicleFineModal from '@/app/HRM/Fine/components/AddVehicleFineModal';
import { invalidateAssetPendingInbox } from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import { isHandoverHrStage } from '../../../../utils/vehicleHandoverAssignActions';
import { buildLiveHandoverEntry, isVehicleInspectionHandoverEntry } from '../../../../utils/vehicleHandoverHistory';
import VehicleHandoverAssignHeaderCards from '../../../../components/VehicleHandoverAssignHeaderCards';
import VehicleHandoverAttachmentPanel from '../../../../components/VehicleHandoverAttachmentPanel';
import { VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG } from '../../../../utils/vehicleHandoverAssignWorkflowTrackerConfig';
import { useHandoverAssignPermissions } from '../../../../hooks/useHandoverAssignPermissions';
import {
    buildHandoverApprovalFineInitialData,
    buildHandoverItemFineInitialData,
    HANDOVER_DAMAGE_FINE_MODAL_PROPS,
    canManageHandoverItemFines,
    indexHandoverItemFineWaivers,
    indexHandoverItemFines,
    updateHandoverItemFineWaiver,
} from '../../../../utils/vehicleHandoverItemFineUtils';
import { resolveVehicleAccessoryItemPrice, buildPreviousHandoverComparisonForm } from '../../../../utils/vehicleHandoverReceiverAssessment';

function mergeHistoryEntryIntoList(list, entry) {
    if (!entry?._id || !Array.isArray(list)) return list;
    const entryId = String(entry._id);
    const index = list.findIndex((row) => String(row?._id) === entryId);
    if (index === -1) return [...list, entry];
    const next = [...list];
    next[index] = { ...next[index], ...entry };
    return next;
}

const { page: assignPageLayout } = VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG;

const PAGE_SECTION_ANIMATION =
    'animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-forwards';

const ASSIGN_TABS = [
    { id: 'details', label: 'Details' },
    { id: 'attachment', label: 'Attachment' },
];

function AssignPageTabs({ activeTab, onChange }) {
    return (
        <div className="mb-6 flex gap-2 border-b border-gray-200 print:hidden">
            {ASSIGN_TABS.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    onClick={() => onChange(tab.id)}
                    className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                        activeTab === tab.id
                            ? 'border-slate-900 text-slate-900'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

function VehicleHandoverAssignPageContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const vehicleId = params?.id;
    const assignId = params?.assignId;
    const activeTab = searchParams.get('tab') === 'attachment' ? 'attachment' : 'details';

    const [vehicle, setVehicle] = useState(null);
    const [historyEntry, setHistoryEntry] = useState(null);
    const [assetHistory, setAssetHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showHandoverFineModal, setShowHandoverFineModal] = useState(false);
    const pendingHandoverApprovalRef = useRef(false);
    const [handoverFineSubmitting, setHandoverFineSubmitting] = useState(false);
    const [handoverFines, setHandoverFines] = useState([]);
    const [itemFineInitialData, setItemFineInitialData] = useState(null);
    const approvalHeaderRef = useRef(null);
    const assessmentSectionRef = useRef(null);

    const {
        canEditReports,
        canApprove,
        canReviewInspection,
        canEditInspectionForm,
        canEditInspectionAccessories,
        canSubmitInspectionForHr,
        isHandoverHrStage: handoverAtHrStage,
        isFlowchartHr,
        flowchartRows,
        hrActiveHolder,
        loading: permissionsLoading,
    } = useHandoverAssignPermissions(vehicle, historyEntry);
    const isInspectionHandover = isVehicleInspectionHandoverEntry(historyEntry, vehicle);
    const reportsReadOnly = !permissionsLoading && !canEditReports;
    const inspectionFormReadOnly = !permissionsLoading && !canEditInspectionForm;
    const inspectionAccessoriesReadOnly =
        permissionsLoading || !canEditInspectionAccessories;
    const accessoriesReadOnly = isInspectionHandover
        ? inspectionAccessoriesReadOnly
        : reportsReadOnly;

    const isHrReviewStage = useMemo(
        () =>
            handoverAtHrStage ||
            isHandoverHrStage(vehicle, historyEntry) ||
            canReviewInspection,
        [canReviewInspection, handoverAtHrStage, vehicle, historyEntry],
    );

    const handoverFineVehicles = useMemo(
        () =>
            vehicle
                ? [
                      {
                          _id: vehicle._id,
                          assetId: vehicle.assetId || '',
                          name: vehicle.name || vehicle.assetId || 'Vehicle',
                          plateNumber: vehicle.plateNumber || '',
                      },
                  ]
                : [],
        [vehicle],
    );

    const handoverFineEmployees = useMemo(() => {
        const assignee = historyEntry?.assignedTo || vehicle?.assignedTo;
        if (!assignee?.employeeId) return [];
        return [
            {
                employeeId: assignee.employeeId,
                firstName: assignee.firstName || '',
                lastName: assignee.lastName || '',
                company: assignee.company || null,
            },
        ];
    }, [historyEntry, vehicle]);

    const handoverItemFineIndex = useMemo(
        () => indexHandoverItemFines(handoverFines, historyEntry?._id),
        [handoverFines, historyEntry?._id],
    );

    const handoverItemFineWaiverIndex = useMemo(
        () => indexHandoverItemFineWaivers(historyEntry),
        [historyEntry],
    );

    const handoverItemFineIndexForUi = useMemo(
        () => (isInspectionHandover ? {} : handoverItemFineIndex),
        [isInspectionHandover, handoverItemFineIndex],
    );

    const handoverItemFineWaiversForUi = useMemo(
        () => (isInspectionHandover ? {} : handoverItemFineWaiverIndex),
        [isInspectionHandover, handoverItemFineWaiverIndex],
    );

    const handoverFinesForUi = useMemo(
        () => (isInspectionHandover ? [] : handoverFines),
        [handoverFines, isInspectionHandover],
    );

    const handoverFineInitialData = useMemo(
        () =>
            buildHandoverApprovalFineInitialData({
                vehicle,
                historyEntry,
                assetHistory,
                handoverItemFineIndex,
                handoverItemFineWaiverIndex,
                assignee: historyEntry?.assignedTo || vehicle?.assignedTo,
            }),
        [
            assetHistory,
            handoverItemFineIndex,
            handoverItemFineWaiverIndex,
            historyEntry,
            vehicle,
        ],
    );

    const canManageItemFines = useMemo(
        () =>
            !isInspectionHandover &&
            canManageHandoverItemFines({ isFlowchartHr, vehicle, historyEntry }),
        [isInspectionHandover, isFlowchartHr, vehicle, historyEntry],
    );

    const fetchHandoverFines = useCallback(async (vehicleData) => {
        if (!vehicleData?._id) return;
        try {
            const [byObjectIdResp, byAssetCodeResp] = await Promise.all([
                axiosInstance.get('/Fine', { params: { vehicleId: vehicleData._id } }),
                vehicleData.assetId
                    ? axiosInstance.get('/Fine', { params: { assetId: vehicleData.assetId } })
                    : Promise.resolve({ data: { fines: [] } }),
            ]);
            const merged = [
                ...(byObjectIdResp?.data?.fines || []),
                ...(byAssetCodeResp?.data?.fines || []),
            ];
            const seen = new Set();
            const deduped = [];
            merged.forEach((fine) => {
                const id = String(fine?._id || '');
                if (!id || seen.has(id)) return;
                seen.add(id);
                deduped.push(fine);
            });
            setHandoverFines(deduped);
        } catch {
            setHandoverFines([]);
        }
    }, []);

    const removeHandoverItemFine = useCallback(
        async ({ itemType, itemKey, itemLabel }) => {
            const historyId = historyEntry?._id;
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
                setHistoryEntry(updated);
                setAssetHistory((prev) => mergeHistoryEntryIntoList(prev, updated));
                if (vehicle) {
                    await fetchHandoverFines(vehicle);
                }
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
        [fetchHandoverFines, historyEntry?._id, toast, vehicle],
    );

    const openHandoverItemFine = useCallback(
        ({
            itemType,
            itemKey,
            itemLabel,
            existingFine = null,
            photo = null,
            previousPhoto = null,
            comment = null,
            previousComment = null,
            present = null,
            previousPresent = null,
            photoUrl = null,
            previousPhotoUrl = null,
            photoChanged = false,
        }) => {
            const assignee = historyEntry?.assignedTo || vehicle?.assignedTo;
            let suggestedAmount = null;
            let resolvedPhoto = photo;
            let resolvedPreviousPhoto = previousPhoto;
            let resolvedComment = comment;
            let resolvedPreviousComment = previousComment;
            let resolvedPresent = present;
            let resolvedPreviousPresent = previousPresent;

            if (itemType === 'accessory') {
                const assessmentRow =
                    historyEntry?.details?.receiverAssessment?.[itemKey] ||
                    historyEntry?.details?.vehicleAssessmentReportByReceiver?.[itemKey] ||
                    null;
                suggestedAmount = resolveVehicleAccessoryItemPrice(
                    vehicle,
                    itemKey,
                    itemLabel,
                    assessmentRow,
                );
                if (!resolvedPhoto) {
                    resolvedPhoto = assessmentRow?.photo ?? null;
                }
                if (resolvedPresent == null) {
                    resolvedPresent = assessmentRow?.present ?? null;
                }
                if (!resolvedPreviousPhoto || resolvedPreviousPresent == null) {
                    const previousForm = buildPreviousHandoverComparisonForm(historyEntry, vehicle, {
                        assetHistory,
                        currentEntry: historyEntry,
                        asset: vehicle,
                    });
                    const previousRow = previousForm[itemKey] || {};
                    if (!resolvedPreviousPhoto) {
                        resolvedPreviousPhoto = previousRow.photo ?? null;
                    }
                    if (resolvedPreviousPresent == null) {
                        resolvedPreviousPresent = previousRow.present ?? null;
                    }
                }
            }

            setItemFineInitialData(
                buildHandoverItemFineInitialData({
                    vehicle,
                    historyEntry,
                    itemType,
                    itemKey,
                    itemLabel,
                    suggestedAmount,
                    existingFine,
                    assignee,
                    photo: resolvedPhoto,
                    previousPhoto: resolvedPreviousPhoto,
                    comment: resolvedComment,
                    previousComment: resolvedPreviousComment,
                    present: resolvedPresent,
                    previousPresent: resolvedPreviousPresent,
                    photoUrl,
                    previousPhotoUrl,
                    photoChanged,
                }),
            );
            pendingHandoverApprovalRef.current = false;
            setShowHandoverFineModal(true);
        },
        [assetHistory, historyEntry, vehicle],
    );

    const openApprovalHandoverFine = useCallback(() => {
        pendingHandoverApprovalRef.current = true;
        setItemFineInitialData(handoverFineInitialData);
        setShowHandoverFineModal(true);
    }, [handoverFineInitialData]);

    const handoverAssetHistory = useMemo(() => {
        if (!historyEntry?._id) return assetHistory;
        const entryId = String(historyEntry._id);
        const index = assetHistory.findIndex((row) => String(row?._id) === entryId);
        if (index >= 0) {
            const merged = [...assetHistory];
            merged[index] = {
                ...merged[index],
                ...historyEntry,
                details: {
                    ...(merged[index]?.details && typeof merged[index].details === 'object'
                        ? merged[index].details
                        : {}),
                    ...(historyEntry?.details && typeof historyEntry.details === 'object'
                        ? historyEntry.details
                        : {}),
                },
            };
            return merged;
        }
        return [historyEntry, ...assetHistory];
    }, [assetHistory, historyEntry]);

    const scrollToApprovalHeader = useCallback(() => {
        approvalHeaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const scrollToAssessmentSection = useCallback(() => {
        assessmentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const setActiveTab = useCallback(
        (tabId) => {
            const query = tabId === 'attachment' ? '?tab=attachment' : '';
            router.replace(`/HRM/Asset/Vehicle/details/${vehicleId}/assign/${assignId}${query}`);
        },
        [assignId, router, vehicleId],
    );

    const refreshAll = useCallback(async () => {
        if (!vehicleId || !assignId) return;
        try {
            const [vehicleRes, historyRes, recordRes] = await Promise.all([
                axiosInstance.get(`/AssetItem/detail/${vehicleId}`),
                axiosInstance.get(`/AssetItem/${vehicleId}/history`, {
                    params: { forHandover: '1' },
                    skipToast: true,
                }),
                axiosInstance
                    .get(`/AssetItem/history-record/${assignId}`, { skipToast: true })
                    .catch(() => ({ data: null })),
            ]);
            const vehicleData = vehicleRes.data;
            const historyList = Array.isArray(historyRes.data)
                ? historyRes.data
                : historyRes.data?.history || [];
            const entry =
                recordRes?.data ||
                historyList.find((row) => String(row?._id) === String(assignId)) ||
                null;

            setVehicle(vehicleData);
            setAssetHistory(entry ? mergeHistoryEntryIntoList(historyList, entry) : historyList);
            if (entry) setHistoryEntry(entry);
            await fetchHandoverFines(vehicleData);
        } catch {
            /* keep current */
        }
    }, [assignId, fetchHandoverFines, vehicleId]);

    const completeHandoverAcceptance = useCallback(
        async (handoverFineId = null) => {
            if (!vehicle?._id) return;
            setHandoverFineSubmitting(true);
            try {
                const payload = { action: 'Accept', comments: '' };
                if (handoverFineId) payload.handoverFineId = String(handoverFineId);
                await axiosInstance.put(
                    `/AssetItem/${vehicle._id}/respond`,
                    payload,
                    { skipActionDedupe: true },
                );
                await refreshAll();
                toast({
                    title: 'Approved',
                    description: handoverFineId
                        ? 'Handover approved and vehicle damage recorded.'
                        : 'Handover approved successfully.',
                });
                invalidateAssetPendingInbox('vehicle');
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: 'Approval failed',
                    description: error.response?.data?.message || 'Could not complete handover approval.',
                });
                throw error;
            } finally {
                setHandoverFineSubmitting(false);
            }
        },
        [refreshAll, toast, vehicle?._id],
    );

    const handleHandoverFineCreated = useCallback(
        async (result) => {
            const fineId =
                result?.fines?.[0]?._id ||
                result?.fine?._id ||
                result?._id ||
                null;
            const itemContext = itemFineInitialData?.handoverApprovalContext;
            const shouldCompleteApproval =
                pendingHandoverApprovalRef.current ||
                Boolean(itemFineInitialData?.handoverApprovalFine) ||
                Boolean(handoverFineInitialData?.handoverApprovalFine);
            pendingHandoverApprovalRef.current = false;
            setShowHandoverFineModal(false);
            setItemFineInitialData(null);

            if (
                itemContext?.historyId &&
                itemContext?.itemType &&
                itemContext?.itemKey &&
                !itemFineInitialData?.handoverApprovalFine
            ) {
                try {
                    const updated = await updateHandoverItemFineWaiver(
                        axiosInstance,
                        itemContext.historyId,
                        {
                            itemType: itemContext.itemType,
                            itemKey: itemContext.itemKey,
                            waived: false,
                        },
                    );
                    setHistoryEntry(updated);
                    setAssetHistory((prev) => mergeHistoryEntryIntoList(prev, updated));
                } catch {
                    /* non-fatal — fine was still created */
                }
            }

            if (vehicle) {
                await fetchHandoverFines(vehicle);
            }

            if (shouldCompleteApproval) {
                try {
                    await completeHandoverAcceptance(fineId);
                } catch {
                    /* toast shown */
                }
            }
        },
        [
            completeHandoverAcceptance,
            fetchHandoverFines,
            handoverFineInitialData?.handoverApprovalFine,
            itemFineInitialData?.handoverApprovalFine,
            vehicle,
        ],
    );

    const handleHandoverFineModalClose = useCallback(() => {
        if (handoverFineSubmitting) return;
        pendingHandoverApprovalRef.current = false;
        setShowHandoverFineModal(false);
        setItemFineInitialData(null);
    }, [handoverFineSubmitting]);

    const handleHistorySaved = useCallback((entry, options = {}) => {
        startTransition(() => {
            setHistoryEntry(entry);
            setAssetHistory((prev) => mergeHistoryEntryIntoList(prev, entry));
        });
    }, []);

    const handleAssessmentDone = useCallback(() => {
        scrollToAssessmentSection();
    }, [scrollToAssessmentSection]);

    const handleVehicleUpdated = useCallback((nextVehicle) => {
        setVehicle(nextVehicle);
    }, []);

    const handleHandoverResponded = useCallback(async () => {
        await refreshAll();
    }, [refreshAll]);

    const handleBack = useListReturnBack(
        useCallback(() => {
            if (vehicleId) {
                router.push(`/HRM/Asset/Vehicle/details/${vehicleId}?tab=handover`);
            } else {
                router.push('/HRM/Asset/Vehicle');
            }
        }, [router, vehicleId]),
    );

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!vehicleId || !assignId) return;
            setLoading(true);

            try {
                const [vehicleRes, historyRes, recordRes] = await Promise.all([
                    axiosInstance.get(`/AssetItem/detail/${vehicleId}`),
                    axiosInstance.get(`/AssetItem/${vehicleId}/history`, {
                        params: { forHandover: '1' },
                        skipToast: true,
                    }),
                    String(assignId).startsWith('live-')
                        ? Promise.resolve({ data: null })
                        : axiosInstance
                              .get(`/AssetItem/history-record/${assignId}`, { skipToast: true })
                              .catch(() => ({ data: null })),
                ]);

                if (cancelled) return;

                const vehicleData = vehicleRes.data;
                const historyList = Array.isArray(historyRes.data)
                    ? historyRes.data
                    : historyRes.data?.history || [];

                setVehicle(vehicleData);

                let entry = null;
                if (String(assignId).startsWith('live-')) {
                    entry = buildLiveHandoverEntry(vehicleData);
                } else {
                    entry =
                        recordRes?.data ||
                        historyList.find((row) => String(row?._id) === String(assignId)) ||
                        null;
                }

                setHistoryEntry(entry);
                setAssetHistory(entry ? mergeHistoryEntryIntoList(historyList, entry) : historyList);
                if (entry) {
                    if (!isVehicleInspectionHandoverEntry(entry, vehicleData)) {
                        void fetchHandoverFines(vehicleData);
                    } else {
                        setHandoverFines([]);
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    toast({
                        variant: 'destructive',
                        title: 'Error',
                        description: error.response?.data?.message || 'Failed to load handover assignment details.',
                    });
                    setHistoryEntry(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [assignId, toast, vehicleId]);

    if (loading) {
        return (
            <div className="flex min-h-screen w-full bg-[#F2F6F9]">
                <Sidebar />
                <div className="flex-1 flex flex-col">
                    <Navbar />
                    <div className="flex-1 flex flex-col items-stretch justify-start py-8 w-full px-6 md:px-8 animate-in fade-in duration-300">
                        <div className="w-full flex items-center justify-between mb-2 print:hidden animate-in fade-in slide-in-from-top-2 duration-500">
                            <ListReturnBackButton onNavigate={handleBack} />
                        </div>
                        <div className="flex flex-1 items-center justify-center animate-in fade-in zoom-in-95 duration-500">
                            <div className="flex flex-col items-center gap-3 text-slate-500">
                                <Loader2 className="animate-spin" size={32} />
                                <span className="text-sm font-medium">Loading handover details...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!vehicle || !historyEntry) {
        return (
            <div className="flex min-h-screen w-full bg-[#F2F6F9]">
                <Sidebar />
                <div className="flex-1 flex flex-col">
                    <Navbar />
                    <div className="flex-1 flex flex-col items-stretch justify-start py-8 w-full px-6 md:px-8 animate-in fade-in duration-300">
                        <div className="w-full flex items-center justify-between mb-2 print:hidden animate-in fade-in slide-in-from-top-2 duration-500">
                            <ListReturnBackButton onNavigate={handleBack} />
                        </div>
                        <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-500">
                            <FileText className="mx-auto text-gray-300 mb-4" size={56} />
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Handover record not found</h2>
                            <p className="text-sm text-gray-500">
                                This assignment may have been removed or the link is invalid.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full bg-[#F2F6F9]">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Navbar />
                <div className="flex-1 flex flex-col items-stretch justify-start py-8 relative overflow-y-auto w-full px-6 md:px-8 print:py-0 animate-in fade-in duration-300">
                    <div className="w-full flex items-center justify-between mb-2 print:hidden animate-in fade-in slide-in-from-top-2 duration-500">
                        <ListReturnBackButton onNavigate={handleBack} />
                    </div>

                    <div ref={approvalHeaderRef} className="scroll-mt-6 w-full">
                        <VehicleHandoverAssignHeaderCards
                            key={`${vehicleId}-${assignId}`}
                            vehicle={vehicle}
                            historyEntry={historyEntry}
                            assetHistory={handoverAssetHistory}
                            onVehicleUpdated={handleVehicleUpdated}
                            onHistoryUpdated={setHistoryEntry}
                            onResponded={handleHandoverResponded}
                            canApprove={canApprove}
                            isHrStage={isHrReviewStage}
                            onApproveWithFine={isInspectionHandover ? undefined : openApprovalHandoverFine}
                            handoverItemFines={handoverItemFineIndexForUi}
                            handoverItemFineWaivers={handoverItemFineWaiversForUi}
                            canReviewInspection={canReviewInspection}
                            canSubmitInspectionForHr={canSubmitInspectionForHr}
                        />
                    </div>

                    <AssignPageTabs activeTab={activeTab} onChange={setActiveTab} />

                    {activeTab === 'details' ? (
                        <>
                            <div
                                className={`${assignPageLayout.rowClassName} ${PAGE_SECTION_ANIMATION} delay-150`}
                            >
                                <div className={assignPageLayout.mainColumnClassName}>
                                    <VehicleHandoverAssignGrid
                                        historyEntry={historyEntry}
                                        vehicle={vehicle}
                                    />

                                    <div
                                        ref={assessmentSectionRef}
                                        className="w-full min-w-0 scroll-mt-6"
                                    >
                                        <VehicleHandoverReceiverAssessmentCard
                                            historyEntry={historyEntry}
                                            vehicle={vehicle}
                                            assetHistory={handoverAssetHistory}
                                            onSaved={handleHistorySaved}
                                            onDone={handleAssessmentDone}
                                            onVehicleUpdated={handleVehicleUpdated}
                                            inspectionHandover={isInspectionHandover}
                                            mirrorLiveAccessories={!isInspectionHandover}
                                            readOnly={accessoriesReadOnly}
                                            handoverItemFines={handoverItemFineIndexForUi}
                                            handoverFines={handoverFinesForUi}
                                            handoverItemFineWaivers={handoverItemFineWaiversForUi}
                                            canManageItemFines={canManageItemFines}
                                            isHrApprovalStage={isHrReviewStage}
                                            onOpenItemFine={openHandoverItemFine}
                                            onRemoveItemFine={removeHandoverItemFine}
                                        />
                                    </div>
                                </div>

                                <div className={`${assignPageLayout.sideColumnClassName}`}>
                                    <VehicleHandoverAssignWorkflowPanel
                                        historyEntry={historyEntry}
                                        vehicle={vehicle}
                                        assetHistory={handoverAssetHistory}
                                        handoverItemFines={handoverItemFineIndexForUi}
                                        handoverItemFineWaivers={handoverItemFineWaiversForUi}
                                        className={assignPageLayout.panelClassName}
                                        canApprove={canApprove}
                                        isHrStage={isHrReviewStage}
                                        onApproveWithFine={
                                            isInspectionHandover ? undefined : openApprovalHandoverFine
                                        }
                                        onVehicleUpdated={handleVehicleUpdated}
                                        onHistoryUpdated={setHistoryEntry}
                                        onResponded={handleHandoverResponded}
                                        accessoriesSidePanel
                                        flowchartRows={permissionsLoading ? undefined : flowchartRows}
                                        hrActiveHolder={permissionsLoading ? undefined : hrActiveHolder}
                                    />
                                </div>
                            </div>

                            <div className={`mt-6 w-full min-w-0 ${PAGE_SECTION_ANIMATION} delay-300`}>
                                <VehicleHandoverBodyConditionCard
                                    historyEntry={historyEntry}
                                    vehicle={vehicle}
                                    assetHistory={handoverAssetHistory}
                                    onSaved={handleHistorySaved}
                                    readOnly={
                                        isInspectionHandover ? inspectionFormReadOnly : reportsReadOnly
                                    }
                                    inspectionHandover={isInspectionHandover}
                                    onVehicleUpdated={handleVehicleUpdated}
                                    onGoToApproval={scrollToApprovalHeader}
                                    onGoToAssessment={scrollToAssessmentSection}
                                    handoverItemFines={handoverItemFineIndexForUi}
                                    handoverFines={handoverFinesForUi}
                                    handoverItemFineWaivers={handoverItemFineWaiversForUi}
                                    canManageItemFines={canManageItemFines}
                                    isHrApprovalStage={isHrReviewStage}
                                    onOpenItemFine={openHandoverItemFine}
                                    onRemoveItemFine={removeHandoverItemFine}
                                />
                            </div>
                        </>
                    ) : (
                        <div className={`w-full ${PAGE_SECTION_ANIMATION} delay-150`}>
                            <VehicleHandoverAttachmentPanel
                                vehicle={vehicle}
                                historyEntry={historyEntry}
                                vehicleId={vehicleId}
                            />
                        </div>
                    )}

                </div>
            </div>

            <AddVehicleFineModal
                isOpen={showHandoverFineModal}
                onClose={handleHandoverFineModalClose}
                onSuccess={handleHandoverFineCreated}
                initialData={itemFineInitialData || handoverFineInitialData}
                employees={handoverFineEmployees}
                vehicles={handoverFineVehicles}
                {...HANDOVER_DAMAGE_FINE_MODAL_PROPS}
            />
        </div>
    );
}

export default function VehicleHandoverAssignPage() {
    return (
        <Suspense
            fallback={(
                <div className="flex items-center justify-center min-h-screen bg-[#F2F6F9] animate-in fade-in duration-300">
                    <Loader2 className="animate-spin text-slate-400" size={32} />
                </div>
            )}
        >
            <VehicleHandoverAssignPageContent />
        </Suspense>
    );
}
