'use client';

import { formatVehicleProfilePendingStatusText } from '../utils/resolveVehicleProfilePendingItems';

const BADGE_BASE =
    'inline-flex items-center justify-center rounded-lg px-3 py-2 text-[11px] font-bold leading-snug text-center ring-1';

function badgeClassForKind(kind) {
    if (kind === 'service') {
        return `${BADGE_BASE} bg-sky-100 text-sky-950 ring-sky-300/80`;
    }
    if (kind === 'handover') {
        return `${BADGE_BASE} bg-amber-100 text-amber-950 ring-amber-300/80`;
    }
    return `${BADGE_BASE} bg-orange-100 text-orange-950 ring-orange-300/80`;
}

export default function VehicleProfilePendingStatusBadge({ item, fullWidth = false, className = '' }) {
    if (!item) return null;
    const text = formatVehicleProfilePendingStatusText(item);
    return (
        <span
            className={`${badgeClassForKind(item.kind)} ${fullWidth ? 'w-full' : ''} ${className}`.trim()}
            title={text}
        >
            {text}
        </span>
    );
}

export { badgeClassForKind, formatVehicleProfilePendingStatusText };
