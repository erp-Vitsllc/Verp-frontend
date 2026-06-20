'use client';

import { IdleSessionProvider } from '@/contexts/IdleSessionProvider';

export default function ClientSessionShell({ children }) {
    return <IdleSessionProvider>{children}</IdleSessionProvider>;
}
