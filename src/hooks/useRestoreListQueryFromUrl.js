'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Applies URL query values to list state when returning from a detail page (must run inside Suspense).
 * @param {Array<{ key: string, apply: (value: string) => void }>} mappings
 */
export function useRestoreListQueryFromUrl(mappings) {
    const searchParams = useSearchParams();

    useEffect(() => {
        mappings.forEach(({ key, apply }) => {
            const raw = searchParams.get(key);
            if (raw !== null && raw !== '') {
                apply(raw);
            }
        });
    }, [searchParams, mappings]);
}
