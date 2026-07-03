import { normalizeMongoId, parseVehicleServiceRemark } from '../components/vehicleServiceUtils';

function findServiceRow(asset, serviceId, service) {
    if (service) return service;
    return Array.isArray(asset?.services)
        ? asset.services.find((row) => normalizeMongoId(row?._id) === normalizeMongoId(serviceId))
        : null;
}

function accountsApprovalRecorded(asset, service, accountsStage) {
    if (!service) return false;
    const remark = parseVehicleServiceRemark(service) || {};
    const log = Array.isArray(remark.tireActivityLog) ? remark.tireActivityLog : [];
    if (log.some((entry) => entry.type === 'accounts_approved')) return true;
    if (remark.accountsApprovedAt) return true;

    const wf = asset?.activeServiceWorkflow || {};
    const wfHistory = Array.isArray(wf.history) ? wf.history : [];
    const snapHistory = Array.isArray(service?.workflowSnapshot?.history) ? service.workflowSnapshot.history : [];
    const combined = [...wfHistory, ...snapHistory];

    return combined.some(
        (entry) =>
            String(entry?.action || '').toLowerCase() === 'approve' &&
            String(entry?.stage || '').toLowerCase() === accountsStage,
    );
}

function inferStageFromRemarkActivity(remark, asset, stages) {
    if (String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live') {
        return stages.COMPLETE;
    }
    if (String(remark.workflowStage || '').toLowerCase() === stages.COMPLETE) {
        return stages.COMPLETE;
    }

    const log = Array.isArray(remark.tireActivityLog) ? remark.tireActivityLog : [];
    const has = (type) => log.some((entry) => entry.type === type);

    if (has('service_completed')) return stages.COMPLETE;
    if (has('accounts_approved') || remark.accountsApprovedAt) {
        return stages.SCHEDULED;
    }
    if (has('garage_updated') || remark.garageSubmittedByName) {
        return stages.ACCOUNTS;
    }
    if (has('quotation_review_approved')) {
        return stages.ADMIN_OFFICER;
    }
    if (has('request_submitted') || String(remark.requestStatus || '').toLowerCase() === 'submitted') {
        return stages.HR;
    }
    return '';
}

function normalizeShopServiceDisplayStage(rawStage, asset, service, stages) {
    let stage = String(rawStage || '').toLowerCase();

    if (stage === 'pending_admin') {
        return stages.ADMIN_RETURN;
    }

    if (stage === stages.SCHEDULED) {
        return stage;
    }

    if (stage === stages.ACCOUNTS && accountsApprovalRecorded(asset, service, stages.ACCOUNTS)) {
        const wf = asset?.activeServiceWorkflow || {};
        const remark = parseVehicleServiceRemark(service) || {};
        if (
            wf.scheduledServiceDate ||
            wf.shopServiceScheduledNotifiedAt ||
            remark.serviceStartDate ||
            remark.scheduledServiceDate ||
            remark.accountsApprovedAt
        ) {
            return stages.SCHEDULED;
        }
        return stages.ADMIN_RETURN;
    }

    return stage;
}

function resolveRawShopServiceStage(asset, serviceId, service, stages) {
    const serviceRow = findServiceRow(asset, serviceId, service);
    if (!serviceRow) return '';

    const wf = asset?.activeServiceWorkflow || {};
    const wfMatch = normalizeMongoId(wf?.serviceRecordId) === normalizeMongoId(serviceId);
    const remark = parseVehicleServiceRemark(serviceRow) || {};
    const snap = serviceRow?.workflowSnapshot;

    const inferred = inferStageFromRemarkActivity(remark, asset, stages);
    if (inferred === stages.COMPLETE) {
        return stages.COMPLETE;
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
        return stages.HR;
    }

    return '';
}

export function resolveShopServiceWorkflowStage(asset, serviceId, service, stages) {
    const serviceRow = findServiceRow(asset, serviceId, service);
    const raw = resolveRawShopServiceStage(asset, serviceId, serviceRow, stages);
    if (!raw || raw === 'pending') return '';
    return normalizeShopServiceDisplayStage(raw, asset, serviceRow, stages);
}

export function isShopServiceWorkflowRecord(asset, serviceId, service, serviceTypeLabel) {
    const wf = asset?.activeServiceWorkflow || {};
    const wfMatch = normalizeMongoId(wf?.serviceRecordId) === normalizeMongoId(serviceId);
    if (wfMatch) {
        return String(wf?.serviceTypeLabel || '').trim() === serviceTypeLabel;
    }
    const serviceRow = findServiceRow(asset, serviceId, service);
    return String(serviceRow?.serviceType || '').trim() === serviceTypeLabel;
}
