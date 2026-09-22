'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
    { label: 'User', href: '/Settings/User' },
    { label: 'Group', href: '/Settings/Group' },
    { label: 'Active Session', href: '/Settings/Devices' },
];

export default function UserGroupDeviceTabs() {
    const pathname = usePathname();

    return (
        <div className="mb-4 sm:mb-6 flex gap-6 border-b border-gray-200">
            {TABS.map((tab) => {
                const active = pathname === tab.href;
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={`pb-2 text-sm sm:text-base font-semibold border-b-2 -mb-px ${
                            active
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </div>
    );
}
