'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { ERP_BACK_BUTTON_CLASS } from '@/components/ListReturnBackButton';
import { tryNavigateListReturn } from '@/utils/listReturnNavigation';

const HIDDEN_PREFIXES = ['/login', '/dashboard'];

export function useErpBackNavigation() {
    const router = useRouter();

    return useCallback(() => {
        if (tryNavigateListReturn(router)) return;
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
            return;
        }
        router.push('/dashboard');
    }, [router]);
}

/** Inline back control for page headers (not fixed over the sidebar). */
export default function ErpBackButton({ className = '' }) {
    const pathname = usePathname() || '';
    const handleBack = useErpBackNavigation();

    const hidden = useMemo(
        () => HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)),
        [pathname],
    );

    if (hidden) return null;

    return (
        <button
            type="button"
            onClick={handleBack}
            className={`${ERP_BACK_BUTTON_CLASS} ${className}`.trim()}
            aria-label="Go back to previous page"
            title="Back (restores filters and list view)"
        >
            <ChevronLeft size={20} />
        </button>
    );
}
