'use client';

import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import { RotateCcw } from 'lucide-react';

export default function VehicleAccessPageShell({
    title,
    subtitle,
    count = null,
    onRefresh = null,
    refreshing = false,
    children,
}) {
    return (
        <PermissionGuard moduleId="hrm_asset_vehicle" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#f2f6f9]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 mb-5">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 truncate">
                                        {title}
                                    </h1>
                                    {count != null ? (
                                        <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold tabular-nums">
                                            {count}
                                        </span>
                                    ) : null}
                                </div>
                                {subtitle ? (
                                    <p className="text-gray-500 text-xs sm:text-sm">{subtitle}</p>
                                ) : null}
                            </div>
                            {onRefresh ? (
                                <button
                                    type="button"
                                    onClick={onRefresh}
                                    disabled={refreshing}
                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 bg-white shadow-sm disabled:opacity-50"
                                    title="Refresh"
                                >
                                    <RotateCcw size={18} className={refreshing ? 'animate-spin' : ''} />
                                </button>
                            ) : null}
                        </div>
                        {children}
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
