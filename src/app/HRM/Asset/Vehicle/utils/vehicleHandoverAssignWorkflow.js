import { fmtHandoverPerson } from './vehicleHandoverHistory';
import { buildWorkflowStepEvents } from '@/app/HRM/shared/workflowHistory/buildWorkflowHistoryEvents';

export const HANDOVER_ASSIGN_WORKFLOW_STEPS = [
    { id: 1, label: 'Assigner', role: 'Assigner' },
    { id: 2, label: 'Targeted User', role: 'TargetedUser' },
    { id: 3, label: 'HR', role: 'HR' },
];

const STAGE_META_KEYS = {
    1: 'assigner',
    2: 'target',
    3: 'hr',
};

const normFlowchartCategoryKey = (c) => String(c || '').toLowerCase().trim();

export function pickFlowchartHrRow(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const active = list.filter((r) => String(r?.status || '').trim() === 'Active');
    return active.find((r) => normFlowchartCategoryKey(r.category).replace(/\s+/g, '') === 'hr') || null;
}

export function pickFlowchartAdminRow(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const active = list.filter((r) => String(r?.status || '').trim() === 'Active');
    const pick = (re) => active.find((r) => re.test(normFlowchartCategoryKey(r.category)));
    return (
        pick(/^admin$/) ||
        pick(/^administrator$/) ||
        active.find((r) => normFlowchartCategoryKey(r.category).replace(/\s+/g, '') === 'admincontroller') ||
        active.find((r) => {
            const key = normFlowchartCategoryKey(r.category).replace(/\s+/g, '');
            return key.includes('admin') && key.includes('controller');
        }) ||
        null
    );
}

export function formatEmployeeName(person) {
    if (!person) return '';
    if (typeof person === 'string') return person.trim();
    const name = fmtHandoverPerson(person);
    return name || String(person.employeeId || '').trim();
}

export function nameFromFlowchartRow(row) {
    if (!row) return '';
    const pop = row.empObjectId;
    if (pop && typeof pop === 'object') {
        const name = formatEmployeeName(pop);
        if (name) return name;
    }
    const label = String(row.employeeName || '').trim();
    if (label) return label;
    return String(row.employeeId || '').trim();
}

/** Matches backend assigneeCanSelfAcknowledgeFleetHandover — email alone is not enough. */
export function employeeHasUserAccount(employee) {
    if (!employee || typeof employee !== 'object') return false;
    if (!(employee.companyEmail && String(employee.companyEmail).trim())) return false;
    return employee.enablePortalAccess === true;
}

export function resolveHandoverAdminActorName(vehicle, flowchartAdminRow) {
    const assetController = vehicle?.assetController;
    const acName = formatEmployeeName(assetController);
    if (acName) return acName;

    const adminName = nameFromFlowchartRow(flowchartAdminRow);
    if (adminName) return adminName;

    return 'Admin Officer';
}

function getWorkflowMeta(historyEntry) {
    return historyEntry?.details?.vehicleHandoverWorkflow || null;
}

function resolveAssigneeCanSelfAcknowledge(vehicle, historyEntry, assignee) {
    const meta = getWorkflowMeta(historyEntry);
    if (typeof meta?.assigneeCanSelfAcknowledge === 'boolean') {
        return meta.assigneeCanSelfAcknowledge;
    }
    if (typeof vehicle?.pendingActionDetails?.vehicleHandoverFlow?.assigneeCanSelfAcknowledge === 'boolean') {
        return vehicle.pendingActionDetails.vehicleHandoverFlow.assigneeCanSelfAcknowledge;
    }
    return employeeHasUserAccount(assignee);
}

function pickPrimaryReportee(...assigneeSources) {
    for (const assignee of assigneeSources) {
        if (!assignee || typeof assignee !== 'object') continue;
        const reportee = assignee.primaryReportee;
        if (!reportee) continue;
        if (typeof reportee === 'object') return reportee;
    }
    return null;
}

function resolveAssignee(vehicle, historyEntry) {
    const vehicleAssignee =
        vehicle?.assignedTo && typeof vehicle.assignedTo === 'object' ? vehicle.assignedTo : null;
    const historyAssignee =
        historyEntry?.assignedTo && typeof historyEntry.assignedTo === 'object'
            ? historyEntry.assignedTo
            : null;
    const detailsAssignee =
        historyEntry?.details?.assignedTo && typeof historyEntry.details.assignedTo === 'object'
            ? historyEntry.details.assignedTo
            : null;

    const primaryReportee = pickPrimaryReportee(
        historyAssignee,
        detailsAssignee,
        vehicleAssignee,
    );

    if (vehicleAssignee && historyAssignee) {
        return {
            ...historyAssignee,
            enablePortalAccess:
                vehicleAssignee.enablePortalAccess ?? historyAssignee.enablePortalAccess,
            companyEmail: vehicleAssignee.companyEmail || historyAssignee.companyEmail,
            primaryReportee: primaryReportee || vehicleAssignee.primaryReportee || historyAssignee.primaryReportee,
        };
    }

    const base = vehicleAssignee || historyAssignee || historyEntry?.assignedTo || vehicle?.assignedTo || null;
    if (!base || typeof base !== 'object') return base;

    return {
        ...base,
        primaryReportee: primaryReportee || base.primaryReportee || null,
    };
}

function resolveAssigner(vehicle, historyEntry) {
    const fromHistory =
        historyEntry?.performedBy && typeof historyEntry.performedBy === 'object'
            ? historyEntry.performedBy
            : null;
    const fromVehicle =
        vehicle?.assignedBy && typeof vehicle.assignedBy === 'object' ? vehicle.assignedBy : null;

    if (fromHistory && fromVehicle) {
        return {
            ...fromHistory,
            enablePortalAccess: fromVehicle.enablePortalAccess ?? fromHistory.enablePortalAccess,
            companyEmail: fromVehicle.companyEmail || fromHistory.companyEmail,
        };
    }

    return fromHistory || fromVehicle || historyEntry?.performedBy || vehicle?.assignedBy || null;
}


export function resolveHandoverWorkflowActors({
    vehicle,
    historyEntry,
    flowchartAdminRow = null,
    flowchartHrRow = null,
    hrActiveHolder = null,
}) {
    const adminActorName = resolveHandoverAdminActorName(vehicle, flowchartAdminRow);
    const assigner = resolveAssigner(vehicle, historyEntry);
    const assignee = resolveAssignee(vehicle, historyEntry);
    const workflowMeta = getWorkflowMeta(historyEntry);

    const assigneeCanSelfAcknowledge = resolveAssigneeCanSelfAcknowledge(
        vehicle,
        historyEntry,
        assignee,
    );

    const assignerFromMeta = workflowMeta?.stages?.assigner?.actorName;
    const targetFromMeta = workflowMeta?.stages?.target?.actorName;

    const assignerActor =
        assignerFromMeta ||
        (workflowMeta?.assignerUsesAdminOfficer || workflowMeta?.wasAssignedFromPool
            ? adminActorName
            : formatEmployeeName(assigner) || adminActorName);

    const targetedUserActor =
        targetFromMeta ||
        (!assigneeCanSelfAcknowledge ? adminActorName : formatEmployeeName(assignee) || adminActorName);

    const hofPerson = assignee?.primaryReportee;
    const hofActor = formatEmployeeName(hofPerson) || '—';

    const hrActor = nameFromFlowchartRow(flowchartHrRow) || hrActiveHolder?.employeeId || 'HR';

    return {
        adminActorName,
        assignerActor,
        targetedUserActor,
        hofActor,
        primaryReporteeActor: hofActor,
        hrActor,
        assigneeCanSelfAcknowledge,
        hasHofStep: Boolean(hofPerson),
    };
}

export function resolveHandoverWorkflowState(vehicle, historyEntry, actors) {
    const action = String(historyEntry?.action || '').trim();
    const assetAcceptance = String(vehicle?.acceptanceStatus || '').trim();
    const flowStage = vehicle?.pendingActionDetails?.vehicleHandoverFlow?.stage;
    const normalizedStage = flowStage === 'hod' ? 'hr' : flowStage;

    if (action === 'Rejected') {
        return { currentActiveStepId: 2, isRejected: true };
    }

    const isFullyComplete =
        action === 'Accepted' ||
        action === 'AcceptWithComments' ||
        action === 'ControllerHandover' ||
        (assetAcceptance === 'Accepted' && !normalizedStage);

    if (isFullyComplete) {
        return { currentActiveStepId: 4, isRejected: false };
    }

    if (normalizedStage === 'hr' || normalizedStage === 'management') {
        return { currentActiveStepId: 3, isRejected: false };
    }

    if (normalizedStage === 'target') {
        return { currentActiveStepId: 2, isRejected: false };
    }

    if (action === 'Assigned' || assetAcceptance === 'Pending') {
        return { currentActiveStepId: 2, isRejected: false };
    }

    if (historyEntry) {
        return { currentActiveStepId: 2, isRejected: false };
    }

    return { currentActiveStepId: 1, isRejected: false };
}

function resolveDefaultStepActor(step, actors) {
    if (step.role === 'Assigner') return actors.assignerActor;
    if (step.role === 'TargetedUser') return actors.targetedUserActor;
    if (step.role === 'PrimaryReportee' || step.role === 'HOF') return actors.primaryReporteeActor;
    if (step.role === 'HR') return actors.hrActor;
    return '';
}

function resolveStepActorFromMeta(meta, step, actors, currentActiveStepId) {
    const stageKey = STAGE_META_KEYS[step.id];
    const recorded = meta?.stages?.[stageKey];

    if (recorded?.actorName) {
        if (step.id === 2 && recorded.date) {
            return recorded.actorName;
        }
        if (step.id !== 2) {
            return recorded.actorName;
        }
    }

    if (step.id === 2 && !recorded?.date && currentActiveStepId === 2) {
        return actors.targetedUserActor;
    }

    if (step.id === 2 && !actors.assigneeCanSelfAcknowledge) {
        return actors.adminActorName;
    }

    return resolveDefaultStepActor(step, actors);
}

function resolveStepDateFromMeta(meta, step, fallbackDate, currentActiveStepId) {
    const stageKey = STAGE_META_KEYS[step.id];
    const recordedDate = meta?.stages?.[stageKey]?.date;
    if (recordedDate) return recordedDate;

    if (step.id < currentActiveStepId && fallbackDate) return fallbackDate;
    if (step.id === 1) return fallbackDate;
    return null;
}

export function buildHandoverAssignWorkflowEvents({
    vehicle,
    historyEntry,
    flowchartAdminRow = null,
    flowchartHrRow = null,
    hrActiveHolder = null,
}) {
    const actors = resolveHandoverWorkflowActors({
        vehicle,
        historyEntry,
        flowchartAdminRow,
        flowchartHrRow,
        hrActiveHolder,
    });

    const workflowMeta = getWorkflowMeta(historyEntry);

    const { currentActiveStepId, isRejected } = resolveHandoverWorkflowState(
        vehicle,
        historyEntry,
        actors,
    );

    const assignDate =
        historyEntry?.date ||
        historyEntry?.createdAt ||
        vehicle?.assignedDate ||
        vehicle?.updatedAt ||
        null;

    const acceptDate =
        vehicle?.acceptedDate ||
        historyEntry?.details?.acceptedDate ||
        (String(historyEntry?.action || '') === 'Accepted' ? historyEntry?.date : null);

    const getStepActor = (step) =>
        resolveStepActorFromMeta(workflowMeta, step, actors, currentActiveStepId);

    const getStepDate = (step) => {
        const fallback =
            step.id === 1
                ? assignDate
                : step.id === 3 && currentActiveStepId >= 4
                  ? acceptDate || vehicle?.updatedAt || null
                  : acceptDate || assignDate;

        return resolveStepDateFromMeta(workflowMeta, step, fallback, currentActiveStepId);
    };

    return buildWorkflowStepEvents({
        steps: HANDOVER_ASSIGN_WORKFLOW_STEPS,
        isStepApproved: (step) => step.id < currentActiveStepId,
        isConnectorGreen: (step) => step.id < currentActiveStepId,
        getStepActor,
        getStepDate,
        isRejected,
        currentActiveStepId,
        rejectionReason: historyEntry?.details?.rejectionReason || historyEntry?.comments || '',
    });
}
