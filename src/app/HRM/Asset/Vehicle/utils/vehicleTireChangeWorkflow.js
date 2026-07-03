import { normalizeMongoId, parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import { isShopServiceLiveOnAsset, shouldShowShopServiceReturnCard } from './vehicleShopWorkStatus';

export const TIRE_CHANGE_WORKFLOW_STAGES = {
    HR: 'pending_hr',
    ADMIN_OFFICER: 'pending_admin_officer',
    ACCOUNTS: 'pending_accounts',
    SCHEDULED: 'scheduled_service',
    ADMIN_RETURN: 'pending_admin_return',
    COMPLETE: 'complete',
    REJECTED: 'rejected',
};

function findServiceRow(asset, serviceId, service) {
    if (service) return service;
    return Array.isArray(asset?.services)
        ? asset.services.find((row) => normalizeMongoId(row?._id) === normalizeMongoId(serviceId))
        : null;
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
            String(entry?.stage || '').toLowerCase() === TIRE_CHANGE_WORKFLOW_STAGES.ACCOUNTS,
    );
}

function inferStageFromRemarkActivity(remark, asset, service) {
    if (String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live') {
        return TIRE_CHANGE_WORKFLOW_STAGES.COMPLETE;
    }
    if (String(remark.workflowStage || '').toLowerCase() === TIRE_CHANGE_WORKFLOW_STAGES.COMPLETE) {
        return TIRE_CHANGE_WORKFLOW_STAGES.COMPLETE;
    }

    const log = Array.isArray(remark.tireActivityLog) ? remark.tireActivityLog : [];
    const has = (type) => log.some((entry) => entry.type === type);

    if (has('service_completed')) return TIRE_CHANGE_WORKFLOW_STAGES.COMPLETE;
    if (has('accounts_approved') || remark.accountsApprovedAt) {
        if (isShopServiceLiveOnAsset(asset) || remark.shopServiceLiveAt) {
            return TIRE_CHANGE_WORKFLOW_STAGES.SCHEDULED;
        }
        return TIRE_CHANGE_WORKFLOW_STAGES.SCHEDULED;
    }
    if (has('garage_updated') || remark.garageSubmittedByName) {
        return TIRE_CHANGE_WORKFLOW_STAGES.ACCOUNTS;
    }
    if (has('quotation_review_approved')) {
        return TIRE_CHANGE_WORKFLOW_STAGES.ADMIN_OFFICER;
    }
    if (has('request_submitted') || String(remark.requestStatus || '').toLowerCase() === 'submitted') {
        return TIRE_CHANGE_WORKFLOW_STAGES.HR;
    }
    return '';
}

/** Map legacy generic workflow stages to tire-change card visibility stages. */
function normalizeTireChangeDisplayStage(rawStage, asset, service) {
    let stage = String(rawStage || '').toLowerCase();

    if (stage === 'pending_admin') {
        return TIRE_CHANGE_WORKFLOW_STAGES.ADMIN_RETURN;
    }

    if (stage === TIRE_CHANGE_WORKFLOW_STAGES.SCHEDULED) {
        return stage;
    }

    if (stage === TIRE_CHANGE_WORKFLOW_STAGES.ACCOUNTS && accountsApprovalRecorded(asset, service)) {
        const wf = asset?.activeServiceWorkflow || {};
        if (wf.scheduledServiceDate || wf.shopServiceScheduledNotifiedAt) {
            return TIRE_CHANGE_WORKFLOW_STAGES.SCHEDULED;
        }
        return TIRE_CHANGE_WORKFLOW_STAGES.ADMIN_RETURN;
    }

    return stage;
}

function resolveRawTireChangeStage(asset, serviceId, service) {
    const serviceRow = findServiceRow(asset, serviceId, service);
    if (!serviceRow) return '';

    const wf = asset?.activeServiceWorkflow || {};
    const wfMatch = normalizeMongoId(wf?.serviceRecordId) === normalizeMongoId(serviceId);
    const remark = parseVehicleServiceRemark(serviceRow) || {};
    const snap = serviceRow?.workflowSnapshot;

    const inferred = inferStageFromRemarkActivity(remark, asset, serviceRow);
    if (inferred === TIRE_CHANGE_WORKFLOW_STAGES.COMPLETE) {
        return TIRE_CHANGE_WORKFLOW_STAGES.COMPLETE;
    }

    if (wfMatch && wf?.stage) {
        return String(wf.stage).toLowerCase();
    }

    if (snap?.stage) {
        return String(snap.stage).toLowerCase();
    }

    if (remark.workflowStage) {
        return String(remark.workflowStage).toLowerCase();
    }

    if (inferred) return inferred;

    if (String(remark.requestStatus || '').toLowerCase() === 'submitted') {
        return TIRE_CHANGE_WORKFLOW_STAGES.HR;
    }

    return '';
}

export function resolveTireChangeWorkflowStage(asset, serviceId, service = null) {
    const serviceRow = findServiceRow(asset, serviceId, service);
    const raw = resolveRawTireChangeStage(asset, serviceId, serviceRow);
    if (!raw || raw === 'pending') return '';
    return normalizeTireChangeDisplayStage(raw, asset, serviceRow);
}

export function isTireChangeWorkflowRecord(asset, serviceId) {
    const wf = asset?.activeServiceWorkflow || {};
    const wfMatch = normalizeMongoId(wf?.serviceRecordId) === normalizeMongoId(serviceId);
    if (wfMatch) {
        return String(wf?.serviceTypeLabel || '').trim() === 'Tire Change';
    }
    const serviceRow = findServiceRow(asset, serviceId);
    return String(serviceRow?.serviceType || '').trim() === 'Tire Change';
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
    if ([TIRE_CHANGE_WORKFLOW_STAGES.COMPLETE, TIRE_CHANGE_WORKFLOW_STAGES.REJECTED].includes(stage)) {
        return false;
    }
    if (stage === TIRE_CHANGE_WORKFLOW_STAGES.HR) {
        return Boolean(canActHr || canRespondToWorkflow || canManageTireChange);
    }
    return Boolean(canActHr || canManageTireChange);
}
