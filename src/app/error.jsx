'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GlobalError({ error, reset }) {
    const router = useRouter();

    useEffect(() => {
        if (process.env.NODE_ENV === 'development' && error) {
            console.error('App error boundary:', error);
        }
    }, [error]);

    const message =
        error?.message ||
        'Something went wrong on this page. Your data was not lost if you have not refreshed yet.';

    return (
        <div className="min-h-[60vh] flex items-center justify-center p-6 bg-slate-50">
            <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-8 text-center">
                <h1 className="text-lg font-bold text-slate-900 mb-2">Something went wrong</h1>
                <p className="text-sm text-slate-600 mb-6 break-words">{message}</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        type="button"
                        onClick={() => reset?.()}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                    >
                        Try again
                    </button>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                    >
                        Go back
                    </button>
                </div>
            </div>
        </div>
    );
}
