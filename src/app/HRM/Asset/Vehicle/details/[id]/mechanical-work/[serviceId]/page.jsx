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
import VehicleMechanicalWorkDetailHeaderCards from '@/app/HRM/Asset/Vehicle/components/VehicleMechanicalWorkDetailHeaderCards';
import VehicleMechanicalWorkDetailForm from '@/app/HRM/Asset/Vehicle/components/VehicleMechanicalWorkDetailForm';
import VehicleMechanicalWorkQuoteApprovalCard from '@/app/HRM/Asset/Vehicle/components/VehicleMechanicalWorkQuoteApprovalCard';
import VehicleMechanicalWorkGarageCard from '@/app/HRM/Asset/Vehicle/components/VehicleMechanicalWorkGarageCard';
import VehicleMechanicalWorkReturnCard from '@/app/HRM/Asset/Vehicle/components/VehicleMechanicalWorkReturnCard';
import VehicleMechanicalWorkPreviousHistoryPanel from '@/app/HRM/Asset/Vehicle/components/VehicleMechanicalWorkPreviousHistoryPanel';
import VehicleMechanicalWorkDriverHistoryPanel from '@/app/HRM/Asset/Vehicle/components/VehicleMechanicalWorkDriverHistoryPanel';
import VehicleMechanicalWorkWorkflowPanel from '@/app/HRM/Asset/Vehicle/components/VehicleMechanicalWorkWorkflowPanel';
import {
    canUserManageOilService,
    isCurrentUserFlowchartAdminOfficer,
    isOilServiceAssignmentPending,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleOilServiceAccess';
import { pickFlowchartHrRow, pickFlowchartAccountsRow } from '@/app/HRM/Asset/Vehicle/utils/vehicleHandoverAssignWorkflow';
import {
    resolveMechanicalWorkWorkflowStage,
    showMechanicalWorkGarageCard,
    showMechanicalWorkQuoteCard,
    showMechanicalWorkReturnCard,
    MECHANICAL_WORK_WORKFLOW_STAGES,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleMechanicalWorkWorkflow';
import { VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG } from '@/app/HRM/Asset/Vehicle/utils/vehicleHandoverAssignWorkflowTrackerConfig';
import { parseStoredSessionUser } from '@/utils/permissions';
import {
    normalizeMongoId,
    parseVehicleServiceRemark,
    vehicleServiceTypeKey,
} from '@/app/HRM/Asset/Vehicle/components/vehicleServiceUtils';

const PAGE_SECTION_ANIMATION =
    'animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both';

const { page: mechanicalWorkPageLayout } = VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG;

function VehicleMechanicalWorkDetailPageContent() {
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
                title: 'Could not load mechanical work details',
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
                return vehicleServiceTypeKey(row) === 'Mechanical Work';
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

    const canManageMechanicalWork = useMemo(
        () => canUserManageOilService(asset, currentUserEmployeeId, currentUser, isFlowchartAdminOfficer),
        [asset, currentUserEmployeeId, currentUser, isFlowchartAdminOfficer],
    );

    const isFlowchartHr = useMemo(() => {
        const hrRow = pickFlowchartHrRow(flowchartRows);
        if (!hrRow || !currentUser) return false;
        const empRef = hrRow.empObjectId;
        const rowMongo = typeof empRef === 'object' && empRef ? empRef._id || empRef.id : empRef;
        const myEmpObj = currentUser.employeeObjectId;
        const myDocId = currentUser._id || currentUser.id;
        if (rowMongo) {
            if (myEmpObj && String(rowMongo) === String(myEmpObj)) return true;
            if (myDocId && String(rowMongo) === String(myDocId)) return true;
        }
        const norm = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '');
        const rowCode = norm(hrRow.employeeId || (typeof empRef === 'object' && empRef?.employeeId) || '');
        const myCode = norm(currentUser.employeeId || '');
        return !!(rowCode && myCode && rowCode === myCode);
    }, [currentUser, flowchartRows]);

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

    const mechanicalWorkflowStage = useMemo(
        () => resolveMechanicalWorkWorkflowStage(asset, serviceId, service),
        [asset, serviceId, service],
    );

    const canRespondToMechanicalWorkflow = useMemo(() => {
        if (!asset || mechanicalWorkflowStage !== MECHANICAL_WORK_WORKFLOW_STAGES.HR) return false;
        return asset.canRespondToServiceWorkflow === true;
    }, [asset, mechanicalWorkflowStage]);

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
                                <span className="text-sm font-medium">Loading mechanical work details...</span>
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
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Mechanical work request not found</h2>
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

                    <VehicleMechanicalWorkDetailHeaderCards
                        vehicle={asset}
                        service={service}
                        isDraft={assignmentPending}
                        canEditAssignment={canManageMechanicalWork}
                        canRequest={draftUi.canRequest}
                        requesting={draftUi.requesting}
                        onRequested={handleRequested}
                    />

                    {assignmentPending && !canManageMechanicalWork ? (
                        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            Only the Super User, Admin Officer, or assigned user can complete this mechanical work request.
                        </div>
                    ) : null}

                    <div className={`${mechanicalWorkPageLayout.rowClassName} ${PAGE_SECTION_ANIMATION} delay-150`}>
                        <div className={mechanicalWorkPageLayout.mainColumnClassName}>
                            <div className="flex flex-col gap-5 w-full">
                                <VehicleMechanicalWorkDetailForm
                                    asset={asset}
                                    service={service}
                                    vehicleId={vehicleId}
                                    serviceId={serviceId}
                                    canEditAssignment={canManageMechanicalWork}
                                    onSaved={() => {
                                        void load();
                                    }}
                                    draftSubmitRef={draftSubmitRef}
                                    onDraftStateChange={handleDraftStateChange}
                                    className="w-full shrink-0"
                                />
                                {!assignmentPending && showMechanicalWorkQuoteCard(assignmentPending) ? (
                                    <VehicleMechanicalWorkQuoteApprovalCard
                                        asset={asset}
                                        service={service}
                                        vehicleId={vehicleId}
                                        serviceId={serviceId}
                                        canActHr={isFlowchartHr}
                                        canRespondToWorkflow={canRespondToMechanicalWorkflow}
                                        canManageMechanicalWork={canManageMechanicalWork}
                                        workflowStage={mechanicalWorkflowStage}
                                        onUpdated={(updatedAsset) => {
                                            if (updatedAsset) {
                                                setAsset(updatedAsset);
                                            }
                                            void load();
                                        }}
                                        className="w-full shrink-0"
                                    />
                                ) : null}
                                {showMechanicalWorkGarageCard(assignmentPending, mechanicalWorkflowStage) ? (
                                    <VehicleMechanicalWorkGarageCard
                                        asset={asset}
                                        service={service}
                                        vehicleId={vehicleId}
                                        serviceId={serviceId}
                                        canManage={canManageMechanicalWork}
                                        canActAccounts={isFlowchartAccounts}
                                        workflowStage={mechanicalWorkflowStage}
                                        onUpdated={(updatedAsset) => {
                                            if (updatedAsset) setAsset(updatedAsset);
                                            void load();
                                        }}
                                        className="w-full shrink-0"
                                    />
                                ) : null}
                                {showMechanicalWorkReturnCard(assignmentPending, mechanicalWorkflowStage) ? (
                                    <VehicleMechanicalWorkReturnCard
                                        asset={asset}
                                        service={service}
                                        vehicleId={vehicleId}
                                        serviceId={serviceId}
                                        canManage={canManageMechanicalWork}
                                        workflowStage={mechanicalWorkflowStage}
                                        onUpdated={(updatedAsset) => {
                                            if (updatedAsset) setAsset(updatedAsset);
                                            void load();
                                        }}
                                        className="w-full shrink-0"
                                    />
                                ) : null}
                            </div>
                        </div>

                        <div className={`${mechanicalWorkPageLayout.sideColumnClassName} min-h-0`}>
                            <VehicleMechanicalWorkPreviousHistoryPanel
                                asset={asset}
                                service={service}
                                className="shrink-0"
                            />
                            <VehicleMechanicalWorkDriverHistoryPanel
                                asset={asset}
                                service={service}
                                className="shrink-0"
                            />
                            <VehicleMechanicalWorkWorkflowPanel
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

export default function VehicleMechanicalWorkDetailPage() {
    return (
        <PermissionGuard moduleId="hrm_asset_vehicle" redirectTo="/dashboard">
            <Suspense
                fallback={
                    <div className="flex min-h-screen w-full bg-[#F2F6F9] items-center justify-center">
                        <Loader2 className="animate-spin text-slate-400" size={32} />
                    </div>
                }
            >
                <VehicleMechanicalWorkDetailPageContent />
            </Suspense>
        </PermissionGuard>
    );
}
