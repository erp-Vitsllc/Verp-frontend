'use client';

import ErpBackButton from '@/components/ErpBackButton';

/**
 * Standard list-page header: back control beside the page title (main content area).
 */
export default function ErpPageHeader({ title, subtitle, children, showBack = true }) {
    return (
        <div className="flex items-center justify-between mb-6 gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
                {showBack ? <ErpBackButton className="shrink-0 mt-1.5" /> : null}
                <div className="min-w-0">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">{title}</h1>
                    {subtitle ? <p className="text-gray-600">{subtitle}</p> : null}
                </div>
            </div>
            {children ? (
                <div className="flex items-center gap-4 shrink-0 flex-wrap justify-end">{children}</div>
            ) : null}
        </div>
    );
}
