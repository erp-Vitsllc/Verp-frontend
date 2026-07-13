'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    getBrowserPathWithSearch,
    hrefsEquivalent,
    rememberListFilterStepFrom,
    replaceNavigationUrl,
} from '@/utils/listReturnNavigation';

/**
 * Build a same-page href with updated query keys while preserving unrelated params.
 * Values matching omitDefaults are omitted from the query string.
 */
export function buildDetailNavigationHref(pathname, searchParams, updates = {}, omitDefaults = {}) {
    const current =
        typeof searchParams?.toString === 'function'
            ? searchParams.toString()
            : String(searchParams || '');
    const q = new URLSearchParams(current);

    Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
            q.delete(key);
            return;
        }
        const str = String(value);
        if (Object.prototype.hasOwnProperty.call(omitDefaults, key) && str === String(omitDefaults[key])) {
            q.delete(key);
            return;
        }
        q.set(key, str);
    });

    const qs = q.toString();
    return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Shared helper for detail pages: push tab/sub-tab/filter URL changes onto the ERP back stack.
 * Route changes are still tracked globally by ErpNavigationTracker.
 */
export function useDetailNavigationState() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const hrefRef = useRef(null);

    useEffect(() => {
        const bar = getBrowserPathWithSearch();
        if (bar) hrefRef.current = bar;
    }, [pathname, searchParams]);

    const navigateDetailState = useCallback(
        (updates, omitDefaults = {}) => {
            const nextHref = buildDetailNavigationHref(pathname, searchParams, updates, omitDefaults);
            const fromHref = hrefRef.current || getBrowserPathWithSearch();
            if (hrefsEquivalent(fromHref, nextHref)) return false;

            rememberListFilterStepFrom(fromHref, nextHref);
            hrefRef.current = nextHref;
            router.replace(nextHref, { scroll: false });
            return true;
        },
        [pathname, searchParams, router],
    );

    /** Update URL + keep tracker in sync without adding a stack entry. */
    const replaceDetailState = useCallback(
        (updates, omitDefaults = {}) => {
            const nextHref = buildDetailNavigationHref(pathname, searchParams, updates, omitDefaults);
            if (hrefsEquivalent(hrefRef.current || getBrowserPathWithSearch(), nextHref)) return false;
            replaceNavigationUrl(nextHref);
            hrefRef.current = nextHref;
            router.replace(nextHref, { scroll: false });
            return true;
        },
        [pathname, searchParams, router],
    );

    return {
        pathname,
        searchParams,
        router,
        navigateDetailState,
        replaceDetailState,
        currentHref: () => hrefRef.current || getBrowserPathWithSearch(),
    };
}
