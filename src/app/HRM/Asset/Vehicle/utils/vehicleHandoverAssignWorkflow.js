import { buildWorkflowStepEvents } from '@/app/HRM/shared/workflowHistory/buildWorkflowHistoryEvents';
import { getHandoverDisplayStatus } from './vehicleHandoverHistory';

export const HANDOVER_ASSIGN_WORKFLOW_STEPS = [
    { id: 1, label: 'Handover By', role: 'Assigner' },
    { id: 2, label: 'Handover To', role: 'Target' },
    { id: 3, label: 'HR Approval', role: 'HR' },
];

export function normalizeCategory(c) {
    return String(c || '').trim().toLowerCase().replace(/\s+/g, '');
}

export function pickFlowchartAdminRow(flowchartRows = []) {
    if (!Array.isArray(flowchartRows)) return null;
    return flowchartRows.find(row => {
        const cat = normalizeCategory(row?.category);
        const status = normalizeCategory(row?.status);
        return cat === 'admincontroller' && status === 'active';
    }) || flowchartRows.find(row => {
        const cat = normalizeCategory(row?.category);
        return cat === 'admincontroller';
    }) || null;
}

export function pickFlowchartHrRow(flowchartRows = []) {
    if (!Array.isArray(flowchartRows)) return null;
    return flowchartRows.find(row => {
        const cat = normalizeCategory(row?.category);
        const status = normalizeCategory(row?.status);
        return cat === 'hr' && status === 'active';
    }) || flowchartRows.find(row => {
        const cat = normalizeCategory(row?.category);
        return cat === 'hr';
    }) || null;
}

export function pickFlowchartAccountsRow(flowchartRows = []) {
    if (!Array.isArray(flowchartRows)) return null;
    return flowchartRows.find(row => {
        const cat = normalizeCategory(row?.category);
        const status = normalizeCategory(row?.status);
        return cat === 'accounts' && status === 'active';
    }) || flowchartRows.find(row => {
        const cat = normalizeCategory(row?.category);
        return cat === 'accounts';
    }) || null;
}

export function nameFromFlowchartRow(row) {
    if (!row) return '';
    const name = String(row.employeeName || '').trim();
    const empId = String(row.employeeId || '').trim();
    if (name && empId) return `${name} (${empId})`;
    if (name) return name;
    return empId || '';
}

export function formatEmployeeName(ref) {
    if (!ref) return '';
    if (typeof ref === 'object') {
        const name = `${ref.firstName || ''} ${ref.lastName || ''}`.trim();
        return name || String(ref.employeeId || '').trim();
    }
    return String(ref);
}

export function resolveHandoverAssignWorkflowState(vehicle, historyEntry) {
    const statusObj = getHandoverDisplayStatus(historyEntry, vehicle) || {};
    const statusKey = String(statusObj.key || '').toLowerCase();

    if (statusKey === 'rejected') {
        const wasAccepted = historyEntry?.details?.vehicleHandoverWorkflow?.stages?.target?.date ||
                            String(historyEntry?.details?.acceptanceStatus || '').trim() === 'Accepted';
        return {
            currentActiveStepId: wasAccepted ? 3 : 2,
            isRejected: true,
        };
    }

    if (statusKey === 'approved') {
        return { currentActiveStepId: 4, isRejected: false };
    }

    if (statusKey === 'accepted') {
        return { currentActiveStepId: 3, isRejected: false };
    }

    return { currentActiveStepId: 2, isRejected: false };
}

export function formatWorkflowActor(stage, fallbackPerson = null, fallbackType = 'Employee') {
    const name = String(stage?.actorName || '').trim();
    const empId = String(stage?.actorEmployeeId || '').trim();
    if (name && empId) return `${name} (${empId})`;
    if (name) return name;
    if (empId) return empId;

    if (fallbackPerson) {
        if (String(fallbackType).toLowerCase() === 'company') {
            if (typeof fallbackPerson === 'object') {
                return fallbackPerson.name || fallbackPerson.companyId || '';
            }
            return String(fallbackPerson);
        }
        if (typeof fallbackPerson === 'object') {
            const firstName = fallbackPerson.firstName || '';
            const lastName = fallbackPerson.lastName || '';
            const personName = `${firstName} ${lastName}`.trim();
            if (personName && fallbackPerson.employeeId) {
                return `${personName} (${fallbackPerson.employeeId})`;
            }
            return personName || fallbackPerson.employeeId || '';
        }
        return String(fallbackPerson);
    }
    return '';
}

function localResolveHandoverAssigneeRef(vehicle, historyEntry = null) {
    return historyEntry?.assignedTo || vehicle?.assignedTo || null;
}

function localGetHandoverAssigneeCanSelfAcknowledge(vehicle, assignee = null, historyEntry = null) {
    const meta = historyEntry?.details?.vehicleHandoverWorkflow;
    if (typeof meta?.assigneeCanSelfAcknowledge === 'boolean') {
        return meta.assigneeCanSelfAcknowledge;
    }

    const stored = vehicle?.pendingActionDetails?.vehicleHandoverFlow?.assigneeCanSelfAcknowledge;
    if (typeof stored === 'boolean') return stored;

    const target = assignee || localResolveHandoverAssigneeRef(vehicle, historyEntry);
    if (!target || typeof target !== 'object') return false;
    const hasEmail = Boolean(target.companyEmail && String(target.companyEmail).trim());
    if (!hasEmail) return false;
    return target.enablePortalAccess === true;
}

export function resolveHandoverWorkflowActors({
    vehicle,
    historyEntry = null,
    flowchartAdminRow = null,
    flowchartHrRow = null,
    hrActiveHolder = null,
}) {
    const meta = historyEntry?.details?.vehicleHandoverWorkflow || null;

    // 1. Target User / Admin
    const targetStage = meta?.stages?.target;
    let targetedUserActor = formatWorkflowActor(targetStage);
    if (!targetedUserActor) {
        const assigneeRef = historyEntry?.assignedTo || vehicle?.assignedTo || historyEntry?.assignedCompany || vehicle?.assignedCompany || null;
        const assigneeType = historyEntry?.assignedToType || vehicle?.assignedToType || 'Employee';
        targetedUserActor = formatWorkflowActor(null, assigneeRef, assigneeType);
    }

    // 2. Admin Actor
    let adminActorName = nameFromFlowchartRow(flowchartAdminRow);
    if (!adminActorName) {
        adminActorName = formatWorkflowActor(null, vehicle?.assetController || historyEntry?.performedBy);
    }

    // 3. HR Actor
    const hrStage = meta?.stages?.hr;
    let hrActor = formatWorkflowActor(hrStage);
    if (!hrActor) {
        hrActor = nameFromFlowchartRow(flowchartHrRow);
    }
    if (!hrActor) {
        hrActor = String(hrActiveHolder?.employeeId || '').trim();
    }
    if (!hrActor) {
        hrActor = 'HR';
    }

    return {
        targetedUserActor: targetedUserActor || '—',
        adminActorName: adminActorName || 'Admin Officer',
        hrActor: hrActor || 'HR',
    };
}

export function buildHandoverAssignWorkflowEvents({
    vehicle,
    historyEntry,
    flowchartAdminRow = null,
    flowchartHrRow = null,
    hrActiveHolder = null,
}) {
    const meta = historyEntry?.details?.vehicleHandoverWorkflow || null;
    const { currentActiveStepId, isRejected } = resolveHandoverAssignWorkflowState(
        vehicle,
        historyEntry,
    );

    const assignDate = historyEntry?.date || historyEntry?.createdAt || null;

    const getStepActor = (step) => {
        if (step.id === 1) {
            return formatWorkflowActor(meta?.stages?.assigner, historyEntry?.performedBy) || '—';
        }
        if (step.id === 2) {
            const targetStage = meta?.stages?.target;
            const fromMeta = formatWorkflowActor(targetStage);
            if (fromMeta) return fromMeta;

            const assigneeRef = historyEntry?.assignedTo || vehicle?.assignedTo || historyEntry?.assignedCompany || vehicle?.assignedCompany || null;
            const assigneeType = historyEntry?.assignedToType || vehicle?.assignedToType || 'Employee';
            const assigneeCanSelf = localGetHandoverAssigneeCanSelfAcknowledge(vehicle, assigneeRef, historyEntry);

            if (assigneeCanSelf) {
                return formatWorkflowActor(targetStage, assigneeRef, assigneeType) || '—';
            } else {
                const fromFlowchart = nameFromFlowchartRow(flowchartAdminRow);
                if (fromFlowchart) return fromFlowchart;
                const assetControllerName = formatWorkflowActor(null, vehicle?.assetController || historyEntry?.performedBy);
                if (assetControllerName) return assetControllerName;
                return 'Admin Officer';
            }
        }
        if (step.id === 3) {
            const hrStage = meta?.stages?.hr;
            const fromMeta = formatWorkflowActor(hrStage);
            if (fromMeta) return fromMeta;
            const fromFlowchart = nameFromFlowchartRow(flowchartHrRow);
            if (fromFlowchart) return fromFlowchart;
            const holderId = String(hrActiveHolder?.employeeId || '').trim();
            if (holderId) return holderId;
            return 'HR';
        }
        return '—';
    };

    const getStepDate = (step) => {
        if (step.id === 1) return meta?.stages?.assigner?.date || assignDate;
        if (step.id === 2) return meta?.stages?.target?.date || (currentActiveStepId >= 3 ? assignDate : null);
        if (step.id === 3) return meta?.stages?.hr?.date || (currentActiveStepId >= 4 ? assignDate : null);
        return null;
    };

    return buildWorkflowStepEvents({
        steps: HANDOVER_ASSIGN_WORKFLOW_STEPS,
        isStepApproved: (step) => step.id < currentActiveStepId,
        isConnectorGreen: (step) => step.id < currentActiveStepId,
        getStepActor,
        getStepDate,
        isRejected,
        currentActiveStepId,
        rejectionReason: historyEntry?.comments || '',
    });
}
