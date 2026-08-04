'use client';

import ErpAuthenticatedErrorPage from '@/components/ErpAuthenticatedErrorPage';

/** Soft error page — returns HTTP 200 (unlike /404 which Next reports as 404). */
export default function SystemUnavailablePage() {
    return <ErpAuthenticatedErrorPage />;
}
