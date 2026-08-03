import { isPortalSuperUser } from '@/utils/permissions';
import { isCurrentUserVehicleAssignee } from './evaluateVehicleFleetHeaderActions';
import { pickFlowchartAdminRow, pickFlowchartHrRow, pickFlowchartAccountsRow } from './vehicleHandoverAssignWorkflow';
import { normalizeMongoId, parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import {
    isShopWorkServiceLive,
    isShopWorkScheduledWaiting,
    isShopWorkServiceRecord,
    resolveShopWorkTableStatusLabel,
} from './vehicleShopWorkStatus';

const normEmpId = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '');

/** Active workflow stage for a specific oil service row. */
export function resolveOilServiceWorkflowStage(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const serviceId = normalizeMongoId(service?._id);
    const wf = asset?.activeServiceWorkflow || {};
    const wfMatch = serviceId && normalizeMongoId(wf.serviceRecordId) === serviceId;

    const remarkStage = String(remark.workflowStage || remark.stage || '')
        .toLowerCase()
        .trim();
    const billingStatus = String(remark.billingStatus || '')
        .toLowerCase()
        .trim();

    // Billed is final — never keep showing Accounts from a stale snapshot/wf stage.
    if (remarkStage === 'billed' || billingStatus === 'billed' || String(remark.zohoBillId || '').trim()) {
        return 'billed';
    }

    return String(
        (wfMatch ? wf.stage : '') ||
            service?.workflowSnapshot?.stage ||
            remarkStage ||
            '',
    )
        .toLowerCase()
        .trim();
}

function isOilServiceWorkflowMatch(service, asset) {
    const serviceId = normalizeMongoId(service?._id);
    const wf = asset?.activeServiceWorkflow || {};
    return serviceId && normalizeMongoId(wf.serviceRecordId) === serviceId;
}

/** True once the scheduled start date has been reached and the vehicle is on service. */
export function isOilServiceLive(service, asset) {
    if (isShopWorkServiceRecord(service)) {
        return isShopWorkServiceLive(service, asset);
    }

    const remark = parseVehicleServiceRemark(service) || {};
    const wf = asset?.activeServiceWorkflow || {};
    const stage = resolveOilServiceWorkflowStage(service, asset);

    if (
        stage === 'complete' ||
        stage === 'billed' ||
        stage === 'pending_hr' ||
        stage === 'pending_accounts' ||
        stage === 'rejected'
    ) {
        return false;
    }

    if (!isOilServiceWorkflowMatch(service, asset)) {
        return String(remark.oilServiceLiveAt || '').trim().length > 0;
    }
    if (wf.oilServiceLiveAt || remark.oilServiceLiveAt) return true;
    if (asset?.onServiceActive === true && String(wf.stage || '').toLowerCase() === 'scheduled_service') {
        return true;
    }
    return false;
}

/** Assignment sent but waiting for the service start date (Oil only; shop work uses isShopWorkScheduledWaiting). */
export function isOilServiceScheduledWaiting(service, asset) {
    if (isShopWorkServiceRecord(service)) {
        return isShopWorkScheduledWaiting(service, asset);
    }

    const remark = parseVehicleServiceRemark(service) || {};
    const requestStatus = String(remark.requestStatus || '').toLowerCase();
    if (requestStatus !== 'submitted') return false;
    const stage = resolveOilServiceWorkflowStage(service, asset);
    // Ready/On-Service window is only after schedule is approved through to scheduled_service.
    if (stage !== 'scheduled_service') return false;
    const isCash = String(remark.amountMode || '').toLowerCase() !== 'warranty';
    if (isCash && !String(remark.accountsQuoteApprovedAt || '').trim()) {
        return false;
    }
    return !isOilServiceLive(service, asset);
}

/** Alias: approvals done, start date not yet reached. */
export function isOilServiceReadyToService(service, asset) {
    return isOilServiceScheduledWaiting(service, asset);
}

export function isOilServiceDetailsEnabled(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const stage = resolveOilServiceWorkflowStage(service, asset);
    if (stage === 'complete' || String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live') {
        return true;
    }
    if (stage === 'rejected') return false;
    return isOilServiceCompleteUnlocked(service, asset);
}

/** Header / summary badge for oil service detail page. */
export function resolveOilServiceHeaderStatus(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const requestStatus = String(remark.requestStatus || '').toLowerCase();
    const stage = resolveOilServiceWorkflowStage(service, asset);
    const vehicleServiceDone = String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live';

    if (stage === 'billed' || String(remark.billingStatus || '').toLowerCase() === 'billed') {
        return {
            label: 'Billed',
            boxClass: 'bg-emerald-50 border-emerald-100 text-emerald-700',
        };
    }
    if (stage === 'pending_accounts' && vehicleServiceDone) {
        return {
            label: 'Complete — awaiting billing',
            boxClass: 'bg-amber-50 border-amber-100 text-amber-800',
        };
    }
    if (stage === 'complete' || vehicleServiceDone) {
        return {
            label: 'Complete',
            boxClass: 'bg-emerald-50 border-emerald-100 text-emerald-700',
        };
    }
    if (stage === 'rejected') {
        return {
            label: 'Rejected',
            boxClass: 'bg-slate-50 border-slate-100 text-slate-600',
        };
    }
    if (requestStatus === 'draft' || requestStatus === 'pending') {
        return {
            label: 'Request Initiated',
            boxClass: 'bg-blue-50 border-blue-100 text-blue-700',
        };
    }
    if (isOilServiceScheduledWaiting(service, asset)) {
        return {
            label: 'Ready to Service',
            boxClass: 'bg-violet-50 border-violet-100 text-violet-700',
        };
    }
    if (isOilServiceLive(service, asset) || requestStatus === 'submitted') {
        return {
            label: 'On Service',
            boxClass: 'bg-amber-50 border-amber-100 text-amber-700',
        };
    }

    return {
        label: 'Pending',
        boxClass: 'bg-amber-50 border-amber-100 text-amber-700',
    };
}

/** Approval-stage label shown beside service date on oil service detail header. */
export function resolveOilServiceApprovalStageLabel(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const requestStatus = String(remark.requestStatus || '').toLowerCase();
    const stage = resolveOilServiceWorkflowStage(service, asset);
    const vehicleServiceDone = String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live';

    if (requestStatus === 'draft' || requestStatus === 'pending') {
        return 'Request Initiated';
    }
    if (stage === 'complete' || vehicleServiceDone) {
        return 'Complete';
    }
    if (stage === 'pending_hr') {
        return 'Awaiting HR (Cash)';
    }
    if (stage === 'scheduled_service') {
        const isCash = String(remark.amountMode || '').toLowerCase() !== 'warranty';
        if (isCash && !String(remark.accountsQuoteApprovedAt || '').trim()) {
            return 'Awaiting Accounts (Cash)';
        }
    }
    if (stage === 'pending_accounts') {
        return 'Awaiting Accounts (Cash)';
    }
    if (stage === 'rejected') {
        return 'Rejected';
    }
    if (isOilServiceScheduledWaiting(service, asset)) {
        return 'Ready to Service';
    }
    if (isOilServiceLive(service, asset) || requestStatus === 'submitted') {
        return remark.serviceDetailsDraft ? 'Service Details (draft)' : 'On Service';
    }

    return '—';
}

/** Service tab table label for an oil service request row. */
export function resolveOilServiceTableStatusLabel(service, asset) {
    if (isShopWorkServiceRecord(service)) {
        return resolveShopWorkTableStatusLabel(service, asset);
    }

    const remark = parseVehicleServiceRemark(service) || {};
    const requestStatus = String(remark.requestStatus || '').toLowerCase();
    const stage = resolveOilServiceWorkflowStage(service, asset);
    const vehicleServiceDone = String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live';

    if (requestStatus === 'draft') {
        return { label: 'Draft', tone: 'draft' };
    }
    if (requestStatus === 'pending') {
        return { label: 'Request Initiated', tone: 'pending' };
    }
    if (stage === 'billed' || String(remark.billingStatus || '').toLowerCase() === 'billed') {
        return { label: 'Billed', tone: 'complete' };
    }
    if (stage === 'complete' || vehicleServiceDone) {
        return { label: 'Complete', tone: 'complete' };
    }
    if (stage === 'pending_hr') {
        return { label: 'Awaiting HR', tone: 'pending' };
    }
    if (stage === 'scheduled_service') {
        const isCash = String(remark.amountMode || '').toLowerCase() !== 'warranty';
        if (isCash && !String(remark.accountsQuoteApprovedAt || '').trim()) {
            return { label: 'Awaiting Accounts', tone: 'pending' };
        }
    }
    if (stage === 'pending_accounts') {
        return { label: 'Awaiting Payment', tone: 'pending' };
    }
    if (stage === 'rejected') {
        return { label: 'Rejected', tone: 'rejected' };
    }
    if (isOilServiceScheduledWaiting(service, asset)) {
        return { label: 'Ready to Service', tone: 'scheduled' };
    }
    if (isOilServiceLive(service, asset) || requestStatus === 'submitted') {
        return { label: 'On Service', tone: 'working' };
    }

    return { label: 'Pending', tone: 'pending' };
}

export function isOilServiceAssignmentPending(remark = {}) {
    const status = String(remark?.requestStatus || '').toLowerCase();
    return status === 'draft' || status === 'pending';
}

export function isOilServiceAssignmentSubmitted(remark = {}) {
    return String(remark?.requestStatus || '').toLowerCase() === 'submitted';
}

/** Garage + dates must be filled before Schedule is considered complete (tracker tick). */
export function isOilServiceScheduleFieldsComplete(remark = {}) {
    const garage = String(remark?.garageName || remark?.vendorName || '').trim();
    const location = String(remark?.garageLocation || '').trim();
    const contact = String(remark?.garageContact || '').trim();
    const start = String(remark?.serviceStartDate || remark?.scheduledServiceDate || '').trim();
    const end = String(remark?.serviceEndDate || remark?.nextChangeMonth || '').trim();
    return Boolean(garage && location && contact && start && end);
}

/** Admin Schedule OK + all required schedule fields. */
export function isOilServiceScheduleStepComplete(remark = {}) {
    return isOilServiceAssignmentSubmitted(remark) && isOilServiceScheduleFieldsComplete(remark);
}

/** Initiate Service Send completed (before Schedule OK / submit-request). */
export function isOilServiceInitiated(remark = {}) {
    if (isOilServiceAssignmentSubmitted(remark)) return true;
    return Boolean(String(remark?.oilServiceInitiatedAt || '').trim());
}

/** Schedule card is editable after initiate, before workflow submit. */
export function isOilServiceAwaitingSchedule(remark = {}) {
    return isOilServiceInitiated(remark) && !isOilServiceAssignmentSubmitted(remark);
}

export function isOilServiceCompleteUnlocked(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const stage = resolveOilServiceWorkflowStage(service, asset);
    if (stage === 'complete' || stage === 'billed' || stage === 'pending_accounts') return true;
    if (String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live') return true;

    if (!isOilServiceLive(service, asset)) return false;
    if (!isOilServiceScheduleStepComplete(remark)) return false;
    const isCash = String(remark.amountMode || '').toLowerCase() !== 'warranty';
    if (isCash && !String(remark.accountsQuoteApprovedAt || '').trim()) return false;
    return true;
}

/** Card keys for sequential unlock (approve current → next opens). */
export const OIL_SERVICE_CARD = {
    SCHEDULE: 'schedule',
    HR: 'hr',
    ACCOUNTS: 'accounts',
    EXTEND: 'extend',
    COMPLETE: 'complete',
    PAYMENT: 'payment',
};

const CASH_ONLY_MESSAGE =
    'Cash payment type only — switch Payment Type to Cash on Initiate Service';

/**
 * Sequential card gate: each card stays locked until the previous step is done.
 * Cash: Anyone Initiate → Admin Schedule + HR open together → Accounts (after HR once)
 *       → Ready/On Service → Admin Complete (On Service + schedule once + Accounts)
 *       → Accounts Make Payment (Zoho) — no separate Billed track step
 * Warranty: Anyone Initiate → Admin Officer Schedule → Ready/On Service → Complete
 */
export function resolveOilServiceCardGate(service, asset, cardKey) {
    const remark = parseVehicleServiceRemark(service) || {};
    const stage = resolveOilServiceWorkflowStage(service, asset);
    const isCash = String(remark.amountMode || '').toLowerCase() !== 'warranty';
    const initiated = isOilServiceInitiated(remark);
    const scheduleComplete = isOilServiceScheduleStepComplete(remark);
    const hrDone = Boolean(String(remark.hrScheduleApprovedAt || remark.hrPaymentApprovedAt || '').trim());
    const accountsDone =
        !isCash || Boolean(String(remark.accountsQuoteApprovedAt || '').trim());
    const workComplete =
        stage === 'pending_accounts' ||
        stage === 'billed' ||
        stage === 'complete' ||
        String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live';
    const isBilled =
        stage === 'billed' ||
        String(remark.billingStatus || '').toLowerCase() === 'billed' ||
        Boolean(String(remark.zohoBillId || '').trim());
    const onServiceLive = isOilServiceLive(service, asset);

    switch (cardKey) {
        case OIL_SERVICE_CARD.SCHEDULE: {
            if (!initiated) {
                return { locked: true, message: 'Complete Initiate Service and click Send first' };
            }
            if (workComplete || isBilled || stage === 'rejected') {
                return {
                    locked: true,
                    message: 'Schedule locked — this service is complete or billed',
                };
            }
            // Admin Officer can edit anytime after initiate until Complete Service.
            return { locked: false, message: '', active: true, done: scheduleComplete };
        }
        case OIL_SERVICE_CARD.HR: {
            if (!isCash) return { locked: true, message: CASH_ONLY_MESSAGE };
            if (!initiated) {
                return {
                    locked: true,
                    message: 'Complete Initiate Service first — Schedule and HR open together',
                };
            }
            if (!scheduleComplete) {
                return {
                    locked: true,
                    message: 'Admin must complete Schedule and Reschedule first',
                    done: false,
                };
            }
            return {
                locked: false,
                message: '',
                active: !hrDone && stage !== 'rejected',
                done: hrDone,
            };
        }
        case OIL_SERVICE_CARD.ACCOUNTS: {
            if (!isCash) return { locked: true, message: CASH_ONLY_MESSAGE };
            if (!scheduleComplete) {
                return {
                    locked: true,
                    message: 'Admin must complete Schedule and Reschedule first',
                    done: false,
                };
            }
            if (!hrDone) {
                return { locked: true, message: 'Complete HR Approval first (HR once)' };
            }
            return {
                locked: false,
                message: '',
                active: !accountsDone && !isBilled && stage !== 'rejected',
                done: accountsDone,
            };
        }
        case OIL_SERVICE_CARD.EXTEND: {
            if (!scheduleComplete) {
                return { locked: true, message: 'Complete Schedule and Reschedule Service first' };
            }
            if (workComplete || isBilled || stage === 'rejected') {
                return {
                    locked: true,
                    message: 'Extend Date locked — this service is complete or billed',
                };
            }
            return { locked: false, message: '', active: true, done: false };
        }
        case OIL_SERVICE_CARD.COMPLETE: {
            if (!scheduleComplete) {
                return {
                    locked: true,
                    message: 'Admin must complete Schedule and Reschedule at least once',
                };
            }
            if (isCash && !accountsDone) {
                return { locked: true, message: 'Complete Accounts Approve first' };
            }
            if (workComplete && (stage === 'pending_accounts' || stage === 'billed' || stage === 'complete')) {
                return { locked: false, message: '', active: false, done: true };
            }
            if (stage === 'rejected') {
                return { locked: false, message: '', active: false, done: false };
            }
            if (!onServiceLive) {
                return {
                    locked: true,
                    message: 'Unlocks at On Service (after Accounts Approve)',
                };
            }
            return { locked: false, message: '', active: true, done: false };
        }
        case OIL_SERVICE_CARD.PAYMENT: {
            if (!isCash) return { locked: true, message: CASH_ONLY_MESSAGE };
            if (isBilled) {
                return { locked: true, message: 'Zoho bill already created — payment done' };
            }
            if (stage !== 'pending_accounts') {
                return {
                    locked: true,
                    message: 'Complete Service first — then Make Payment unlocks',
                };
            }
            return { locked: false, message: '', active: true, done: false };
        }
        default:
            return { locked: true, message: 'Unavailable' };
    }
}

export function isCurrentUserFlowchartAdminOfficer(currentUser, flowchartRows = []) {
    if (!currentUser) return false;
    const adminRow = pickFlowchartAdminRow(flowchartRows);
    if (!adminRow) return false;
    return flowchartRowMatchesUser(adminRow, currentUser);
}

function flowchartRowMatchesUser(row, currentUser) {
    if (!row || !currentUser) return false;
    const empRef = row.empObjectId;
    const rowMongo =
        typeof empRef === 'object' && empRef ? empRef._id || empRef.id : empRef;
    const myEmpObj = currentUser.employeeObjectId;
    const myDocId = currentUser._id || currentUser.id;
    if (rowMongo) {
        const rowId = String(rowMongo);
        if (myEmpObj && rowId === String(myEmpObj)) return true;
        if (myDocId && rowId === String(myDocId)) return true;
    }
    const rowCode = normEmpId(
        row.employeeId || (typeof empRef === 'object' && empRef?.employeeId) || '',
    );
    const myCode = normEmpId(currentUser.employeeId || '');
    return !!(rowCode && myCode && rowCode === myCode);
}

function pickFlowchartAssetControllerRow(flowchartRows = []) {
    if (!Array.isArray(flowchartRows)) return null;
    return (
        flowchartRows.find((row) => {
            const cat = String(row?.category || '')
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '');
            const status = String(row?.status || '')
                .trim()
                .toLowerCase();
            return cat === 'assetcontroller' && status === 'active';
        }) ||
        flowchartRows.find((row) => {
            const cat = String(row?.category || '')
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '');
            return cat === 'assetcontroller';
        }) ||
        null
    );
}

export function isCurrentUserFlowchartAssetController(currentUser, flowchartRows = []) {
    return flowchartRowMatchesUser(pickFlowchartAssetControllerRow(flowchartRows), currentUser);
}

export function isCurrentUserFlowchartHr(currentUser, flowchartRows = []) {
    return flowchartRowMatchesUser(pickFlowchartHrRow(flowchartRows), currentUser);
}

export function isCurrentUserFlowchartAccounts(currentUser, flowchartRows = []) {
    return flowchartRowMatchesUser(pickFlowchartAccountsRow(flowchartRows), currentUser);
}

function isCurrentUserAssigneeHod(asset, currentUserEmployeeId, currentUser = null) {
    const assignee = asset?.assignedTo;
    if (!assignee || typeof assignee !== 'object') return false;
    const hod = assignee.primaryReportee;
    if (!hod) return false;

    const hodMongoId = typeof hod === 'object' ? hod._id || hod.id : hod;
    const viewerIdCandidates = new Set(
        [currentUserEmployeeId, currentUser?.employeeObjectId, currentUser?._id, currentUser?.id]
            .filter((v) => v != null && v !== '')
            .map((v) => String(v)),
    );
    if (hodMongoId && viewerIdCandidates.has(String(hodMongoId))) return true;

    const hodCode =
        typeof hod === 'object' && hod.employeeId ? normEmpId(hod.employeeId) : '';
    const viewerCode = normEmpId(currentUser?.employeeId || '');
    return !!(hodCode && viewerCode && hodCode === viewerCode);
}

function isSessionSystemSuperUser(currentUser) {
    return isPortalSuperUser(currentUser);
}

/**
 * Who may manage later vehicle service steps (not create/initiate):
 * Super User, Admin Officer/Controller, Asset Controller, HR,
 * assigned employee, or assignee HOD (primaryReportee).
 */
export function canUserManageOilService(
    asset,
    currentUserEmployeeId,
    currentUser = null,
    isFlowchartAdminOfficer = false,
    {
        isAssetController = false,
        isFlowchartHr = false,
        flowchartRows = null,
    } = {},
) {
    if (!asset) return false;
    if (isSessionSystemSuperUser(currentUser)) return true;
    if (isFlowchartAdminOfficer) return true;
    if (isAssetController) return true;
    if (isFlowchartHr) return true;
    if (Array.isArray(flowchartRows) && flowchartRows.length) {
        if (isCurrentUserFlowchartAdminOfficer(currentUser, flowchartRows)) return true;
        if (isCurrentUserFlowchartAssetController(currentUser, flowchartRows)) return true;
        const hrRow = pickFlowchartHrRow(flowchartRows);
        if (flowchartRowMatchesUser(hrRow, currentUser)) return true;
    }
    if (isCurrentUserVehicleAssignee(asset, currentUserEmployeeId, currentUser)) return true;
    return isCurrentUserAssigneeHod(asset, currentUserEmployeeId, currentUser);
}

/**
 * Create service + Initiate (submit pending/draft) — any signed-in user on the vehicle page.
 */
export function canUserCreateOrInitiateVehicleService(asset, currentUser = null) {
    if (!asset) return false;
    if (isSessionSystemSuperUser(currentUser)) return true;
    return Boolean(
        currentUser?._id ||
            currentUser?.id ||
            currentUser?.employeeObjectId ||
            currentUser?.employeeId ||
            typeof window !== 'undefined',
    );
}

/** Tire change requests are manual only — same roles as oil service manager. */
export const canUserManageTireChange = canUserManageOilService;

export function canUserEditOilServiceDates(
    asset,
    service,
    {
        isFlowchartAdminOfficer = false,
        currentUser = null,
        currentUserEmployeeId = null,
        isAssetController = false,
        isFlowchartHr = false,
        flowchartRows = null,
    } = {},
) {
    if (!asset || !service) return false;
    const remark = parseVehicleServiceRemark(service) || {};
    if (!isOilServiceAssignmentSubmitted(remark)) return false;
    const wf = asset.activeServiceWorkflow || {};
    if (String(wf.stage || '').toLowerCase() !== 'scheduled_service') return false;

    if (
        isSessionSystemSuperUser(currentUser) ||
        isFlowchartAdminOfficer ||
        isAssetController ||
        isFlowchartHr
    ) {
        return true;
    }
    if (Array.isArray(flowchartRows) && flowchartRows.length) {
        if (isCurrentUserFlowchartAdminOfficer(currentUser, flowchartRows)) return true;
        if (isCurrentUserFlowchartAssetController(currentUser, flowchartRows)) return true;
        const hrRow = pickFlowchartHrRow(flowchartRows);
        if (flowchartRowMatchesUser(hrRow, currentUser)) return true;
    }

    if (isOilServiceScheduledWaiting(service, asset)) {
        return (
            isCurrentUserVehicleAssignee(asset, currentUserEmployeeId, currentUser) ||
            isCurrentUserAssigneeHod(asset, currentUserEmployeeId, currentUser)
        );
    }

    return false;
}
