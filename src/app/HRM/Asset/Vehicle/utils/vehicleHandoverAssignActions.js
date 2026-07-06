import { isAdmin as isPortalSuperUser } from '@/utils/permissions';
import { buildAssessmentFormState, isAssessmentFormComplete, isReceiverAssessmentMarkedDone } from './vehicleHandoverReceiverAssessment';
import { buildBodyConditionFormState, isBodyConditionFormComplete, isBodyConditionMarkedDone } from './vehicleHandoverBodyCondition';
import {
    nameFromFlowchartRow,
    pickFlowchartAdminRow,
} from './vehicleHandoverAssignWorkflow';
import { isVehicleInspectionHandoverEntry } from './vehicleHandoverHistory';

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

function resolvePendingHandoverActorRef(vehicle, historyEntry, stage, flowchartAdminRow, flowchartHrRow) {
    if (vehicle?.actionRequiredBy) {
        return vehicle.actionRequiredBy;
    }

    const normalizedStage = stage === 'hod' ? 'hr' : stage;

    if (normalizedStage === 'hr' || normalizedStage === 'management') {
        return flowchartHrRow?.empObjectId || flowchartHrRow || null;
    }

    if (normalizedStage === 'target') {
        const assigneeRef = resolveHandoverAssigneeRef(vehicle, historyEntry);
        const assigneeCanSelf = getHandoverAssigneeCanSelfAcknowledge(
            vehicle,
            assigneeRef,
            historyEntry,
        );
        if (assigneeCanSelf) return assigneeRef || null;
        return flowchartAdminRow?.empObjectId || flowchartAdminRow || null;
    }

    return null;
}

export function flowchartAdminRowMatchesUser(row, userData) {
    if (!row || !userData) return false;
    return userMatchesEmployeeRef(userData, row.empObjectId || row);
}

export function flowchartHrRowMatchesUser(row, userData) {
    if (!row || !userData) return false;
    return userMatchesEmployeeRef(userData, row.empObjectId || row);
}

export function isFlowchartHrUser(user, flowchartHrRow) {
    if (!user) return false;
    if (isPortalSuperUser()) return true;
    if (flowchartHrRow && flowchartHrRowMatchesUser(flowchartHrRow, user)) return true;
    return false;
}

export function isHandoverHrStage(vehicle, historyEntry = null) {
    const stage = getEffectiveHandoverStage(vehicle, historyEntry);
    return stage === 'hr' || stage === 'management';
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

export function resolveHandoverAssigneeRef(vehicle, historyEntry = null) {
    return historyEntry?.assignedTo || vehicle?.assignedTo || null;
}

export function vehicleHasAssignedEmployee(vehicle) {
    const assigneeId = extractMongoId(vehicle?.assignedTo);
    if (!assigneeId) return false;

    const assignedType = String(vehicle?.assignedToType || 'Employee').toLowerCase();
    if (assignedType !== 'employee') return false;

    const status = String(vehicle?.status || '').toLowerCase();
    if (status === 'assigned') return true;

    // During fleet handover acknowledgment the assignee is set but status stays Pending.
    if (
        String(vehicle?.acceptanceStatus || '').trim() === 'Pending' &&
        (status === 'pending' || getHandoverFlowStage(vehicle) === 'target')
    ) {
        return true;
    }

    return false;
}

export function isHandoverReceiverUser(vehicle, historyEntry, currentUser) {
    if (!currentUser) return false;
    const assigneeRef = resolveHandoverAssigneeRef(vehicle, historyEntry);
    return Boolean(assigneeRef) && userMatchesEmployeeRef(currentUser, assigneeRef);
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
    if (isVehicleInspectionHandoverEntry(historyEntry, vehicle)) {
        return null;
    }

    const explicit = getHandoverFlowStage(vehicle);
    if (explicit === 'hod') return 'hr';
    if (explicit) return explicit;

    if (getHandoverAcceptanceStatus(vehicle, historyEntry) === 'Pending') {
        const action = String(historyEntry?.action || '').trim();
        if (!action || action === 'Assigned') return 'target';
    }

    return null;
}

export function handoverHasTargetEmployee(vehicle, historyEntry = null) {
    if (vehicleHasAssignedEmployee(vehicle)) return true;
    if (getHandoverAcceptanceStatus(vehicle, historyEntry) !== 'Pending') return false;
    return Boolean(extractMongoId(resolveHandoverAssigneeRef(vehicle, historyEntry)));
}

export function getHandoverAssigneeCanSelfAcknowledge(vehicle, assignee = null, historyEntry = null) {
    const meta = historyEntry?.details?.vehicleHandoverWorkflow;
    if (typeof meta?.assigneeCanSelfAcknowledge === 'boolean') {
        return meta.assigneeCanSelfAcknowledge;
    }

    const stored = vehicle?.pendingActionDetails?.vehicleHandoverFlow?.assigneeCanSelfAcknowledge;
    if (typeof stored === 'boolean') return stored;

    const target = assignee || resolveHandoverAssigneeRef(vehicle, historyEntry);
    if (!target || typeof target !== 'object') return false;
    const hasEmail = Boolean(target.companyEmail && String(target.companyEmail).trim());
    if (hasEmail && target.enablePortalAccess === true) return true;
    return hasEmail || target.enablePortalAccess === true;
}

export function isHandoverReportsCompleteForEntry(historyEntry, vehicle = null) {
    if (!historyEntry) return false;

    const assessmentMarkedDone = isReceiverAssessmentMarkedDone(historyEntry);
    const bodyMarkedDone = isBodyConditionMarkedDone(historyEntry);
    if (assessmentMarkedDone && bodyMarkedDone) return true;

    const assessmentForm = buildAssessmentFormState(historyEntry, vehicle);
    const bodyForm = buildBodyConditionFormState(historyEntry);
    return isAssessmentFormComplete(assessmentForm) && isBodyConditionFormComplete(bodyForm);
}

export function getHandoverReportsIncompleteMessage(historyEntry, vehicle = null) {
    if (!historyEntry) return 'Handover record is still loading.';

    const assessmentForm = buildAssessmentFormState(historyEntry, vehicle);
    const bodyForm = buildBodyConditionFormState(historyEntry);
    const assessmentFormComplete = isAssessmentFormComplete(assessmentForm);
    const bodyFormComplete = isBodyConditionFormComplete(bodyForm);
    const assessmentMarkedDone = isReceiverAssessmentMarkedDone(historyEntry);
    const bodyMarkedDone = isBodyConditionMarkedDone(historyEntry);

    const missing = [];

    if (!assessmentMarkedDone && !assessmentFormComplete) {
        missing.push('complete Vehicle Assessment (Yes/No and required photos)');
    } else if (!assessmentMarkedDone && assessmentFormComplete) {
        missing.push('click Next Step on Vehicle Assessment Report');
    }

    if (!bodyMarkedDone && !bodyFormComplete) {
        missing.push('upload all Body Condition photos');
    } else if (!bodyMarkedDone && bodyFormComplete) {
        missing.push('click Go to Approval on Body Condition Report');
    }

    if (missing.length === 0) {
        return 'Complete assessment (Next Step) and body condition (Go to Approval) before approving.';
    }

    return `Before approving: ${missing.join('; ')}.`;
}

export function isHandoverReportsLocked(vehicle, historyEntry = null) {
    if (getHandoverAcceptanceStatus(vehicle, historyEntry) !== 'Pending') return true;

    const stage = getEffectiveHandoverStage(vehicle, historyEntry);
    return stage !== 'target';
}

export function canEditInspectionHandoverContent({
    vehicle,
    historyEntry = null,
    currentUser = null,
    flowchartAdminRow = null,
    allowAfterBodyComplete = false,
}) {
    if (!vehicle || !currentUser || !historyEntry) return false;
    if (!isVehicleInspectionHandoverEntry(historyEntry, vehicle)) return false;
    if (String(vehicle?.vehicleInspectionStatus || '').toLowerCase() !== 'draft') return false;

    const linkedId = vehicle?.vehicleInspectionHandoverHistoryId;
    if (linkedId && historyEntry?._id && String(linkedId) !== String(historyEntry._id)) {
        return false;
    }

    if (!allowAfterBodyComplete && historyEntry?.details?.bodyConditionCompleted === true) {
        return false;
    }

    if (isPortalSuperUser()) return true;

    const isAdmin = isFlowchartAdminOfficerUser(currentUser, flowchartAdminRow);
    const assigneeRef = resolveHandoverAssigneeRef(vehicle, historyEntry);
    const hasAssignee = handoverHasTargetEmployee(vehicle, historyEntry);

    if (!hasAssignee) {
        return isAdmin;
    }

    const assigneeCanSelf = getHandoverAssigneeCanSelfAcknowledge(
        vehicle,
        assigneeRef,
        historyEntry,
    );

    if (assigneeCanSelf && userMatchesEmployeeRef(currentUser, assigneeRef)) {
        return true;
    }

    return isAdmin;
}

export function canEditHandoverReports({
    vehicle,
    historyEntry = null,
    currentUser = null,
    flowchartAdminRow = null,
}) {
    if (!vehicle || !currentUser) return false;
    if (isHandoverReportsLocked(vehicle, historyEntry)) return false;

    if (isPortalSuperUser()) return true;

    const isAdmin = isFlowchartAdminOfficerUser(currentUser, flowchartAdminRow);
    const assigneeRef = resolveHandoverAssigneeRef(vehicle, historyEntry);
    const hasAssignee = handoverHasTargetEmployee(vehicle, historyEntry);

    if (!hasAssignee) {
        return isAdmin;
    }

    const assigneeCanSelf = getHandoverAssigneeCanSelfAcknowledge(
        vehicle,
        assigneeRef,
        historyEntry,
    );

    if (assigneeCanSelf && userMatchesEmployeeRef(currentUser, assigneeRef)) {
        return true;
    }

    return isAdmin;
}

export function canUserActOnHandoverAssign({
    vehicle,
    historyEntry = null,
    currentUser = null,
    flowchartAdminRow = null,
    flowchartHrRow = null,
}) {
    if (!vehicle || !currentUser) return false;
    if (isVehicleInspectionHandoverEntry(historyEntry, vehicle)) return false;
    if (getHandoverAcceptanceStatus(vehicle, historyEntry) !== 'Pending') return false;

    const stage = getEffectiveHandoverStage(vehicle, historyEntry);

    const pendingActorRef = resolvePendingHandoverActorRef(
        vehicle,
        historyEntry,
        stage,
        flowchartAdminRow,
        flowchartHrRow,
    );
    if (pendingActorRef && userMatchesEmployeeRef(currentUser, pendingActorRef)) {
        return true;
    }

    if (stage === 'hr' || stage === 'management') {
        return isFlowchartHrUser(currentUser, flowchartHrRow);
    }

    if (stage === 'target') {
        const isAdmin = isFlowchartAdminOfficerUser(currentUser, flowchartAdminRow);
        const assigneeRef = resolveHandoverAssigneeRef(vehicle, historyEntry);
        const hasAssignee = handoverHasTargetEmployee(vehicle, historyEntry);

        if (!hasAssignee) {
            return isAdmin;
        }

        const assigneeCanSelf = getHandoverAssigneeCanSelfAcknowledge(
            vehicle,
            assigneeRef,
            historyEntry,
        );

        if (assigneeCanSelf && userMatchesEmployeeRef(currentUser, assigneeRef)) {
            return true;
        }

        return isAdmin;
    }

    return false;
}

export function canAcceptHandoverAssign({
    vehicle,
    historyEntry,
    currentUser,
    flowchartAdminRow,
    flowchartHrRow = null,
}) {
    if (!canUserActOnHandoverAssign({ vehicle, historyEntry, currentUser, flowchartAdminRow, flowchartHrRow })) {
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
