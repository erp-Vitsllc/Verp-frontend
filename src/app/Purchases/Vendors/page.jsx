'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PurchasesVendorsRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/Accounts/Vendors');
    }, [router]);
    return null;
}
