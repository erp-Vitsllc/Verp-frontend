'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
    getRemainingIdleMs,
    IDLE_TIMEOUT_MS,
    isAuthenticated,
    performLogout,
    touchActivity,
} from '@/utils/authSession';

const IdleSessionContext = createContext({
    remainingMs: IDLE_TIMEOUT_MS,
    isIdleTrackingActive: false,
});

function throttle(fn, waitMs) {
    let lastRun = 0;
    return (...args) => {
        const now = Date.now();
        if (now - lastRun >= waitMs) {
            lastRun = now;
            fn(...args);
        }
    };
}

export function IdleSessionProvider({ children }) {
    const pathname = usePathname();
    const [remainingMs, setRemainingMs] = useState(IDLE_TIMEOUT_MS);
    const logoutTriggeredRef = useRef(false);

    const isLoginRoute = pathname === '/login' || pathname?.startsWith('/login/');
    const isIdleTrackingActive = isAuthenticated() && !isLoginRoute;

    const syncRemaining = useCallback(() => {
        setRemainingMs(getRemainingIdleMs());
    }, []);

    const recordActivity = useCallback(() => {
        if (!isAuthenticated() || isLoginRoute) return;
        touchActivity();
        syncRemaining();
    }, [isLoginRoute, syncRemaining]);

    useEffect(() => {
        logoutTriggeredRef.current = false;
    }, [pathname]);

    useEffect(() => {
        if (!isIdleTrackingActive) {
            setRemainingMs(IDLE_TIMEOUT_MS);
            return undefined;
        }

        touchActivity();
        syncRemaining();

        const throttledActivity = throttle(recordActivity, 1000);
        const activityEvents = [
            'mousemove',
            'mousedown',
            'keydown',
            'keyup',
            'scroll',
            'touchstart',
            'click',
            'wheel',
            'pointerdown',
        ];

        activityEvents.forEach((eventName) => {
            window.addEventListener(eventName, throttledActivity, { passive: true });
        });

        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return;
            const remaining = getRemainingIdleMs();
            setRemainingMs(remaining);
            if (remaining <= 0 && !logoutTriggeredRef.current) {
                logoutTriggeredRef.current = true;
                performLogout({ reason: 'idle' });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        const tick = window.setInterval(() => {
            const remaining = getRemainingIdleMs();
            setRemainingMs(remaining);

            if (remaining <= 0 && !logoutTriggeredRef.current) {
                logoutTriggeredRef.current = true;
                performLogout({ reason: 'idle' });
            }
        }, 1000);

        return () => {
            activityEvents.forEach((eventName) => {
                window.removeEventListener(eventName, throttledActivity);
            });
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.clearInterval(tick);
        };
    }, [isIdleTrackingActive, recordActivity, syncRemaining]);

    const value = useMemo(
        () => ({
            remainingMs,
            isIdleTrackingActive,
        }),
        [remainingMs, isIdleTrackingActive],
    );

    return (
        <IdleSessionContext.Provider value={value}>
            {children}
        </IdleSessionContext.Provider>
    );
}

export function useIdleSession() {
    return useContext(IdleSessionContext);
}
