'use client';

import { IdleSessionProvider } from '@/contexts/IdleSessionProvider';
import { ErpBackHandlerProvider } from '@/contexts/ErpBackHandlerContext';
import ActionClickGuardProvider from '@/components/ActionClickGuardProvider';
import LinkContextMenuProvider from '@/components/LinkContextMenuProvider';

export default function ClientSessionShell({ children }) {
    return (
        <IdleSessionProvider>
            <ErpBackHandlerProvider>
                <LinkContextMenuProvider>
                    <ActionClickGuardProvider>{children}</ActionClickGuardProvider>
                </LinkContextMenuProvider>
            </ErpBackHandlerProvider>
        </IdleSessionProvider>
    );
}
