'use client';

import { useEffect, useState } from 'react';

function sidebarStaysOpen() {
    if (typeof window === 'undefined') return true;
    if (window.matchMedia('(max-width: 1023px)').matches) return false;
    return localStorage.getItem('sidebar_isOpen') !== 'false';
}

export default function CatalogModal({ title, onClose, children }) {
    const [shiftForSidebar, setShiftForSidebar] = useState(true);

    useEffect(() => {
        const read = () => setShiftForSidebar(sidebarStaysOpen());
        read();
        window.addEventListener('resize', read);
        const timer = window.setInterval(read, 400);
        return () => {
            window.removeEventListener('resize', read);
            window.clearInterval(timer);
        };
    }, []);

    return (
        <div className={`fixed inset-y-0 right-0 z-30 flex items-center justify-center bg-slate-900/40 p-4 ${shiftForSidebar ? 'left-72' : 'left-0'}`}>
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                    <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-slate-700" aria-label="Close">
                        Close
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export const fieldClass = 'h-10 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500';
export const labelClass = 'mb-1 block text-sm font-medium text-slate-700';
