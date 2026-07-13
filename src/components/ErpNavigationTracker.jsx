'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
    captureNavigationScroll,
    consumeNavigationPushSuppression,
    consumeSkipTrackerPushOnce,
    getBrowserPathWithSearch,
    getLocationSyncEventName,
    pushNavigationReturnState,
    syncNavigationStackOnBrowserPop,
} from '@/utils/listReturnNavigation';

/**
 * Records each in-app route change on a stack so global / local Back restores filters, tabs, and pagination.
 */
export default function ErpNavigationTracker() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const prevHrefRef = useRef(null);
    const readyRef = useRef(false);

    useEffect(() => {
        const fromNext = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
        const resolved = getBrowserPathWithSearch() || fromNext;

        if (consumeNavigationPushSuppression()) {
            prevHrefRef.current = resolved;
            return;
        }

        if (consumeSkipTrackerPushOnce()) {
            prevHrefRef.current = resolved;
            return;
        }

        if (!readyRef.current) {
            readyRef.current = true;
            prevHrefRef.current = resolved;
            captureNavigationScroll(resolved);
            return;
        }

        if (prevHrefRef.current && prevHrefRef.current !== resolved) {
            // Scroll for the previous page was captured while the user was still there.
            pushNavigationReturnState(prevHrefRef.current);
        }
        prevHrefRef.current = resolved;
        captureNavigationScroll(resolved);
    }, [pathname, searchParams]);

    useEffect(() => {
        const syncFromBar = () => {
            syncNavigationStackOnBrowserPop();
            prevHrefRef.current = getBrowserPathWithSearch();
            captureNavigationScroll(prevHrefRef.current);
        };
        const onLocationSync = () => {
            prevHrefRef.current = getBrowserPathWithSearch();
            captureNavigationScroll(prevHrefRef.current);
        };
        const onScroll = () => captureNavigationScroll();
        window.addEventListener('popstate', syncFromBar);
        window.addEventListener(getLocationSyncEventName(), onLocationSync);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            window.removeEventListener('popstate', syncFromBar);
            window.removeEventListener(getLocationSyncEventName(), onLocationSync);
            window.removeEventListener('scroll', onScroll);
        };
    }, []);

    return null;
}
