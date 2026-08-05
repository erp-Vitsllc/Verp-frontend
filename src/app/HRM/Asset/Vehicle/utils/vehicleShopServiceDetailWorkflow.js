/**
 * Oil-style Service Workflow History for shop services
 * (Tire Change / Mechanical Work / Body Work).
 *
 * Same 7 steps as Oil cash:
 * Initiate → Schedule → HR Approval → Accounts Approve → On Service → Complete → Make Payment
 */

import { normalizeMongoId, parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import {
    isShopServiceLiveOnAsset,
    isShopWorkScheduledWaiting,
    isShopWorkServiceLive,
} from './vehicleShopWorkStatus';
import {
    formatEmployeeName,
    nameFromFlowchartRow,
    pickFlowchartAdminRow,
} from './vehicleHandoverAssignWorkflow';
import { resolveShopServiceFlowchartActors } from './vehicleShopServiceWorkflowActors';

/** Same labels as Oil cash — kept local to avoid circular import with oil workflow utils. */
export const SHOP_SERVICE_CASH_WORKFLOW_STEPS = [
    { id: 1, label: 'Initiate Service', role: 'Creator' },
    { id: 2, label: 'Schedule and Reschedule', role: 'Admin Officer' },
    { id: 3, label: 'HR Approval', role: 'HR' },
    { id: 4, label: 'Accounts Approve', role: 'Accounts' },
    { id: 5, label: 'On Service', role: 'Service' },
    { id: 6, label: 'Complete Service', role: 'Admin Officer' },
    { id: 7, label: 'Make Payment', role: 'Accounts' },
];

export const SHOP_SERVICE_WORKFLOW_SUBTITLE =
    'Initiate, Schedule + HR Approval (together), Accounts, On Service, Complete Service, and Make Payment';

function isPlaceholderActor(name) {
    const n = String(name || '').trim();
    if (!n) return true;
    const lower = n.toLowerCase();
    if (lower === 'user' || lower === 'system' || lower === 'admin' || lower === '—') return true;
    if (/^[a-fA-F0-9]{24}$/.test(n)) return true;
    return false;
}

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

function formatShopDate(value) {
    if (!value) return '—';
    const str = String(value).trim();
    let iso = str;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) iso = str.slice(0, 10);
    else if (/^\d{4}-\d{2}$/.test(str)) iso = `${str}-01`;
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

    const remarkStage = String(remark.workflowStage || '').toLowerCase();
    const billingStatus = String(remark.billingStatus || '').toLowerCase();

    if (remarkStage === 'pending_billing') {
        return {
            stage: 'pending_billing',
            history: Array.isArray(snap?.history)
                ? snap.history
                : Array.isArray(activeWf?.history) && wfMatch
                  ? activeWf.history
                  : [],
            wf: wfMatch ? activeWf : {},
        };
    }

    if (remarkStage === 'billed' || billingStatus === 'billed' || String(remark.zohoBillId || '').trim()) {
        return {
            stage: 'billed',
            history: Array.isArray(snap?.history)
                ? snap.history
                : Array.isArray(activeWf?.history) && wfMatch
                  ? activeWf.history
                  : [],
            wf: wfMatch ? activeWf : {},
        };
    }

    if (
        remarkStage === 'complete' ||
        String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live'
    ) {
        return {
            stage: remarkStage === 'pending_billing' ? 'pending_billing' : 'complete',
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

function isGarageDone(remark, wf) {
    return Boolean(
        String(remark.garageSubmittedByName || '').trim() ||
            remark.garageSubmittedAt ||
            wf?.garageSubmittedAt,
    );
}

function isHrDone(remark, stage, history = []) {
    if (
        String(remark.hrReviewApprovedAt || '').trim() ||
        String(remark.hrApprovedAt || '').trim() ||
        String(remark.hrScheduleApprovedAt || '').trim()
    ) {
        return true;
    }
    if (String(remark.tireQuoteReview?.approvedQuote || remark.approvedQuoteKey || '').trim()) {
        if (stage && stage !== 'pending_hr' && stage !== 'pending' && stage !== '') return true;
    }
    return history.some(
        (h) =>
            String(h.action || '').toLowerCase() === 'approve' &&
            String(h.stage || '').toLowerCase() === 'pending_hr',
    );
}

function isAccountsApproveDone(remark, stage, history = []) {
    if (
        String(remark.accountsQuoteApprovedAt || '').trim() ||
        String(remark.accountsGarageApprovedAt || '').trim() ||
        String(remark.accountsApprovedAt || '').trim()
    ) {
        return true;
    }
    if (['pending_admin_return', 'pending_billing', 'billed', 'complete'].includes(stage)) {
        return true;
    }
    const accountsApprovedInHistory = history.some(
        (h) =>
            String(h.action || '').toLowerCase() === 'approve' &&
            String(h.stage || '').toLowerCase() === 'pending_accounts',
    );
    if (stage === 'scheduled_service' && accountsApprovedInHistory) {
        return true;
    }
    return accountsApprovedInHistory;
}

function isInitiateDone(remark, service) {
    if (String(remark.requestStatus || '').toLowerCase() === 'submitted') return true;
    if (String(remark.assignmentSubmittedAt || '').trim()) return true;
    if (service?.createdAt && String(remark.requestStatus || '').toLowerCase() !== 'draft') {
        return Boolean(remark.requestedByName);
    }
    return false;
}

function findHistory(history, predicate) {
    const rows = (history || []).filter(predicate);
    return rows.length ? rows[rows.length - 1] : null;
}

function buildStepEvent(step, { isDone, isActive, isRejected, actor, date, detail }) {
    const actorFirst =
        String(formatTrackerActorName(actor) || '')
            .split(/\s+/)
            .filter(Boolean)[0] || '';
    const labelWithActor = actorFirst ? `${step.label} by ${actorFirst}` : step.label;

    return {
        id: `shop-workflow-${step.id}`,
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
        actor: '',
        date: isDone || isActive ? date : null,
        detail,
        connectorGreen: isDone,
        isLast: false,
    };
}

function resolveActiveStepId({
    stage,
    initiateDone,
    scheduleDone,
    hrDone,
    accountsDone,
    onServiceDone,
    completeDone,
    paymentDone,
}) {
    const s = String(stage || '').toLowerCase();
    if (paymentDone || s === 'billed') return 8;
    if (s === 'pending_billing' || (completeDone && !paymentDone)) return 7;
    if (s === 'pending_admin_return' || (onServiceDone && !completeDone && scheduleDone)) return 6;
    if (s === 'scheduled_service' && onServiceDone && !completeDone) return 6;
    if (s === 'scheduled_service' || (accountsDone && scheduleDone && hrDone && !onServiceDone)) return 5;
    if (s === 'pending_accounts' || (scheduleDone && hrDone && !accountsDone)) return 4;
    // After Initiate: Schedule + HR open together — highlight Schedule while garage incomplete;
    // HR stays Pending via parallel badge below (oil cash style).
    if (s === 'pending_hr' && initiateDone && !scheduleDone) return 2;
    if (s === 'pending_admin_officer' || (hrDone && !scheduleDone)) return 2;
    if (s === 'pending_hr' || (initiateDone && !hrDone)) return 3;
    if (!initiateDone) return 1;
    if (!scheduleDone) return 2;
    if (!hrDone) return 3;
    if (!accountsDone) return 4;
    if (!onServiceDone) return 5;
    if (!completeDone) return 6;
    return 7;
}

/**
 * @param {'Tire Change'|'Mechanical Work'|'Body Work'} serviceTypeLabel
 * @param {string} [activityLogKey] remark activity log key (optional)
 */
export function buildShopServiceDetailWorkflowEvents(
    asset,
    service,
    flowchartRows = [],
    { activityLogKey = '' } = {},
) {
    const remark = parseVehicleServiceRemark(service) || {};
    const { stage, history, wf } = resolveWorkflowForService(asset, service);
    const flowchartActors = resolveShopServiceFlowchartActors(flowchartRows);

    const adminOfficer =
        flowchartNameOnly(flowchartActors.adminOfficer) ||
        flowchartNameOnly(nameFromFlowchartRow(pickFlowchartAdminRow(flowchartRows))) ||
        'Admin Officer';
    const hrOfficer = flowchartNameOnly(flowchartActors.hr) || 'HR';
    const accountsOfficer = flowchartNameOnly(flowchartActors.accounts) || 'Accounts';

    const requester =
        formatTrackerActorName(remark.requestedByName) ||
        formatTrackerActorName(remark.createdByName) ||
        formatTrackerActorName(formatEmployeeName(service?.requestedBy)) ||
        adminOfficer;

    const live =
        isShopWorkServiceLive(service, asset) || isShopServiceLiveOnAsset(asset, service);
    const ready = isShopWorkScheduledWaiting(service, asset);

    const initiateDone = isInitiateDone(remark, service);
    const scheduleDone = isGarageDone(remark, wf);
    const hrDone = isHrDone(remark, stage, history);
    const accountsDone = isAccountsApproveDone(remark, stage, history);
    const onServiceDone = live || ready || stage === 'pending_admin_return';
    const completeDone =
        Boolean(String(remark.vehicleServiceCompletedAt || '').trim()) ||
        String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live' ||
        stage === 'pending_billing' ||
        stage === 'billed' ||
        stage === 'complete';
    const paymentDone =
        stage === 'billed' ||
        String(remark.billingStatus || '').toLowerCase() === 'billed' ||
        Boolean(String(remark.zohoBillId || '').trim());

    const currentActiveStepId = resolveActiveStepId({
        stage,
        initiateDone,
        scheduleDone,
        hrDone,
        accountsDone,
        onServiceDone,
        completeDone,
        paymentDone,
    });

    const hrHist = findHistory(
        history,
        (h) =>
            String(h.action || '').toLowerCase() === 'approve' &&
            String(h.stage || '').toLowerCase() === 'pending_hr',
    );
    const accountsHist = findHistory(
        history,
        (h) =>
            String(h.action || '').toLowerCase() === 'approve' &&
            ['pending_accounts', 'pending_billing'].includes(String(h.stage || '').toLowerCase()),
    );
    const billingHist = findHistory(
        history,
        (h) =>
            String(h.action || '').toLowerCase() === 'approve' &&
            String(h.stage || '').toLowerCase() === 'pending_billing',
    );

    const serviceStartDate = remark.serviceStartDate || remark.scheduledServiceDate || null;
    const serviceEndDate = remark.serviceEndDate || null;

    const activityLog =
        activityLogKey && Array.isArray(remark[activityLogKey]) ? remark[activityLogKey] : [];
    const fromLog = (type) => {
        const rows = activityLog.filter((a) => a.type === type);
        return rows.length ? rows[rows.length - 1] : null;
    };

    const initiateDate =
        remark.assignmentSubmittedAt ||
        fromLog('request_submitted')?.at ||
        fromLog('service_updated')?.at ||
        fromLog('service_created')?.at ||
        service?.updatedAt ||
        service?.createdAt ||
        null;

    const scheduleDate =
        remark.garageSubmittedAt ||
        wf?.garageSubmittedAt ||
        fromLog('garage_updated')?.at ||
        fromLog('service_scheduled')?.at ||
        null;

    const hrDate =
        remark.hrReviewApprovedAt ||
        remark.hrApprovedAt ||
        remark.hrScheduleApprovedAt ||
        hrHist?.at ||
        fromLog('quotation_review_approved')?.at ||
        fromLog('hr_approved')?.at ||
        null;

    const accountsDate =
        remark.accountsQuoteApprovedAt ||
        remark.accountsGarageApprovedAt ||
        accountsHist?.at ||
        fromLog('accounts_approved')?.at ||
        null;

    const onServiceDate =
        remark.shopServiceLiveAt ||
        wf?.shopServiceLiveAt ||
        fromLog('on_service')?.at ||
        (ready || live ? serviceStartDate : null) ||
        null;

    const completeDate =
        remark.vehicleServiceCompletedAt ||
        fromLog('service_completed')?.at ||
        null;

    const paymentDate =
        remark.accountsPaymentApprovedAt ||
        remark.zohoBillCreatedAt ||
        billingHist?.at ||
        fromLog('zoho_bill_created')?.at ||
        null;

    const initiateActor =
        formatTrackerActorName(fromLog('request_submitted')?.byName) ||
        formatTrackerActorName(fromLog('service_updated')?.byName) ||
        requester;
    const scheduleActor =
        formatTrackerActorName(remark.garageSubmittedByName) ||
        formatTrackerActorName(fromLog('garage_updated')?.byName) ||
        adminOfficer;
    const hrActor =
        formatTrackerActorName(remark.hrReviewApprovedByName || remark.hrApprovedByName) ||
        formatTrackerActorName(hrHist?.byName) ||
        formatTrackerActorName(fromLog('quotation_review_approved')?.byName) ||
        hrOfficer;
    const accountsActor =
        formatTrackerActorName(remark.accountsQuoteApprovedByName || remark.accountsGarageApprovedByName) ||
        formatTrackerActorName(accountsHist?.byName) ||
        accountsOfficer;
    const onServiceActor = adminOfficer;
    const completeActor =
        formatTrackerActorName(remark.serviceCompletedByName) ||
        formatTrackerActorName(fromLog('service_completed')?.byName) ||
        adminOfficer;
    const paymentActor =
        formatTrackerActorName(remark.accountsPaymentApprovedByName) ||
        formatTrackerActorName(billingHist?.byName) ||
        formatTrackerActorName(fromLog('zoho_bill_created')?.byName) ||
        accountsOfficer;

    const steps = SHOP_SERVICE_CASH_WORKFLOW_STEPS.map((step) => {
        if (step.id === 5) {
            return {
                ...step,
                label: live ? 'On Service' : ready ? 'Ready to Service' : 'On Service',
            };
        }
        return step;
    });

    const stepActors = {
        1: initiateActor,
        2: scheduleActor,
        3: hrActor,
        4: accountsActor,
        5: onServiceActor,
        6: completeActor,
        7: paymentActor,
    };

    const stepDates = {
        1: initiateDate,
        2: scheduleDate,
        3: hrDate,
        4: accountsDate,
        5: onServiceDate,
        6: completeDate,
        7: paymentDate,
    };

    const stepDoneMap = {
        1: initiateDone,
        2: scheduleDone,
        3: hrDone,
        4: accountsDone,
        5: onServiceDone && scheduleDone,
        6: completeDone,
        7: paymentDone,
    };

    const events = steps.map((step) => {
        let detail;
        if (step.id === 2 && serviceStartDate) {
            if (!scheduleDone) detail = 'Admin must complete garage details and dates';
            else if (ready) detail = `Waiting for start date · ${formatShopDate(serviceStartDate)}`;
            else if (live) detail = `Scheduled · start ${formatShopDate(serviceStartDate)}`;
            else detail = `Planned start · ${formatShopDate(serviceStartDate)}`;
        }
        if (step.id === 3) {
            detail =
                currentActiveStepId === 3 || (currentActiveStepId === 2 && !hrDone)
                    ? 'Flowchart HR must approve quotation'
                    : 'HR approved schedule';
        }
        if (step.id === 4) {
            detail =
                currentActiveStepId === 4
                    ? 'Flowchart Accounts must approve quotation'
                    : 'Accounts approved quotation';
        }
        if (step.id === 5 && serviceStartDate) {
            detail = live
                ? `On Service · start ${formatShopDate(serviceStartDate)}`
                : ready
                  ? `Ready to Service · start ${formatShopDate(serviceStartDate)}`
                  : `Service start: ${formatShopDate(serviceStartDate)}`;
        }
        if (step.id === 6 && serviceEndDate) {
            detail = `Service end: ${formatShopDate(serviceEndDate)}`;
        }
        if (step.id === 7) {
            detail =
                currentActiveStepId === 7
                    ? 'Flowchart Accounts — Make Payment (Zoho)'
                    : 'Accounts submitted Make Payment (Zoho)';
        }

        return buildStepEvent(step, {
            isDone: Boolean(stepDoneMap[step.id]),
            isActive: currentActiveStepId === step.id && stage !== 'rejected',
            isRejected: stage === 'rejected' && currentActiveStepId === step.id,
            actor: stepActors[step.id],
            date: stepDates[step.id],
            detail,
        });
    });

    if (events.length) {
        events[events.length - 1].isLast = true;
    }

    // Parallel open: show HR as Pending when Schedule is active and HR not done yet (oil cash style).
    const hrEvent = events.find((e) => e.stepNumber === 3);
    if (hrEvent && currentActiveStepId === 2 && !hrDone) {
        hrEvent.badge = 'Pending';
        hrEvent.badgeVariant = 'pending';
    }

    return events;
}

/** Accident Repair: no quotation HR before garage — HR is On-Service approval. */
export function buildAccidentRepairOilStyleWorkflowEvents(asset, service, flowchartRows = []) {
    const remark = parseVehicleServiceRemark(service) || {};
    const { stage, history, wf } = resolveWorkflowForService(asset, service);
    const flowchartActors = resolveShopServiceFlowchartActors(flowchartRows);

    const adminOfficer =
        flowchartNameOnly(flowchartActors.adminOfficer) ||
        flowchartNameOnly(nameFromFlowchartRow(pickFlowchartAdminRow(flowchartRows))) ||
        'Admin Officer';
    const hrOfficer = flowchartNameOnly(flowchartActors.hr) || 'HR';
    const accountsOfficer = flowchartNameOnly(flowchartActors.accounts) || 'Accounts';

    const requester =
        formatTrackerActorName(remark.requestedByName) ||
        formatTrackerActorName(remark.createdByName) ||
        adminOfficer;

    const live =
        isShopWorkServiceLive(service, asset) || isShopServiceLiveOnAsset(asset, service);
    const ready = isShopWorkScheduledWaiting(service, asset);

    const initiateDone = isInitiateDone(remark, service);
    const scheduleDone = isGarageDone(remark, wf);
    // Accident: HR approves after garage (pending_hr on-service)
    const hrDone =
        Boolean(String(remark.hrOnServiceApprovedAt || remark.hrApprovedAt || '').trim()) ||
        history.some(
            (h) =>
                String(h.action || '').toLowerCase() === 'approve' &&
                String(h.stage || '').toLowerCase() === 'pending_hr',
        ) ||
        [
            'scheduled_service',
            'pending_admin_return',
            'pending_billing',
            'billed',
            'complete',
        ].includes(stage);
    const accountsDone = isAccountsApproveDone(remark, stage, history);
    const onServiceDone =
        live ||
        ready ||
        stage === 'pending_admin_return' ||
        stage === 'scheduled_service' ||
        stage === 'pending_billing' ||
        stage === 'billed' ||
        stage === 'complete';
    const completeDone =
        Boolean(String(remark.vehicleServiceCompletedAt || '').trim()) ||
        String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live' ||
        stage === 'pending_billing' ||
        stage === 'billed' ||
        stage === 'complete';
    const paymentDone =
        stage === 'billed' ||
        String(remark.billingStatus || '').toLowerCase() === 'billed' ||
        Boolean(String(remark.zohoBillId || '').trim());

    // Accident: Schedule + HR open together after Initiate (oil style).
    let currentActiveStepId = 1;
    if (paymentDone || stage === 'billed') currentActiveStepId = 8;
    else if (stage === 'pending_billing' || (completeDone && !paymentDone)) currentActiveStepId = 7;
    else if (stage === 'pending_admin_return' || (onServiceDone && !completeDone && scheduleDone && hrDone))
        currentActiveStepId = 6;
    else if (stage === 'scheduled_service' || (hrDone && accountsDone && !completeDone))
        currentActiveStepId = 5;
    else if (stage === 'pending_accounts' || (hrDone && scheduleDone && !accountsDone))
        currentActiveStepId = 4;
    // After Initiate: highlight Schedule while garage incomplete; HR stays Pending in parallel.
    else if (
        (stage === 'pending_hr' || stage === 'pending_admin_officer') &&
        initiateDone &&
        !scheduleDone
    )
        currentActiveStepId = 2;
    else if (stage === 'pending_hr' || (scheduleDone && !hrDone)) currentActiveStepId = 3;
    else if (stage === 'pending_admin_officer' || (hrDone && !scheduleDone)) currentActiveStepId = 2;
    else if (!initiateDone) currentActiveStepId = 1;
    else currentActiveStepId = 2;

    const serviceStartDate = remark.serviceStartDate || remark.scheduledServiceDate || null;
    const serviceEndDate = remark.serviceEndDate || null;

    const hrHist = findHistory(
        history,
        (h) =>
            String(h.action || '').toLowerCase() === 'approve' &&
            String(h.stage || '').toLowerCase() === 'pending_hr',
    );

    const stepActors = {
        1: requester,
        2: formatTrackerActorName(remark.garageSubmittedByName) || adminOfficer,
        3: formatTrackerActorName(remark.hrOnServiceApprovedByName || hrHist?.byName) || hrOfficer,
        4: accountsOfficer,
        5: adminOfficer,
        6: formatTrackerActorName(remark.serviceCompletedByName) || adminOfficer,
        7: accountsOfficer,
    };

    const stepDates = {
        1: remark.assignmentSubmittedAt || service?.createdAt || null,
        2: remark.garageSubmittedAt || wf?.garageSubmittedAt || null,
        3: remark.hrOnServiceApprovedAt || hrHist?.at || null,
        4: remark.accountsGarageApprovedAt || remark.accountsQuoteApprovedAt || null,
        5: remark.shopServiceLiveAt || wf?.shopServiceLiveAt || null,
        6: remark.vehicleServiceCompletedAt || null,
        7: remark.zohoBillCreatedAt || remark.accountsPaymentApprovedAt || null,
    };

    const stepDoneMap = {
        1: initiateDone,
        2: scheduleDone,
        3: hrDone,
        4: accountsDone,
        5: onServiceDone && scheduleDone,
        6: completeDone,
        7: paymentDone,
    };

    const steps = SHOP_SERVICE_CASH_WORKFLOW_STEPS.map((step) => {
        if (step.id === 5) {
            return {
                ...step,
                label: live ? 'On Service' : ready ? 'Ready to Service' : 'On Service',
            };
        }
        return step;
    });

    const events = steps.map((step) => {
        let detail;
        if (step.id === 2 && serviceStartDate) {
            detail = scheduleDone
                ? `Scheduled · start ${formatShopDate(serviceStartDate)}`
                : 'Admin must complete garage details and dates';
        }
        if (step.id === 3) {
            detail =
                currentActiveStepId === 3 || (currentActiveStepId === 2 && !hrDone)
                    ? 'Flowchart HR must approve (opens with Schedule)'
                    : 'HR approved';
        }
        if (step.id === 4) {
            detail =
                currentActiveStepId === 4
                    ? 'Flowchart Accounts must approve quotation'
                    : 'Accounts approved quotation';
        }
        if (step.id === 5 && serviceStartDate) {
            detail = live
                ? `On Service · start ${formatShopDate(serviceStartDate)}`
                : ready
                  ? `Ready to Service · start ${formatShopDate(serviceStartDate)}`
                  : `Service start: ${formatShopDate(serviceStartDate)}`;
        }
        if (step.id === 6 && serviceEndDate) {
            detail = `Service end: ${formatShopDate(serviceEndDate)}`;
        }
        if (step.id === 7) {
            detail =
                currentActiveStepId === 7
                    ? 'Flowchart Accounts — Make Payment (Zoho)'
                    : 'Accounts submitted Make Payment (Zoho)';
        }

        return buildStepEvent(step, {
            isDone: Boolean(stepDoneMap[step.id]),
            isActive: currentActiveStepId === step.id && stage !== 'rejected',
            isRejected: stage === 'rejected' && currentActiveStepId === step.id,
            actor: stepActors[step.id],
            date: stepDates[step.id],
            detail,
        });
    });

    if (events.length) events[events.length - 1].isLast = true;

    // Parallel open: show HR as Pending when Schedule is active and HR not done yet.
    const hrEvent = events.find((e) => e.stepNumber === 3);
    if (hrEvent && currentActiveStepId === 2 && !hrDone) {
        hrEvent.badge = 'Pending';
        hrEvent.badgeVariant = 'pending';
        hrEvent.detail = 'Flowchart HR must approve (opens with Schedule)';
    }

    return events;
}
