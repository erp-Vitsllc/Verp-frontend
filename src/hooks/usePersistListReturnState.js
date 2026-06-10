'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { rememberListFilterStep, saveListReturnState, buildListReturnHref } from '@/utils/listReturnNavigation';

/**
 * Persists the current list view (URL + optional extra query fields) for detail-page back navigation.
 * @param {Record<string, string|number|boolean|null|undefined>|null} extraParams - Local-only filters not yet in the URL
 * @param {boolean} enabled
 */
export function usePersistListReturnState(extraParams = null, enabled = true) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const prevHrefRef = useRef(null);
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

        if (!prevHrefRef.current) {
            prevHrefRef.current = href;
            saveListReturnState(href);
            return;
        }

        if (prevHrefRef.current !== href) {
            rememberListFilterStep(href);
            prevHrefRef.current = href;
        }
    }, [enabled, pathname, searchParams, extraKey, extraParams]);
}

export { buildListReturnHref };
