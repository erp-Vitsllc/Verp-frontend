'use client';

import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';

/** Standard authenticated layout: sidebar + navbar + scrollable main area. */
export default function AppPageShell({ children }) {
    return (
        <div className="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans">
            <Sidebar />
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                <Navbar />
                <div className="flex-1 overflow-y-auto w-full p-6 lg:p-10 scrollbar-hide">
                    {children}
                </div>
            </div>
        </div>
    );
}
