'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Hook for transactional buttons — disables while async work is in flight.
 * @template {(...args: any[]) => Promise<any> | any} T
 * @param {T} action
 * @param {{ loadingText?: string }} [options]
 */
export function useGuardedAsyncAction(action, { loadingText = 'Processing...' } = {}) {
    const [isPending, setIsPending] = useState(false);
    const pendingRef = useRef(false);

    const run = useCallback(
        async (...args) => {
            if (pendingRef.current) return undefined;
            pendingRef.current = true;
            setIsPending(true);
            try {
                return await action(...args);
            } finally {
                pendingRef.current = false;
                setIsPending(false);
            }
        },
        [action],
    );

    return {
        run,
        isPending,
        disabled: isPending,
        loadingText,
    };
}

/** Alias for discoverability — same as {@link useGuardedAsyncAction}. */
export const useAsyncAction = useGuardedAsyncAction;
