'use client';

import { MapPin } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function LocationTurnOnModal({
    open,
    busy = false,
    error = '',
    onTurnOn,
    onClose,
}) {
    return (
        <AlertDialog
            open={open}
            onOpenChange={(next) => {
                if (!next && !busy) onClose?.();
            }}
        >
            <AlertDialogContent className="max-w-sm">
                <AlertDialogHeader>
                    <div className="mx-auto sm:mx-0 mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
                        <MapPin className="h-6 w-6 text-[#EA3D2F]" />
                    </div>
                    <AlertDialogTitle>Turn on location</AlertDialogTitle>
                    <AlertDialogDescription>
                        Location is required to finish login. If it is already on, tap Turn On to
                        continue. If it is off, turn it on, allow this site, then wait for your
                        position.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                <AlertDialogFooter>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onClose}
                        className="h-10 px-4 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onTurnOn}
                        className="h-10 px-5 rounded-lg bg-[#EA3D2F] hover:bg-[#d43528] text-white text-sm font-semibold disabled:opacity-60"
                    >
                        {busy ? 'Turning on…' : 'Turn On'}
                    </button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
