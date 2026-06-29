import { isAdmin as isPortalSuperUser } from '@/utils/permissions';
import { buildAssessmentFormState, isAssessmentFormComplete, isReceiverAssessmentMarkedDone } from './vehicleHandoverReceiverAssessment';
import { buildBodyConditionFormState, isBodyConditionFormComplete, isBodyConditionMarkedDone } from './vehicleHandoverBodyCondition';
import {
    nameFromFlowchartRow,
    pickFlowchartAdminRow,
} from './vehicleHandoverAssignWorkflow';

function normEmpId(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function extractMongoId(ref) {
    if (!ref) return '';
    if (typeof ref === 'object') return String(ref._id || ref.id || '');
    return String(ref);
}

function extractEmployeeCode(ref) {
    if (!ref || typeof ref !== 'object') return '';
    return normEmpId(ref.employeeId || '');
}

export function userMatchesEmployeeRef(user, ref) {
    if (!user || !ref) return false;

    const refId = extractMongoId(ref);
    const userIds = [
        user.employeeObjectId,
        user._id,
        user.id,
        user.empObjectId,
    ]
        .filter(Boolean)
        .map(String);

    if (refId && userIds.includes(refId)) return true;

    const refCode = extractEmployeeCode(ref);
    const userCode = normEmpId(user.employeeId || '');
    if (refCode && userCode && refCode === userCode) return true;

    if (typeof ref === 'string' && userIds.includes(String(ref))) return true;

    return false;
}

function resolvePendingHandoverActorRef(vehicle, historyEntry, stage, flowchartAdminRow) {
    if (vehicle?.actionRequiredBy) {
        return vehicle.actionRequiredBy;
    }

    if (stage === 'hod') {
        return vehicle?.assignedTo?.primaryReportee || null;
    }

    if (stage === 'target') {
        const assigneeCanSelf = getHandoverAssigneeCanSelfAcknowledge(
            vehicle,
            vehicle?.assignedTo,
            historyEntry,
        );
        if (assigneeCanSelf) return vehicle?.assignedTo || null;
        return flowchartAdminRow?.empObjectId || flowchartAdminRow || null;
    }

    return null;
}

export function flowchartAdminRowMatchesUser(row, userData) {
    if (!row || !userData) return false;
    return userMatchesEmployeeRef(userData, row.empObjectId || row);
}

export function isFlowchartAdminOfficerUser(user, flowchartAdminRow) {
    if (!user) return false;
    if (isPortalSuperUser()) return true;
    if (flowchartAdminRow && flowchartAdminRowMatchesUser(flowchartAdminRow, user)) return true;
    return false;
}

export function getHandoverFlowStage(vehicle) {
    return vehicle?.pendingActionDetails?.vehicleHandoverFlow?.stage || null;
}

export function getHandoverAcceptanceStatus(vehicle, historyEntry = null) {
    return String(
        vehicle?.acceptanceStatus ||
            historyEntry?.details?.acceptanceStatus ||
            (String(historyEntry?.action || '').trim() === 'Assigned' ? 'Pending' : '') ||
            '',
    ).trim();
}

export function getEffectiveHandoverStage(vehicle, historyEntry = null) {
    const explicit = getHandoverFlowStage(vehicle);
    if (explicit) return explicit;

    if (getHandoverAcceptanceStatus(vehicle, historyEntry) === 'Pending') {
        const action = String(historyEntry?.action || '').trim();
        if (!action || action === 'Assigned') return 'target';
    }

    return null;
}

export function getHandoverAssigneeCanSelfAcknowledge(vehicle, assignee = null, historyEntry = null) {
    const meta = historyEntry?.details?.vehicleHandoverWorkflow;
    if (typeof meta?.assigneeCanSelfAcknowledge === 'boolean') {
        return meta.assigneeCanSelfAcknowledge;
    }

    const stored = vehicle?.pendingActionDetails?.vehicleHandoverFlow?.assigneeCanSelfAcknowledge;
    if (typeof stored === 'boolean') return stored;

    const target = assignee || vehicle?.assignedTo;
    if (!target || typeof target !== 'object') return false;
    if (!(target.companyEmail && String(target.companyEmail).trim())) return false;
    return target.enablePortalAccess === true;
}

export function isHandoverReportsCompleteForEntry(historyEntry, vehicle = null) {
    if (!isReceiverAssessmentMarkedDone(historyEntry)) return false;
    if (!isBodyConditionMarkedDone(historyEntry)) return false;

    const assessmentForm = buildAssessmentFormState(historyEntry, vehicle);
    const bodyForm = buildBodyConditionFormState(historyEntry);
    return isAssessmentFormComplete(assessmentForm) && isBodyConditionFormComplete(bodyForm);
}

export function isHandoverReportsLocked(vehicle, historyEntry = null) {
    if (getHandoverAcceptanceStatus(vehicle, historyEntry) !== 'Pending') return true;

    const stage = getEffectiveHandoverStage(vehicle, historyEntry);
    return stage !== 'target';
}

export function canEditHandoverReports({
    vehicle,
    historyEntry = null,
    currentUser = null,
    flowchartAdminRow = null,
}) {
    if (!vehicle || !currentUser) return false;
    if (isHandoverReportsLocked(vehicle, historyEntry)) return false;

    const assigneeCanSelf = getHandoverAssigneeCanSelfAcknowledge(
        vehicle,
        vehicle?.assignedTo,
        historyEntry,
    );

    if (assigneeCanSelf && userMatchesEmployeeRef(currentUser, vehicle?.assignedTo)) {
        return true;
    }

    if (!assigneeCanSelf && isFlowchartAdminOfficerUser(currentUser, flowchartAdminRow)) {
        return true;
    }

    return false;
}

export function canUserActOnHandoverAssign({
    vehicle,
    historyEntry = null,
    currentUser = null,
    flowchartAdminRow = null,
}) {
    if (!vehicle || !currentUser) return false;
    if (getHandoverAcceptanceStatus(vehicle, historyEntry) !== 'Pending') return false;

    const stage = getEffectiveHandoverStage(vehicle, historyEntry);

    const pendingActorRef = resolvePendingHandoverActorRef(
        vehicle,
        historyEntry,
        stage,
        flowchartAdminRow,
    );
    if (pendingActorRef && userMatchesEmployeeRef(currentUser, pendingActorRef)) {
        return true;
    }

    if (stage === 'target') {
        const assigneeCanSelf = getHandoverAssigneeCanSelfAcknowledge(
            vehicle,
            vehicle?.assignedTo,
            historyEntry,
        );
        if (assigneeCanSelf && userMatchesEmployeeRef(currentUser, vehicle?.assignedTo)) {
            return true;
        }
        if (assigneeCanSelf === false && isFlowchartAdminOfficerUser(currentUser, flowchartAdminRow)) {
            return true;
        }
        if (
            !vehicle?.pendingActionDetails?.vehicleHandoverFlow &&
            isFlowchartAdminOfficerUser(currentUser, flowchartAdminRow)
        ) {
            return true;
        }
    }

    return false;
}

export function canAcceptHandoverAssign({ vehicle, historyEntry, currentUser, flowchartAdminRow }) {
    if (!canUserActOnHandoverAssign({ vehicle, historyEntry, currentUser, flowchartAdminRow })) {
        return { allowed: false, reason: 'You are not authorized to accept this handover.' };
    }
    const stage = getEffectiveHandoverStage(vehicle, historyEntry);
    if (!stage || stage === 'target') {
        if (!isHandoverReportsCompleteForEntry(historyEntry, vehicle)) {
            return {
                allowed: false,
                reason:
                    'Complete Vehicle Assessment Report and Body Condition photos before approving.',
            };
        }
    }
    return { allowed: true, reason: '' };
}

export function handoverStageLabel(stage, vehicle = null, historyEntry = null) {
    const effective = stage || getEffectiveHandoverStage(vehicle, historyEntry);
    if (effective === 'target') return 'Target User / Admin Officer';
    if (effective === 'hod') return 'HOD Review';
    if (effective === 'hr' || effective === 'management') return 'HR Approval';
    return 'Handover Review';
}

export function resolveHandoverAdminActorLabel(vehicle, flowchartRows = []) {
    const adminRow = pickFlowchartAdminRow(flowchartRows);
    const fromFlowchart = nameFromFlowchartRow(adminRow);
    if (fromFlowchart) return fromFlowchart;

    const assetController = vehicle?.assetController;
    if (assetController && typeof assetController === 'object') {
        const name = `${assetController.firstName || ''} ${assetController.lastName || ''}`.trim();
        if (name) return name;
    }
    return 'Admin Officer';
}
