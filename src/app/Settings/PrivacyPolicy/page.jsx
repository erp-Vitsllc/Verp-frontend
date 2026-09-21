'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppPageShell from '@/components/AppPageShell';
import VerpPrivacyPolicyContent from '@/components/VerpPrivacyPolicyContent';

export default function SettingsPrivacyPolicyPage() {
    const router = useRouter();

    useEffect(() => {
        if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
            router.replace('/login');
        }
    }, [router]);

    return (
        <AppPageShell>
            <div className="mx-auto w-full max-w-3xl">
                <VerpPrivacyPolicyContent />
            </div>
        </AppPageShell>
    );
}
