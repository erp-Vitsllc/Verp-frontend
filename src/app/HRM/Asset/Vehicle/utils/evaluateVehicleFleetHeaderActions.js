import { isAssetAssigned } from '../../utils/canPerformAssetAction';

const ACTION_BTN_BASE =
    'min-h-[48px] rounded-2xl px-3 py-2.5 text-[11px] font-black uppercase tracking-wide text-center leading-snug transition-all break-words';

export { ACTION_BTN_BASE };

export function isVehicleProfileActiveForAssignment(vehicleActPhase) {
    return vehicleActPhase === 'active';
}

function normEmpId(s) {
    return String(s || '').toLowerCase().replace(/\s+/g, '');
}

export function isCurrentUserVehicleAssignee(asset, currentUserEmployeeId, currentUser = null) {
    if (!asset?.assignedTo) return false;

    const assignedTo = asset.assignedTo;
    const assignedMongoId =
        typeof assignedTo === 'object' ? assignedTo._id || assignedTo.id : assignedTo;

    const viewerIdCandidates = new Set(
        [currentUserEmployeeId, currentUser?.employeeObjectId, currentUser?._id, currentUser?.id]
            .filter((v) => v != null && v !== '')
            .map((v) => String(v)),
    );

    if (assignedMongoId && viewerIdCandidates.has(String(assignedMongoId))) {
        return true;
    }

    const assignedCode =
        typeof assignedTo === 'object' && assignedTo.employeeId
            ? normEmpId(assignedTo.employeeId)
            : '';
    const viewerCode = normEmpId(currentUser?.employeeId || '');
    return !!assignedCode && !!viewerCode && assignedCode === viewerCode;
}

export function isVehicleFirstInspectionComplete(asset) {
    if (!asset) return false;
    const inspectionStatus = String(asset?.vehicleInspectionStatus || 'none').toLowerCase();
    if (inspectionStatus === 'active') return true;
    return (asset?.documents || []).some(
        (doc) => String(doc?.type || '').trim().toLowerCase() === 'vehicle inspection',
    );
}

/** True once a first-inspection handover exists (draft, pending HR, or approved). */
export function hasVehicleInspectionHandoverStarted(asset) {
    if (!asset) return false;
    const inspectionStatus = String(asset?.vehicleInspectionStatus || 'none').toLowerCase();
    if (inspectionStatus === 'draft' || inspectionStatus === 'pending_hr' || inspectionStatus === 'active') {
        return true;
    }
    return (asset?.documents || []).some(
        (doc) => String(doc?.type || '').trim().toLowerCase() === 'vehicle inspection',
    );
}

export function canShowVehicleReinspectionAction(asset, vehicleActPhase = 'inactive') {
    if (!asset) return false;
    const inspectionStatus = String(asset?.vehicleInspectionStatus || 'none').toLowerCase();
    if (inspectionStatus === 'draft' || inspectionStatus === 'pending_hr') return false;
    return vehicleActPhase === 'active' && isVehicleFirstInspectionComplete(asset);
}

export function isVehicleActivelyAssigned(asset) {
    if (!asset || !isAssetAssigned(asset)) return false;
    if (String(asset.acceptanceStatus || '') === 'Pending') return false;
    const status = String(asset.status || '').trim().toLowerCase();
    if (status === 'unassigned' || status === 'returned') return false;
    return true;
}

function isVehicleAssignableFromPool(asset) {
    const status = String(asset?.status || '').trim().toLowerCase();
    return status === 'unassigned' || status === 'returned';
}

const HANDOVER_ACTION_BTN_CLASS = (disabled) =>
    `${ACTION_BTN_BASE} hover:opacity-95 hover:shadow-lg active:scale-[0.98] text-slate-700 bg-[#dde5c8] ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
    }`;

/**
 * Handover tab blue card: after inspection starts, show Assign, Reassign, Create Inspection
 * (disabled once first inspection is complete), and Create Reinspection. Return is hidden.
 */
export function evaluateVehicleHandoverCardActions({
    asset,
    canAssignFleetVehicle = false,
    canManageAssignment = false,
    currentUserEmployeeId = null,
    currentUser = null,
    vehicleActPhase = 'inactive',
    onAssign,
    onReassign,
    onReturn,
    onCreateInspection,
    canCreateInspection = false,
    isCreateInspectionDisabled = false,
    createInspectionDisabledReason = '',
    onCreateReinspection,
    canCreateReinspection = false,
    isCreateReinspectionDisabled = false,
    createReinspectionDisabledReason = '',
}) {
    if (!asset) return [];

    const profileActive = vehicleActPhase === 'active';
    const isDisposed = ['sold', 'total loss'].includes(
        String(asset.vehicleDispositionStatus || '').toLowerCase().trim(),
    );
    const assigned = isAssetAssigned(asset);
    const isAssignee = isCurrentUserVehicleAssignee(asset, currentUserEmployeeId, currentUser);
    const activelyAssigned = isVehicleActivelyAssigned(asset);
    const hasWorkflowPending = !!asset.pendingAction;
    const isAssigneeReassignPending =
        asset.pendingAction === 'Reassign Asset' &&
        String(asset.pendingActionDetails?.requestedBy || '') === String(currentUserEmployeeId || '');
    const isAssigneeReturnPending =
        asset.pendingAction === 'Return Asset' &&
        (String(asset.pendingActionDetails?.requestedBy || '') === String(currentUserEmployeeId || '') ||
            isAssignee);
    const hasPendingAssignmentAck =
        asset.acceptanceStatus === 'Pending' &&
        !!(asset.actionRequiredBy || asset.assignedTo || asset.assignedCompany);
    const inspectionStatus = String(asset.vehicleInspectionStatus || 'none').toLowerCase();
    const inspectionBlocksAssign = inspectionStatus === 'draft' || inspectionStatus === 'pending_hr';
    const inspectionAssignBlockTitle =
        inspectionStatus === 'pending_hr'
            ? 'Approve the vehicle inspection handover (HR step) before assigning or reassigning.'
            : 'Complete and approve the vehicle inspection handover before assigning or reassigning.';
    const inspectionComplete = isVehicleFirstInspectionComplete(asset);
    const inspectionHandoverStarted = hasVehicleInspectionHandoverStarted(asset);
    const showReinspection = canShowVehicleReinspectionAction(asset, vehicleActPhase);
    const assigneeMayReassign =
        isAssignee &&
        assigned &&
        String(asset.status || '').trim().toLowerCase() === 'assigned' &&
        !hasPendingAssignmentAck &&
        !isAssigneeReassignPending;
    const assigneeMayReturn =
        isAssignee && assigned && !hasPendingAssignmentAck && !isAssigneeReturnPending;
    const adminMayManage = canManageAssignment;

    let assignDisabled = false;
    let assignTitle = '';
    if (isDisposed) {
        assignDisabled = true;
        assignTitle = 'Vehicle is disposed.';
    } else if (!profileActive) {
        assignDisabled = true;
        assignTitle = 'Assign is available after the vehicle profile is activated.';
    } else if (assigned) {
        assignDisabled = true;
        assignTitle = 'Vehicle is already assigned. Use Reassign instead.';
    } else if (!canAssignFleetVehicle) {
        assignDisabled = true;
        assignTitle = 'Only the flowchart Admin Officer can assign fleet vehicles.';
    } else if (hasWorkflowPending) {
        assignDisabled = true;
        assignTitle = 'Complete or reject the pending fleet action first.';
    } else if (inspectionBlocksAssign) {
        assignDisabled = true;
        assignTitle = inspectionAssignBlockTitle;
    } else if (!isVehicleAssignableFromPool(asset)) {
        assignDisabled = true;
        assignTitle = 'Vehicle must be unassigned or returned before a new assignment.';
    }

    let reassignDisabled = false;
    let reassignTitle = '';
    if (isDisposed) {
        reassignDisabled = true;
        reassignTitle = 'Vehicle is disposed.';
    } else if (!profileActive) {
        reassignDisabled = true;
        reassignTitle = 'Reassign is available after the vehicle profile is activated.';
    } else if (!assigned) {
        reassignDisabled = true;
        reassignTitle = 'Vehicle is not assigned. Use Assign instead.';
    } else if (!adminMayManage && !assigneeMayReassign) {
        reassignDisabled = true;
        reassignTitle = activelyAssigned
            ? 'Only the flowchart Admin Officer or the current assignee (status Assigned) can reassign this vehicle.'
            : 'Reassign is available once the vehicle status is Assigned.';
    } else if (hasWorkflowPending) {
        reassignDisabled = true;
        reassignTitle = adminMayManage
            ? 'Use the approval banner above to approve or reject the pending request.'
            : 'Complete or reject the pending fleet action first.';
    } else if (inspectionBlocksAssign) {
        reassignDisabled = true;
        reassignTitle = inspectionAssignBlockTitle;
    } else if (!adminMayManage && hasPendingAssignmentAck) {
        reassignDisabled = true;
        reassignTitle = 'Waiting for the assignee to accept the current assignment.';
    } else if (!adminMayManage && !activelyAssigned) {
        reassignDisabled = true;
        reassignTitle = 'Reassign is available once your assignment is fully active.';
    } else if (isAssigneeReassignPending) {
        reassignDisabled = true;
        reassignTitle = 'Your reassign request is awaiting HR approval.';
    }

    let returnDisabled = false;
    let returnTitle = '';
    if (isDisposed) {
        returnDisabled = true;
        returnTitle = 'Vehicle is disposed.';
    } else if (!profileActive) {
        returnDisabled = true;
        returnTitle = 'Return is available after the vehicle profile is activated.';
    } else if (!assigned) {
        returnDisabled = true;
        returnTitle = 'Vehicle is not assigned.';
    } else if (!adminMayManage && !assigneeMayReturn) {
        returnDisabled = true;
        returnTitle = 'Only the flowchart Admin Officer or the current assignee can return this vehicle.';
    } else if (hasWorkflowPending) {
        returnDisabled = true;
        returnTitle = adminMayManage
            ? 'Use the approval banner above to approve or reject the pending request.'
            : 'Complete or reject the pending fleet action first.';
    } else if (!adminMayManage && hasPendingAssignmentAck) {
        returnDisabled = true;
        returnTitle = 'Waiting for the assignee to accept the current assignment.';
    } else if (!adminMayManage && !activelyAssigned) {
        returnDisabled = true;
        returnTitle = 'Return is available once your assignment is fully active.';
    } else if (isAssigneeReturnPending) {
        returnDisabled = true;
        returnTitle = 'Your return request is awaiting HR approval.';
    } else if (inspectionHandoverStarted) {
        returnDisabled = true;
        returnTitle =
            'Return is not available after a vehicle inspection has been created. Use Reassign instead.';
    } else if (!returnDisabled && isAssignee && !adminMayManage) {
        returnTitle = 'Request goes to HR for approval (email and dashboard task).';
    }

    let createInspectionDisabled = true;
    let createInspectionTitle = 'Only the flowchart Admin Officer can create vehicle inspections.';
    if (isDisposed) {
        createInspectionTitle = 'Vehicle is disposed.';
    } else if (!canCreateInspection) {
        createInspectionDisabled = true;
    } else if (inspectionComplete) {
        createInspectionDisabled = true;
        createInspectionTitle = 'First inspection is already complete. Use Create Reinspection.';
    } else if (inspectionStatus === 'pending_hr') {
        createInspectionDisabled = true;
        createInspectionTitle = 'A vehicle inspection request is pending HR approval.';
    } else if (inspectionStatus === 'draft') {
        createInspectionDisabled = true;
        createInspectionTitle = 'An inspection handover is already in progress.';
    } else if (isCreateInspectionDisabled) {
        createInspectionDisabled = true;
        createInspectionTitle = createInspectionDisabledReason || createInspectionTitle;
    } else {
        createInspectionDisabled = false;
        createInspectionTitle =
            createInspectionDisabledReason ||
            (profileActive
                ? 'Request first vehicle inspection'
                : 'Request vehicle inspection (required before profile activation)');
    }

    let createReinspectionDisabled = true;
    let createReinspectionTitle =
        'Only the flowchart Admin Officer can create vehicle reinspections.';
    if (isDisposed) {
        createReinspectionTitle = 'Vehicle is disposed.';
    } else if (!canCreateReinspection) {
        createReinspectionDisabled = true;
    } else if (!profileActive) {
        createReinspectionDisabled = true;
        createReinspectionTitle = 'Reinspection is available after the vehicle profile is activated.';
    } else if (!inspectionComplete) {
        createReinspectionDisabled = true;
        createReinspectionTitle = 'Complete the first vehicle inspection before creating a reinspection.';
    } else if (inspectionStatus === 'draft') {
        createReinspectionDisabled = true;
        createReinspectionTitle = 'A reinspection handover is already in progress.';
    } else if (inspectionStatus === 'pending_hr') {
        createReinspectionDisabled = true;
        createReinspectionTitle = 'A vehicle reinspection request is pending HR approval.';
    } else if (!showReinspection) {
        createReinspectionDisabled = true;
        createReinspectionTitle = 'Reinspection is not available for this vehicle right now.';
    } else if (isCreateReinspectionDisabled) {
        createReinspectionDisabled = true;
        createReinspectionTitle = createReinspectionDisabledReason || createReinspectionTitle;
    } else {
        createReinspectionDisabled = false;
        createReinspectionTitle =
            createReinspectionDisabledReason ||
            'Start a new inspection cycle. Previous inspection rows stay in handover history.';
    }

    if (!reassignDisabled && isAssignee && !canManageAssignment && !reassignTitle) {
        reassignTitle = 'Request goes to HR for approval (email and dashboard task).';
    }

    const buttons = [
        {
            key: 'assign',
            label: 'ASSIGN',
            displayLabel: 'ASSIGN',
            disabled: assignDisabled,
            title: assignTitle,
            onClick: onAssign,
            className: HANDOVER_ACTION_BTN_CLASS(assignDisabled),
        },
        {
            key: 'reassign',
            label: 'REASSIGN',
            displayLabel: 'REASSIGN',
            disabled: reassignDisabled,
            title: reassignTitle,
            onClick: onReassign,
            className: HANDOVER_ACTION_BTN_CLASS(reassignDisabled),
        },
        {
            key: 'return',
            label: 'RETURN',
            displayLabel: 'RETURN',
            disabled: returnDisabled,
            title: returnTitle,
            onClick: onReturn,
            className: HANDOVER_ACTION_BTN_CLASS(returnDisabled),
        },
        {
            key: 'create-inspection',
            label: 'CREATE INSPECTION',
            displayLabel: 'CREATE INSPECTION',
            disabled: createInspectionDisabled,
            title: createInspectionTitle,
            onClick: onCreateInspection,
            className: HANDOVER_ACTION_BTN_CLASS(createInspectionDisabled),
        },
        {
            key: 'create-reinspection',
            label: 'CREATE REINSPECTION',
            displayLabel: 'CREATE REINSPECTION',
            disabled: createReinspectionDisabled,
            title: createReinspectionTitle,
            onClick: onCreateReinspection,
            className: HANDOVER_ACTION_BTN_CLASS(createReinspectionDisabled),
        },
    ];

    if (inspectionHandoverStarted) {
        const postInspectionKeys = [
            'assign',
            'reassign',
            ...(canCreateReinspection ? ['create-reinspection'] : []),
            'create-inspection',
        ];
        return postInspectionKeys
            .map((key) => buttons.find((button) => button.key === key))
            .filter(Boolean);
    }

    return buttons;
}

/**
 * Fleet vehicle blue-panel actions (Assign / Return / Reassign) with HR-centric rules.
 */
export function evaluateVehicleFleetHeaderActions({
    asset,
    isAssetController = false,
    isHr = false,
    isAdmin = false,
    currentUserEmployeeId = null,
    vehicleActPhase = 'inactive',
    onAssign,
    onReturn,
    onReassign,
}) {
    if (!asset) return [];

    const isAssignee = isCurrentUserVehicleAssignee(asset, currentUserEmployeeId);

    const hasWorkflowPending = !!asset.pendingAction;
    const hasPendingAssignmentAck =
        asset.acceptanceStatus === 'Pending' &&
        !!(asset.actionRequiredBy || asset.assignedTo || asset.assignedCompany);
    const profileActive = isVehicleProfileActiveForAssignment(vehicleActPhase);
    const isDisposed =
        ['sold', 'total loss'].includes(String(asset.vehicleDispositionStatus || '').toLowerCase().trim());
    const inspectionHandoverStarted = hasVehicleInspectionHandoverStarted(asset);

    const actions = [];

    if (
        !isDisposed &&
        profileActive &&
        !hasWorkflowPending &&
        !hasPendingAssignmentAck &&
        isVehicleAssignableFromPool(asset) &&
        !isAssetAssigned(asset) &&
        (isAssetController || isAdmin)
    ) {
        actions.push({
            key: 'assign',
            label: 'ASSIGN',
            displayLabel: 'ASSIGN',
            disabled: false,
            onClick: onAssign,
        });
    }

    if (
        !isDisposed &&
        profileActive &&
        !hasWorkflowPending &&
        !hasPendingAssignmentAck &&
        isVehicleActivelyAssigned(asset) &&
        (isHr || isAdmin || isAssignee)
    ) {
        if (!inspectionHandoverStarted) {
            actions.push({
                key: 'return',
                label: 'RETURN ASSET',
                displayLabel: 'RETURN ASSET',
                disabled: false,
                onClick: onReturn,
            });
        }
        actions.push({
            key: 'reassign',
            label: 'REASSIGN ASSET',
            displayLabel: 'REASSIGN ASSET',
            disabled: false,
            onClick: onReassign,
        });
    }

    return actions.map((action) => ({
        ...action,
        className: `${ACTION_BTN_BASE} hover:opacity-95 hover:shadow-lg active:scale-[0.98] text-slate-700 bg-[#dde5c8] ${
            action.disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`,
    }));
}
