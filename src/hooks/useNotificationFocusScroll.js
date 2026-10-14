'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    COMPANY_ACTIVATION_FOCUS_PREFIX,
    resolveNotificationFocusTargetId,
    resolveSectionFocusTargetIds,
    runNotificationFocusScroll,
} from '@/utils/notificationFocusNavigation';

/**
 * After a task or notification deep link: scroll to the card or row and blink it twice.
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
        const focusCertificate = String(searchParams?.get('focusCertificate') || '').trim();
        const focusAsset = String(searchParams?.get('focusAsset') || '').trim();
        const focusAccessory = String(searchParams?.get('focusAccessory') || '').trim();
        const focus = String(searchParams?.get('focus') || '').trim();
        const hash = window.location.hash || '';
        const targetId = resolveNotificationFocusTargetId({
            focusCard,
            focusCertificate,
            focusAsset,
            focusAccessory,
            focusCardPrefix,
            hash,
            ownerTabIndex,
        });
        const targetIds = targetId ? [targetId] : resolveSectionFocusTargetIds(focus);
        if (!targetIds.length) return undefined;

        return runNotificationFocusScroll(targetIds);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- caller passes tab/layout deps intentionally
    }, [loading, searchParams, focusCardPrefix, ownerTabIndex, ...deps]);
}

/** Mount inside a Suspense boundary on pages that do not already call useSearchParams. */
export function NotificationFocusScroll(props) {
    useNotificationFocusScroll(props);
    return null;
}
