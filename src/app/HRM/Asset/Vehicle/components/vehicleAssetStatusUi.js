/**
 * Vehicle asset operational status — labels match VERP_backend/models/AssetItem.js `status` enum.
 * Use for badges and fleet / detail selects.
 */
export const VEHICLE_ASSET_STATUS_OPTIONS = [
    'Assigned',
    'Unassigned',
    'Waiting for Service',
    'On Service',
    'Online',
    'Service',
    'Maintenance',
    'Accident',
    'Out of Service',
    'On Leave',
    'Lost',
    'Returned',
    'Pending',
    'End of Life',
    'Draft',
    'Rejected',
    'Submitted for Approval',
];

export function vehicleAssetStatusBadgeClass(status) {
    const s = String(status || '')
        .toLowerCase()
        .trim();
    if (s === 'waiting for service') return 'bg-cyan-100 text-cyan-900 ring-1 ring-cyan-300/80';
    if (s === 'on service') return 'bg-violet-100 text-violet-800 ring-1 ring-violet-300/80';
    if (s === 'online') return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300/80';
    if (s === 'service' || s === 'maintenance') return 'bg-amber-100 text-amber-900 ring-1 ring-amber-200';
    if (s === 'assigned') return 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200';
    if (s === 'unassigned') return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
    if (s === 'accident') return 'bg-red-100 text-red-800 ring-1 ring-red-200';
    if (s === 'out of service' || s === 'end of life') return 'bg-neutral-200 text-neutral-800 ring-1 ring-neutral-300';
    if (s === 'draft' || s === 'pending' || s === 'submitted for approval') return 'bg-amber-50 text-amber-900 ring-1 ring-amber-200';
    return 'bg-sky-50 text-sky-900 ring-1 ring-sky-200';
}

/** Fleet disposition (`vehicleDispositionStatus`) — not the operational `status` enum. */
export function vehicleDispositionStatusBadgeClass(dispositionStatus) {
    const s = String(dispositionStatus || '')
        .toLowerCase()
        .trim();
    if (s === 'sold') return 'bg-amber-100 text-amber-950 ring-1 ring-amber-300/80';
    if (s === 'total loss') return 'bg-slate-200 text-slate-900 ring-1 ring-slate-400/80';
    return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
}

function vehicleDispositionKeyLocal(vehicle) {
    return String(vehicle?.vehicleDispositionStatus || 'active')
        .toLowerCase()
        .trim();
}

/** Profile activation column: Active / Inactive (Sold & Total loss override disposition). */
export function getVehicleProfileStatusLabel(vehicle) {
    const disp = vehicleDispositionKeyLocal(vehicle);
    if (disp === 'sold') return 'Sold';
    if (disp === 'total loss') return 'Total loss';
    const activation = String(vehicle?.vehicleProfileActivationStatus || 'inactive').toLowerCase().trim();
    return activation === 'active' ? 'Active' : 'Inactive';
}

export function vehicleProfileStatusBadgeClass(vehicle) {
    const label = getVehicleProfileStatusLabel(vehicle);
    if (label === 'Active') return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200';
    if (label === 'Sold') return vehicleDispositionStatusBadgeClass('sold');
    if (label === 'Total loss') return vehicleDispositionStatusBadgeClass('total loss');
    return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
}

function resolveVehicleAssigneeName(vehicle) {
    if (vehicle?.assignedCompany && typeof vehicle.assignedCompany === 'object') {
        return (
            vehicle.assignedCompany.nickName ||
            vehicle.assignedCompany.companyShortName ||
            vehicle.assignedCompany.name ||
            vehicle.assignedCompany.companyName ||
            ''
        );
    }
    const assignee = vehicle?.assignedTo;
    if (!assignee || typeof assignee !== 'object') return '';
    const name = `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim();
    return name || assignee.employeeId || '';
}

function isVehicleAssignmentAcknowledgmentPending(vehicle) {
    if (String(vehicle?.acceptanceStatus || '') !== 'Pending') return false;
    if (vehicle?.pendingAction) return false;
    const status = String(vehicle?.status || '');
    if (status !== 'Pending' && status !== 'Assigned') return false;
    return !!(vehicle?.assignedTo || vehicle?.assignedCompany);
}

/** Assigned To column: Unassigned, assignee name, Pending, or other workflow label. */
export function getVehicleAssignedToLabel(vehicle) {
    if (!vehicle) return '—';

    const assigneeName = resolveVehicleAssigneeName(vehicle);
    const status = String(vehicle.status || '').trim();
    const statusLow = status.toLowerCase();

    if (status === 'Submitted for Approval') return 'Awaiting approval';
    if (status === 'Draft') return 'Draft';
    if (status === 'Rejected') return 'Rejected';

    if (isVehicleAssignmentAcknowledgmentPending(vehicle)) {
        return assigneeName ? `Pending — ${assigneeName}` : 'Pending';
    }

    if (vehicle.pendingAction) {
        const action = String(vehicle.pendingAction).trim();
        return action ? `Pending — ${action}` : 'Pending';
    }

    if (
        vehicle.actionRequiredBy &&
        statusLow === 'pending' &&
        !isVehicleAssignmentAcknowledgmentPending(vehicle)
    ) {
        return 'Awaiting approval';
    }

    if (assigneeName) {
        const service = vehicle.onServiceActive === true;
        const leave = vehicle.onLeaveActive === true;
        if (service && leave) return `${assigneeName} (On Service · On Leave)`;
        if (service) return `${assigneeName} (On Service)`;
        if (leave) return `${assigneeName} (On Leave)`;
        return assigneeName;
    }

    if (statusLow === 'unassigned' || statusLow === 'available' || statusLow === 'returned') {
        return status || 'Unassigned';
    }

    if (!vehicle.assignedTo && !vehicle.assignedCompany) {
        return 'Unassigned';
    }

    return status || 'Assigned';
}

export function vehicleAssigneeHasPersonAvatar(vehicle) {
    const assignee = vehicle?.assignedTo;
    return !!(assignee && typeof assignee === 'object' && (assignee.firstName || assignee.lastName));
}

/** Tools asset list uses "First L." — same shape for assignment status line. */
export function resolveVehicleListAssigneeStr(vehicle) {
    if (vehicle?.assignedCompany && typeof vehicle.assignedCompany === 'object') {
        return (
            vehicle.assignedCompany.nickName ||
            vehicle.assignedCompany.companyShortName ||
            vehicle.assignedCompany.name ||
            vehicle.assignedCompany.companyName ||
            ''
        );
    }
    if (vehicle?.assignedTo && typeof vehicle.assignedTo === 'object') {
        const first = vehicle.assignedTo.firstName || '';
        const last = vehicle.assignedTo.lastName || '';
        if (first && last) return `${first} ${last.charAt(0).toUpperCase()}.`;
        return first || last;
    }
    return '';
}

function isVehicleSubmittedForApproval(vehicle) {
    if (String(vehicle?.status || '') === 'Submitted for Approval') return true;
    return (
        vehicle?.actionRequiredBy != null &&
        String(vehicle?.status || '') === 'Pending' &&
        !isVehicleAssignmentAcknowledgmentPending(vehicle)
    );
}

export function isVehicleAwaitingListApproval(vehicle) {
    return isVehicleSubmittedForApproval(vehicle) || isVehicleAssignmentAcknowledgmentPending(vehicle);
}

function formatVehicleWorkflowActorLabel(ref) {
    if (!ref || typeof ref !== 'object') return '';
    const name = `${ref.firstName || ''} ${ref.lastName || ''}`.trim();
    return name || (ref.employeeId ? String(ref.employeeId) : '');
}

export function getVehicleListWaitingLabel(vehicle) {
    if (isVehicleAssignmentAcknowledgmentPending(vehicle)) {
        const fromActionRequired = formatVehicleWorkflowActorLabel(vehicle?.actionRequiredBy);
        if (fromActionRequired) return fromActionRequired;
        if (vehicle?.assignedCompany && typeof vehicle.assignedCompany === 'object') {
            return (
                vehicle.assignedCompany.nickName ||
                vehicle.assignedCompany.companyShortName ||
                vehicle.assignedCompany.name ||
                vehicle.assignedCompany.companyName ||
                'Company'
            );
        }
        if (vehicle?.assignedTo && typeof vehicle.assignedTo === 'object') {
            const name = `${vehicle.assignedTo.firstName || ''} ${vehicle.assignedTo.lastName || ''}`.trim();
            return name || vehicle.assignedTo.employeeId || 'Acknowledgment';
        }
        return 'Acknowledgment';
    }
    const ar = vehicle?.actionRequiredBy;
    const fromAr = formatVehicleWorkflowActorLabel(ar);
    if (fromAr) return fromAr;
    const st = String(vehicle?.status || '').toLowerCase();
    if (st === 'submitted for approval') return 'Asset controller approval';
    if (st === 'pending') return 'Acknowledgment';
    return 'Approval';
}
