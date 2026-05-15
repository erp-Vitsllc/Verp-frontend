'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { tryNavigateListReturn } from '@/utils/listReturnNavigation';

/**
 * Returns a back handler: saved list URL first, then optional fallback, then router.back().
 */
export function useListReturnBack(onFallback) {
    const router = useRouter();

    return useCallback(() => {
        if (tryNavigateListReturn(router)) return;
        if (onFallback) {
            onFallback();
            return;
        }
        router.back();
    }, [router, onFallback]);
}
