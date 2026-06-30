import { buildWorkflowStepEvents } from '@/app/HRM/shared/workflowHistory/buildWorkflowHistoryEvents';
import { isVehicleInspectionHandoverEntry } from './vehicleHandoverHistory';
import { nameFromFlowchartRow, pickFlowchartHrRow } from './vehicleHandoverAssignWorkflow';

function formatInspectionWorkflowActor(stage, fallbackPerson = null) {
    const name = String(stage?.actorName || '').trim();
    const empId = String(stage?.actorEmployeeId || fallbackPerson?.employeeId || '').trim();
    if (name && empId) return `${name} (${empId})`;
    if (name) return name;
    if (empId) return empId;
    if (fallbackPerson) {
        const personName = `${fallbackPerson.firstName || ''} ${fallbackPerson.lastName || ''}`.trim();
        if (personName && fallbackPerson.employeeId) {
            return `${personName} (${fallbackPerson.employeeId})`;
        }
        return personName || fallbackPerson.employeeId || '—';
    }
    return '—';
}

export const INSPECTION_HANDOVER_WORKFLOW_STEPS = [
    { id: 1, label: 'Handover By', role: 'Assigner' },
    { id: 2, label: 'Handover To', role: 'AdminOfficer' },
    { id: 3, label: 'HR Approval', role: 'HR' },
];

function getWorkflowMeta(historyEntry) {
    return historyEntry?.details?.vehicleHandoverWorkflow || null;
}

export function resolveInspectionHandoverWorkflowState(vehicle, historyEntry) {
    const action = String(historyEntry?.action || '').trim();
    const acceptance = String(historyEntry?.details?.acceptanceStatus || '').trim();
    const inspStatus = String(vehicle?.vehicleInspectionStatus || '').toLowerCase();

    if (action === 'Rejected' || acceptance === 'Rejected') {
        return { currentActiveStepId: 3, isRejected: true };
    }

    if (action === 'Accepted' || acceptance === 'Accepted' || inspStatus === 'active') {
        return { currentActiveStepId: 4, isRejected: false };
    }

    if (inspStatus === 'pending_hr') {
        return { currentActiveStepId: 3, isRejected: false };
    }

    if (inspStatus === 'draft') {
        return { currentActiveStepId: 2, isRejected: false };
    }

    return { currentActiveStepId: 2, isRejected: false };
}

export function inspectionHandoverStageLabel(vehicle, historyEntry) {
    const { currentActiveStepId, isRejected } = resolveInspectionHandoverWorkflowState(
        vehicle,
        historyEntry,
    );
    if (isRejected) return 'Rejected';
    if (currentActiveStepId >= 4) return 'Approved';
    if (currentActiveStepId === 3) return 'HR Approval';
    if (currentActiveStepId === 2) return 'Handover To';
    return 'Handover By';
}

export function buildInspectionHandoverWorkflowEvents({
    vehicle,
    historyEntry,
    flowchartHrRow = null,
    hrActiveHolder = null,
}) {
    const meta = getWorkflowMeta(historyEntry);
    const { currentActiveStepId, isRejected } = resolveInspectionHandoverWorkflowState(
        vehicle,
        historyEntry,
    );

    const assignDate = historyEntry?.date || historyEntry?.createdAt || null;
    const hrActor =
        formatInspectionWorkflowActor(meta?.stages?.hr) ||
        nameFromFlowchartRow(flowchartHrRow) ||
        hrActiveHolder?.employeeId ||
        'HR';

    const getStepActor = (step) => {
        if (step.id === 1) {
            return formatInspectionWorkflowActor(meta?.stages?.assigner, historyEntry?.performedBy);
        }
        if (step.id === 2) {
            return formatInspectionWorkflowActor(meta?.stages?.target, historyEntry?.assignedTo);
        }
        if (step.id === 3) return hrActor;
        return '—';
    };

    const getStepDate = (step) => {
        if (step.id === 1) return meta?.stages?.assigner?.date || assignDate;
        if (step.id === 2) return meta?.stages?.target?.date || assignDate;
        if (step.id === 3) return meta?.stages?.hr?.date || (currentActiveStepId >= 4 ? assignDate : null);
        return null;
    };

    return buildWorkflowStepEvents({
        steps: INSPECTION_HANDOVER_WORKFLOW_STEPS,
        isStepApproved: (step) => step.id < currentActiveStepId,
        isConnectorGreen: (step) => step.id < currentActiveStepId,
        getStepActor,
        getStepDate,
        isRejected,
        currentActiveStepId,
        rejectionReason: historyEntry?.comments || '',
    });
}

export function isInspectionHandoverDetailEntry(historyEntry, vehicle = null) {
    return isVehicleInspectionHandoverEntry(historyEntry, vehicle);
}
