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

/**
 * Handover tab blue card: Assign / Reassign / Return / Create Inspection.
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
    isCreateInspectionDisabled = false,
    createInspectionDisabledReason = '',
}) {
    const buttons = [];
    if (!asset) return buttons;

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

    if (profileActive && !isDisposed) {
        const isAssignMode = !assigned;
        const assigneeMayReassign =
            isAssignee &&
            assigned &&
            String(asset.status || '').trim().toLowerCase() === 'assigned' &&
            !hasPendingAssignmentAck &&
            !isAssigneeReassignPending;
        const assigneeMayReturn =
            isAssignee && assigned && !hasPendingAssignmentAck && !isAssigneeReturnPending;
        const adminMayManage = canManageAssignment;

        let disabled = false;
        let title = '';

        if (isAssignMode) {
            if (!canAssignFleetVehicle) {
                disabled = true;
                title = 'Only the flowchart Admin Officer can assign fleet vehicles.';
            } else if (hasWorkflowPending) {
                disabled = true;
                title = 'Complete or reject the pending fleet action first.';
            } else if (!isVehicleAssignableFromPool(asset)) {
                disabled = true;
                title = 'Vehicle must be unassigned or returned before a new assignment.';
            }
        } else if (!adminMayManage && !assigneeMayReassign) {
            disabled = true;
            title = activelyAssigned
                ? 'Only the flowchart Admin Officer or the current assignee (status Assigned) can reassign this vehicle.'
                : 'Reassign is available once the vehicle status is Assigned.';
        } else if (hasWorkflowPending) {
            disabled = true;
            title = adminMayManage
                ? 'Use the approval banner above to approve or reject the pending request.'
                : 'Complete or reject the pending fleet action first.';
        } else if (!adminMayManage && hasPendingAssignmentAck) {
            disabled = true;
            title = 'Waiting for the assignee to accept the current assignment.';
        } else if (!adminMayManage && !activelyAssigned) {
            disabled = true;
            title = 'Reassign is available once your assignment is fully active.';
        } else if (isAssigneeReassignPending) {
            disabled = true;
            title = 'Your reassign request is awaiting HR approval.';
        }

        if (isAssignMode && canAssignFleetVehicle) {
            buttons.push({
                key: 'assign',
                label: 'ASSIGN',
                displayLabel: 'ASSIGN',
                disabled,
                title,
                onClick: onAssign,
                className: `${ACTION_BTN_BASE} hover:opacity-95 hover:shadow-lg active:scale-[0.98] text-slate-700 bg-[#dde5c8] ${
                    disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`,
            });
        } else if (!isAssignMode) {
            buttons.push({
                key: 'reassign',
                label: 'REASSIGN',
                displayLabel: 'REASSIGN',
                disabled,
                title:
                    !disabled && isAssignee && !canManageAssignment
                        ? 'Request goes to HR for approval (email and dashboard task).'
                        : title,
                onClick: onReassign,
                className: `${ACTION_BTN_BASE} hover:opacity-95 hover:shadow-lg active:scale-[0.98] text-slate-700 bg-[#dde5c8] ${
                    disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`,
            });
        }

        if (!isAssignMode) {
            let returnDisabled = false;
            let returnTitle = '';

            if (!adminMayManage && !assigneeMayReturn) {
                returnDisabled = true;
                returnTitle =
                    'Only the flowchart Admin Officer or the current assignee can return this vehicle.';
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
            }

            buttons.push({
                key: 'return',
                label: 'RETURN',
                displayLabel: 'RETURN',
                disabled: returnDisabled,
                title:
                    !returnDisabled && isAssignee && !adminMayManage
                        ? 'Request goes to HR for approval (email and dashboard task).'
                        : returnTitle,
                onClick: onReturn,
                className: `${ACTION_BTN_BASE} hover:opacity-95 hover:shadow-lg active:scale-[0.98] text-slate-700 bg-[#dde5c8] ${
                    returnDisabled ? 'opacity-50 cursor-not-allowed' : ''
                }`,
            });
        }
    }

    if (!isDisposed) {
        buttons.push({
            key: 'create-inspection',
            label: 'CREATE INSPECTION',
            displayLabel: 'CREATE INSPECTION',
            disabled: isCreateInspectionDisabled,
            title:
                createInspectionDisabledReason ||
                (vehicleActPhase === 'active'
                    ? 'Request first vehicle inspection'
                    : 'Request vehicle inspection (required before profile activation)'),
            onClick: onCreateInspection,
            className: `${ACTION_BTN_BASE} hover:opacity-95 hover:shadow-lg active:scale-[0.98] text-slate-700 bg-[#dde5c8] ${
                isCreateInspectionDisabled ? 'opacity-50 cursor-not-allowed' : ''
            }`,
        });
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
        actions.push({
            key: 'return',
            label: 'RETURN ASSET',
            displayLabel: 'RETURN ASSET',
            disabled: false,
            onClick: onReturn,
        });
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
