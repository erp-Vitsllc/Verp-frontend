import { normalizeMongoId, parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import {
    isOilServiceLive,
    isOilServiceScheduledWaiting,
    isOilServiceInitiated,
    isOilServiceScheduleStepComplete,
} from './vehicleOilServiceAccess';
import {
    formatEmployeeName,
    nameFromFlowchartRow,
    pickFlowchartAdminRow,
} from './vehicleHandoverAssignWorkflow';
import { resolveShopServiceFlowchartActors } from './vehicleShopServiceWorkflowActors';

/** Warranty (no payment) — Initiate → Schedule → On Service → Complete Service. */
export const OIL_SERVICE_WORKFLOW_STEPS = [
    { id: 1, label: 'Initiate Service', role: 'Creator' },
    { id: 2, label: 'Schedule and Reschedule', role: 'Admin Officer' },
    { id: 3, label: 'On Service', role: 'Service' },
    { id: 4, label: 'Complete Service', role: 'Admin Officer' },
];

/** Cash — Initiate → Schedule + HR (parallel) → Accounts → On Service → Complete → Make Payment. */
export const OIL_SERVICE_CASH_WORKFLOW_STEPS = [
    { id: 1, label: 'Initiate Service', role: 'Creator' },
    { id: 2, label: 'Schedule and Reschedule', role: 'Admin Officer' },
    { id: 3, label: 'HR Approval', role: 'HR' },
    { id: 4, label: 'Accounts Approve', role: 'Accounts' },
    { id: 5, label: 'On Service', role: 'Service' },
    { id: 6, label: 'Complete Service', role: 'Admin Officer' },
    { id: 7, label: 'Make Payment', role: 'Accounts' },
];

export function isOilServiceCashAmountMode(remark = {}) {
    return String(remark?.amountMode || '').toLowerCase() !== 'warranty';
}

function isPlaceholderActor(name) {
    const n = String(name || '').trim();
    if (!n) return true;
    const lower = n.toLowerCase();
    if (lower === 'user' || lower === 'system' || lower === 'admin' || lower === '—') return true;
    // Never show raw Mongo ObjectIds in the timeline "Action by" line.
    if (/^[a-fA-F0-9]{24}$/.test(n)) return true;
    return false;
}

/** Tracker labels: name only (no employee id); collapse duplicated first/last. */
function formatTrackerActorName(name) {
    let cleaned = String(name || '')
        .replace(/\s*\([^)]*\)\s*$/, '')
        .trim();
    if (!cleaned || isPlaceholderActor(cleaned)) return '';
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
        return parts[0];
    }
    return cleaned;
}

function flowchartNameOnly(name) {
    return formatTrackerActorName(name);
}

function nameFromFlowchartObjectId(flowchartRows = [], objectId) {
    const id = String(objectId || '').trim().toLowerCase();
    if (!id || !Array.isArray(flowchartRows) || !flowchartRows.length) return '';
    const row = flowchartRows.find((r) => {
        const candidates = [
            r?.empObjectId,
            r?.employeeObjectId,
            r?._id,
            r?.id,
            r?.employee?._id,
            r?.employee?.id,
        ];
        return candidates.some((c) => String(c || '').trim().toLowerCase() === id);
    });
    return flowchartNameOnly(nameFromFlowchartRow(row));
}

function resolveOilAssigneeName(asset) {
    return formatTrackerActorName(formatEmployeeName(asset?.assignedTo)) || '';
}

function resolveOilRequesterName(remark = {}, asset = null, service = null) {
    const fromRemark = formatTrackerActorName(remark.requestedByName);
    if (fromRemark && !isPlaceholderActor(fromRemark)) return fromRemark;

    // Prefer the employee who created the service row — never the vehicle assignee.
    const createdBy =
        formatTrackerActorName(formatEmployeeName(service?.requestedBy)) ||
        formatTrackerActorName(remark.createdByName) ||
        '';
    if (createdBy && !isPlaceholderActor(createdBy)) return createdBy;

    return '';
}

function resolveOilActorName(
    raw,
    {
        remark,
        asset,
        service,
        flowchartActors,
        flowchartRows,
        preferSystem = false,
        allowAssigneeFallback = false,
    } = {},
) {
    const rawStr = String(raw || '').trim();
    const fromFlowchartId = /^[a-fA-F0-9]{24}$/.test(rawStr)
        ? nameFromFlowchartObjectId(flowchartRows, rawStr)
        : '';
    if (fromFlowchartId) return fromFlowchartId;

    const cleaned = formatTrackerActorName(raw);
    if (cleaned && !isPlaceholderActor(cleaned)) return cleaned;
    if (preferSystem && String(raw || '').trim().toLowerCase() === 'system') {
        return (
            flowchartNameOnly(flowchartActors?.adminOfficer) ||
            resolveOilRequesterName(remark, asset, service) ||
            'System'
        );
    }
    const requester = resolveOilRequesterName(remark, asset, service);
    if (requester) return requester;
    if (allowAssigneeFallback) {
        const assignee = resolveOilAssigneeName(asset);
        if (assignee) return assignee;
    }
    return flowchartNameOnly(flowchartActors?.adminOfficer) || '';
}

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

    const remarkStage = String(remark.workflowStage || '').toLowerCase();
    if (remarkStage === 'pending_hr' || remarkStage === 'pending_accounts' || remarkStage === 'billed') {
        return {
            stage: remarkStage,
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

function buildLegacyOilActivityLog(service, asset, remark, { history, stage, flowchartActors = {}, flowchartRows = [] }) {
    const legacy = [];
    const live = isOilServiceLive(service, asset);
    const waiting = isOilServiceScheduledWaiting(service, asset);
    const requester = resolveOilRequesterName(remark, asset, service);
    const isCash = isOilServiceCashAmountMode(remark);
    const hrName = flowchartNameOnly(flowchartActors?.hr) || 'HR';
    const accountsName = flowchartNameOnly(flowchartActors?.accounts) || 'Accounts';
    const adminName = flowchartNameOnly(flowchartActors?.adminOfficer) || 'Admin Officer';
    const actorOpts = { remark, asset, service, flowchartActors, flowchartRows };

    if (service?.createdAt) {
        legacy.push({
            type: 'service_created',
            at: service.createdAt,
            byName: requester || adminName,
        });
    }

    const updates = history.filter((h) => h.action === 'updated');
    updates.forEach((h) => {
        legacy.push({
            type: 'service_updated',
            at: h.at,
            byName: resolveOilActorName(h.byName, actorOpts),
        });
    });

    if (
        updates.length === 0 &&
        (stage === 'scheduled_service' ||
            remark.assignmentSubmittedAt ||
            String(remark.requestStatus || '').toLowerCase() === 'submitted') &&
        isOilServiceScheduleStepComplete(remark)
    ) {
        legacy.push({
            type: 'service_updated',
            at: remark.assignmentSubmittedAt || service?.updatedAt || service?.createdAt,
            byName: requester || adminName,
        });
    }

    const scheduledEntry =
        history.find((h) => h.action === 'scheduled') ||
        (isOilServiceScheduleStepComplete(remark) &&
        (remark.oilServiceScheduledAt || remark.assignmentSubmittedAt)
            ? {
                  at: remark.oilServiceScheduledAt || remark.assignmentSubmittedAt,
                  byName: requester,
              }
            : null);

    // Only treat Schedule as done when Admin actually submitted complete garage/dates.
    if (scheduledEntry || isOilServiceScheduleStepComplete(remark)) {
        legacy.push({
            type: 'service_scheduled',
            at: scheduledEntry?.at || remark.oilServiceScheduledAt || remark.assignmentSubmittedAt || service?.updatedAt,
            byName:
                resolveOilActorName(scheduledEntry?.byName, actorOpts) ||
                requester ||
                adminName,
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
            byName:
                resolveOilActorName(onService?.byName, {
                    ...actorOpts,
                    preferSystem: true,
                }) || adminName,
        });
    }

    history
        .filter((h) => h.action === 'date_change')
        .forEach((h) => {
            legacy.push({
                type: 'date_change',
                at: h.at,
                byName: resolveOilActorName(h.byName, actorOpts),
                note: h.note || 'Service date updated',
                field: h.field,
                from: h.from,
                to: h.to,
            });
        });

    const completed =
        history.find((h) => h.action === 'completed' || (h.action === 'approve' && h.stage === 'complete')) ||
        (remark.vehicleServiceCompletedAt || remark.oilServiceEndedAt
            ? {
                  at: remark.vehicleServiceCompletedAt || remark.oilServiceEndedAt,
                  byName: remark.serviceCompletedByName || requester,
              }
            : null);
    // Cash: pending_hr is schedule approval (before On Service) — never treat as End Service.
    const endServiceDone =
        Boolean(completed) ||
        stage === 'complete' ||
        stage === 'billed' ||
        (isCash && stage === 'pending_accounts') ||
        String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live' ||
        Boolean(remark.oilServiceEndedAt);

    if (endServiceDone) {
        legacy.push({
            type: 'service_completed',
            at: completed?.at || remark.vehicleServiceCompletedAt || remark.oilServiceEndedAt || service?.updatedAt,
            byName:
                resolveOilActorName(completed?.byName || remark.serviceCompletedByName, actorOpts) ||
                adminName ||
                requester,
        });
    }

    const hrDone = Boolean(remark.hrScheduleApprovedAt || remark.hrPaymentApprovedAt);

    if (hrDone && isCash) {
        legacy.push({
            type: 'hr_approved',
            at: remark.hrScheduleApprovedAt || remark.hrPaymentApprovedAt || null,
            byName:
                formatTrackerActorName(remark.hrScheduleApprovedByName || remark.hrPaymentApprovedByName) ||
                hrName,
        });
    }

    const accountsDone =
        stage === 'billed' ||
        String(remark.billingStatus || '').toLowerCase() === 'billed' ||
        Boolean(remark.accountsPaymentApprovedAt);

    if (accountsDone && isCash) {
        legacy.push({
            type: 'accounts_approved',
            at: remark.accountsPaymentApprovedAt || null,
            byName: formatTrackerActorName(remark.accountsPaymentApprovedByName) || accountsName,
        });
    }

    const accountsQuoteDone = Boolean(String(remark.accountsQuoteApprovedAt || '').trim());
    if (accountsQuoteDone && isCash) {
        legacy.push({
            type: 'accounts_quote_approved',
            at: remark.accountsQuoteApprovedAt || null,
            byName: formatTrackerActorName(remark.accountsQuoteApprovedByName) || accountsName,
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

function getOilActivityLog(service, asset, flowchartActors = {}, flowchartRows = []) {
    const remark = parseVehicleServiceRemark(service) || {};
    const fromRemark = Array.isArray(remark.oilActivityLog) ? remark.oilActivityLog : [];
    const { history, stage } = resolveWorkflowForService(asset, service);
    const legacy = buildLegacyOilActivityLog(service, asset, remark, {
        history,
        stage,
        flowchartActors,
        flowchartRows,
    });

    if (!fromRemark.length) return legacy;

    const normalized = fromRemark
        .filter((entry) => {
            // Never invent a Schedule Done tick from a stale activity if garage fields are incomplete.
            if (entry.type === 'service_scheduled' && !isOilServiceScheduleStepComplete(remark)) {
                return false;
            }
            return true;
        })
        .map((entry) => {
        if (
            entry.type === 'on_service' &&
            !isOilServiceLive(service, asset) &&
            isOilServiceScheduleStepComplete(remark)
        ) {
            return { ...entry, type: 'service_scheduled', note: entry.note || 'Oil service scheduled' };
        }
        return {
            ...entry,
            byName: resolveOilActorName(entry.byName, {
                remark,
                asset,
                service,
                flowchartActors,
                flowchartRows,
                preferSystem: entry.type === 'on_service',
            }),
        };
    });

    return mergeOilActivityLogs(normalized, legacy);
}

function resolveActiveStepId(activities, stage, service, asset, isCash = false) {
    const remark = parseVehicleServiceRemark(service) || {};
    const hasUpdated = activities.some((a) => a.type === 'service_updated');
    const hasScheduled = isOilServiceScheduleStepComplete(remark);
    const hasOnService = activities.some((a) => a.type === 'on_service');
    const hasCompleted = activities.some((a) => a.type === 'service_completed');
    const hasHr = Boolean(String(remark.hrScheduleApprovedAt || remark.hrPaymentApprovedAt || '').trim());
    const hasAccountsQuote = Boolean(String(remark.accountsQuoteApprovedAt || '').trim());
    const hasAccountsPay = activities.some(
        (a) => a.type === 'accounts_approved' || a.type === 'zoho_bill_created',
    );
    const live = isOilServiceLive(service, asset);
    const waiting = isOilServiceScheduledWaiting(service, asset);
    const initiated = isOilServiceInitiated(remark) || hasUpdated;

    if (isCash) {
        // Tick only when that step is truly done — never skip past incomplete Schedule.
        if (stage === 'billed' || hasAccountsPay) return 8;
        if (stage === 'pending_accounts' || hasCompleted) return 7;
        if (!initiated) return 1;
        if (!hasScheduled) return 2;
        if (!hasHr) return 3;
        if (!hasAccountsQuote) return 4;
        if (!(hasOnService || live || waiting)) return 5;
        return 6;
    }

    // 1 Initiate 2 Schedule 3 On Service 4 Complete
    if (hasCompleted || stage === 'complete' || stage === 'billed') return 5;
    if (!initiated && !hasUpdated) return 1;
    if (!hasScheduled) return 2;
    if (!(hasOnService || live || waiting)) return 3;
    return 4;
}

function buildStepEvent(step, { isDone, isActive, isRejected, actor, date, detail }) {
    const actorFirst =
        String(formatTrackerActorName(actor) || '')
            .split(/\s+/)
            .filter(Boolean)[0] || '';
    const labelWithActor = actorFirst ? `${step.label} by ${actorFirst}` : step.label;

    return {
        id: `workflow-${step.id}`,
        kind: 'workflow',
        stepNumber: step.id,
        label: labelWithActor,
        badge: isDone
            ? 'Done'
            : isRejected
              ? 'Rejected'
              : isActive
                ? 'Pending'
                : 'Scheduled',
        badgeVariant: isDone
            ? 'approved'
            : isRejected
              ? 'rejected'
              : isActive
                ? 'pending'
                : 'scheduled',
        // Name is already in the step label ("Initiate Service by John").
        actor: '',
        date: isDone || isActive ? date : null,
        detail,
        connectorGreen: isDone,
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

export function buildOilServiceDetailWorkflowEvents(asset, service, flowchartRows = []) {
    const remark = parseVehicleServiceRemark(service) || {};
    const isCash = isOilServiceCashAmountMode(remark);
    const flowchartActors = resolveShopServiceFlowchartActors(flowchartRows);
    const activities = getOilActivityLog(service, asset, flowchartActors, flowchartRows);
    const { stage } = resolveWorkflowForService(asset, service);
    const currentActiveStepId = resolveActiveStepId(activities, stage, service, asset, isCash);

    const created = latestActivity(activities, 'service_created');
    const updated = latestActivity(activities, 'service_updated');
    const scheduled = latestActivity(activities, 'service_scheduled');
    const onService = latestActivity(activities, 'on_service');
    const completed = latestActivity(activities, 'service_completed');
    const hrApproved = latestActivity(activities, 'hr_approved');
    const accountsQuoteApproved = latestActivity(activities, 'accounts_quote_approved');
    const accountsApproved = latestActivity(activities, 'accounts_approved');

    const adminOfficer =
        flowchartNameOnly(flowchartActors.adminOfficer) ||
        flowchartNameOnly(nameFromFlowchartRow(pickFlowchartAdminRow(flowchartRows))) ||
        'Admin Officer';
    const hrOfficer = flowchartNameOnly(flowchartActors.hr) || 'HR';
    const accountsOfficer = flowchartNameOnly(flowchartActors.accounts) || 'Accounts';
    const requester = resolveOilRequesterName(remark, asset, service);
    const { start: serviceStartDate, end: serviceEndDate } = resolveOilScheduleDates(asset, service, remark);
    const actorOpts = { remark, asset, service, flowchartActors, flowchartRows };
    const live = isOilServiceLive(service, asset);
    const ready = isOilServiceScheduledWaiting(service, asset);

    const steps = (isCash ? OIL_SERVICE_CASH_WORKFLOW_STEPS : OIL_SERVICE_WORKFLOW_STEPS).map((step) => {
        if (step.id === (isCash ? 5 : 3)) {
            return {
                ...step,
                label: live ? 'On Service' : ready ? 'Ready to Service' : 'On Service',
            };
        }
        return step;
    });

    // Service Created must be the person who raised the request — never the vehicle assignee fallback.
    const storedCreator =
        formatTrackerActorName(remark.createdByName) ||
        formatTrackerActorName(remark.requestedByName) ||
        '';
    const activityCreatorRaw = formatTrackerActorName(created?.byName);
    const activityCreator =
        activityCreatorRaw && !isPlaceholderActor(activityCreatorRaw) ? activityCreatorRaw : '';
    const createdActor = storedCreator || activityCreator || adminOfficer;
    const updatedActor =
        resolveOilActorName(updated?.byName, actorOpts) || createdActor;
    const scheduledActor =
        resolveOilActorName(scheduled?.byName, actorOpts) ||
        adminOfficer ||
        requester;
    const onServiceActor =
        resolveOilActorName(onService?.byName, {
            ...actorOpts,
            preferSystem: true,
        }) || adminOfficer;
    const endServiceActor =
        resolveOilActorName(completed?.byName || remark.serviceCompletedByName, actorOpts) ||
        adminOfficer ||
        requester;
    const hrActor =
        formatTrackerActorName(hrApproved?.byName || remark.hrScheduleApprovedByName || remark.hrPaymentApprovedByName) ||
        hrOfficer;
    const accountsQuoteActor =
        formatTrackerActorName(
            accountsQuoteApproved?.byName || remark.accountsQuoteApprovedByName,
        ) || accountsOfficer;
    const accountsActor =
        formatTrackerActorName(
            accountsApproved?.byName || remark.accountsPaymentApprovedByName,
        ) || accountsOfficer;

    // Step 1 "Initiate Service" merges Created + Updated (the Send moment) into a single card entry.
    const initiateActor = updatedActor || createdActor;
    const initiateDate = updated?.at || created?.at || service?.createdAt || service?.date || null;

    const stepActors = isCash
        ? {
              1: initiateActor,
              2: scheduledActor,
              3: hrActor,
              4: accountsQuoteActor,
              5: onServiceActor,
              6: endServiceActor,
              7: accountsActor,
              8: accountsActor,
          }
        : {
              1: initiateActor,
              2: scheduledActor,
              3: onServiceActor,
              4: endServiceActor,
          };

    const stepDates = isCash
        ? {
              1: initiateDate,
              2: scheduled?.at || remark.oilServiceScheduledAt || remark.assignmentSubmittedAt || null,
              3: hrApproved?.at || remark.hrScheduleApprovedAt || remark.hrPaymentApprovedAt || null,
              4: accountsQuoteApproved?.at || remark.accountsQuoteApprovedAt || null,
              5: onService?.at || remark.oilServiceLiveAt || asset?.activeServiceWorkflow?.oilServiceLiveAt || null,
              6: completed?.at || remark.oilServiceEndedAt || remark.vehicleServiceCompletedAt || null,
              7: accountsApproved?.at || remark.accountsPaymentApprovedAt || null,
              8: accountsApproved?.at || remark.accountsPaymentApprovedAt || null,
          }
        : {
              1: initiateDate,
              2: scheduled?.at || remark.oilServiceScheduledAt || remark.assignmentSubmittedAt || null,
              3: onService?.at || remark.oilServiceLiveAt || asset?.activeServiceWorkflow?.oilServiceLiveAt || null,
              4: completed?.at || remark.oilServiceEndedAt || remark.vehicleServiceCompletedAt || null,
          };

    const updateCount = activities.filter((a) => a.type === 'service_updated').length;

    const workflowEvents = steps.map((step) => {
        let detail;
        if (step.id === 1 && updateCount > 1) {
            detail = `${updateCount} updates recorded`;
        }
        if (step.id === 1 && serviceStartDate) {
            const startLine = `Service start: ${formatOilDate(serviceStartDate)}`;
            detail = detail ? `${detail} · ${startLine}` : startLine;
        }
        if (step.id === 2 && serviceStartDate) {
            const waiting = isOilServiceScheduledWaiting(service, asset);
            const live = isOilServiceLive(service, asset);
            if (!isOilServiceScheduleStepComplete(remark)) {
                detail = 'Admin must complete garage details and dates';
            } else if (waiting && stage === 'pending_hr') {
                detail = `Awaiting HR · start ${formatOilDate(serviceStartDate)}`;
            } else if (waiting) {
                detail = `Waiting for start date · ${formatOilDate(serviceStartDate)}`;
            } else if (live || scheduled) {
                detail = `Scheduled · start ${formatOilDate(serviceStartDate)}`;
            } else {
                detail = `Planned start · ${formatOilDate(serviceStartDate)}`;
            }
        }
        if (isCash) {
            if (step.id === 3) {
                detail = currentActiveStepId === 3 ? 'Flowchart HR must approve schedule' : 'HR approved schedule';
            }
            if (step.id === 4) {
                detail =
                    currentActiveStepId === 4
                        ? 'Flowchart Accounts must approve quotation'
                        : 'Accounts approved quotation';
            }
            if (step.id === 5 && serviceStartDate) {
                detail = live
                    ? `On Service · start ${formatOilDate(serviceStartDate)}`
                    : ready
                      ? `Ready to Service · start ${formatOilDate(serviceStartDate)}`
                      : `Service start: ${formatOilDate(serviceStartDate)}`;
            }
            if (step.id === 6 && serviceEndDate) {
                detail = `Service end: ${formatOilDate(serviceEndDate)}`;
            }
            if (step.id === 7) {
                detail =
                    currentActiveStepId === 7
                        ? 'Flowchart Accounts — Make Payment (Zoho)'
                        : 'Accounts submitted Make Payment (Zoho)';
            }
        } else {
            if (step.id === 3 && serviceStartDate) {
                detail = live
                    ? `On Service · start ${formatOilDate(serviceStartDate)}`
                    : ready
                      ? `Ready to Service · start ${formatOilDate(serviceStartDate)}`
                      : `Service start: ${formatOilDate(serviceStartDate)}`;
            }
            if (step.id === 4 && serviceEndDate) {
                detail = `Service end: ${formatOilDate(serviceEndDate)}`;
            }
        }

        const scheduleDone = isOilServiceScheduleStepComplete(remark);
        const hrDoneStamp = Boolean(
            String(remark.hrScheduleApprovedAt || remark.hrPaymentApprovedAt || '').trim(),
        );
        const accountsQuoteDone = Boolean(String(remark.accountsQuoteApprovedAt || '').trim());
        const onServiceDone = live || ready || Boolean(onService);
        const completeDone = Boolean(completed) || stage === 'pending_accounts' || stage === 'billed' || stage === 'complete';
        const paymentDone =
            stage === 'billed' ||
            Boolean(accountsApproved) ||
            String(remark.billingStatus || '').toLowerCase() === 'billed';
        const initiateDone = Boolean(initiateDate) || isOilServiceInitiated(remark);

        const stepDoneMap = isCash
            ? {
                  1: initiateDone,
                  2: scheduleDone,
                  3: hrDoneStamp,
                  4: accountsQuoteDone,
                  5: onServiceDone && scheduleDone,
                  6: completeDone,
                  7: paymentDone,
              }
            : {
                  1: initiateDone,
                  2: scheduleDone,
                  3: onServiceDone && scheduleDone,
                  4: completeDone,
              };

        return buildStepEvent(step, {
            isDone: Boolean(stepDoneMap[step.id]),
            isActive: currentActiveStepId === step.id && stage !== 'rejected',
            isRejected: stage === 'rejected' && currentActiveStepId === step.id,
            actor: stepActors[step.id],
            date: stepDates[step.id],
            detail,
        });
    });

    const { beforeOnService: dateEventsBeforeOnService, afterOnService: dateEventsAfterOnService } =
        partitionDateChangeEvents(activities, service, asset);

    const decorateDateEvents = (rows) =>
        rows.map((row) => ({
            ...row,
            actor:
                formatTrackerActorName(
                    resolveOilActorName(row.actor, { remark, asset, service, flowchartActors, flowchartRows }),
                ) || adminOfficer,
        }));

    if (!isCash) {
        const [initiateStep, scheduledStep, onServiceStep, endServiceStep] = workflowEvents;

        const tailCount = dateEventsAfterOnService.length + (endServiceStep ? 1 : 0);
        if (onServiceStep) {
            onServiceStep.isLast = tailCount === 0;
            onServiceStep.connectorGreen = currentActiveStepId > 3;
        }
        if (endServiceStep) {
            endServiceStep.isLast = true;
            endServiceStep.connectorGreen = currentActiveStepId > 4;
        }

        return [
            initiateStep,
            scheduledStep,
            ...decorateDateEvents(dateEventsBeforeOnService),
            onServiceStep,
            ...decorateDateEvents(dateEventsAfterOnService),
            endServiceStep,
        ].filter(Boolean);
    }

    // Cash: Initiate → Schedule + HR (parallel) → Accounts → On Service → Complete → Make Payment
    const [
        initiateStep,
        scheduledStep,
        hrStep,
        accountsQuoteStep,
        onServiceStep,
        endServiceStep,
        accountsStep,
    ] = workflowEvents;

    // Parallel open: show HR as pending when Schedule is active and HR not done yet.
    if (hrStep && currentActiveStepId === 2 && !hrApproved) {
        hrStep.badge = 'Pending';
        hrStep.badgeVariant = 'pending';
    }

    if (hrStep) {
        hrStep.connectorGreen = currentActiveStepId > 3 || Boolean(hrApproved);
        hrStep.isLast = false;
    }
    if (accountsQuoteStep) {
        accountsQuoteStep.connectorGreen = currentActiveStepId > 4;
        accountsQuoteStep.isLast = false;
    }
    if (onServiceStep) {
        onServiceStep.connectorGreen = currentActiveStepId > 5;
        onServiceStep.isLast = false;
    }
    if (endServiceStep) {
        endServiceStep.connectorGreen = currentActiveStepId > 6;
        endServiceStep.isLast = false;
    }
    if (accountsStep) {
        accountsStep.connectorGreen = currentActiveStepId > 7;
        accountsStep.isLast = true;
    }

    return [
        initiateStep,
        scheduledStep,
        hrStep,
        accountsQuoteStep,
        ...decorateDateEvents(dateEventsBeforeOnService),
        onServiceStep,
        ...decorateDateEvents(dateEventsAfterOnService),
        endServiceStep,
        accountsStep,
    ].filter(Boolean);
}
