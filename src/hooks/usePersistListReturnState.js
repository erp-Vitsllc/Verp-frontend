'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { saveListReturnState, buildListReturnHref } from '@/utils/listReturnNavigation';

/**
 * Persists the current list view (URL + optional extra query fields) for detail-page back navigation.
 * @param {Record<string, string|number|boolean|null|undefined>|null} extraParams - Local-only filters not yet in the URL
 * @param {boolean} enabled
 */
export function usePersistListReturnState(extraParams = null, enabled = true) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const extraKey = useMemo(
        () => (extraParams ? JSON.stringify(extraParams) : ''),
        [extraParams],
    );

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return;

        const browserSearch =
            typeof window !== 'undefined' && window.location.pathname === pathname
                ? window.location.search.replace(/^\?/, '')
                : searchParams.toString();

        const merged = new URLSearchParams(browserSearch);
        if (extraParams && typeof extraParams === 'object') {
            Object.entries(extraParams).forEach(([key, value]) => {
                if (value === undefined || value === null || value === '') {
                    merged.delete(key);
                } else {
                    merged.set(key, String(value));
                }
            });
        }

        const qs = merged.toString();
        const href = qs ? `${pathname}?${qs}` : pathname;
        saveListReturnState(href);
    }, [enabled, pathname, searchParams, extraKey, extraParams]);
}

export { buildListReturnHref };
