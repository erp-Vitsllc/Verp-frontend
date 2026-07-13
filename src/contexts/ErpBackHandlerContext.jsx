'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ErpBackHandlerContext = createContext(null);

/**
 * Lets detail pages register a custom Back handler (tabs, overlays, etc.)
 * while the shared Navbar Back button owns the visible UI.
 */
export function ErpBackHandlerProvider({ children }) {
    const stackRef = useRef([]);
    const [hasOverride, setHasOverride] = useState(false);

    const syncHasOverride = useCallback(() => {
        setHasOverride(stackRef.current.length > 0);
    }, []);

    const registerHandler = useCallback((handler) => {
        if (typeof handler !== 'function') return () => {};
        stackRef.current = [...stackRef.current, handler];
        syncHasOverride();
        return () => {
            stackRef.current = stackRef.current.filter((h) => h !== handler);
            syncHasOverride();
        };
    }, [syncHasOverride]);

    const runOverride = useCallback(() => {
        const stack = stackRef.current;
        const fn = stack[stack.length - 1];
        if (typeof fn === 'function') {
            fn();
            return true;
        }
        return false;
    }, []);

    const value = useMemo(
        () => ({ registerHandler, runOverride, hasOverride }),
        [registerHandler, runOverride, hasOverride],
    );

    return (
        <ErpBackHandlerContext.Provider value={value}>
            {children}
        </ErpBackHandlerContext.Provider>
    );
}

export function useErpBackHandlerRegistry() {
    const ctx = useContext(ErpBackHandlerContext);
    if (!ctx) {
        return {
            registerHandler: () => () => {},
            runOverride: () => false,
            hasOverride: false,
        };
    }
    return ctx;
}

/** Register a page-specific Back handler for the global Navbar control. */
export function useRegisterErpBackHandler(handler) {
    const { registerHandler } = useErpBackHandlerRegistry();
    const handlerRef = useRef(handler);
    handlerRef.current = handler;

    useEffect(() => {
        if (typeof handler !== 'function') return undefined;
        const wrapped = () => {
            if (typeof handlerRef.current === 'function') handlerRef.current();
        };
        return registerHandler(wrapped);
    }, [handler, registerHandler]);
}
