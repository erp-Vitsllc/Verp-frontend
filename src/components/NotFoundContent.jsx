'use client';

import ErpErrorBanner from '@/components/ErpErrorBanner';

export default function NotFoundContent({ standalone = false }) {
    const banner = <ErpErrorBanner />;

    if (standalone) {
        return (
            <div className="flex min-h-screen items-start justify-center bg-[#F8FAFC] px-6 py-10">
                <div className="w-full max-w-3xl">{banner}</div>
            </div>
        );
    }

    return <div className="mx-auto w-full max-w-3xl">{banner}</div>;
}
