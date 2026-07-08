'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { shouldShowBodyConditionSection } from '../../../../utils/vehicleHandoverBodyCondition';
import { useHandoverAssignPermissions } from '../../../../hooks/useHandoverAssignPermissions';
import {
    buildHandoverItemFineInitialData,
    indexHandoverItemFines,
} from '../../../../utils/vehicleHandoverItemFineUtils';
import { resolveVehicleAccessoryItemPrice } from '../../../../utils/vehicleHandoverReceiverAssessment';

function shouldShowHandoverReports(entry) {
    if (shouldShowBodyConditionSection(entry)) return true;
    return entry?.details?.bodyConditionCompleted === true;
}

function mergeHistoryEntryIntoList(list, entry) {
    if (!entry?._id || !Array.isArray(list)) return list;
    const entryId = String(entry._id);
    const index = list.findIndex((row) => String(row?._id) === entryId);
    if (index === -1) return [...list, entry];
    const next = [...list];
    next[index] = { ...next[index], ...entry };
    return next;
}

const { page: workflowPageLayout } = VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG;

const PAGE_SECTION_ANIMATION =
    'animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both';

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
        canSubmitInspectionForHr,
        isHandoverHrStage: handoverAtHrStage,
        isFlowchartHr,
        loading: permissionsLoading,
    } = useHandoverAssignPermissions(vehicle, historyEntry);
    const reportsReadOnly = !permissionsLoading && !canEditReports;
    const inspectionFormReadOnly = !permissionsLoading && !canEditInspectionForm;
    const isInspectionHandover = isVehicleInspectionHandoverEntry(historyEntry, vehicle);
    const [showBodyCondition, setShowBodyCondition] = useState(false);

    const isHrReviewStage = useMemo(
        () => handoverAtHrStage || isHandoverHrStage(vehicle, historyEntry),
        [handoverAtHrStage, vehicle, historyEntry],
    );

    const handoverFineInitialData = useMemo(() => {
        const assignee = historyEntry?.assignedTo || vehicle?.assignedTo;
        return {
            handoverApprovalFine: true,
            handoverApprovalContext: {
                historyId: historyEntry?._id || null,
                vehicleId: vehicle?._id || vehicleId || null,
            },
            vehicleId: vehicle?._id || vehicleId || '',
            assetId: vehicle?.assetId || '',
            employeeId: assignee?.employeeId || '',
            assignedEmployees: assignee?.employeeId ? [{ employeeId: assignee.employeeId }] : [],
            description: `Vehicle handover damage fine — ${vehicle?.assetId || ''}`.trim(),
        };
    }, [historyEntry, vehicle, vehicleId]);

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

    const canManageItemFines = isFlowchartHr && isHrReviewStage;

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

    const openHandoverItemFine = useCallback(
        ({ itemType, itemKey, itemLabel, existingFine = null }) => {
            const assignee = historyEntry?.assignedTo || vehicle?.assignedTo;
            let suggestedAmount = null;
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
                }),
            );
            pendingHandoverApprovalRef.current = false;
            setShowHandoverFineModal(true);
        },
        [historyEntry, vehicle],
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
            const [vehicleRes, historyRes] = await Promise.all([
                axiosInstance.get(`/AssetItem/detail/${vehicleId}`),
                axiosInstance.get(`/AssetItem/${vehicleId}/history`),
            ]);
            const vehicleData = vehicleRes.data;
            const historyList = Array.isArray(historyRes.data)
                ? historyRes.data
                : historyRes.data?.history || [];
            setVehicle(vehicleData);
            setAssetHistory(historyList);
            await fetchHandoverFines(vehicleData);
            let entry = null;
            try {
                const recordRes = await axiosInstance.get(`/AssetItem/history-record/${assignId}`, {
                    skipToast: true,
                });
                entry = recordRes.data;
            } catch {
                entry =
                    historyList.find((row) => String(row?._id) === String(assignId)) || null;
            }
            if (entry) setHistoryEntry(entry);
            if (entry) {
                setAssetHistory((prev) => mergeHistoryEntryIntoList(prev, entry));
            }
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
                await axiosInstance.put(`/AssetItem/${vehicle._id}/respond`, payload);
                await refreshAll();
                toast({
                    title: 'Approved',
                    description: handoverFineId
                        ? 'Handover approved and vehicle fine recorded.'
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
            const shouldCompleteApproval =
                pendingHandoverApprovalRef.current ||
                Boolean(itemFineInitialData?.handoverApprovalFine) ||
                Boolean(handoverFineInitialData?.handoverApprovalFine);
            pendingHandoverApprovalRef.current = false;
            setShowHandoverFineModal(false);
            setItemFineInitialData(null);
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

    const handleHistorySaved = useCallback(
        (entry, options = {}) => {
            setHistoryEntry(entry);
            if (shouldShowHandoverReports(entry)) {
                setShowBodyCondition(true);
            }
            if (options.partial !== true) {
                void refreshAll();
            }
        },
        [refreshAll, vehicle],
    );

    const handleAssessmentDone = useCallback(
        (entry) => {
            setHistoryEntry(entry);
            setShowBodyCondition(true);
            void refreshAll();
        },
        [refreshAll],
    );

    const handleVehicleUpdated = useCallback(
        (nextVehicle) => {
            setVehicle(nextVehicle);
            void refreshAll();
        },
        [refreshAll],
    );

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
                const [vehicleRes, historyRes] = await Promise.all([
                    axiosInstance.get(`/AssetItem/detail/${vehicleId}`),
                    axiosInstance.get(`/AssetItem/${vehicleId}/history`),
                ]);

                if (cancelled) return;

                const vehicleData = vehicleRes.data;
                const historyList = Array.isArray(historyRes.data)
                    ? historyRes.data
                    : historyRes.data?.history || [];

                setVehicle(vehicleData);
                setAssetHistory(historyList);
                void fetchHandoverFines(vehicleData);

                let entry = null;
                if (String(assignId).startsWith('live-')) {
                    entry = buildLiveHandoverEntry(vehicleData);
                } else {
                    try {
                        const recordRes = await axiosInstance.get(
                            `/AssetItem/history-record/${assignId}`,
                            { skipToast: true },
                        );
                        if (!cancelled) entry = recordRes.data;
                    } catch {
                        entry =
                            historyList.find((row) => String(row?._id) === String(assignId)) || null;
                    }
                }

                setHistoryEntry(entry);
                setShowBodyCondition(shouldShowHandoverReports(entry));
                if (entry) {
                    setAssetHistory((prev) => mergeHistoryEntryIntoList(prev, entry));
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

                    <div ref={approvalHeaderRef} className={`${PAGE_SECTION_ANIMATION} delay-75 scroll-mt-6`}>
                        <VehicleHandoverAssignHeaderCards
                            vehicle={vehicle}
                            historyEntry={historyEntry}
                            assetHistory={handoverAssetHistory}
                            onVehicleUpdated={handleVehicleUpdated}
                            onHistoryUpdated={setHistoryEntry}
                            canApprove={canApprove}
                            isHrStage={isHrReviewStage}
                            onApproveWithFine={openApprovalHandoverFine}
                            canReviewInspection={canReviewInspection}
                            canSubmitInspectionForHr={canSubmitInspectionForHr}
                            onScrollToAssessment={scrollToAssessmentSection}
                        />
                    </div>

                    <AssignPageTabs activeTab={activeTab} onChange={setActiveTab} />

                    {activeTab === 'details' ? (
                        <>
                            <div
                                className={`${workflowPageLayout.rowClassName} ${PAGE_SECTION_ANIMATION} delay-150`}
                            >
                                <div className={workflowPageLayout.mainColumnClassName}>
                                    <VehicleHandoverAssignGrid
                                        historyEntry={historyEntry}
                                        vehicle={vehicle}
                                    />
                                    <div ref={assessmentSectionRef} className="scroll-mt-6">
                                        <VehicleHandoverReceiverAssessmentCard
                                            historyEntry={historyEntry}
                                            vehicle={vehicle}
                                            assetHistory={handoverAssetHistory}
                                            onSaved={handleHistorySaved}
                                            onDone={handleAssessmentDone}
                                            onVehicleUpdated={handleVehicleUpdated}
                                            inspectionHandover={isInspectionHandover}
                                            readOnly={
                                                isInspectionHandover ? inspectionFormReadOnly : reportsReadOnly
                                            }
                                            handoverItemFines={handoverItemFineIndex}
                                            canManageItemFines={canManageItemFines}
                                            isHrApprovalStage={isHrReviewStage}
                                            onOpenItemFine={openHandoverItemFine}
                                        />
                                    </div>
                                </div>

                                <div className={`${workflowPageLayout.sideColumnClassName} flex min-h-0 flex-col`}>
                                    <VehicleHandoverAssignWorkflowPanel
                                        historyEntry={historyEntry}
                                        vehicle={vehicle}
                                        className={`${workflowPageLayout.panelClassName} min-h-full flex-1`}
                                        canApprove={canApprove}
                                        isHrStage={isHrReviewStage}
                                        onApproveWithFine={openApprovalHandoverFine}
                                        onVehicleUpdated={handleVehicleUpdated}
                                        onHistoryUpdated={setHistoryEntry}
                                        onScrollToAssessment={scrollToAssessmentSection}
                                    />
                                </div>
                            </div>

                            {showBodyCondition ? (
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
                                        handoverItemFines={handoverItemFineIndex}
                                        canManageItemFines={canManageItemFines}
                                        isHrApprovalStage={isHrReviewStage}
                                        onOpenItemFine={openHandoverItemFine}
                                    />
                                </div>
                            ) : null}
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
