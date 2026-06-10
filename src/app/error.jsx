'use client';

import { useEffect } from 'react';
import ErpAuthenticatedErrorPage from '@/components/ErpAuthenticatedErrorPage';

export default function GlobalError({ error, reset }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return <ErpAuthenticatedErrorPage onRetry={reset} />;
}
