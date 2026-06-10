'use client';

import { useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ErpErrorBanner from '@/components/ErpErrorBanner';

export default function EmployeeProfileError({ error, reset }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#F2F6F9]">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <Navbar />
                <div className="p-8">
                    <ErpErrorBanner onRetry={reset} />
                </div>
            </div>
        </div>
    );
}
