'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

export default function Navbar() {
    const router = useRouter();
    const [userName, setUserName] = useState('Admin');
    const [showLogoutDialog, setShowLogoutDialog] = useState(false);

    useEffect(() => {
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
    }, []);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const handleLogout = () => {
        // Clear all localStorage items
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('employeeUser');
            localStorage.removeItem('userPermissions');
            localStorage.removeItem('tokenExpiresIn');
        }
        // Redirect to login
        router.push('/login');
    };

    return (
        <>
            <div className="bg-white border-b border-gray-200 px-8 py-6">
                <div className="flex items-center justify-end">
                    <div className="text-right">
                        <h1 className="text-2xl font-bold text-gray-800">
                            Hello, {userName}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {getGreeting()}
                        </p>
                        <button
                            onClick={() => setShowLogoutDialog(true)}
                            className="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ml-auto"
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

