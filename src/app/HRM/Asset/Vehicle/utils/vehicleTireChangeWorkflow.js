import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import { isShopServiceLiveOnAsset, shouldShowShopServiceReturnCard } from './vehicleShopWorkStatus';
import {
    isShopServiceWorkflowRecord,
    resolveShopServiceWorkflowStage,
} from './vehicleShopServiceWorkflowStage';

export const TIRE_CHANGE_WORKFLOW_STAGES = {
    HR: 'pending_hr',
    ADMIN_OFFICER: 'pending_admin_officer',
    ACCOUNTS: 'pending_accounts',
    SCHEDULED: 'scheduled_service',
    ADMIN_RETURN: 'pending_admin_return',
    PENDING_BILLING: 'pending_billing',
    COMPLETE: 'complete',
    REJECTED: 'rejected',
};

export function resolveTireChangeWorkflowStage(asset, serviceId, service = null) {
    return resolveShopServiceWorkflowStage(asset, serviceId, service, TIRE_CHANGE_WORKFLOW_STAGES);
}

export function isTireChangeWorkflowRecord(asset, serviceId, service = null) {
    return isShopServiceWorkflowRecord(asset, serviceId, service, 'Tire Change');
}

export function showTireChangeQuoteCard(assignmentPending) {
    return !assignmentPending;
}

export function showTireChangeGarageCard(assignmentPending, stage) {
    if (assignmentPending) return false;
    if (!stage || stage === TIRE_CHANGE_WORKFLOW_STAGES.REJECTED) return false;
    if (stage === TIRE_CHANGE_WORKFLOW_STAGES.HR) return false;
    return [
        TIRE_CHANGE_WORKFLOW_STAGES.ADMIN_OFFICER,
        TIRE_CHANGE_WORKFLOW_STAGES.ACCOUNTS,
        TIRE_CHANGE_WORKFLOW_STAGES.SCHEDULED,
        TIRE_CHANGE_WORKFLOW_STAGES.PENDING_BILLING,
        'billed',
        TIRE_CHANGE_WORKFLOW_STAGES.ADMIN_RETURN,
        TIRE_CHANGE_WORKFLOW_STAGES.COMPLETE,
    ].includes(stage);
}

export function showTireChangeReturnCard(assignmentPending, stage) {
    if (assignmentPending) return false;
    if (!stage || stage === TIRE_CHANGE_WORKFLOW_STAGES.REJECTED) return false;
    if (stage === TIRE_CHANGE_WORKFLOW_STAGES.COMPLETE) return true;
    return shouldShowShopServiceReturnCard(stage);
}

export function canEditTireChangeGarage(stage, canManageTireChange) {
    return canManageTireChange && stage === TIRE_CHANGE_WORKFLOW_STAGES.ADMIN_OFFICER;
}

export function canApproveTireChangeGarageAccounts(stage, isFlowchartAccounts) {
    // Zoho billing uses VehicleServiceAccountsZohoBillingCard (pending_billing), not this garage Approve.
    return isFlowchartAccounts && stage === TIRE_CHANGE_WORKFLOW_STAGES.ACCOUNTS;
}

export function canEditTireChangeReturn(stage, canManageTireChange, isComplete, asset) {
    if (isComplete || !canManageTireChange) return false;
    if (stage === TIRE_CHANGE_WORKFLOW_STAGES.ADMIN_RETURN) return true;
    if (stage === TIRE_CHANGE_WORKFLOW_STAGES.SCHEDULED && isShopServiceLiveOnAsset(asset)) return true;
    return false;
}

export function isTireChangeQuoteReadOnly(stage, canActHr) {
    return stage !== TIRE_CHANGE_WORKFLOW_STAGES.HR || !canActHr;
}

export function canEditTireChangeQuoteCard(assignmentPending, stage, { canActHr, canRespondToWorkflow }) {
    if (assignmentPending) return false;
    if (stage !== TIRE_CHANGE_WORKFLOW_STAGES.HR) return false;
    return Boolean(canActHr || canRespondToWorkflow);
}

export function canEditTireChangeQuoteEmployeeRows(assignmentPending, stage, { canActHr, canManageTireChange, canRespondToWorkflow }) {
    if (assignmentPending) return false;
    if (
        [TIRE_CHANGE_WORKFLOW_STAGES.COMPLETE, TIRE_CHANGE_WORKFLOW_STAGES.REJECTED, 'billed'].includes(
            stage,
        )
    ) {
        return false;
    }
    if (stage === TIRE_CHANGE_WORKFLOW_STAGES.HR) {
        return Boolean(canActHr || canRespondToWorkflow || canManageTireChange);
    }
    return Boolean(canActHr || canManageTireChange);
}

export function isTireChangeGarageSubmitted(asset, service) {
    const wf = asset?.activeServiceWorkflow || {};
    if (wf.garageSubmittedAt) return true;
    const remark = parseVehicleServiceRemark(service) || {};
    return Boolean(String(remark.garageSubmittedByName || '').trim());
}
