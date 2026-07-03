import { normalizeMongoId, parseVehicleServiceRemark } from '../components/vehicleServiceUtils';

export const TIRE_CHANGE_WORKFLOW_STEPS = [
    { id: 1, label: 'Service Created' },
    { id: 2, label: 'Service Updated' },
    { id: 3, label: 'Request Submitted' },
    { id: 4, label: 'Quotation Review Approved' },
    { id: 5, label: 'Garage Updated' },
    { id: 6, label: 'Accounts Approved' },
    { id: 7, label: 'Service Completed' },
];

const ACTIVITY_BY_STEP = {
    1: 'service_created',
    2: 'service_updated',
    3: 'request_submitted',
    4: 'quotation_review_approved',
    5: 'garage_updated',
    6: 'accounts_approved',
    7: 'service_completed',
};

function resolveWorkflowForService(asset, service) {
    const serviceId = normalizeMongoId(service?._id);
    const activeWf = asset?.activeServiceWorkflow || {};
    const wfMatch = normalizeMongoId(activeWf.serviceRecordId) === serviceId;
    const snap = service?.workflowSnapshot;
    const remark = parseVehicleServiceRemark(service) || {};

    const remarkComplete =
        String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live' ||
        String(remark.workflowStage || '').toLowerCase() === 'complete';

    if (remarkComplete) {
        return {
            stage: 'complete',
            history: Array.isArray(snap?.history)
                ? snap.history
                : Array.isArray(activeWf?.history) && wfMatch
                  ? activeWf.history
                  : [],
            wf: wfMatch ? activeWf : {},
        };
    }

    if (wfMatch && activeWf?.stage) {
        return {
            stage: String(activeWf.stage).toLowerCase(),
            history: Array.isArray(activeWf.history) ? activeWf.history : [],
            wf: activeWf,
        };
    }
    if (snap && (snap.stage || (Array.isArray(snap.history) && snap.history.length))) {
        return {
            stage: String(snap.stage || '').toLowerCase(),
            history: Array.isArray(snap.history) ? snap.history : [],
            wf: wfMatch ? activeWf : {},
        };
    }

    if (['draft', 'pending'].includes(String(remark.requestStatus || '').toLowerCase())) {
        return { stage: 'pending', history: [], wf: {} };
    }
    if (String(remark.requestStatus || '').toLowerCase() === 'submitted') {
        return { stage: 'pending_hr', history: [], wf: {} };
    }

    return { stage: '', history: [], wf: {} };
}

function mapHistoryEntry(h) {
    const stage = String(h.stage || '').toLowerCase();
    const action = String(h.action || '').toLowerCase();
    if (action === 'created' && stage === 'pending_hr') {
        return { type: 'request_submitted', at: h.at, byName: h.byName, note: h.note };
    }
    if (action === 'approve' && stage === 'pending_hr') {
        return { type: 'quotation_review_approved', at: h.at, byName: h.byName, note: h.note };
    }
    if (action === 'approve' && stage === 'pending_accounts') {
        return { type: 'accounts_approved', at: h.at, byName: h.byName, note: h.note };
    }
    if (action === 'updated') {
        return { type: 'service_updated', at: h.at, byName: h.byName, note: h.note };
    }
    return null;
}

function buildLegacyTireActivityLog(service, asset, remark, { history, stage, wf }) {
    const legacy = [];
    const wfMatch = wf && Object.keys(wf).length > 0 ? wf : asset?.activeServiceWorkflow || {};

    if (service?.createdAt) {
        legacy.push({
            type: 'service_created',
            at: service.createdAt,
            byName: remark.requestedByName || '',
        });
    }

    history
        .map(mapHistoryEntry)
        .filter(Boolean)
        .forEach((entry) => legacy.push(entry));

    history
        .filter((h) => h.action === 'updated')
        .forEach((h) => {
            legacy.push({
                type: 'service_updated',
                at: h.at,
                byName: h.byName || remark.requestedByName || '',
            });
        });

    if (
        !legacy.some((a) => a.type === 'request_submitted') &&
        (remark.assignmentSubmittedAt || String(remark.requestStatus || '').toLowerCase() === 'submitted')
    ) {
        legacy.push({
            type: 'request_submitted',
            at: remark.assignmentSubmittedAt || service?.updatedAt || service?.createdAt,
            byName: remark.requestedByName || '',
        });
    }

    if (!legacy.some((a) => a.type === 'garage_updated') && wfMatch.garageSubmittedAt) {
        legacy.push({
            type: 'garage_updated',
            at: wfMatch.garageSubmittedAt,
            byName: remark.garageSubmittedByName || '',
        });
    }

    if (
        !legacy.some((a) => a.type === 'service_completed') &&
        (remark.vehicleServiceCompletedAt || stage === 'complete')
    ) {
        legacy.push({
            type: 'service_completed',
            at: remark.vehicleServiceCompletedAt || service?.updatedAt,
            byName: remark.serviceCompletedByName || remark.requestedByName || '',
        });
    }

    return legacy;
}

function mergeActivityLogs(primary = [], supplemental = []) {
    const merged = [...primary];
    const typesPresent = new Set(primary.map((a) => a.type));
    for (const entry of supplemental) {
        if (!typesPresent.has(entry.type)) {
            merged.push(entry);
            typesPresent.add(entry.type);
        }
    }
    return merged.sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
}

function getTireActivityLog(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const fromRemark = Array.isArray(remark.tireActivityLog) ? remark.tireActivityLog : [];
    const { history, stage, wf } = resolveWorkflowForService(asset, service);
    const legacy = buildLegacyTireActivityLog(service, asset, remark, { history, stage, wf });

    if (!fromRemark.length) return legacy;
    return mergeActivityLogs(fromRemark, legacy);
}

function latestActivity(activities, type) {
    const rows = activities.filter((a) => a.type === type);
    if (!rows.length) return null;
    return rows[rows.length - 1];
}

function resolveActiveStepId(activities, stage) {
    const has = (t) => activities.some((a) => a.type === t);

    if (has('service_completed') || stage === 'complete') return 8;
    if (stage === 'pending_admin_return') return 7;
    if (has('accounts_approved')) return 7;
    if (stage === 'pending_accounts') return 6;
    if (has('garage_updated')) return 6;
    if (stage === 'pending_admin_officer') return 5;
    if (has('quotation_review_approved')) return 5;
    if (stage === 'pending_hr') return 4;
    if (has('request_submitted')) return 4;
    if (has('service_updated')) return 3;
    if (has('service_created')) return 2;
    return 1;
}

function buildStepEvent(step, { currentActiveStepId, isRejected, actor, date, detail }) {
    const approved = step.id < currentActiveStepId;
    const isStepRejected = isRejected && currentActiveStepId === step.id;
    const isStepPending = currentActiveStepId === step.id && !isRejected;

    return {
        id: `tire-workflow-${step.id}`,
        kind: 'workflow',
        stepNumber: step.id,
        label: step.label,
        badge: approved
            ? 'Done'
            : isStepRejected
              ? 'Rejected'
              : isStepPending
                ? 'Pending'
                : 'Scheduled',
        badgeVariant: approved
            ? 'approved'
            : isStepRejected
              ? 'rejected'
              : isStepPending
                ? 'pending'
                : 'scheduled',
        actor: actor || '',
        date,
        detail,
        connectorGreen: step.id < currentActiveStepId,
        isLast: false,
    };
}

function formatDetailDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function buildTireChangeDetailWorkflowEvents(asset, service) {
    const activities = getTireActivityLog(service, asset);
    const { stage } = resolveWorkflowForService(asset, service);
    const currentActiveStepId = resolveActiveStepId(activities, stage);
    const remark = parseVehicleServiceRemark(service) || {};
    const updateCount = activities.filter((a) => a.type === 'service_updated').length;

    const events = TIRE_CHANGE_WORKFLOW_STEPS.map((step) => {
        const activityType = ACTIVITY_BY_STEP[step.id];
        const activity = latestActivity(activities, activityType);
        let actor = activity?.byName || '';
        let date = activity?.at || null;
        let detail = activity?.note || '';

        if (step.id === 1 && !date) {
            date = service?.createdAt || service?.date || null;
            actor =
                actor ||
                remark.requestedByName ||
                latestActivity(activities, 'request_submitted')?.byName ||
                '';
        }
        if (step.id === 2 && updateCount > 1) {
            detail = detail ? `${detail} · ${updateCount} updates` : `${updateCount} updates recorded`;
        }
        if (step.id === 3 && remark.assignmentSubmittedAt) {
            date = date || remark.assignmentSubmittedAt;
            actor = actor || remark.requestedByName || '';
        }
        if (step.id === 4 && remark.tireQuoteReview?.approvedQuote) {
            const quoteLine = `Approved quote: ${remark.tireQuoteReview.approvedQuote}`;
            detail = detail ? `${detail} · ${quoteLine}` : quoteLine;
        }
        if (step.id === 5 && (remark.serviceStartDate || remark.scheduledServiceDate)) {
            const start = formatDetailDate(remark.serviceStartDate || remark.scheduledServiceDate);
            const startLine = `Service start: ${start}`;
            detail = detail ? `${detail} · ${startLine}` : startLine;
        }
        if (step.id === 7 && remark.vehicleServiceCompletedAt) {
            date = date || remark.vehicleServiceCompletedAt;
            actor = actor || remark.serviceCompletedByName || '';
        }

        return buildStepEvent(step, {
            currentActiveStepId,
            isRejected: stage === 'rejected',
            actor,
            date,
            detail: detail || undefined,
        });
    });

    if (events.length) {
        events[events.length - 1].isLast = true;
    }

    return events;
}
