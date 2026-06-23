'use client';

import { useEffect } from 'react';
import {
    beginActionGuardSession,
    isButtonActionGuardLocked,
    resolveActionButtonFromTarget,
} from '@/utils/actionClickGuardCore';

/**
 * Locks action buttons on first click; blocks repeat clicks until the API finishes
 * (or a short idle timeout for UI-only buttons with no mutation).
 */
export default function ActionClickGuardProvider({ children }) {
    useEffect(() => {
        const blockEvent = (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') {
                event.stopImmediatePropagation();
            }
        };

        const onPointerDown = (event) => {
            const button = resolveActionButtonFromTarget(event.target);
            if (!button) return;
            if (isButtonActionGuardLocked(button)) {
                blockEvent(event);
            }
        };

        const onClick = (event) => {
            const button = resolveActionButtonFromTarget(event.target);
            if (!button) return;

            if (isButtonActionGuardLocked(button)) {
                blockEvent(event);
                return;
            }

            beginActionGuardSession(button);
        };

        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('click', onClick, true);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown, true);
            document.removeEventListener('click', onClick, true);
        };
    }, []);

    return children;
}
