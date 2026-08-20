'use client';

import { isLeaveActive } from '@/utils/assetStatusHelpers';
import {
    getVehicleListWaitingLabel,
    isVehicleAwaitingListApproval,
    resolveVehicleListAssigneeStr,
    resolveVehicleListAssignedToDisplay,
} from '@/app/HRM/Asset/Vehicle/components/vehicleAssetStatusUi';
import { collectVehicleProfilePendingItems } from '@/app/HRM/Asset/Vehicle/utils/resolveVehicleProfilePendingItems';
import VehicleProfilePendingStatusBadge from '@/app/HRM/Asset/Vehicle/components/VehicleProfilePendingStatusBadge';
import { EmployeeAssignmentStatusLine } from '@/components/EmployeeNameLink';

const LIST_TEXT =
    'text-[12px] font-bold uppercase tracking-wide whitespace-nowrap leading-none';

const pendingApprovalTextClass = `${LIST_TEXT} text-amber-800`;

/** Assigned To: text only — dark green when assigned, grey when not. */
function assignmentListTextClass(badgeLabel) {
    const label = String(badgeLabel || '').trim().toLowerCase();
    if (label === 'unassigned' || label === 'returned') {
        return `${LIST_TEXT} text-slate-500`;
    }
    return `${LIST_TEXT} text-emerald-800`;
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
                    className={assignmentListTextClass(badgeLabel)}
                    title={badgeLabel}
                >
                    <EmployeeAssignmentStatusLine
                        asset={vehicle}
                        assigneeStr={assigneeStr}
                        line={badgeLabel}
                        className={assignmentListTextClass(badgeLabel)}
                        linkClassName={assignmentListTextClass(badgeLabel)}
                    />
                </span>
            ) : null}
        </div>
    );
}
