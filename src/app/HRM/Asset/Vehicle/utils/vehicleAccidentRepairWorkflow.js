import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import { isShopServiceLiveOnAsset } from './vehicleShopWorkStatus';
import {
    isShopServiceWorkflowRecord,
    resolveShopServiceWorkflowStage,
} from './vehicleShopServiceWorkflowStage';
import { canEditShopServiceSchedule } from './vehicleShopServiceCardGates';

export const ACCIDENT_REPAIR_WORKFLOW_STAGES = {
    HR: 'pending_hr',
    ADMIN_OFFICER: 'pending_admin_officer',
    ACCOUNTS: 'pending_accounts',
    SCHEDULED: 'scheduled_service',
    ADMIN_RETURN: 'pending_admin_return',
    PENDING_BILLING: 'pending_billing',
    COMPLETE: 'complete',
    REJECTED: 'rejected',
};

export function resolveAccidentRepairWorkflowStage(asset, serviceId, service = null) {
    return resolveShopServiceWorkflowStage(asset, serviceId, service, ACCIDENT_REPAIR_WORKFLOW_STAGES);
}

export function isAccidentRepairWorkflowRecord(asset, serviceId, service = null) {
    return isShopServiceWorkflowRecord(asset, serviceId, service, 'Accident Repair');
}

export function showAccidentRepairQuoteCard(_assignmentPending) {
    return true;
}

export function showAccidentRepairGarageCard(_assignmentPending, stage) {
    return true;
}

export function showAccidentRepairReturnCard(_assignmentPending, stage) {
    return true;
}

export function isAccidentRepairGarageSubmitted(asset, service) {
    const wf = asset?.activeServiceWorkflow || {};
    if (wf.garageSubmittedAt) return true;
    const remark = parseVehicleServiceRemark(service) || {};
    return Boolean(String(remark.garageSubmittedByName || '').trim());
}

export function canEditAccidentRepairGarage(stage, canManageAccidentRepair, { asset, service } = {}) {
    // Admin-only Schedule/Reschedule; open until Complete Service (Accounts Approve does not lock).
    return canEditShopServiceSchedule(stage, canManageAccidentRepair, { service });
}

export function canApproveAccidentRepairGarageAccounts(stage, isFlowchartAccounts) {
    // Zoho billing uses VehicleServiceAccountsZohoBillingCard (pending_billing), not this garage Approve.
    return isFlowchartAccounts && stage === ACCIDENT_REPAIR_WORKFLOW_STAGES.ACCOUNTS;
}

export function canEditAccidentRepairReturn(stage, canManageAccidentRepair, isComplete, asset) {
    if (isComplete || !canManageAccidentRepair) return false;
    if (stage === ACCIDENT_REPAIR_WORKFLOW_STAGES.ADMIN_RETURN) return true;
    if (stage === ACCIDENT_REPAIR_WORKFLOW_STAGES.SCHEDULED && isShopServiceLiveOnAsset(asset)) return true;
    return false;
}

export function isAccidentRepairQuoteReadOnly(stage, canActHr) {
    return stage !== ACCIDENT_REPAIR_WORKFLOW_STAGES.HR || !canActHr;
}

export function canEditAccidentRepairQuoteCard(assignmentPending, stage, { canActHr, canRespondToWorkflow }) {
    if (assignmentPending) return false;
    if (stage !== ACCIDENT_REPAIR_WORKFLOW_STAGES.HR) return false;
    return Boolean(canActHr || canRespondToWorkflow);
}

export function canEditAccidentRepairQuoteEmployeeRows(
    assignmentPending,
    stage,
    { canActHr, canManageAccidentRepair, canRespondToWorkflow },
) {
    // Lock after HR Approval — employee rows only editable while HR stage is open.
    if (assignmentPending) return false;
    if (stage !== ACCIDENT_REPAIR_WORKFLOW_STAGES.HR) return false;
    return Boolean(canActHr || canRespondToWorkflow || canManageAccidentRepair);
}
