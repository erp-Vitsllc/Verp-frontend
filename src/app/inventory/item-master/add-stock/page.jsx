'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AddStockPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/inventory/item-master?addStock=1');
    }, [router]);

    return null;
}
