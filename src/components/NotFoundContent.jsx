'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, ArrowLeft, FileQuestion } from 'lucide-react';

export default function NotFoundContent({ standalone = false }) {
    const router = useRouter();

    const inner = (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <FileQuestion className="h-10 w-10" strokeWidth={1.5} />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Error 404</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                Page not found
            </h1>
            <p className="mt-3 max-w-md text-sm font-medium text-slate-500">
                The page you requested does not exist, or something went wrong while loading it.
                Use the menu to continue, or go back to the dashboard.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Go back
                </button>
                <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                    <Home className="h-4 w-4" />
                    Dashboard
                </Link>
            </div>
        </div>
    );

    if (standalone) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-6 py-16">
                <div className="w-full max-w-lg">{inner}</div>
            </div>
        );
    }

    return <div className="mx-auto w-full max-w-3xl">{inner}</div>;
}
