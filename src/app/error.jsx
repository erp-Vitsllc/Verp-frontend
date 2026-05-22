'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NOT_FOUND_PATH } from '@/utils/notFoundRedirect';

export default function GlobalError({ error }) {
    const router = useRouter();

    useEffect(() => {
        if (process.env.NODE_ENV === 'development' && error) {
            console.error('App error boundary:', error);
        }
        router.replace(NOT_FOUND_PATH);
    }, [router, error]);

    return null;
}
