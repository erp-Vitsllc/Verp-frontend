'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    COMPANY_ACTIVATION_FOCUS_PREFIX,
    resolveNotificationFocusTargetId,
    runNotificationFocusScroll,
} from '@/utils/notificationFocusNavigation';

/**
 * After notification deep-link: scroll to target card/section and pulse blue ring.
 * Supports company `?focusCard=` and employee `#section-id` hash routes.
 */
export function useNotificationFocusScroll({
    loading = false,
    focusCardPrefix = COMPANY_ACTIVATION_FOCUS_PREFIX,
    ownerTabIndex = null,
    deps = [],
} = {}) {
    const searchParams = useSearchParams();

    useEffect(() => {
        if (loading || typeof window === 'undefined') return undefined;

        const focusCard = String(searchParams?.get('focusCard') || '').trim();
        const hash = window.location.hash || '';
        const targetId = resolveNotificationFocusTargetId({
            focusCard,
            focusCardPrefix,
            hash,
            ownerTabIndex,
        });
        if (!targetId) return undefined;

        return runNotificationFocusScroll(targetId);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- caller passes tab/layout deps intentionally
    }, [loading, searchParams, focusCardPrefix, ownerTabIndex, ...deps]);
}
