import { normalizeMongoId, parseVehicleServiceRemark } from '../components/vehicleServiceUtils';

function findServiceRow(asset, serviceId, service) {
    if (service) return service;
    return Array.isArray(asset?.services)
        ? asset.services.find((row) => normalizeMongoId(row?._id) === normalizeMongoId(serviceId))
        : null;
}

function shopActivityLog(remark = {}) {
    if (Array.isArray(remark.tireActivityLog) && remark.tireActivityLog.length) return remark.tireActivityLog;
    if (Array.isArray(remark.mechanicalActivityLog) && remark.mechanicalActivityLog.length) {
        return remark.mechanicalActivityLog;
    }
    if (Array.isArray(remark.bodyWorkActivityLog) && remark.bodyWorkActivityLog.length) {
        return remark.bodyWorkActivityLog;
    }
    return [];
}

function hasAccountsApprovalEvidence(remark = {}, asset = null, service = null, accountsStage = 'pending_accounts') {
    if (
        String(remark.accountsApprovedAt || '').trim() ||
        String(remark.accountsQuoteApprovedAt || '').trim() ||
        String(remark.accountsGarageApprovedAt || '').trim()
    ) {
        return true;
    }
    const log = shopActivityLog(remark);
    if (log.some((entry) => entry.type === 'accounts_approved')) return true;
    return accountsApprovalRecorded(asset, service, accountsStage);
}

function accountsApprovalRecorded(asset, service, accountsStage) {
    if (!service) return false;
    const remark = parseVehicleServiceRemark(service) || {};
    const log = shopActivityLog(remark);
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

function inferStageFromRemarkActivity(remark, asset, stages, service = null) {
    const log = shopActivityLog(remark);
    const has = (type) => log.some((entry) => entry.type === type);
    const workflowStage = String(remark.workflowStage || '').toLowerCase();
    const billingStatus = String(remark.billingStatus || '').toLowerCase();
    const pendingBilling = stages.PENDING_BILLING || 'pending_billing';

    // Billing after End Service must win over "service completed" flags.
    if (workflowStage === pendingBilling) {
        return pendingBilling;
    }
    if (has('zoho_bill_created') || workflowStage === 'billed' || billingStatus === 'billed') {
        return workflowStage === 'billed' || billingStatus === 'billed' ? 'billed' : stages.COMPLETE;
    }
    if (workflowStage === stages.COMPLETE || workflowStage === 'complete') {
        return stages.COMPLETE;
    }

    // Accounts Approve (not garage alone) unlocks scheduled / On Service — oil cash style.
    if (hasAccountsApprovalEvidence(remark, asset, service, stages.ACCOUNTS)) {
        return stages.SCHEDULED;
    }

    // HR quotation approved → Accounts next (Schedule may already be done in parallel).
    if (
        has('quotation_review_approved') ||
        String(remark.hrReviewApprovedAt || '').trim() ||
        String(remark.hrApprovedAt || '').trim() ||
        String(remark.hrScheduleApprovedAt || '').trim()
    ) {
        return stages.ACCOUNTS;
    }

    if (has('request_submitted') || String(remark.requestStatus || '').toLowerCase() === 'submitted') {
        return stages.HR;
    }
    return '';
}

function normalizeShopServiceDisplayStage(rawStage, asset, service, stages) {
    let stage = String(rawStage || '').toLowerCase();
    const pendingBilling = stages.PENDING_BILLING || 'pending_billing';

    if (stage === pendingBilling || stage === 'billed') {
        return stage;
    }

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
    const pendingBilling = stages.PENDING_BILLING || 'pending_billing';
    const wfStage = wfMatch ? String(wf?.stage || '').toLowerCase() : '';
    const remarkStage = String(remark.workflowStage || '').toLowerCase();
    const billingStatus = String(remark.billingStatus || '').toLowerCase();

    // Live Accounts Zoho billing always wins (do not collapse to "complete" from vehicleServiceCompleted).
    if (wfStage === pendingBilling || remarkStage === pendingBilling) {
        return pendingBilling;
    }
    if (wfStage === 'billed' || remarkStage === 'billed' || billingStatus === 'billed') {
        return 'billed';
    }

    const inferred = inferStageFromRemarkActivity(remark, asset, stages, serviceRow);
    if (inferred === pendingBilling || inferred === 'billed' || inferred === stages.COMPLETE) {
        return inferred;
    }

    // Accounts already approved → never stay on pre-schedule stages.
    // Stale snapshot/active stage can lag behind the activity log.
    if (inferred === stages.SCHEDULED) {
        const ahead = new Set([
            stages.SCHEDULED,
            stages.ADMIN_RETURN,
            pendingBilling,
            'billed',
            stages.COMPLETE,
            'complete',
        ]);
        if (wfMatch && wfStage && ahead.has(wfStage)) return wfStage;
        const snapStage = snap?.stage ? String(snap.stage).toLowerCase() : '';
        if (snapStage && ahead.has(snapStage)) return snapStage;
        return stages.SCHEDULED;
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
