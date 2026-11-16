'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import ErpPageHeader from '@/components/ErpPageHeader';

const COLUMNS = ['WORK ORDER', 'ITEM', 'QUANTITY', 'STATUS', 'START DATE', 'DUE DATE'];

export default function WorkOrderPage() {
    const router = useRouter();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!localStorage.getItem('token')) {
            router.replace('/login');
            return;
        }
        setReady(true);
    }, [router]);

    if (!ready) return null;

    return (
        <PermissionGuard moduleId="production" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#f4f6f8]">
                <Sidebar />
                <div className="flex min-w-0 w-full max-w-full flex-1 flex-col">
                    <Navbar />
                    <main className="w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5 lg:p-8">
                        <ErpPageHeader title="Work Order" subtitle="Production work orders" />

                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:rounded-2xl">
                            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-[#f8fafc] px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-3">
                                <span className="text-xs font-medium text-slate-600 sm:text-sm">0 work orders</span>
                                <div className="relative w-full sm:max-w-xs">
                                    <Search
                                        size={16}
                                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Search work orders"
                                        className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 sm:h-10 sm:text-sm"
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[720px] border-collapse text-xs sm:text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-[#f8fafc] text-left">
                                            {COLUMNS.map((column) => (
                                                <th
                                                    key={column}
                                                    className="px-3 py-2 text-[10px] font-bold tracking-[0.08em] text-slate-500 sm:px-4 sm:py-3 sm:text-[11px]"
                                                >
                                                    {column}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td
                                                colSpan={COLUMNS.length}
                                                className="px-3 py-10 text-center text-slate-500 sm:px-4 sm:py-16"
                                            >
                                                No work orders yet.
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </PermissionGuard>
    );
}
