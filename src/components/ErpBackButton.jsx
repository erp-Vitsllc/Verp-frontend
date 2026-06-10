'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import ListReturnBackButton from '@/components/ListReturnBackButton';
import { useErpBackNavigation } from '@/hooks/useErpBackNavigation';

const HIDDEN_PREFIXES = ['/login', '/dashboard'];

/** List-page header back control — same UI as profile/detail pages. */
export default function ErpBackButton({ className = '', onFallback, label = 'Back' }) {
    const pathname = usePathname() || '';
    const handleBack = useErpBackNavigation(onFallback);

    const hidden = useMemo(
        () => HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)),
        [pathname],
    );

    if (hidden) return null;

    return (
        <ListReturnBackButton
            onNavigate={handleBack}
            onFallback={onFallback}
            label={label}
            className={className}
        />
    );
}
