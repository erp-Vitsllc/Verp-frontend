'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { tryNavigateListReturn } from '@/utils/listReturnNavigation';

/** Standard ERP back control — use on every page header across the app. */
export const ERP_BACK_BUTTON_CLASS =
    'inline-flex items-center gap-1 bg-white px-2.5 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm';

/**
 * Global back button: navigation stack first, then optional fallback, then dashboard.
 * Always shows chevron + "Back" label for consistent ERP UI.
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
}) {
    const router = useRouter();

    const handleClick = () => {
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
    };

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
