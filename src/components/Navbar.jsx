'use client';

import { useEffect, useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useIdleSession } from '@/contexts/IdleSessionProvider';
import { formatIdleCountdown, performLogout } from '@/utils/authSession';
import ErpBackButton from '@/components/ErpBackButton';

export default function Navbar() {
    const [userName, setUserName] = useState('Admin');
    const [showLogoutDialog, setShowLogoutDialog] = useState(false);
    const { remainingMs, isIdleTrackingActive } = useIdleSession();
    const [isMounted, setIsMounted] = useState(false);
    const [greeting, setGreeting] = useState('Good Day');

    useEffect(() => {
        setIsMounted(true);
        if (typeof window !== 'undefined') {
            const userData = localStorage.getItem('employeeUser');
            if (userData) {
                try {
                    const user = JSON.parse(userData);
                    setUserName(user.name || 'Admin');
                } catch (e) {
                    setUserName('Admin');
                }
            }
        }

        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Good Morning');
        else if (hour < 18) setGreeting('Good Afternoon');
        else setGreeting('Good Evening');
    }, []);

    const handleLogout = () => {
        performLogout({ reason: 'manual' });
    };

    const countdownLabel = formatIdleCountdown(remainingMs);
    const countdownTone =
        remainingMs <= 5 * 60 * 1000
            ? 'text-red-600 bg-red-50 border-red-200'
            : remainingMs <= 10 * 60 * 1000
              ? 'text-amber-700 bg-amber-50 border-amber-200'
              : 'text-emerald-700 bg-emerald-50 border-emerald-200';

    return (
        <>
            <div className="bg-white border-b border-gray-200 px-3 py-3 sm:px-5 sm:py-4 lg:px-8 lg:py-6">
                <div className="flex items-start gap-2 sm:gap-4">
                    <ErpBackButton className="shrink-0 mt-0.5 sm:mt-1" />
                    <div className="text-right ml-auto min-w-0">
                        <h1 className="text-base sm:text-xl lg:text-2xl font-bold text-gray-800 truncate">
                            Hello, {userName}
                        </h1>
                        <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
                            {greeting}
                        </p>
                        {isMounted && isIdleTrackingActive && (
                            <div
                                className={`mt-2 sm:mt-3 inline-flex items-center gap-1.5 sm:gap-2 rounded-lg border px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-xs font-semibold ${countdownTone}`}
                                title="Auto logout after 1 hour with no mouse, keyboard, or scroll activity. Any activity resets this timer."
                            >
                                <span className="uppercase tracking-wide">Session</span>
                                <span className="font-mono text-xs sm:text-sm">{countdownLabel}</span>
                            </div>
                        )}
                        <button
                            onClick={() => setShowLogoutDialog(true)}
                            className="mt-2 sm:mt-3 px-3 py-1.5 sm:px-4 sm:py-2 bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors inline-flex items-center gap-2 ml-auto"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to logout? You will need to login again to access your account.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleLogout}
                            className="bg-red-500 hover:bg-red-600 text-white"
                        >
                            Logout
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

