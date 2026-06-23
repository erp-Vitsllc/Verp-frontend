'use client';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useGuardedAsyncAction } from '@/hooks/useGuardedAsyncAction';

export default function ConfirmAlertDialog({
    open,
    onOpenChange,
    title = 'Are you sure?',
    description = '',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    loading = false,
    onConfirm,
}) {
    const { run, isPending, loadingText } = useGuardedAsyncAction(async () => {
        await Promise.resolve(onConfirm?.());
    }, { loadingText: 'Please wait...' });

    const isBusy = loading || isPending;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="bg-white rounded-3xl border-gray-100 shadow-2xl p-8 max-w-lg">
                <AlertDialogHeader className="mb-4">
                    <AlertDialogTitle className="text-xl font-bold text-gray-800">{title}</AlertDialogTitle>
                    {description ? (
                        <AlertDialogDescription className="text-gray-500 font-medium whitespace-pre-line">
                            {description}
                        </AlertDialogDescription>
                    ) : null}
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-3">
                    <AlertDialogCancel
                        disabled={isBusy}
                        className="rounded-xl border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all px-6"
                    >
                        {cancelLabel}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        disabled={isBusy}
                        onClick={(e) => {
                            e.preventDefault();
                            void run();
                        }}
                        className={
                            destructive
                                ? 'rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-lg shadow-red-100 px-8'
                                : 'rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-lg shadow-blue-500/30 px-8'
                        }
                    >
                        {isBusy ? loadingText : confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
