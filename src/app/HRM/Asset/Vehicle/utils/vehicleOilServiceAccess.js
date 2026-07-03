import { isPortalSuperUser } from '@/utils/permissions';
import { isCurrentUserVehicleAssignee } from './evaluateVehicleFleetHeaderActions';
import { pickFlowchartAdminRow } from './vehicleHandoverAssignWorkflow';
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

    return String(
        service?.workflowSnapshot?.stage ||
            (wfMatch ? wf.stage : '') ||
            remark.workflowStage ||
            remark.stage ||
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
    if (stage !== 'scheduled_service') return false;
    return !isOilServiceLive(service, asset);
}

/** Service details form is enabled only when the vehicle is on service (start date reached). */
export function isOilServiceDetailsEnabled(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const stage = resolveOilServiceWorkflowStage(service, asset);
    if (stage === 'complete' || String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live') {
        return true;
    }
    if (stage === 'rejected') return false;
    return isOilServiceLive(service, asset);
}

/** Header / summary badge for oil service detail page. */
export function resolveOilServiceHeaderStatus(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const requestStatus = String(remark.requestStatus || '').toLowerCase();
    const stage = resolveOilServiceWorkflowStage(service, asset);
    const vehicleServiceDone = String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live';

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
            label: 'Scheduled',
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
    if (stage === 'rejected') {
        return 'Rejected';
    }
    if (isOilServiceScheduledWaiting(service, asset)) {
        return 'Scheduled';
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
    if (stage === 'complete' || vehicleServiceDone) {
        return { label: 'Complete', tone: 'complete' };
    }
    if (stage === 'rejected') {
        return { label: 'Rejected', tone: 'rejected' };
    }
    if (isOilServiceScheduledWaiting(service, asset)) {
        return { label: 'Scheduled', tone: 'scheduled' };
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

export function isCurrentUserFlowchartAdminOfficer(currentUser, flowchartRows = []) {
    if (!currentUser) return false;
    const adminRow = pickFlowchartAdminRow(flowchartRows);
    if (!adminRow) return false;
    const empRef = adminRow.empObjectId;
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
        adminRow.employeeId || (typeof empRef === 'object' && empRef?.employeeId) || '',
    );
    const myCode = normEmpId(currentUser.employeeId || '');
    return !!(rowCode && myCode && rowCode === myCode);
}

function isSessionSystemSuperUser(currentUser) {
    return isPortalSuperUser(currentUser);
}

/** Super User, Admin Officer (flowchart), or vehicle assignee. */
export function canUserManageOilService(
    asset,
    currentUserEmployeeId,
    currentUser = null,
    isFlowchartAdminOfficer = false,
) {
    if (!asset) return false;
    if (isSessionSystemSuperUser(currentUser)) return true;
    if (isFlowchartAdminOfficer) return true;
    return isCurrentUserVehicleAssignee(asset, currentUserEmployeeId, currentUser);
}

/** Tire change requests are manual only — same roles as oil service manager. */
export const canUserManageTireChange = canUserManageOilService;

export function canUserEditOilServiceDates(
    asset,
    service,
    { isFlowchartAdminOfficer = false, currentUser = null, currentUserEmployeeId = null } = {},
) {
    if (!asset || !service) return false;
    const remark = parseVehicleServiceRemark(service) || {};
    if (!isOilServiceAssignmentSubmitted(remark)) return false;
    const wf = asset.activeServiceWorkflow || {};
    if (String(wf.stage || '').toLowerCase() !== 'scheduled_service') return false;

    if (isSessionSystemSuperUser(currentUser) || isFlowchartAdminOfficer) return true;

    if (isOilServiceScheduledWaiting(service, asset)) {
        return isCurrentUserVehicleAssignee(asset, currentUserEmployeeId, currentUser);
    }

    return false;
}
