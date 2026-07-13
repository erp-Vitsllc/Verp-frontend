'use client';

import { IdleSessionProvider } from '@/contexts/IdleSessionProvider';
import { ErpBackHandlerProvider } from '@/contexts/ErpBackHandlerContext';
import ActionClickGuardProvider from '@/components/ActionClickGuardProvider';

export default function ClientSessionShell({ children }) {
    return (
        <IdleSessionProvider>
            <ErpBackHandlerProvider>
                <ActionClickGuardProvider>{children}</ActionClickGuardProvider>
            </ErpBackHandlerProvider>
        </IdleSessionProvider>
    );
}
