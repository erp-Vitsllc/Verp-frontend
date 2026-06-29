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

/**
 * Assigned-to column — matches tools asset list status badge UI (read-only reference).
 */
export default function VehicleListAssignmentStatusCell({ vehicle }) {
    if (!vehicle) return <span className="text-gray-400">—</span>;

    if (isVehicleAwaitingListApproval(vehicle)) {
        const waitingLabel = getVehicleListWaitingLabel(vehicle);
        return (
            <div className="flex flex-col items-start gap-1">
                <span
                    className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 whitespace-nowrap"
                    title={`Waiting for: ${waitingLabel}`}
                >
                    Waiting: {waitingLabel}
                </span>
            </div>
        );
    }

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

    return (
        <div className="flex flex-col items-start gap-1">
            <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getAssetStatusBadgeClass(vehicle.status, vehicle)}`}
            >
                {badgeLabel}
            </span>
        </div>
    );
}
