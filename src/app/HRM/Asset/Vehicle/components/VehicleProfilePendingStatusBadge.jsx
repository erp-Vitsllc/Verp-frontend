'use client';

import { formatVehicleProfilePendingStatusText } from '../utils/resolveVehicleProfilePendingItems';

const SIZE_CLASS = {
    /** Match GPS Status / Status / Service Status list pills. */
    list: 'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-center ring-1 whitespace-nowrap',
    default:
        'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-center ring-1 whitespace-nowrap',
};

function badgeClassForKind(kind, size = 'default') {
    const base = SIZE_CLASS[size] || SIZE_CLASS.default;
    if (kind === 'service') {
        return `${base} bg-sky-100 text-sky-950 ring-sky-300/80`;
    }
    if (kind === 'handover') {
        return `${base} bg-amber-100 text-amber-950 ring-amber-300/80`;
    }
    return `${base} bg-orange-100 text-orange-950 ring-orange-300/80`;
}

export default function VehicleProfilePendingStatusBadge({
    item,
    fullWidth = false,
    size = 'default',
    className = '',
}) {
    if (!item) return null;
    const text = formatVehicleProfilePendingStatusText(item);
    return (
        <span
            className={`${badgeClassForKind(item.kind, size)} ${fullWidth ? 'w-full' : ''} ${className}`.trim()}
            title={text}
        >
            {text}
        </span>
    );
}

export { badgeClassForKind, formatVehicleProfilePendingStatusText };
