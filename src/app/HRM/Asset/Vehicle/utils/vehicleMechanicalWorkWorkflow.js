import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import { isShopServiceLiveOnAsset } from './vehicleShopWorkStatus';
import {
    isShopServiceWorkflowRecord,
    resolveShopServiceWorkflowStage,
} from './vehicleShopServiceWorkflowStage';
import { canEditShopServiceSchedule } from './vehicleShopServiceCardGates';

export const MECHANICAL_WORK_WORKFLOW_STAGES = {
    HR: 'pending_hr',
    ADMIN_OFFICER: 'pending_admin_officer',
    ACCOUNTS: 'pending_accounts',
    SCHEDULED: 'scheduled_service',
    ADMIN_RETURN: 'pending_admin_return',
    PENDING_BILLING: 'pending_billing',
    COMPLETE: 'complete',
    REJECTED: 'rejected',
};

export function resolveMechanicalWorkWorkflowStage(asset, serviceId, service = null) {
    return resolveShopServiceWorkflowStage(asset, serviceId, service, MECHANICAL_WORK_WORKFLOW_STAGES);
}

export function isMechanicalWorkWorkflowRecord(asset, serviceId, service = null) {
    return isShopServiceWorkflowRecord(asset, serviceId, service, 'Mechanical Work');
}

export function showMechanicalWorkQuoteCard(_assignmentPending) {
    return true;
}

export function showMechanicalWorkGarageCard(_assignmentPending, stage) {
    return true;
}

export function showMechanicalWorkReturnCard(_assignmentPending, stage) {
    return true;
}

export function isMechanicalWorkGarageSubmitted(asset, service) {
    const wf = asset?.activeServiceWorkflow || {};
    if (wf.garageSubmittedAt) return true;
    const remark = parseVehicleServiceRemark(service) || {};
    return Boolean(String(remark.garageSubmittedByName || '').trim());
}

export function canEditMechanicalWorkGarage(stage, canManageMechanicalWork, { asset, service } = {}) {
    // Admin-only Schedule/Reschedule; open until Complete Service (Accounts Approve does not lock).
    return canEditShopServiceSchedule(stage, canManageMechanicalWork, { service });
}

export function canApproveMechanicalWorkGarageAccounts(stage, isFlowchartAccounts) {
    // Zoho billing uses VehicleServiceAccountsZohoBillingCard (pending_billing), not this garage Approve.
    return isFlowchartAccounts && stage === MECHANICAL_WORK_WORKFLOW_STAGES.ACCOUNTS;
}

export function canEditMechanicalWorkReturn(stage, canManageMechanicalWork, isComplete, asset) {
    if (isComplete || !canManageMechanicalWork) return false;
    if (stage === MECHANICAL_WORK_WORKFLOW_STAGES.ADMIN_RETURN) return true;
    if (stage === MECHANICAL_WORK_WORKFLOW_STAGES.SCHEDULED && isShopServiceLiveOnAsset(asset)) return true;
    return false;
}

export function isMechanicalWorkQuoteReadOnly(stage, canActHr) {
    return stage !== MECHANICAL_WORK_WORKFLOW_STAGES.HR || !canActHr;
}

export function canEditMechanicalWorkQuoteCard(assignmentPending, stage, { canActHr, canRespondToWorkflow }) {
    if (assignmentPending) return false;
    if (stage !== MECHANICAL_WORK_WORKFLOW_STAGES.HR) return false;
    return Boolean(canActHr || canRespondToWorkflow);
}

export function canEditMechanicalWorkQuoteEmployeeRows(assignmentPending, stage, { canActHr, canManageMechanicalWork, canRespondToWorkflow }) {
    // Lock after HR Approval — employee rows only editable while HR stage is open.
    if (assignmentPending) return false;
    if (stage !== MECHANICAL_WORK_WORKFLOW_STAGES.HR) return false;
    return Boolean(canActHr || canRespondToWorkflow || canManageMechanicalWork);
}
