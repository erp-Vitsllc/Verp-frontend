import { normalizeMongoId, parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import { isShopServiceLiveOnAsset, shouldShowShopServiceReturnCard } from './vehicleShopWorkStatus';

export const ACCIDENT_REPAIR_WORKFLOW_STAGES = {
    HR: 'pending_hr',
    ADMIN_OFFICER: 'pending_admin_officer',
    ACCOUNTS: 'pending_accounts',
    SCHEDULED: 'scheduled_service',
    ADMIN_RETURN: 'pending_admin_return',
    COMPLETE: 'complete',
    REJECTED: 'rejected',
};

export function resolveAccidentRepairWorkflowStage(asset, serviceId, service = null) {
    const wf = asset?.activeServiceWorkflow || {};
    const wfMatch = normalizeMongoId(wf?.serviceRecordId) === normalizeMongoId(serviceId);
    if (!wfMatch) return '';

    const serviceRow =
        service ||
        (Array.isArray(asset?.services)
            ? asset.services.find((row) => normalizeMongoId(row?._id) === normalizeMongoId(serviceId))
            : null);

    const rawStage = String(wf?.stage || '').toLowerCase();
    return normalizeAccidentRepairDisplayStage(rawStage, asset, serviceRow);
}

function accountsApprovalRecorded(asset, service) {
    if (!service) return false;
    const remark = parseVehicleServiceRemark(service) || {};
    const log = Array.isArray(remark.tireActivityLog) ? remark.tireActivityLog : [];
    if (log.some((entry) => entry.type === 'accounts_approved')) return true;

    const wf = asset?.activeServiceWorkflow || {};
    const wfHistory = Array.isArray(wf.history) ? wf.history : [];
    const snapHistory = Array.isArray(service?.workflowSnapshot?.history) ? service.workflowSnapshot.history : [];
    const combined = [...wfHistory, ...snapHistory];

    return combined.some(
        (entry) =>
            String(entry?.action || '').toLowerCase() === 'approve' &&
            String(entry?.stage || '').toLowerCase() === ACCIDENT_REPAIR_WORKFLOW_STAGES.ACCOUNTS,
    );
}

/** Map legacy generic workflow stages to accident-repair card visibility stages. */
function normalizeAccidentRepairDisplayStage(rawStage, asset, service) {
    let stage = String(rawStage || '').toLowerCase();

    if (stage === 'pending_admin') {
        return ACCIDENT_REPAIR_WORKFLOW_STAGES.ADMIN_RETURN;
    }

    if (stage === ACCIDENT_REPAIR_WORKFLOW_STAGES.SCHEDULED) {
        return stage;
    }

    if (stage === ACCIDENT_REPAIR_WORKFLOW_STAGES.ACCOUNTS && accountsApprovalRecorded(asset, service)) {
        const wf = asset?.activeServiceWorkflow || {};
        if (wf.scheduledServiceDate || wf.shopServiceScheduledNotifiedAt) {
            return ACCIDENT_REPAIR_WORKFLOW_STAGES.SCHEDULED;
        }
        return ACCIDENT_REPAIR_WORKFLOW_STAGES.ADMIN_RETURN;
    }

    return stage;
}

export function isAccidentRepairWorkflowRecord(asset, serviceId) {
    const wf = asset?.activeServiceWorkflow || {};
    const wfMatch = normalizeMongoId(wf?.serviceRecordId) === normalizeMongoId(serviceId);
    if (!wfMatch) return false;
    return String(wf?.serviceTypeLabel || '').trim() === 'Accident Repair';
}

export function showAccidentRepairQuoteCard(assignmentPending) {
    return !assignmentPending;
}

export function showAccidentRepairGarageCard(assignmentPending, stage) {
    if (assignmentPending) return false;
    if (!stage || stage === ACCIDENT_REPAIR_WORKFLOW_STAGES.REJECTED) return false;
    if (stage === ACCIDENT_REPAIR_WORKFLOW_STAGES.HR) return false;
    return true;
}

export function showAccidentRepairReturnCard(assignmentPending, stage) {
    if (assignmentPending) return false;
    if (!stage || stage === ACCIDENT_REPAIR_WORKFLOW_STAGES.REJECTED) return false;
    return shouldShowShopServiceReturnCard(stage);
}

export function isAccidentRepairGarageSubmitted(asset, service) {
    const wf = asset?.activeServiceWorkflow || {};
    if (wf.garageSubmittedAt) return true;
    const remark = parseVehicleServiceRemark(service) || {};
    return Boolean(String(remark.garageSubmittedByName || '').trim());
}

export function canEditAccidentRepairGarage(stage, canManageAccidentRepair, { asset, service } = {}) {
    if (!canManageAccidentRepair) return false;
    if (stage === ACCIDENT_REPAIR_WORKFLOW_STAGES.ADMIN_OFFICER) return true;
    if (stage === ACCIDENT_REPAIR_WORKFLOW_STAGES.ACCOUNTS && asset && service) {
        return !isAccidentRepairGarageSubmitted(asset, service);
    }
    return false;
}

export function canApproveAccidentRepairGarageAccounts(stage, isFlowchartAccounts) {
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

export function canEditAccidentRepairQuoteEmployeeRows(assignmentPending, stage, { canActHr, canManageAccidentRepair, canRespondToWorkflow }) {
    if (assignmentPending) return false;
    if ([ACCIDENT_REPAIR_WORKFLOW_STAGES.COMPLETE, ACCIDENT_REPAIR_WORKFLOW_STAGES.REJECTED].includes(stage)) {
        return false;
    }
    if (stage === ACCIDENT_REPAIR_WORKFLOW_STAGES.HR) {
        return Boolean(canActHr || canRespondToWorkflow || canManageAccidentRepair);
    }
    return Boolean(canActHr || canManageAccidentRepair);
}
