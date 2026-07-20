'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PurchasesExpensesRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/Accounts/Expenses');
    }, [router]);
    return null;
}
