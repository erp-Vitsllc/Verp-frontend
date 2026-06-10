'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { tryNavigateListReturn } from '@/utils/listReturnNavigation';

/** Shared back handler for stack navigation + optional fallback + dashboard. */
export function useErpBackNavigation(onFallback) {
    const router = useRouter();

    return useCallback(() => {
        if (tryNavigateListReturn(router)) return;
        if (onFallback) {
            onFallback();
            return;
        }
        router.push('/dashboard');
    }, [router, onFallback]);
}
