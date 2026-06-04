'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
    consumeNavigationPushSuppression,
    getBrowserPathWithSearch,
    getLocationSyncEventName,
    pushNavigationReturnState,
} from '@/utils/listReturnNavigation';

/**
 * Records each in-app route change on a stack so global / local Back restores filters and pagination.
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

        if (!readyRef.current) {
            readyRef.current = true;
            prevHrefRef.current = resolved;
            return;
        }

        if (prevHrefRef.current && prevHrefRef.current !== resolved) {
            pushNavigationReturnState(prevHrefRef.current);
        }
        prevHrefRef.current = resolved;
    }, [pathname, searchParams]);

    useEffect(() => {
        const syncFromBar = () => {
            prevHrefRef.current = getBrowserPathWithSearch();
        };
        const onLocationSync = () => syncFromBar();
        window.addEventListener('popstate', syncFromBar);
        window.addEventListener(getLocationSyncEventName(), onLocationSync);
        return () => {
            window.removeEventListener('popstate', syncFromBar);
            window.removeEventListener(getLocationSyncEventName(), onLocationSync);
        };
    }, []);

    return null;
}
