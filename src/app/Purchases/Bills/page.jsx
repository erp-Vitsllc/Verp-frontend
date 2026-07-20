'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PurchasesBillsRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/Accounts/Bills');
    }, [router]);
    return null;
}
