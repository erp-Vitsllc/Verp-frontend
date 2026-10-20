'use client';

import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';

export default function LoanAndAdvanceLayout({ children }) {
    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#F2F6F9] print:bg-white">
            <div className="print:hidden">
                <Sidebar />
            </div>
            <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                <div className="print:hidden shrink-0">
                    <Navbar />
                </div>
                {children}
            </div>
        </div>
    );
}
