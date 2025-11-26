'use client';

import { useEffect, useState } from 'react';

export default function Navbar() {
    const [userName, setUserName] = useState('Admin');

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

    return (
        <div className="bg-white border-b border-gray-200 px-8 py-6">
            <div className="flex items-center justify-end">
                <div className="text-right">
                    <h1 className="text-2xl font-bold text-gray-800">
                        Hello, {userName}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {getGreeting()}
                    </p>
                </div>
            </div>
        </div>
    );
}

