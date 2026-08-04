import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import { isShopServiceLiveOnAsset } from './vehicleShopWorkStatus';
import {
    isShopServiceWorkflowRecord,
    resolveShopServiceWorkflowStage,
} from './vehicleShopServiceWorkflowStage';

export const BODY_WORK_WORKFLOW_STAGES = {
    HR: 'pending_hr',
    ADMIN_OFFICER: 'pending_admin_officer',
    ACCOUNTS: 'pending_accounts',
    SCHEDULED: 'scheduled_service',
    ADMIN_RETURN: 'pending_admin_return',
    PENDING_BILLING: 'pending_billing',
    COMPLETE: 'complete',
    REJECTED: 'rejected',
};

export function resolveBodyWorkWorkflowStage(asset, serviceId, service = null) {
    return resolveShopServiceWorkflowStage(asset, serviceId, service, BODY_WORK_WORKFLOW_STAGES);
}

export function isBodyWorkWorkflowRecord(asset, serviceId, service = null) {
    return isShopServiceWorkflowRecord(asset, serviceId, service, 'Body Work');
}

export function showBodyWorkQuoteCard(_assignmentPending) {
    return true;
}

export function showBodyWorkGarageCard(_assignmentPending, stage) {
    return true;
}

export function showBodyWorkReturnCard(_assignmentPending, stage) {
    return true;
}

export function isBodyWorkGarageSubmitted(asset, service) {
    const wf = asset?.activeServiceWorkflow || {};
    if (wf.garageSubmittedAt) return true;
    const remark = parseVehicleServiceRemark(service) || {};
    return Boolean(String(remark.garageSubmittedByName || '').trim());
}

export function canEditBodyWorkGarage(stage, canManageBodyWork, { asset, service } = {}) {
    if (!canManageBodyWork) return false;
    if (asset && service && isBodyWorkGarageSubmitted(asset, service)) return false;
    if (stage === BODY_WORK_WORKFLOW_STAGES.ADMIN_OFFICER) return true;
    if (stage === BODY_WORK_WORKFLOW_STAGES.ACCOUNTS) return true;
    return false;
}

export function canApproveBodyWorkGarageAccounts(stage, isFlowchartAccounts) {
    // Zoho billing uses VehicleServiceAccountsZohoBillingCard (pending_billing), not this garage Approve.
    return isFlowchartAccounts && stage === BODY_WORK_WORKFLOW_STAGES.ACCOUNTS;
}

export function canEditBodyWorkReturn(stage, canManageBodyWork, isComplete, asset) {
    if (isComplete || !canManageBodyWork) return false;
    if (stage === BODY_WORK_WORKFLOW_STAGES.ADMIN_RETURN) return true;
    if (stage === BODY_WORK_WORKFLOW_STAGES.SCHEDULED && isShopServiceLiveOnAsset(asset)) return true;
    return false;
}

export function isBodyWorkQuoteReadOnly(stage, canActHr) {
    return stage !== BODY_WORK_WORKFLOW_STAGES.HR || !canActHr;
}

export function canEditBodyWorkQuoteCard(assignmentPending, stage, { canActHr, canRespondToWorkflow }) {
    if (assignmentPending) return false;
    if (stage !== BODY_WORK_WORKFLOW_STAGES.HR) return false;
    return Boolean(canActHr || canRespondToWorkflow);
}

export function canEditBodyWorkQuoteEmployeeRows(assignmentPending, stage, { canActHr, canManageBodyWork, canRespondToWorkflow }) {
    if (assignmentPending) return false;
    if ([BODY_WORK_WORKFLOW_STAGES.COMPLETE, BODY_WORK_WORKFLOW_STAGES.REJECTED].includes(stage)) {
        return false;
    }
    if (stage === BODY_WORK_WORKFLOW_STAGES.HR) {
        return Boolean(canActHr || canRespondToWorkflow || canManageBodyWork);
    }
    return Boolean(canActHr || canManageBodyWork);
}
