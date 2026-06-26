import { isAssetAssigned } from '../../utils/canPerformAssetAction';

const ACTION_BTN_BASE =
    'min-h-[48px] rounded-2xl px-3 py-2.5 text-[11px] font-black uppercase tracking-wide text-center leading-snug transition-all break-words';

export { ACTION_BTN_BASE };

export function isVehicleProfileActiveForAssignment(vehicleActPhase) {
    return vehicleActPhase === 'active';
}

function isVehicleActivelyAssigned(asset) {
    if (!asset || !isAssetAssigned(asset)) return false;
    const status = String(asset.status || '').trim().toLowerCase();
    if (status === 'assigned') return true;
    if (status === 'pending' && asset.acceptanceStatus === 'Accepted') return true;
    return false;
}

function isVehicleAssignableFromPool(asset) {
    const status = String(asset?.status || '').trim().toLowerCase();
    return status === 'unassigned' || status === 'returned';
}

/**
 * Fleet vehicle blue-panel actions (Assign / Return / Reassign) with HR-centric rules.
 */
export function evaluateVehicleFleetHeaderActions({
    asset,
    isHr = false,
    isAdmin = false,
    currentUserEmployeeId = null,
    vehicleActPhase = 'inactive',
    onAssign,
    onReturn,
    onReassign,
}) {
    if (!asset) return [];

    const assignedToRef = asset?.assignedTo?._id ?? asset?.assignedTo;
    const isAssignee =
        !!assignedToRef && currentUserEmployeeId?.toString() === assignedToRef.toString();

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
        (isHr || isAdmin)
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
