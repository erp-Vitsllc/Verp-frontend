import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import { isShopServiceLiveOnAsset, shouldShowShopServiceReturnCard } from './vehicleShopWorkStatus';
import {
    isShopServiceWorkflowRecord,
    resolveShopServiceWorkflowStage,
} from './vehicleShopServiceWorkflowStage';

export const MECHANICAL_WORK_WORKFLOW_STAGES = {
    HR: 'pending_hr',
    ADMIN_OFFICER: 'pending_admin_officer',
    ACCOUNTS: 'pending_accounts',
    SCHEDULED: 'scheduled_service',
    ADMIN_RETURN: 'pending_admin_return',
    COMPLETE: 'complete',
    REJECTED: 'rejected',
};

export function resolveMechanicalWorkWorkflowStage(asset, serviceId, service = null) {
    return resolveShopServiceWorkflowStage(asset, serviceId, service, MECHANICAL_WORK_WORKFLOW_STAGES);
}

export function isMechanicalWorkWorkflowRecord(asset, serviceId, service = null) {
    return isShopServiceWorkflowRecord(asset, serviceId, service, 'Mechanical Work');
}

export function showMechanicalWorkQuoteCard(assignmentPending) {
    return !assignmentPending;
}

export function showMechanicalWorkGarageCard(assignmentPending, stage) {
    if (assignmentPending) return false;
    if (!stage || stage === MECHANICAL_WORK_WORKFLOW_STAGES.REJECTED) return false;
    if (stage === MECHANICAL_WORK_WORKFLOW_STAGES.HR) return false;
    return [
        MECHANICAL_WORK_WORKFLOW_STAGES.ADMIN_OFFICER,
        MECHANICAL_WORK_WORKFLOW_STAGES.ACCOUNTS,
        MECHANICAL_WORK_WORKFLOW_STAGES.SCHEDULED,
        MECHANICAL_WORK_WORKFLOW_STAGES.ADMIN_RETURN,
        MECHANICAL_WORK_WORKFLOW_STAGES.COMPLETE,
    ].includes(stage);
}

export function showMechanicalWorkReturnCard(assignmentPending, stage) {
    if (assignmentPending) return false;
    if (!stage || stage === MECHANICAL_WORK_WORKFLOW_STAGES.REJECTED) return false;
    if (stage === MECHANICAL_WORK_WORKFLOW_STAGES.COMPLETE) return true;
    return shouldShowShopServiceReturnCard(stage);
}

export function isMechanicalWorkGarageSubmitted(asset, service) {
    const wf = asset?.activeServiceWorkflow || {};
    if (wf.garageSubmittedAt) return true;
    const remark = parseVehicleServiceRemark(service) || {};
    return Boolean(String(remark.garageSubmittedByName || '').trim());
}

export function canEditMechanicalWorkGarage(stage, canManageMechanicalWork, { asset, service } = {}) {
    if (!canManageMechanicalWork) return false;
    if (stage === MECHANICAL_WORK_WORKFLOW_STAGES.ADMIN_OFFICER) return true;
    if (stage === MECHANICAL_WORK_WORKFLOW_STAGES.ACCOUNTS && asset && service) {
        return !isMechanicalWorkGarageSubmitted(asset, service);
    }
    return false;
}

export function canApproveMechanicalWorkGarageAccounts(stage, isFlowchartAccounts) {
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
    if (assignmentPending) return false;
    if ([MECHANICAL_WORK_WORKFLOW_STAGES.COMPLETE, MECHANICAL_WORK_WORKFLOW_STAGES.REJECTED].includes(stage)) {
        return false;
    }
    if (stage === MECHANICAL_WORK_WORKFLOW_STAGES.HR) {
        return Boolean(canActHr || canRespondToWorkflow || canManageMechanicalWork);
    }
    return Boolean(canActHr || canManageMechanicalWork);
}
