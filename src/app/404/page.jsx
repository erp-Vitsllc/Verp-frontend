'use client';

import AppPageShell from '@/components/AppPageShell';
import NotFoundContent from '@/components/NotFoundContent';

export default function Custom404Page() {
    return (
        <AppPageShell>
            <NotFoundContent />
        </AppPageShell>
    );
}
