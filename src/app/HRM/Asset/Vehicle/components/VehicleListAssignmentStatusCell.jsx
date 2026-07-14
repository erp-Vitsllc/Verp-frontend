'use client';

import {
    formatAssetAssignmentStatusLine,
    getAssetStatusBadgeClass,
    isLeaveActive,
    isServiceActive,
} from '@/utils/assetStatusHelpers';
import {
    getVehicleListWaitingLabel,
    isVehicleAwaitingListApproval,
    resolveVehicleListAssigneeStr,
} from '@/app/HRM/Asset/Vehicle/components/vehicleAssetStatusUi';
import { collectVehicleProfilePendingItems } from '@/app/HRM/Asset/Vehicle/utils/resolveVehicleProfilePendingItems';
import VehicleProfilePendingStatusBadge from '@/app/HRM/Asset/Vehicle/components/VehicleProfilePendingStatusBadge';

const pendingApprovalTextClass = 'inline-flex items-center justify-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold leading-snug text-amber-950 ring-1 ring-amber-300/80 whitespace-nowrap';

/**
 * Assigned-to column — matches tools asset list status badge UI (read-only reference).
 */
export default function VehicleListAssignmentStatusCell({ vehicle }) {
    if (!vehicle) return <span className="text-gray-400">—</span>;

    const pendingItems = collectVehicleProfilePendingItems(vehicle);
    const submittedWaiting =
        isVehicleAwaitingListApproval(vehicle) && pendingItems.length === 0;
    const hideAssigneeBadge =
        pendingItems.some((item) => item.kind === 'handover') || submittedWaiting;

    const statusStr = String(vehicle.status || '');
    const isPoolStatus = statusStr === 'Unassigned' || statusStr === 'Returned';
    const hasOperationalFlags = isServiceActive(vehicle) || isLeaveActive(vehicle);
    const assigneeStr = resolveVehicleListAssigneeStr(vehicle);

    let badgeLabel = statusStr;
    if (isPoolStatus && !hasOperationalFlags) {
        badgeLabel = statusStr;
    } else {
        const isAssignedRelated =
            statusStr === 'Assigned' ||
            vehicle?.assignedTo ||
            vehicle?.assignedCompany ||
            hasOperationalFlags;
        if (!isAssignedRelated && !isPoolStatus) {
            badgeLabel = statusStr || '—';
        } else {
            badgeLabel = formatAssetAssignmentStatusLine(vehicle, assigneeStr);
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
                    className="px-1.5 py-0.5 text-[9px] whitespace-nowrap"
                />
            ))}
            {submittedWaiting ? (
                <p
                    className={pendingApprovalTextClass}
                    title={`Pending approval — pending for ${getVehicleListWaitingLabel(vehicle)}`}
                >
                    Pending approval — pending for {getVehicleListWaitingLabel(vehicle)}
                </p>
            ) : null}
            {showAssigneeBadge ? (
                <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider whitespace-nowrap ${getAssetStatusBadgeClass(vehicle.status, vehicle)}`}
                    title={badgeLabel}
                >
                    {badgeLabel}
                </span>
            ) : null}
        </div>
    );
}
