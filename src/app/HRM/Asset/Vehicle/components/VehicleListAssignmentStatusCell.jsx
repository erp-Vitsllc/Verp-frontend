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

const pendingApprovalTextClass = 'inline-flex items-center justify-center rounded-lg bg-amber-100 px-2.5 py-1.5 text-[10px] font-bold leading-snug text-amber-950 ring-1 ring-amber-300/80';

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
        <div className="flex flex-col items-start gap-1">
            {pendingItems.map((item) => (
                <VehicleProfilePendingStatusBadge
                    key={`${item.kind}-${item.label}-${item.pendingFor}`}
                    item={item}
                    className="px-2.5 py-1.5 text-[10px]"
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
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getAssetStatusBadgeClass(vehicle.status, vehicle)}`}
                >
                    {badgeLabel}
                </span>
            ) : null}
        </div>
    );
}
