import { isAdmin as isPortalSuperUser } from '@/utils/permissions';
import {
    RECEIVER_ASSESSMENT_ITEMS,
    hasAssessmentPhoto,
    isReceiverAssessmentMarkedDone,
} from './vehicleHandoverReceiverAssessment';
import {
    BODY_CONDITION_VIEW_FIELDS,
    isBodyConditionMarkedDone,
} from './vehicleHandoverBodyCondition';
import {
    nameFromFlowchartRow,
    pickFlowchartAdminRow,
} from './vehicleHandoverAssignWorkflow';
import { isVehicleInspectionHandoverEntry } from './vehicleHandoverHistory';

/** History-record completeness only (matches backend accept gate — not live list / previous merge). */
function isReceiverAssessmentCompleteOnHistory(historyEntry) {
    const source =
        historyEntry?.details?.receiverAssessment ||
        historyEntry?.details?.vehicleAssessmentReportByReceiver ||
        null;
    if (!source || typeof source !== 'object') return false;
    return RECEIVER_ASSESSMENT_ITEMS.every((item) => {
        const row = source[item.key];
        if (!row || typeof row !== 'object') return false;
        if (row.present !== true && row.present !== false) return false;
        if (row.present === true && !hasAssessmentPhoto(row.photo || row.image)) return false;
        return true;
    });
}

function isBodyConditionCompleteOnHistory(historyEntry) {
    const source =
        historyEntry?.details?.bodyConditionReport || historyEntry?.details?.bodyCondition || null;
    if (!source || typeof source !== 'object') return false;
    return BODY_CONDITION_VIEW_FIELDS.every((field) => {
        const row = source[field.key];
        if (!row || typeof row !== 'object') return false;
        return hasAssessmentPhoto(row.photo || row.image);
    });
}

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

export function isHandoverHistoryFullyApproved(historyEntry) {
    if (!historyEntry) return false;

    const lifecycle = String(historyEntry?.details?.handoverLifecycleStatus || '')
        .trim()
        .toLowerCase();
    if (lifecycle === 'approved') return true;
    if (historyEntry?.details?.handoverHrApprovedAt) return true;

    const hrStage = historyEntry?.details?.vehicleHandoverWorkflow?.stages?.hr;
    return Boolean(hrStage?.date);
}

export function isHandoverHistoryAwaitingHrApproval(historyEntry, vehicle = null) {
    if (!historyEntry) return false;
    if (isHandoverHistoryFullyApproved(historyEntry)) return false;

    const vehicleStatus = String(vehicle?.acceptanceStatus || '').trim();
    const hasActiveFlow = Boolean(getHandoverFlowStage(vehicle));
    if (vehicleStatus === 'Accepted' && !hasActiveFlow) return false;

    const lifecycle = String(historyEntry?.details?.handoverLifecycleStatus || '')
        .trim()
        .toLowerCase();
    if (lifecycle === 'approved' || lifecycle === 'rejected') return false;

    const workflow = historyEntry?.details?.vehicleHandoverWorkflow;
    const targetDone = Boolean(workflow?.stages?.target?.date);
    const hrDone = Boolean(workflow?.stages?.hr?.date);

    return (lifecycle === 'accepted' || targetDone) && !hrDone;
}

/** Optimistic client merge after HR approves — keeps workflow UI in sync before refetch completes. */
export function mergeHandoverHistoryAfterHrApproval(historyEntry, actor = null) {
    if (!historyEntry) return historyEntry;

    const now = new Date().toISOString();
    const existingWorkflow = historyEntry?.details?.vehicleHandoverWorkflow || {};
    const existingStages = existingWorkflow.stages || {};
    const actorName = actor
        ? `${actor.firstName || ''} ${actor.lastName || ''}`.trim() ||
          String(actor.employeeId || '').trim()
        : existingStages.hr?.actorName || '';

    return {
        ...historyEntry,
        action: 'Accepted',
        details: {
            ...(historyEntry.details && typeof historyEntry.details === 'object' ? historyEntry.details : {}),
            acceptanceStatus: 'Accepted',
            handoverLifecycleStatus: 'approved',
            handoverHrApprovedAt: now,
            vehicleHandoverWorkflow: {
                ...existingWorkflow,
                stages: {
                    ...existingStages,
                    hr: {
                        ...(existingStages.hr || {}),
                        actorName: actorName || existingStages.hr?.actorName || '',
                        actorEmployeeId:
                            actor?.employeeId || existingStages.hr?.actorEmployeeId || '',
                        date: now,
                    },
                },
            },
        },
    };
}

function isHandoverFlowLinkedToHistory(vehicle, historyEntry) {
    const flow = vehicle?.pendingActionDetails?.vehicleHandoverFlow;
    if (!flow?.historyId || !historyEntry?._id) return true;
    return String(flow.historyId) === String(historyEntry._id);
}

export function getHandoverAcceptanceStatus(vehicle, historyEntry = null) {
    if (isHandoverHistoryFullyApproved(historyEntry)) {
        return 'Accepted';
    }

    const flowStage = String(getHandoverFlowStage(vehicle) || '').toLowerCase();
    const fromVehicle = String(vehicle?.acceptanceStatus || '').trim();

    if (flowStage === 'hr' || flowStage === 'management' || flowStage === 'hod') {
        return 'Pending';
    }

    if (fromVehicle === 'Accepted' && !flowStage) {
        return 'Accepted';
    }

    if (
        isHandoverHistoryAwaitingHrApproval(historyEntry, vehicle) &&
        isHandoverFlowLinkedToHistory(vehicle, historyEntry)
    ) {
        return 'Pending';
    }

    if (fromVehicle) return fromVehicle;

    return String(
        historyEntry?.details?.acceptanceStatus ||
            (String(historyEntry?.action || '').trim() === 'Assigned' ? 'Pending' : '') ||
            '',
    ).trim();
}

export function getEffectiveHandoverStage(vehicle, historyEntry = null) {
    if (isVehicleInspectionHandoverEntry(historyEntry, vehicle)) {
        return null;
    }

    if (isHandoverHistoryFullyApproved(historyEntry)) {
        return null;
    }

    const explicit = getHandoverFlowStage(vehicle);
    if (explicit === 'hod') return 'hr';
    if (explicit) return explicit;

    if (isHandoverHistoryAwaitingHrApproval(historyEntry, vehicle) &&
        isHandoverFlowLinkedToHistory(vehicle, historyEntry)
    ) {
        return 'hr';
    }

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
    if (!hasEmail) return false;
    return target.enablePortalAccess === true;
}

export function isHandoverReportsCompleteForEntry(historyEntry, vehicle = null) {
    if (!historyEntry) return false;

    const bodyMarkedDone = isBodyConditionMarkedDone(historyEntry);
    const bodyDataComplete = isBodyConditionCompleteOnHistory(historyEntry);

    if (isVehicleInspectionHandoverEntry(historyEntry, vehicle)) {
        return bodyMarkedDone || bodyDataComplete;
    }

    const assessmentMarkedDone = isReceiverAssessmentMarkedDone(historyEntry);
    const assessmentDataComplete = isReceiverAssessmentCompleteOnHistory(historyEntry);

    // Require Process Next + Go to Approval (or equivalent saved history data).
    // Do not treat live-list / previous-assignment photos as complete for Accept.
    if (assessmentMarkedDone && bodyMarkedDone) return true;
    return assessmentDataComplete && bodyDataComplete;
}

export function getHandoverReportsIncompleteMessage(historyEntry, vehicle = null) {
    if (!historyEntry) return 'Handover record is still loading.';

    const bodyMarkedDone = isBodyConditionMarkedDone(historyEntry);
    const bodyDataComplete = isBodyConditionCompleteOnHistory(historyEntry);

    if (isVehicleInspectionHandoverEntry(historyEntry, vehicle)) {
        if (!bodyMarkedDone && !bodyDataComplete) {
            return 'Before submitting: upload all Body Condition photos.';
        }
        if (!bodyMarkedDone && bodyDataComplete) {
            return 'Before submitting: click Go to Approval on Body Condition Report.';
        }
        return 'Complete body condition (Go to Approval) before submitting for HR approval.';
    }

    const assessmentMarkedDone = isReceiverAssessmentMarkedDone(historyEntry);
    const assessmentDataComplete = isReceiverAssessmentCompleteOnHistory(historyEntry);

    const missing = [];

    if (!assessmentMarkedDone && !assessmentDataComplete) {
        missing.push('complete Vehicle Accessories and click Process Next');
    } else if (!assessmentMarkedDone && assessmentDataComplete) {
        missing.push('click Process Next on Vehicle Accessories');
    }

    if (!bodyMarkedDone && !bodyDataComplete) {
        missing.push('upload all Body Condition photos and click Go to Approval');
    } else if (!bodyMarkedDone && bodyDataComplete) {
        missing.push('click Go to Approval on Body Condition Report');
    }

    if (missing.length === 0) {
        return 'Complete accessories (Process Next) and body condition (Go to Approval) before accepting.';
    }

    return `Before accepting: ${missing.join('; ')}.`;
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

    if (historyEntry?.details?.reinspection === true) {
        return isAdmin;
    }

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

/** Inspection/reinspection accessories — editable until assessment is marked done (even after body condition). */
export function canEditInspectionHandoverAccessories({
    vehicle,
    historyEntry = null,
    currentUser = null,
    flowchartAdminRow = null,
} = {}) {
    if (isReceiverAssessmentMarkedDone(historyEntry)) return false;
    return canEditInspectionHandoverContent({
        vehicle,
        historyEntry,
        currentUser,
        flowchartAdminRow,
        allowAfterBodyComplete: true,
    });
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
    if (isHandoverHistoryFullyApproved(historyEntry)) return false;
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
                    'Complete Vehicle Accessories and Body Condition photos before approving.',
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
