'use client';

import {
    getAssetStatusBadgeClass,
    isLeaveActive,
    isServiceActive,
} from '@/utils/assetStatusHelpers';
import {
    getVehicleListWaitingLabel,
    isVehicleAwaitingListApproval,
    resolveVehicleListAssigneeStr,
    resolveVehicleListAssignedToDisplay,
} from '@/app/HRM/Asset/Vehicle/components/vehicleAssetStatusUi';
import { collectVehicleProfilePendingItems } from '@/app/HRM/Asset/Vehicle/utils/resolveVehicleProfilePendingItems';
import VehicleProfilePendingStatusBadge from '@/app/HRM/Asset/Vehicle/components/VehicleProfilePendingStatusBadge';
import { EmployeeAssignmentStatusLine } from '@/components/EmployeeNameLink';

/** Exact same pill as GPS Status / Status / Service Status. */
const LIST_PILL =
    'inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide whitespace-nowrap';

const pendingApprovalTextClass = `${LIST_PILL} bg-amber-100 text-amber-950 ring-1 ring-amber-300/80`;

/** Assigned To is assignment only — On Service color belongs in Service Status. */
function assignmentListBadgeClass(vehicle) {
    if (isLeaveActive(vehicle)) return `${LIST_PILL} bg-sky-100 text-sky-800`;
    const statusStr = String(vehicle?.status || '');
    const isPool = statusStr === 'Unassigned' || statusStr === 'Returned';
    if (isPool && !vehicle?.assignedTo && !vehicle?.assignedCompany) {
        return `${LIST_PILL} bg-emerald-100 text-emerald-700`;
    }
    if (isServiceActive(vehicle) || vehicle?.assignedTo || vehicle?.assignedCompany || statusStr === 'Assigned') {
        return `${LIST_PILL} bg-indigo-100 text-indigo-700`;
    }
    return `${LIST_PILL} ${getAssetStatusBadgeClass(statusStr, { ...vehicle, onServiceActive: false })}`;
}

export default function VehicleListAssignmentStatusCell({ vehicle }) {
    if (!vehicle) return <span className="text-gray-400">—</span>;

    const pendingItems = collectVehicleProfilePendingItems(vehicle).filter(
        (item) => item.kind !== 'service',
    );
    const submittedWaiting =
        isVehicleAwaitingListApproval(vehicle) && pendingItems.length === 0;
    const hideAssigneeBadge =
        pendingItems.some((item) => item.kind === 'handover') || submittedWaiting;

    const statusStr = String(vehicle.status || '');
    const isPoolStatus = statusStr === 'Unassigned' || statusStr === 'Returned';
    const hasOperationalFlags = isLeaveActive(vehicle);
    const assigneeStr = resolveVehicleListAssigneeStr(vehicle);

    let badgeLabel = '';
    if (isPoolStatus && !hasOperationalFlags) {
        badgeLabel = statusStr || 'Unassigned';
    } else {
        const isAssignedRelated =
            statusStr === 'Assigned' ||
            vehicle?.assignedTo ||
            vehicle?.assignedCompany ||
            hasOperationalFlags;
        if (!isAssignedRelated && !isPoolStatus) {
            badgeLabel = statusStr || '';
        } else {
            badgeLabel = resolveVehicleListAssignedToDisplay(vehicle);
        }
    }

    const showAssigneeBadge = !hideAssigneeBadge && badgeLabel && badgeLabel !== '—';

    if (pendingItems.length === 0 && !submittedWaiting && !showAssigneeBadge) {
        return <span className="text-gray-400">—</span>;
    }

    return (
        <div className="flex flex-col items-start gap-0.5">
            {pendingItems.map((item) => (
                <VehicleProfilePendingStatusBadge
                    key={`${item.kind}-${item.label}-${item.pendingFor}`}
                    item={item}
                    size="list"
                />
            ))}
            {submittedWaiting ? (
                <p
                    className={pendingApprovalTextClass}
                    title={`Pending — ${getVehicleListWaitingLabel(vehicle)}`}
                >
                    Pending — {getVehicleListWaitingLabel(vehicle)}
                </p>
            ) : null}
            {showAssigneeBadge ? (
                <span
                    className={assignmentListBadgeClass(vehicle)}
                    title={badgeLabel}
                >
                    <EmployeeAssignmentStatusLine
                        asset={vehicle}
                        assigneeStr={assigneeStr}
                        line={badgeLabel}
                        className="text-[9px] font-bold uppercase tracking-wide leading-none"
                        linkClassName="text-[9px] font-bold uppercase tracking-wide leading-none"
                    />
                </span>
            ) : null}
        </div>
    );
}
