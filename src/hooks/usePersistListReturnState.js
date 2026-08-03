'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { rememberListFilterStep, saveListReturnState, buildListReturnHref } from '@/utils/listReturnNavigation';

/** Debounce address-bar / sessionStorage writes while typing (Safari/Chrome hang otherwise). */
const PERSIST_DEBOUNCE_MS = 350;

/**
 * Persists the current list view (URL + optional extra query fields) for detail-page back navigation.
 * @param {Record<string, string|number|boolean|null|undefined>|null} extraParams - Local-only filters not yet in the URL
 * @param {boolean} enabled
 */
export function usePersistListReturnState(extraParams = null, enabled = true) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const prevHrefRef = useRef(null);
    const pendingHrefRef = useRef(null);
    const timerRef = useRef(null);
    const extraKey = useMemo(
        () => (extraParams ? JSON.stringify(extraParams) : ''),
        [extraParams],
    );

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

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

        if (prevHrefRef.current === href) return;

        pendingHrefRef.current = href;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            const next = pendingHrefRef.current;
            pendingHrefRef.current = null;
            if (!next || prevHrefRef.current === next) return;
            rememberListFilterStep(next);
            prevHrefRef.current = next;
        }, PERSIST_DEBOUNCE_MS);

        // Do not clear the timer in this effect's cleanup — that would cancel debounce on every keystroke.
    }, [enabled, pathname, searchParams, extraKey, extraParams]);

    // Flush pending URL on unmount so Back from a detail page still restores the typed filter.
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            const next = pendingHrefRef.current;
            pendingHrefRef.current = null;
            if (next && prevHrefRef.current !== next) {
                rememberListFilterStep(next);
                prevHrefRef.current = next;
            }
        };
    }, []);
}

export { buildListReturnHref };
