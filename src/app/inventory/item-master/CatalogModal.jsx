'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

function sidebarStaysOpen() {
    if (typeof window === 'undefined') return true;
    if (window.matchMedia('(max-width: 1023px)').matches) return false;
    return localStorage.getItem('sidebar_isOpen') !== 'false';
}

export default function CatalogModal({ title, onClose, children, wide = false }) {
    const [shiftForSidebar, setShiftForSidebar] = useState(true);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

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

    useEffect(() => {
        const onKey = (event) => {
            if (event.key === 'Escape') onCloseRef.current();
        };
        window.addEventListener('keydown', onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    return (
        <div className={`fixed inset-y-0 right-0 z-30 flex items-center justify-center bg-slate-900/40 p-4 ${shiftForSidebar ? 'left-72' : 'left-0'}`}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={`flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
            >
                <div className="flex items-center justify-between gap-3 px-5 pt-5">
                    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export const fieldClass = 'h-10 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400';
export const labelClass = 'mb-1 block text-sm font-medium text-slate-700';
