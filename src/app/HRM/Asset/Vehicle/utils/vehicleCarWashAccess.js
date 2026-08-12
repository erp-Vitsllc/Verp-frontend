import { isPortalSuperUser } from '@/utils/permissions';
import { normalizeMongoId, parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import { canUserManageOilService } from './vehicleOilServiceAccess';

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
    const billingStatus = String(remark.billingStatus || '').toLowerCase();

    if (requestStatus === 'draft') {
        return { label: 'Draft', tone: 'draft' };
    }
    if (stage === 'rejected') {
        return { label: 'Rejected', tone: 'rejected' };
    }
    if (stage === 'billed' || billingStatus === 'billed' || paymentStatus === 'billed') {
        return { label: 'Complete', tone: 'complete' };
    }
    if (stage === 'pending_billing' || stage === 'pending_accounts') {
        // Completed on Send; Accounts expense still open until billed.
        return { label: 'Completed', tone: 'complete' };
    }
    if (paymentStatus === 'not_paid' || (stage === 'complete' && paymentStatus !== 'paid')) {
        return { label: 'Not paid', tone: 'complete' };
    }
    if (paymentStatus === 'pending' || requestStatus === 'submitted') {
        return { label: 'Pending', tone: 'pending' };
    }
    return { label: 'Pending', tone: 'pending' };
}

export function canUserManageCarWash(
    asset,
    currentUserEmployeeId,
    currentUser = null,
    isFlowchartAdminOfficer = false,
    extras = {},
) {
    return canUserManageOilService(
        asset,
        currentUserEmployeeId,
        currentUser,
        isFlowchartAdminOfficer,
        extras,
    );
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
    if (!asset || !service) return false;
    const remark = parseVehicleServiceRemark(service) || {};
    const billingStatus = String(remark.billingStatus || '').toLowerCase();
    const paymentStatus = String(remark.carWashPaymentStatus || '').toLowerCase();
    if (billingStatus === 'billed' || paymentStatus === 'billed') return false;

    const stage = resolveCarWashWorkflowStage(service, asset);
    if (stage === 'rejected' || stage === 'billed') return false;

    // Open for Accounts until Zoho Expense succeeds (status may already be Completed).
    return (
        stage === 'pending_billing' ||
        stage === 'pending_accounts' ||
        paymentStatus === 'pending' ||
        String(remark.requestStatus || '').toLowerCase() === 'submitted'
    );
}
