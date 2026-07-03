'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ListReturnBackButton from '@/components/ListReturnBackButton';
import { useListReturnBack } from '@/hooks/useListReturnBack';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Loader2 } from 'lucide-react';
import VehicleAccidentRepairDetailHeaderCards from '@/app/HRM/Asset/Vehicle/components/VehicleAccidentRepairDetailHeaderCards';
import VehicleAccidentRepairDetailForm from '@/app/HRM/Asset/Vehicle/components/VehicleAccidentRepairDetailForm';
import VehicleAccidentRepairGarageCard from '@/app/HRM/Asset/Vehicle/components/VehicleAccidentRepairGarageCard';
import VehicleAccidentRepairReturnCard from '@/app/HRM/Asset/Vehicle/components/VehicleAccidentRepairReturnCard';
import VehicleAccidentRepairPreviousHistoryPanel from '@/app/HRM/Asset/Vehicle/components/VehicleAccidentRepairPreviousHistoryPanel';
import VehicleAccidentRepairDriverHistoryPanel from '@/app/HRM/Asset/Vehicle/components/VehicleAccidentRepairDriverHistoryPanel';
import VehicleAccidentRepairWorkflowPanel from '@/app/HRM/Asset/Vehicle/components/VehicleAccidentRepairWorkflowPanel';
import {
    canUserManageOilService,
    isCurrentUserFlowchartAdminOfficer,
    isOilServiceAssignmentPending,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleOilServiceAccess';
import { pickFlowchartAccountsRow } from '@/app/HRM/Asset/Vehicle/utils/vehicleHandoverAssignWorkflow';
import {
    resolveAccidentRepairWorkflowStage,
    showAccidentRepairGarageCard,
    showAccidentRepairReturnCard,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleAccidentRepairWorkflow';
import { VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG } from '@/app/HRM/Asset/Vehicle/utils/vehicleHandoverAssignWorkflowTrackerConfig';
import { parseStoredSessionUser } from '@/utils/permissions';
import {
    normalizeMongoId,
    parseVehicleServiceRemark,
    vehicleServiceTypeKey,
} from '@/app/HRM/Asset/Vehicle/components/vehicleServiceUtils';

const PAGE_SECTION_ANIMATION =
    'animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both';

const { page: accidentRepairPageLayout } = VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG;

function VehicleAccidentRepairDetailPageContent() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const vehicleId = normalizeMongoId(params?.id);
    const serviceId = normalizeMongoId(params?.serviceId);

    const [asset, setAsset] = useState(null);
    const [loading, setLoading] = useState(true);
    const draftSubmitRef = useRef(null);
    const [draftUi, setDraftUi] = useState({ canRequest: false, requesting: false });
    const [currentUser, setCurrentUser] = useState(null);
    const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState(null);
    const [flowchartRows, setFlowchartRows] = useState([]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const parsed = parseStoredSessionUser();
        setCurrentUser(parsed);
        setCurrentUserEmployeeId(
            String(parsed?.employeeObjectId || parsed?._id || parsed?.id || '').trim() || null,
        );
        axiosInstance
            .get('/Flowchart')
            .then(({ data }) => setFlowchartRows(Array.isArray(data) ? data : []))
            .catch(() => setFlowchartRows([]));
    }, []);

    const handleDraftStateChange = useCallback((next) => {
        setDraftUi((prev) => {
            if (prev.canRequest === next.canRequest && prev.requesting === next.requesting) {
                return prev;
            }
            return next;
        });
    }, []);

    const load = useCallback(async () => {
        if (!vehicleId) return;
        setLoading(true);
        try {
            const response = await axiosInstance.get(`/AssetItem/detail/${vehicleId}`);
            setAsset(response.data || null);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not load accident repair details',
                description: error.response?.data?.message || 'Try again in a moment.',
            });
            setAsset(null);
        } finally {
            setLoading(false);
        }
    }, [toast, vehicleId]);

    useEffect(() => {
        void load();
    }, [load]);

    const service = useMemo(() => {
        const services = Array.isArray(asset?.services) ? asset.services : [];
        return (
            services.find((row) => {
                if (normalizeMongoId(row?._id) !== serviceId) return false;
                return vehicleServiceTypeKey(row) === 'Accident Repair';
            }) || null
        );
    }, [asset?.services, serviceId]);

    const assignmentPending = useMemo(() => {
        const remark = parseVehicleServiceRemark(service) || {};
        return isOilServiceAssignmentPending(remark);
    }, [service]);

    const isFlowchartAdminOfficer = useMemo(
        () => isCurrentUserFlowchartAdminOfficer(currentUser, flowchartRows),
        [currentUser, flowchartRows],
    );

    const canManageAccidentRepair = useMemo(
        () => canUserManageOilService(asset, currentUserEmployeeId, currentUser, isFlowchartAdminOfficer),
        [asset, currentUserEmployeeId, currentUser, isFlowchartAdminOfficer],
    );

    const isFlowchartAccounts = useMemo(() => {
        const accountsRow = pickFlowchartAccountsRow(flowchartRows);
        if (!accountsRow || !currentUser) return false;
        const empRef = accountsRow.empObjectId;
        const rowMongo = typeof empRef === 'object' && empRef ? empRef._id || empRef.id : empRef;
        const myEmpObj = currentUser.employeeObjectId;
        const myDocId = currentUser._id || currentUser.id;
        if (rowMongo) {
            if (myEmpObj && String(rowMongo) === String(myEmpObj)) return true;
            if (myDocId && String(rowMongo) === String(myDocId)) return true;
        }
        const norm = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '');
        const rowCode = norm(accountsRow.employeeId || (typeof empRef === 'object' && empRef?.employeeId) || '');
        const myCode = norm(currentUser.employeeId || '');
        return !!(rowCode && myCode && rowCode === myCode);
    }, [currentUser, flowchartRows]);

    const accidentRepairflowStage = useMemo(
        () => resolveAccidentRepairWorkflowStage(asset, serviceId, service),
        [asset, serviceId, service],
    );

    const handleRequested = useCallback(() => {
        if (typeof draftSubmitRef.current === 'function') {
            void draftSubmitRef.current();
        }
    }, []);

    const handleBack = useListReturnBack(
        useCallback(() => {
            if (vehicleId) {
                router.push(`/HRM/Asset/Vehicle/details/${vehicleId}?tab=service`);
            } else {
                router.push('/HRM/Asset/Vehicle');
            }
        }, [router, vehicleId]),
    );

    if (loading) {
        return (
            <div className="flex min-h-screen w-full bg-[#F2F6F9]">
                <Sidebar />
                <div className="flex-1 flex flex-col">
                    <Navbar />
                    <div className="flex-1 flex flex-col items-stretch justify-start py-8 w-full px-6 md:px-8">
                        <div className="w-full flex items-center justify-between mb-2 print:hidden">
                            <ListReturnBackButton onNavigate={handleBack} />
                        </div>
                        <div className="flex flex-1 items-center justify-center">
                            <div className="flex flex-col items-center gap-3 text-slate-500">
                                <Loader2 className="animate-spin" size={32} />
                                <span className="text-sm font-medium">Loading accident repair details...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!asset || !service) {
        return (
            <div className="flex min-h-screen w-full bg-[#F2F6F9]">
                <Sidebar />
                <div className="flex-1 flex flex-col">
                    <Navbar />
                    <div className="flex-1 flex flex-col items-stretch justify-start py-8 w-full px-6 md:px-8">
                        <div className="w-full flex items-center justify-between mb-2 print:hidden">
                            <ListReturnBackButton onNavigate={handleBack} />
                        </div>
                        <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-100">
                            <ClipboardList className="mx-auto text-gray-300 mb-4" size={56} />
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Accident repair request not found</h2>
                            <p className="text-sm text-gray-500">
                                This request may have been removed or the link is invalid.
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
                    <div className="w-full flex items-center justify-between mb-2 print:hidden">
                        <ListReturnBackButton onNavigate={handleBack} />
                    </div>

                    <VehicleAccidentRepairDetailHeaderCards
                        vehicle={asset}
                        service={service}
                        isDraft={assignmentPending}
                        canEditAssignment={canManageAccidentRepair}
                        canRequest={draftUi.canRequest}
                        requesting={draftUi.requesting}
                        onRequested={handleRequested}
                    />

                    {assignmentPending && !canManageAccidentRepair ? (
                        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            Only the Super User, Admin Officer, or assigned user can complete this accident repair request.
                        </div>
                    ) : null}

                    <div className={`${accidentRepairPageLayout.rowClassName} ${PAGE_SECTION_ANIMATION} delay-150`}>
                        <div className={accidentRepairPageLayout.mainColumnClassName}>
                            <div className="flex flex-col gap-5 w-full">
                                <VehicleAccidentRepairDetailForm
                                    asset={asset}
                                    service={service}
                                    vehicleId={vehicleId}
                                    serviceId={serviceId}
                                    canEditAssignment={canManageAccidentRepair}
                                    onSaved={() => {
                                        void load();
                                    }}
                                    draftSubmitRef={draftSubmitRef}
                                    onDraftStateChange={handleDraftStateChange}
                                    className="w-full shrink-0"
                                />
                                {showAccidentRepairGarageCard(assignmentPending, accidentRepairflowStage) ? (
                                    <VehicleAccidentRepairGarageCard
                                        asset={asset}
                                        service={service}
                                        vehicleId={vehicleId}
                                        serviceId={serviceId}
                                        canManage={canManageAccidentRepair}
                                        canActAccounts={isFlowchartAccounts}
                                        workflowStage={accidentRepairflowStage}
                                        onUpdated={(updatedAsset) => {
                                            if (updatedAsset) setAsset(updatedAsset);
                                            void load();
                                        }}
                                        className="w-full shrink-0"
                                    />
                                ) : null}
                                {showAccidentRepairReturnCard(assignmentPending, accidentRepairflowStage) ? (
                                    <VehicleAccidentRepairReturnCard
                                        asset={asset}
                                        service={service}
                                        vehicleId={vehicleId}
                                        serviceId={serviceId}
                                        canManage={canManageAccidentRepair}
                                        workflowStage={accidentRepairflowStage}
                                        onUpdated={(updatedAsset) => {
                                            if (updatedAsset) setAsset(updatedAsset);
                                            void load();
                                        }}
                                        className="w-full shrink-0"
                                    />
                                ) : null}
                            </div>
                        </div>

                        <div className={`${accidentRepairPageLayout.sideColumnClassName} min-h-0`}>
                            <VehicleAccidentRepairPreviousHistoryPanel
                                asset={asset}
                                service={service}
                                className="shrink-0"
                            />
                            <VehicleAccidentRepairDriverHistoryPanel
                                asset={asset}
                                service={service}
                                className="shrink-0"
                            />
                            <VehicleAccidentRepairWorkflowPanel
                                asset={asset}
                                service={service}
                                className="min-h-[360px] flex-1 shrink-0"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function VehicleAccidentRepairDetailPage() {
    return (
        <PermissionGuard moduleId="hrm_asset_vehicle" redirectTo="/dashboard">
            <Suspense
                fallback={
                    <div className="flex min-h-screen w-full bg-[#F2F6F9] items-center justify-center">
                        <Loader2 className="animate-spin text-slate-400" size={32} />
                    </div>
                }
            >
                <VehicleAccidentRepairDetailPageContent />
            </Suspense>
        </PermissionGuard>
    );
}
