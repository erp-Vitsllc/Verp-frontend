'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ListReturnBackButton from '@/components/ListReturnBackButton';
import { useListReturnBack } from '@/hooks/useListReturnBack';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Loader2 } from 'lucide-react';
import VehicleOilServiceDetailHeaderCards from '@/app/HRM/Asset/Vehicle/components/VehicleOilServiceDetailHeaderCards';
import VehicleOilServiceDetailForm from '@/app/HRM/Asset/Vehicle/components/VehicleOilServiceDetailForm';
import VehicleOilServiceScheduleCard from '@/app/HRM/Asset/Vehicle/components/VehicleOilServiceScheduleCard';
import VehicleOilServiceWorkflowPanel from '@/app/HRM/Asset/Vehicle/components/VehicleOilServiceWorkflowPanel';
import VehicleServiceAttachmentsPanel from '@/app/HRM/Asset/Vehicle/components/VehicleServiceAttachmentsPanel';
import VehicleOilServicePreviousHistoryPanel from '@/app/HRM/Asset/Vehicle/components/VehicleOilServicePreviousHistoryPanel';
import VehicleOilServiceDetailsPanel from '@/app/HRM/Asset/Vehicle/components/VehicleOilServiceDetailsPanel';
import VehicleOilCashPaymentApprovalCard from '@/app/HRM/Asset/Vehicle/components/VehicleOilCashPaymentApprovalCard';
import { isPortalSuperUser, parseStoredSessionUser } from '@/utils/permissions';
import {
    canUserManageOilService,
    canUserCreateOrInitiateVehicleService,
    canUserEditOilServiceDates,
    canUserEditShopSchedule,
    isCurrentUserFlowchartAdminOfficer,
    isOilServiceAssignmentPending,
    resolveOilServiceWorkflowStage,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleOilServiceAccess';
import { canEditVehicleServiceInitiate } from '@/app/HRM/Asset/Vehicle/utils/vehicleServiceInitiateEditAccess';
import { VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG } from '@/app/HRM/Asset/Vehicle/utils/vehicleHandoverAssignWorkflowTrackerConfig';
import {
    readWarmVehicleDetail,
    writeWarmVehicleDetail,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleDetailWarmCache';
import { fetchFlowchartRows } from '@/utils/flowchartRowsCache';
import {
    buildOilServiceScheduleRowFromAsset,
    normalizeMongoId,
    parseVehicleServiceRemark,
    vehicleServiceTypeKey,
} from '@/app/HRM/Asset/Vehicle/components/vehicleServiceUtils';
import {
    pickFlowchartAccountsRow,
    pickFlowchartHrRow,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleHandoverAssignWorkflow';

const PAGE_SECTION_ANIMATION =
    'animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both';

const { page: oilServicePageLayout } = VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG;

function VehicleOilServiceDetailPageContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const vehicleId = normalizeMongoId(params?.id);
    const serviceId = normalizeMongoId(params?.serviceId);
    const focusPayment = String(searchParams?.get('focus') || '').trim().toLowerCase() === 'payment';

    const [asset, setAsset] = useState(() => readWarmVehicleDetail(vehicleId) || null);
    const [loading, setLoading] = useState(() => !readWarmVehicleDetail(vehicleId));
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
        fetchFlowchartRows()
            .then((rows) => setFlowchartRows(rows))
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

    const load = useCallback(async ({ silent = false, light = false, deferServiceSigning = false } = {}) => {
        if (!vehicleId) return;
        if (!silent) setLoading(true);
        try {
            const params = {};
            if (light) params.light = 1;
            if (deferServiceSigning) {
                params.deferServiceSigning = 1;
            }
            // Always pass serviceId so backend can slim payload / focus signing.
            if (serviceId) params.serviceId = serviceId;
            const response = await axiosInstance.get(`/AssetItem/detail/${vehicleId}`, {
                params: Object.keys(params).length ? params : undefined,
            });
            const next = response.data || null;
            if (next?._id) writeWarmVehicleDetail(vehicleId, next);
            setAsset(next);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not load oil service details',
                description: error.response?.data?.message || 'Try again in a moment.',
            });
            if (!silent) setAsset(null);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [toast, vehicleId, serviceId]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            // If notification hover already warmed light detail, paint immediately then upgrade.
            const warm = readWarmVehicleDetail(vehicleId);
            if (warm && !cancelled) {
                setAsset(warm);
                setLoading(false);
                void load({ silent: true, deferServiceSigning: true });
                return;
            }
            await load({ light: true });
            if (cancelled) return;
            void load({ silent: true, deferServiceSigning: true });
        })();
        return () => {
            cancelled = true;
        };
    }, [load, vehicleId]);

    const refreshAfterMutation = useCallback(
        (updatedAsset) => {
            if (updatedAsset?._id) {
                writeWarmVehicleDetail(vehicleId, updatedAsset);
                setAsset(updatedAsset);
                return;
            }
            void load({ silent: true, deferServiceSigning: true });
        },
        [load, vehicleId],
    );

    const service = useMemo(() => {
        const services = Array.isArray(asset?.services) ? asset.services : [];
        return (
            services.find((row) => {
                if (normalizeMongoId(row?._id) !== serviceId) return false;
                return vehicleServiceTypeKey(row) === 'Oil Service';
            }) || null
        );
    }, [asset?.services, serviceId]);

    const scheduleRow = useMemo(() => {
        if (!asset || !service) return null;
        return buildOilServiceScheduleRowFromAsset(asset, { service });
    }, [asset, service]);

    const assignmentPending = useMemo(() => {
        const remark = parseVehicleServiceRemark(service) || {};
        return isOilServiceAssignmentPending(remark);
    }, [service]);

    const isFlowchartAdminOfficer = useMemo(
        () => isCurrentUserFlowchartAdminOfficer(currentUser, flowchartRows),
        [currentUser, flowchartRows],
    );

    /** Schedule + Complete Service — Admin / Admin Officer / Asset Controller / super user. */
    const canAdminOilSteps = useMemo(
        () => canUserEditShopSchedule(currentUser, flowchartRows),
        [currentUser, flowchartRows],
    );

    const canManageOilService = useMemo(
        () =>
            canUserManageOilService(asset, currentUserEmployeeId, currentUser, isFlowchartAdminOfficer, {
                flowchartRows,
            }),
        [asset, currentUserEmployeeId, currentUser, isFlowchartAdminOfficer, flowchartRows],
    );

    const canCreateOrInitiate = useMemo(
        () => canUserCreateOrInitiateVehicleService(asset, currentUser),
        [asset, currentUser],
    );



    const canEditServiceDates = useMemo(
        () =>
            canUserEditOilServiceDates(asset, service, {
                isFlowchartAdminOfficer,
                currentUser,
                currentUserEmployeeId,
                flowchartRows,
            }),
        [asset, service, isFlowchartAdminOfficer, currentUser, currentUserEmployeeId, flowchartRows],
    );

    const oilWorkflowStage = useMemo(
        () => resolveOilServiceWorkflowStage(service, asset),
        [service, asset],
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
        const rowCode = norm(
            accountsRow.employeeId || (typeof empRef === 'object' && empRef?.employeeId) || '',
        );
        const myCode = norm(currentUser.employeeId || '');
        return !!(rowCode && myCode && rowCode === myCode);
    }, [currentUser, flowchartRows]);

    /** Draft: create/initiate actors. After Send until Zoho billed: flowchart HR only. */
    const canEditAssignment = canEditVehicleServiceInitiate({
        assignmentPending,
        canCreateOrInitiate,
        isFlowchartHr,
        service,
        asset,
    });


    const handleRequested = useCallback(() => {
        if (typeof draftSubmitRef.current === 'function') {
            void draftSubmitRef.current();
        }
    }, []);

    useEffect(() => {
        if (!focusPayment || loading) return;
        const t = setTimeout(() => {
            const el = document.getElementById('oil-service-make-payment-panel');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 350);
        return () => clearTimeout(t);
    }, [focusPayment, loading, serviceId, vehicleId]);

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
                                <span className="text-sm font-medium">Loading oil service details...</span>
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
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Oil service request not found</h2>
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

                    <VehicleOilServiceDetailHeaderCards
                        vehicle={asset}
                        service={service}
                        isDraft={assignmentPending}
                        canEditAssignment={canEditAssignment}
                        canRequest={draftUi.canRequest}
                        requesting={draftUi.requesting}
                        onRequested={handleRequested}
                    />

                    {assignmentPending && !canCreateOrInitiate ? (
                        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            Sign in to complete and initiate this oil service request.
                        </div>
                    ) : null}

                    {!assignmentPending && !canAdminOilSteps && !isFlowchartHr && !isFlowchartAccounts ? (
                        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            Schedule, Reschedule, and Complete Service are actioned by the flowchart Admin
                            Officer. HR and Accounts handle their approval and payment steps.
                        </div>
                    ) : null}

                    <div
                        className={`${oilServicePageLayout.rowClassName} ${PAGE_SECTION_ANIMATION} delay-150`}
                    >
                        <div className={oilServicePageLayout.mainColumnClassName}>
                            <VehicleOilServiceDetailForm
                                asset={asset}
                                service={service}
                                scheduleRow={scheduleRow}
                                vehicleId={vehicleId}
                                serviceId={serviceId}
                                canEditAssignment={canEditAssignment}
                                workflowStage={oilWorkflowStage}
                                canEditServiceDates={canEditServiceDates}
                                onSaved={refreshAfterMutation}
                                draftSubmitRef={draftSubmitRef}
                                onDraftStateChange={handleDraftStateChange}
                                flowchartRows={flowchartRows}
                                className="w-full shrink-0"
                            />

                            <VehicleOilServiceScheduleCard
                                asset={asset}
                                service={service}
                                vehicleId={vehicleId}
                                serviceId={serviceId}
                                canManage={canAdminOilSteps}
                                onUpdated={refreshAfterMutation}
                                className="w-full shrink-0"
                            />

                            {/* Approve Service: HR Approval | Accounts Approve */}
                            <VehicleOilCashPaymentApprovalCard
                                mode="approvals"
                                asset={asset}
                                service={service}
                                vehicleId={vehicleId}
                                serviceId={serviceId}
                                canActHr={isFlowchartHr}
                                canActAccounts={isFlowchartAccounts}
                                workflowStage={oilWorkflowStage}
                                onUpdated={refreshAfterMutation}
                                className="w-full shrink-0"
                            />

                            <VehicleOilServiceDetailsPanel
                                asset={asset}
                                service={service}
                                vehicleId={vehicleId}
                                serviceId={serviceId}
                                canManage={canAdminOilSteps}
                                onUpdated={refreshAfterMutation}
                            />

                            {/* Make Payment: Accounts Zoho bill (unlocks at pending_accounts) */}
                            <div
                                id="oil-service-make-payment-panel"
                                className={
                                    focusPayment
                                        ? 'w-full shrink-0 scroll-mt-24 rounded-xl ring-2 ring-blue-400/70 ring-offset-2'
                                        : 'w-full shrink-0 scroll-mt-24'
                                }
                            >
                                <VehicleOilCashPaymentApprovalCard
                                    mode="payment"
                                    asset={asset}
                                    service={service}
                                    vehicleId={vehicleId}
                                    serviceId={serviceId}
                                    canActHr={isFlowchartHr}
                                    canActAccounts={isFlowchartAccounts}
                                    workflowStage={oilWorkflowStage}
                                    onUpdated={refreshAfterMutation}
                                    className="w-full shrink-0"
                                />
                            </div>
                        </div>

                        <div className={oilServicePageLayout.sideColumnClassName}>
                            <VehicleOilServicePreviousHistoryPanel
                                asset={asset}
                                service={service}
                                className="shrink-0"
                            />

                            <VehicleOilServiceWorkflowPanel
                                asset={asset}
                                service={service}
                                flowchartRows={flowchartRows}
                                className="min-h-[320px] flex-1"
                            />

                            <VehicleServiceAttachmentsPanel
                                service={service}
                                className="shrink-0"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function VehicleOilServiceDetailPage() {
    return (
        <PermissionGuard moduleId="hrm_asset_vehicle" redirectTo="/dashboard">
            <Suspense
                fallback={
                    <div className="flex min-h-screen w-full bg-[#F2F6F9] items-center justify-center">
                        <Loader2 className="animate-spin text-slate-400" size={32} />
                    </div>
                }
            >
                <VehicleOilServiceDetailPageContent />
            </Suspense>
        </PermissionGuard>
    );
}
