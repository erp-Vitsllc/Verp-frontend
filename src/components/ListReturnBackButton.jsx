'use client';

import { useCallback, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { tryNavigateListReturn } from '@/utils/listReturnNavigation';
import { useErpBackHandlerRegistry } from '@/contexts/ErpBackHandlerContext';

/** Standard ERP back control — use on every page header across the app. */
export const ERP_BACK_BUTTON_CLASS =
    'inline-flex items-center gap-1 bg-white px-2.5 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm';

/**
 * Global back button: navigation stack first, then optional fallback, then dashboard.
 * By default only registers a page override for the Navbar Back control (no duplicate UI).
 * Pass `inline` to render a local button (e.g. Navbar itself).
 */
export default function ListReturnBackButton({
    className,
    children,
    onFallback,
    onBeforeNavigate,
    /** When set, runs instead of default stack navigation (e.g. profile tab back). */
    onNavigate,
    showLabel = true,
    label = 'Back',
    iconSize = 20,
    type = 'button',
    ariaLabel = 'Go back to previous page',
    title = 'Back (restores filters, tabs, and list view)',
    /** Render the button locally. Default false — Navbar shows the global Back control. */
    inline = false,
    /** Skip registering with the global Navbar back (used by Navbar itself). */
    skipRegister = false,
}) {
    const router = useRouter();
    const { registerHandler } = useErpBackHandlerRegistry();

    const handleClick = useCallback(() => {
        if (onNavigate) {
            onNavigate();
            return;
        }
        if (onBeforeNavigate) onBeforeNavigate();
        if (tryNavigateListReturn(router)) return;
        if (onFallback) {
            onFallback();
            return;
        }
        router.push('/dashboard');
    }, [onNavigate, onBeforeNavigate, onFallback, router]);

    useEffect(() => {
        if (skipRegister || inline) return undefined;
        return registerHandler(handleClick);
    }, [skipRegister, inline, registerHandler, handleClick]);

    if (!inline) return null;

    return (
        <button
            type={type}
            onClick={handleClick}
            className={cn(ERP_BACK_BUTTON_CLASS, className)}
            aria-label={ariaLabel}
            title={title}
        >
            {children ?? (
                <>
                    <ChevronLeft size={iconSize} strokeWidth={2} />
                    {showLabel ? <span className="text-sm font-semibold">{label}</span> : null}
                </>
            )}
        </button>
    );
}
