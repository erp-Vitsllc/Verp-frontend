import { isPortalSuperUser } from '@/utils/permissions';
import { isCurrentUserVehicleAssignee } from './evaluateVehicleFleetHeaderActions';
import { normalizeMongoId, parseVehicleServiceRemark } from '../components/vehicleServiceUtils';

export function resolveCarWashWorkflowStage(service, asset) {
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

export function resolveCarWashTableStatusLabel(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const requestStatus = String(remark.requestStatus || '').toLowerCase();
    const paymentStatus = String(remark.carWashPaymentStatus || '').toLowerCase();
    const stage = resolveCarWashWorkflowStage(service, asset);

    if (requestStatus === 'draft') {
        return { label: 'Draft', tone: 'draft' };
    }
    if (stage === 'rejected') {
        return { label: 'Rejected', tone: 'rejected' };
    }
    if (paymentStatus === 'not_paid' || (stage === 'complete' && paymentStatus !== 'paid')) {
        return { label: 'Not paid', tone: 'complete' };
    }
    if (stage === 'pending_accounts' || paymentStatus === 'pending' || requestStatus === 'submitted') {
        return { label: 'Pending', tone: 'pending' };
    }
    return { label: 'Pending', tone: 'pending' };
}

export function canUserManageCarWash(asset, currentUserEmployeeId, currentUser = null, isFlowchartAdminOfficer = false) {
    if (!asset) return false;
    if (isPortalSuperUser(currentUser)) return true;
    if (isFlowchartAdminOfficer) return true;
    return isCurrentUserVehicleAssignee(asset, currentUserEmployeeId, currentUser);
}

export function canUserValidateCarWashAccounts(service, asset, isFlowchartAccounts = false, currentUser = null) {
    if (!asset || !service) return false;
    if (isPortalSuperUser(currentUser)) return true;
    if (!isFlowchartAccounts) return false;

    const remark = parseVehicleServiceRemark(service) || {};
    const requestStatus = String(remark.requestStatus || '').toLowerCase();
    if (requestStatus === 'draft') return false;

    return isCarWashAccountsReviewOpen(service, asset);
}

export function isCarWashAccountsReviewOpen(service, asset) {
    const { label } = resolveCarWashTableStatusLabel(service, asset);
    return label === 'Pending';
}
