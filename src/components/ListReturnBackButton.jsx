'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { tryNavigateListReturn } from '@/utils/listReturnNavigation';

/** Standard ERP back control — matches employee / company profile pages. */
export const ERP_BACK_BUTTON_CLASS =
    'bg-white p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm';

/**
 * Back control that restores the last list view (filters + pagination) when available.
 * Falls back to `onFallback` or `router.back()`.
 */
export default function ListReturnBackButton({
    className = ERP_BACK_BUTTON_CLASS,
    children,
    onFallback,
    onBeforeNavigate,
    /** When set, runs instead of default list-return / router.back() chain. */
    onNavigate,
    showLabel = false,
    label = 'Back',
    iconSize = 20,
    type = 'button',
    ariaLabel = 'Go back',
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
        router.back();
    };

    return (
        <button type={type} onClick={handleClick} className={className} aria-label={ariaLabel}>
            {children ?? (
                <>
                    <ChevronLeft size={iconSize} />
                    {showLabel ? <span className="text-sm font-semibold ml-0.5">{label}</span> : null}
                </>
            )}
        </button>
    );
}
