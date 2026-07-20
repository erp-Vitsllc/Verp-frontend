'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function PurchasesPaymentsMadeRedirectInner() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const qs = searchParams?.toString();
        router.replace(qs ? `/Accounts/PaymentsMade/new?${qs}` : '/Accounts/PaymentsMade');
    }, [router, searchParams]);

    return null;
}

export default function PurchasesPaymentsMadeRedirect() {
    return (
        <Suspense fallback={null}>
            <PurchasesPaymentsMadeRedirectInner />
        </Suspense>
    );
}
