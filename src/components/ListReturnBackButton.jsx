'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { tryNavigateListReturn } from '@/utils/listReturnNavigation';

/**
 * Back control that restores the last list view (filters + pagination) when available.
 * Falls back to `onFallback` or `router.back()` without removing existing handlers elsewhere.
 */
export default function ListReturnBackButton({
    className = 'bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm text-gray-600 hover:bg-gray-50 transition-all font-bold flex items-center gap-2',
    children,
    onFallback,
    onBeforeNavigate,
    showLabel = false,
    label = 'Back',
    iconSize = 20,
    type = 'button',
}) {
    const router = useRouter();

    const handleClick = () => {
        if (onBeforeNavigate) onBeforeNavigate();
        if (tryNavigateListReturn(router)) return;
        if (onFallback) {
            onFallback();
            return;
        }
        router.back();
    };

    return (
        <button type={type} onClick={handleClick} className={className}>
            {children ?? (
                <>
                    <ArrowLeft size={iconSize} />
                    {showLabel ? <span className="text-sm">{label}</span> : null}
                </>
            )}
        </button>
    );
}
