'use client';

import { Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * Always-visible workflow card shell (same as Oil Service):
 * when locked, fields stay visible but disabled, with a lock overlay.
 */
export default function VehicleServiceLockedSection({
    locked = false,
    message = 'Complete the previous step first',
    className = '',
    children,
}) {
    const { toast } = useToast();

    if (!locked) {
        return <div className={className}>{children}</div>;
    }

    const notify = () => {
        toast({
            title: 'Step locked',
            description: message,
        });
    };

    return (
        <div className={`relative ${className}`.trim()}>
            <div className="pointer-events-none select-none opacity-55" aria-hidden="true">
                {children}
            </div>
            <button
                type="button"
                onClick={notify}
                className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-slate-900/[0.04] px-4 text-center outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                aria-label={message}
            >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
                    <Lock size={18} strokeWidth={2.25} />
                </span>
                <span className="max-w-sm text-xs font-semibold text-slate-700">{message}</span>
            </button>
        </div>
    );
}
