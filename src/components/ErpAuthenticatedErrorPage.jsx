'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import AppPageShell from '@/components/AppPageShell';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import { isPublicPath } from '@/utils/notFoundRedirect';

/** Error / not-found view: sidebar + navbar with banner under the menu. */
export default function ErpAuthenticatedErrorPage({ onRetry }) {
    const pathname = usePathname();

    useEffect(() => {
        if (onRetry) {
            console.error('ERP page error:', pathname);
        }
    }, [onRetry, pathname]);

    const banner = <ErpErrorBanner onRetry={onRetry} />;

    if (isPublicPath(pathname)) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] p-6">
                <div className="mx-auto w-full max-w-3xl">{banner}</div>
            </div>
        );
    }

    return (
        <AppPageShell>
            <div className="mx-auto w-full max-w-3xl">{banner}</div>
        </AppPageShell>
    );
}
