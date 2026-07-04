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

const pendingTextClass = 'text-[10px] font-bold leading-snug text-yellow-600';

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
                <p
                    key={`${item.kind}-${item.label}-${item.pendingFor}`}
                    className={pendingTextClass}
                    title={`Pending ${item.label} — pending for ${item.pendingFor}`}
                >
                    Pending {item.label} — pending for {item.pendingFor}
                </p>
            ))}
            {submittedWaiting ? (
                <p
                    className={pendingTextClass}
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
