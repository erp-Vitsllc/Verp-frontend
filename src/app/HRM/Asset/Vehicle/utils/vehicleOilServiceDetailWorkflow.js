import { normalizeMongoId, parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import {
    isOilServiceLive,
    isOilServiceScheduledWaiting,
} from './vehicleOilServiceAccess';

export const OIL_SERVICE_WORKFLOW_STEPS = [
    { id: 1, label: 'Service Created', role: 'Creator' },
    { id: 2, label: 'Service Updated', role: 'Editor' },
    { id: 3, label: 'Scheduled', role: 'Schedule' },
    { id: 4, label: 'On Service', role: 'Service' },
    { id: 5, label: 'End Service', role: 'Complete' },
];

function formatOilDate(value) {
    if (!value) return '—';
    const str = String(value).trim();
    let iso = str;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        iso = str.slice(0, 10);
    } else if (/^\d{4}-\d{2}$/.test(str)) {
        iso = `${str}-01`;
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return str;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

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
        };
    }

    if (wfMatch && activeWf?.stage) {
        return {
            stage: String(activeWf.stage).toLowerCase(),
            history: Array.isArray(activeWf.history) ? activeWf.history : [],
        };
    }
    if (snap && (snap.stage || (Array.isArray(snap.history) && snap.history.length))) {
        return {
            stage: String(snap.stage || '').toLowerCase(),
            history: Array.isArray(snap.history) ? snap.history : [],
        };
    }

    if (['draft', 'pending'].includes(String(remark.requestStatus || '').toLowerCase())) {
        return { stage: 'pending', history: [] };
    }
    if (String(remark.requestStatus || '').toLowerCase() === 'submitted') {
        return { stage: 'scheduled_service', history: [] };
    }

    return { stage: '', history: [] };
}

function buildLegacyOilActivityLog(service, asset, remark, { history, stage }) {
    const legacy = [];
    const live = isOilServiceLive(service, asset);
    const waiting = isOilServiceScheduledWaiting(service, asset);

    if (service?.createdAt) {
        legacy.push({
            type: 'service_created',
            at: service.createdAt,
            byName: remark.requestedByName || 'User',
        });
    }

    const updates = history.filter((h) => h.action === 'updated');
    updates.forEach((h) => {
        legacy.push({
            type: 'service_updated',
            at: h.at,
            byName: h.byName || 'User',
        });
    });

    if (
        updates.length === 0 &&
        (stage === 'scheduled_service' ||
            remark.assignmentSubmittedAt ||
            String(remark.requestStatus || '').toLowerCase() === 'submitted')
    ) {
        legacy.push({
            type: 'service_updated',
            at: remark.assignmentSubmittedAt || service?.updatedAt || service?.createdAt,
            byName: remark.requestedByName || 'User',
        });
    }

    const scheduledEntry =
        history.find((h) => h.action === 'scheduled') ||
        (remark.oilServiceScheduledAt || remark.assignmentSubmittedAt
            ? {
                  at: remark.oilServiceScheduledAt || remark.assignmentSubmittedAt,
                  byName: remark.requestedByName || 'User',
              }
            : null);

    if (scheduledEntry || waiting || live || stage === 'scheduled_service' || remark.assignmentSubmittedAt) {
        legacy.push({
            type: 'service_scheduled',
            at: scheduledEntry?.at || remark.oilServiceScheduledAt || remark.assignmentSubmittedAt || service?.updatedAt,
            byName: scheduledEntry?.byName || remark.requestedByName || 'User',
        });
    }

    const onService =
        history.find((h) => h.action === 'on_service') ||
        (remark.oilServiceLiveAt ? { at: remark.oilServiceLiveAt, byName: 'System' } : null);
    if (onService || live) {
        legacy.push({
            type: 'on_service',
            at:
                onService?.at ||
                remark.oilServiceLiveAt ||
                asset?.activeServiceWorkflow?.oilServiceLiveAt ||
                service?.updatedAt,
            byName: onService?.byName || 'System',
        });
    }

    history
        .filter((h) => h.action === 'date_change')
        .forEach((h) => {
            legacy.push({
                type: 'date_change',
                at: h.at,
                byName: h.byName || 'User',
                note: h.note || 'Service date updated',
                field: h.field,
                from: h.from,
                to: h.to,
            });
        });

    const completed =
        history.find((h) => h.action === 'completed' || (h.action === 'approve' && h.stage === 'complete')) ||
        (remark.vehicleServiceCompletedAt
            ? { at: remark.vehicleServiceCompletedAt, byName: remark.requestedByName }
            : null);
    if (completed || stage === 'complete' || remark.vehicleServiceCompleted === 'live') {
        legacy.push({
            type: 'service_completed',
            at: completed?.at || remark.vehicleServiceCompletedAt || service?.updatedAt,
            byName: completed?.byName || 'User',
        });
    }

    return legacy;
}

function mergeOilActivityLogs(primary = [], supplemental = []) {
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

function getOilActivityLog(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const fromRemark = Array.isArray(remark.oilActivityLog) ? remark.oilActivityLog : [];
    const { history, stage } = resolveWorkflowForService(asset, service);
    const legacy = buildLegacyOilActivityLog(service, asset, remark, { history, stage });

    if (!fromRemark.length) return legacy;

    const normalized = fromRemark.map((entry) => {
        if (entry.type === 'on_service' && !isOilServiceLive(service, asset) && remark.assignmentSubmittedAt) {
            return { ...entry, type: 'service_scheduled', note: entry.note || 'Oil service scheduled' };
        }
        return entry;
    });

    return mergeOilActivityLogs(normalized, legacy);
}

function resolveActiveStepId(activities, stage, service, asset) {
    const hasCreated = activities.some((a) => a.type === 'service_created');
    const hasUpdated = activities.some((a) => a.type === 'service_updated');
    const hasScheduled = activities.some((a) => a.type === 'service_scheduled');
    const hasOnService = activities.some((a) => a.type === 'on_service');
    const hasCompleted = activities.some((a) => a.type === 'service_completed');
    const live = isOilServiceLive(service, asset);
    const waiting = isOilServiceScheduledWaiting(service, asset);

    if (hasCompleted || stage === 'complete') return 6;
    if (hasOnService || live) return 5;
    if (hasScheduled || waiting || stage === 'scheduled_service') return 4;
    if (hasUpdated) return 3;
    if (hasCreated) return 2;
    return 1;
}

function buildStepEvent(step, { currentActiveStepId, isRejected, actor, date, detail }) {
    const approved = step.id < currentActiveStepId;
    const isStepRejected = isRejected && currentActiveStepId === step.id;
    const isStepPending = currentActiveStepId === step.id && !isRejected;

    return {
        id: `workflow-${step.id}`,
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
        actor,
        date,
        detail,
        connectorGreen: step.id < currentActiveStepId,
        isLast: false,
    };
}

function buildDateChangeEvents(activities, slot = 'pre') {
    return activities
        .filter((a) => a.type === 'date_change')
        .map((a, index) => {
            const fieldLabel = a.field === 'end' ? 'End date' : 'Start date';
            const detail =
                a.from || a.to
                    ? `${fieldLabel}: ${formatOilDate(a.from)} → ${formatOilDate(a.to)}`
                    : a.note || 'Service date updated';

            return {
                id: `oil-date-change-${slot}-${index}-${a.at || index}`,
                kind: 'schedule-edit',
                label: a.note || 'Service date updated',
                badge: 'Done',
                badgeVariant: 'approved',
                actor: a.byName || 'Admin',
                date: a.at,
                detail,
                connectorGreen: true,
                isLast: false,
            };
        });
}

function partitionDateChangeEvents(activities, service, asset) {
    const dateActivities = activities.filter((a) => a.type === 'date_change');
    if (!dateActivities.length) {
        return { beforeOnService: [], afterOnService: [] };
    }

    const waiting = isOilServiceScheduledWaiting(service, asset);
    const live = isOilServiceLive(service, asset);
    const onServiceAt = latestActivity(activities, 'on_service')?.at;
    const onServiceMs = onServiceAt ? new Date(onServiceAt).getTime() : null;

    const before = [];
    const after = [];

    for (const activity of dateActivities) {
        const changeMs = activity.at ? new Date(activity.at).getTime() : 0;
        const isBeforeOnService =
            waiting || (!live && (onServiceMs == null || changeMs < onServiceMs));
        if (isBeforeOnService) before.push(activity);
        else after.push(activity);
    }

    return {
        beforeOnService: buildDateChangeEvents(before, 'pre'),
        afterOnService: buildDateChangeEvents(after, 'post'),
    };
}

function latestActivity(activities, type) {
    const rows = activities.filter((a) => a.type === type);
    if (!rows.length) return null;
    return rows[rows.length - 1];
}

function resolveOilScheduleDates(asset, service, remark = {}) {
    const serviceId = normalizeMongoId(service?._id);
    const activeWf = asset?.activeServiceWorkflow || {};
    const wfMatch = serviceId && normalizeMongoId(activeWf.serviceRecordId) === serviceId;

    const start =
        remark.serviceStartDate ||
        remark.scheduledServiceDate ||
        (wfMatch && activeWf.scheduledServiceDate ? activeWf.scheduledServiceDate : null);

    const end =
        remark.serviceEndDate ||
        remark.nextChangeMonth ||
        (wfMatch && activeWf.serviceWindowEndDate ? activeWf.serviceWindowEndDate : null);

    return { start, end };
}

export function buildOilServiceDetailWorkflowEvents(asset, service) {
    const activities = getOilActivityLog(service, asset);
    const { stage } = resolveWorkflowForService(asset, service);
    const currentActiveStepId = resolveActiveStepId(activities, stage, service, asset);

    const created = latestActivity(activities, 'service_created');
    const updated = latestActivity(activities, 'service_updated');
    const scheduled = latestActivity(activities, 'service_scheduled');
    const onService = latestActivity(activities, 'on_service');
    const completed = latestActivity(activities, 'service_completed');

    const remark = parseVehicleServiceRemark(service) || {};
    const { start: serviceStartDate, end: serviceEndDate } = resolveOilScheduleDates(asset, service, remark);

    const stepActors = {
        1: created?.byName || remark.requestedByName || 'User',
        2: updated?.byName || created?.byName || remark.requestedByName || 'User',
        3: scheduled?.byName || remark.requestedByName || 'User',
        4: onService?.byName || 'System',
        5: completed?.byName || 'User',
    };

    const stepDates = {
        1: created?.at || service?.createdAt || service?.date || null,
        2: updated?.at || null,
        3: scheduled?.at || remark.oilServiceScheduledAt || remark.assignmentSubmittedAt || null,
        4: onService?.at || remark.oilServiceLiveAt || asset?.activeServiceWorkflow?.oilServiceLiveAt || null,
        5: completed?.at || remark.vehicleServiceCompletedAt || null,
    };

    const updateCount = activities.filter((a) => a.type === 'service_updated').length;

    const workflowEvents = OIL_SERVICE_WORKFLOW_STEPS.map((step) => {
        let detail;
        if (step.id === 2 && updateCount > 1) {
            detail = `${updateCount} updates recorded`;
        }
        if (step.id === 2 && serviceStartDate) {
            const startLine = `Service start: ${formatOilDate(serviceStartDate)}`;
            detail = detail ? `${detail} · ${startLine}` : startLine;
        }
        if (step.id === 3 && serviceStartDate) {
            detail = `Waiting for start date · ${formatOilDate(serviceStartDate)}`;
        }
        if (step.id === 4 && serviceStartDate) {
            detail = `Service start: ${formatOilDate(serviceStartDate)}`;
        }
        if (step.id === 5 && serviceEndDate) {
            detail = `Service end: ${formatOilDate(serviceEndDate)}`;
        }

        return buildStepEvent(step, {
            currentActiveStepId,
            isRejected: stage === 'rejected',
            actor: stepActors[step.id],
            date: stepDates[step.id],
            detail,
        });
    });

    const { beforeOnService: dateEventsBeforeOnService, afterOnService: dateEventsAfterOnService } =
        partitionDateChangeEvents(activities, service, asset);

    const steps12 = workflowEvents.slice(0, 2);
    const scheduledStep = workflowEvents[2];
    const onServiceStep = workflowEvents[3];
    const endServiceStep = workflowEvents[4];

    const tailCount = dateEventsAfterOnService.length + (endServiceStep ? 1 : 0);
    if (onServiceStep) {
        onServiceStep.isLast = tailCount === 0;
        onServiceStep.connectorGreen = currentActiveStepId > 4;
    }
    if (endServiceStep) {
        endServiceStep.isLast = true;
        endServiceStep.connectorGreen = currentActiveStepId > 5;
    }

    return [
        ...steps12,
        scheduledStep,
        ...dateEventsBeforeOnService,
        onServiceStep,
        ...dateEventsAfterOnService,
        endServiceStep,
    ].filter(Boolean);
}
