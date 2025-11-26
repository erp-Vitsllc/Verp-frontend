'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';

export default function DashboardPage() {
    const router = useRouter();

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const token = localStorage.getItem('token');
        if (!token) {
            router.replace('/');
        }
    }, [router]);

    const handleLogout = () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('employeeUser');
            router.replace('/');
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-100">
            {/* <Sidebar /> */}
            <div className="flex-1 flex flex-col">
                {/* <Navbar /> */}
                <div className="flex-1 bg-gray-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-3xl shadow-lg w-full max-w-xl text-center px-10 py-14">
                        <div className="w-16 h-16 mx-auto rounded-full bg-blue-100 flex items-center justify-center mb-6">
                            <span className="text-2xl font-bold text-blue-600">V</span>
                        </div>
                        <h1 className="text-3xl font-semibold text-gray-800 mb-10">Welcome to Dashboard</h1>
                        <button
                            onClick={handleLogout}
                            className="inline-flex items-center justify-center bg-red-500 hover:bg-red-600 text-white font-semibold px-8 py-3 rounded-full shadow transition"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

