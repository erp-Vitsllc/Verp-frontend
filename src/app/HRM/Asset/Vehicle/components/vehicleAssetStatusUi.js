/**
 * Vehicle asset operational status — labels match VERP_backend/models/AssetItem.js `status` enum.
 * Use for badges and fleet / detail selects.
 */
export const VEHICLE_ASSET_STATUS_OPTIONS = [
    'Assigned',
    'Unassigned',
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
