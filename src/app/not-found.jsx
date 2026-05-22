'use client';

import { usePathname } from 'next/navigation';
import AppPageShell from '@/components/AppPageShell';
import NotFoundContent from '@/components/NotFoundContent';
import { isPublicPath } from '@/utils/notFoundRedirect';

export default function NotFound() {
    const pathname = usePathname();
    const standalone = isPublicPath(pathname);

    if (standalone) {
        return <NotFoundContent standalone />;
    }

    return (
        <AppPageShell>
            <NotFoundContent />
        </AppPageShell>
    );
}
