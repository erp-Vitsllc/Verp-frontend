'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';

export default function DashboardPage() {
    const router = useRouter();
    const [isMounted, setIsMounted] = useState(false);
    const [currentTime, setCurrentTime] = useState(null);
    const [userName, setUserName] = useState('User');

    useEffect(() => {
        // Only run on client to avoid hydration mismatches
        if (typeof window === 'undefined') return;
        setIsMounted(true);
        const token = localStorage.getItem('token');
        if (!token) {
            router.replace('/login');
            return;
        }

        // Get user name from localStorage
        const userData = localStorage.getItem('user') || localStorage.getItem('employeeUser');
        if (userData) {
            try {
                const user = JSON.parse(userData);
                setUserName(user.name || user.username || 'User');
            } catch (e) {
                setUserName('User');
            }
        }

        // Set initial time after mount, then update every second
        setCurrentTime(new Date());
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, [router]);

    const formatTime = (date) => {
        if (!date) return '--:--:--';
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };

    const formatDate = (date) => {
        if (!date) return '';
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Avoid rendering time until mounted to prevent hydration mismatch
    if (!isMounted) {
        return (
            <div className="flex min-h-screen" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col">
                    <Navbar />
                    <div className="flex-1 p-6" style={{ backgroundColor: '#F2F6F9' }}>
                        <div className="bg-white rounded-2xl shadow-lg w-full max-w-md text-left px-6 py-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                    <span className="text-xl font-bold text-blue-600">V</span>
                                </div>
                                <div>
                                    <h1 className="text-xl font-semibold text-gray-800">
                                        Welcome to Dashboard
                                    </h1>
                                    <p className="text-sm text-gray-600">
                                        Hello, {userName}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-2 border-t border-gray-200 pt-4">
                                <div className="text-2xl font-bold text-blue-600">
                                    --:--:--
                                </div>
                                <div className="text-sm text-gray-500">
                                    {/* Date placeholder while mounting */}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                <Navbar />
                <div className="flex-1 p-6 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                    <div className="bg-white rounded-2xl shadow-lg w-full max-w-md text-left px-6 py-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                <span className="text-xl font-bold text-blue-600">V</span>
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold text-gray-800">
                                    Welcome to Dashboard
                                </h1>
                                <p className="text-sm text-gray-600">
                                    Hello, {userName}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2 border-t border-gray-200 pt-4">
                            <div className="text-2xl font-bold text-blue-600">
                                {formatTime(currentTime)}
                            </div>
                            <div className="text-sm text-gray-500">
                                {formatDate(currentTime)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

