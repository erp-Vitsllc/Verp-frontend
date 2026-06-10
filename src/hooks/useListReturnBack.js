'use client';

import { useErpBackNavigation } from '@/hooks/useErpBackNavigation';

/** Returns the standard ERP back handler (stack → fallback → dashboard). */
export function useListReturnBack(onFallback) {
    return useErpBackNavigation(onFallback);
}
