'use client';

import { useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import ListReturnBackButton from '@/components/ListReturnBackButton';
import { useErpBackNavigation } from '@/hooks/useErpBackNavigation';
import { useErpBackHandlerRegistry } from '@/contexts/ErpBackHandlerContext';

const HIDDEN_PREFIXES = ['/login', '/dashboard'];

/** Global ERP back control — shown in Navbar on every authenticated page. */
export default function ErpBackButton({ className = '', onFallback, label = 'Back' }) {
    const pathname = usePathname() || '';
    const defaultBack = useErpBackNavigation(onFallback);
    const { runOverride, hasOverride } = useErpBackHandlerRegistry();

    const hidden = useMemo(
        () => HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)),
        [pathname],
    );

    const handleBack = useCallback(() => {
        if (runOverride()) return;
        defaultBack();
    }, [runOverride, defaultBack]);

    if (hidden) return null;

    return (
        <ListReturnBackButton
            onNavigate={handleBack}
            onFallback={onFallback}
            label={label}
            className={className}
            // Navbar owns the visible control; page buttons only register overrides.
            inline
            skipRegister
            title={
                hasOverride
                    ? 'Back (page navigation)'
                    : 'Back (restores filters, tabs, and list view)'
            }
        />
    );
}
