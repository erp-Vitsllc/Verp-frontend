'use client';

import { IdleSessionProvider } from '@/contexts/IdleSessionProvider';
import ActionClickGuardProvider from '@/components/ActionClickGuardProvider';

export default function ClientSessionShell({ children }) {
    return (
        <IdleSessionProvider>
            <ActionClickGuardProvider>{children}</ActionClickGuardProvider>
        </IdleSessionProvider>
    );
}
