'use client';

import {
    Droplets,
    Flame,
    Phone,
    Plug,
    Radio,
    Receipt,
    Tv,
    Wifi,
    Zap,
} from 'lucide-react';
import { UTILITY_TYPE_COLORS } from './utilityOverviewStats';

/** Lucide has no SIM glyph — classic SIM shape with cut corner and chip. */
function SimCard({ size = 16, strokeWidth = 2, className, ...props }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
            {...props}
        >
            <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
            <path d="M14 3v4h4" />
            <rect x="8" y="11" width="8" height="6" rx="0.8" />
            <path d="M8 13.5h8M8 15h8" />
        </svg>
    );
}

const ICON_RULES = [
    { test: /internet|wifi|broadband|fiber/, Icon: Wifi },
    { test: /sim\s*card|simcard|\bsim\b/, Icon: SimCard },
    { test: /telephon|landline|phone/, Icon: Phone },
    { test: /water|electric/, Icon: Droplets },
    { test: /gas/, Icon: Flame },
    { test: /tv|dstv|osn/, Icon: Tv },
    { test: /power|volt/, Icon: Zap },
    { test: /radio/, Icon: Radio },
];

const FALLBACK_ICONS = [Plug, Receipt, Zap, Radio];

export function utilityTypeIcon(typeName, index = 0) {
    const name = String(typeName || '').toLowerCase();
    const match = ICON_RULES.find((rule) => rule.test.test(name));
    return match?.Icon || FALLBACK_ICONS[index % FALLBACK_ICONS.length];
}

export function utilityTypeColor(index = 0) {
    return UTILITY_TYPE_COLORS[index % UTILITY_TYPE_COLORS.length];
}

export function hexToRgba(hex, alpha) {
    const h = String(hex || '').replace('#', '');
    if (h.length !== 6) return `rgba(20, 184, 166, ${alpha})`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
