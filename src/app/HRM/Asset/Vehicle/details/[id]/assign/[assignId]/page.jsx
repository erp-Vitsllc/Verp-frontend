'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
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
import { buildLiveHandoverEntry, isVehicleInspectionHandoverEntry } from '../../../../utils/vehicleHandoverHistory';
import VehicleHandoverAssignHeaderCards from '../../../../components/VehicleHandoverAssignHeaderCards';
import VehicleHandoverAttachmentPanel from '../../../../components/VehicleHandoverAttachmentPanel';
import { VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG } from '../../../../utils/vehicleHandoverAssignWorkflowTrackerConfig';
import { shouldShowBodyConditionSection } from '../../../../utils/vehicleHandoverBodyCondition';
import { useHandoverAssignPermissions } from '../../../../hooks/useHandoverAssignPermissions';

function shouldShowHandoverReports(entry, vehicleData) {
    if (shouldShowBodyConditionSection(entry)) return true;
    if (!isVehicleInspectionHandoverEntry(entry, vehicleData)) return false;

    const inspStatus = String(vehicleData?.vehicleInspectionStatus || '').toLowerCase();
    if (inspStatus === 'pending_hr' || inspStatus === 'active') return true;
    return entry?.details?.bodyConditionCompleted === true;
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
    const [loading, setLoading] = useState(true);
    const [showBodyCondition, setShowBodyCondition] = useState(false);
    const approvalHeaderRef = useRef(null);
    const assessmentSectionRef = useRef(null);

    const {
        canEditReports,
        canApprove,
        canReviewInspection,
        canEditInspectionForm,
        canSubmitInspectionForHr,
        loading: permissionsLoading,
    } = useHandoverAssignPermissions(vehicle, historyEntry);
    const reportsReadOnly = !permissionsLoading && !canEditReports;
    const inspectionFormReadOnly = !permissionsLoading && !canEditInspectionForm;
    const isInspectionHandover = isVehicleInspectionHandoverEntry(historyEntry, vehicle);

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
        } catch {
            /* keep current */
        }
    }, [assignId, vehicleId]);

    const handleHistorySaved = useCallback(
        (entry, options = {}) => {
            setHistoryEntry(entry);
            if (shouldShowHandoverReports(entry, vehicle)) {
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

                let entry = null;
                if (String(assignId).startsWith('live-')) {
                    entry = buildLiveHandoverEntry(vehicleData);
                } else {
                    entry = historyList.find((row) => String(row?._id) === String(assignId));
                    if (!entry) {
                        const recordRes = await axiosInstance.get(`/AssetItem/history-record/${assignId}`);
                        if (!cancelled) entry = recordRes.data;
                    }
                }

                setHistoryEntry(entry);
                setShowBodyCondition(shouldShowHandoverReports(entry, vehicleData));
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
                            onVehicleUpdated={handleVehicleUpdated}
                            onHistoryUpdated={setHistoryEntry}
                            canApprove={canApprove}
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
                                            onSaved={handleHistorySaved}
                                            onDone={handleAssessmentDone}
                                            onVehicleUpdated={handleVehicleUpdated}
                                            inspectionHandover={isInspectionHandover}
                                            readOnly={
                                                isInspectionHandover ? inspectionFormReadOnly : reportsReadOnly
                                            }
                                        />
                                    </div>
                                </div>

                                <div className={`${workflowPageLayout.sideColumnClassName} flex min-h-0 flex-col`}>
                                    <VehicleHandoverAssignWorkflowPanel
                                        historyEntry={historyEntry}
                                        vehicle={vehicle}
                                        className={`${workflowPageLayout.panelClassName} min-h-full flex-1`}
                                    />
                                </div>
                            </div>

                            {showBodyCondition ? (
                                <div className={`mt-6 w-full min-w-0 ${PAGE_SECTION_ANIMATION} delay-300`}>
                                    <VehicleHandoverBodyConditionCard
                                        historyEntry={historyEntry}
                                        vehicle={vehicle}
                                        onSaved={handleHistorySaved}
                                        readOnly={
                                            isInspectionHandover ? inspectionFormReadOnly : reportsReadOnly
                                        }
                                        inspectionHandover={isInspectionHandover}
                                        onVehicleUpdated={handleVehicleUpdated}
                                        onGoToApproval={scrollToApprovalHeader}
                                        onGoToAssessment={scrollToAssessmentSection}
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
