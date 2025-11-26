'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
    LayoutDashboard,
    Users,
    Layers,
    ShoppingCart,
    FileText,
    Factory,
    BarChart3,
    Settings,
    ChevronRight,
    Search
} from 'lucide-react';

const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'HRM', label: 'HRM', icon: Users, submenu: ['Employees', 'Attendance', 'Leave', 'Leave', 'NCR'] },
    { id: 'CRM', label: 'CRM', icon: Layers },
    { id: 'Purchases', label: 'Purchases', icon: ShoppingCart },
    { id: 'Accounts', label: 'Accounts', icon: FileText },
    { id: 'Production', label: 'Production', icon: Factory },
    { id: 'Reports', label: 'Reports', icon: BarChart3 },
    { id: 'Settings', label: 'Settings', icon: Settings }
];

const logoPath = '/assets/employee/Sidebar_Top_Icon.png';

export default function Sidebar() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(true);
    const [openMenu, setOpenMenu] = useState('HRM');

    const toggleSidebar = () => setIsOpen((prev) => !prev);

    const handleSubmenuClick = (parentId, sub) => {
        if (parentId === 'HRM' && sub === 'Employees') {
            router.push('/Employee');
        }
    };

    return (
        <>
            {/* Sidebar Container */}
            <div
                className={`fixed top-0 left-0 h-screen bg-[#141622] text-gray-200 shadow-2xl transition-all duration-300 overflow-y-auto z-40 ${isOpen ? 'w-64' : 'w-0'
                    }`}
            >
                {isOpen && (
                    <div className="h-full flex flex-col">
                        {/* Header */}
                        <div className="p-5 flex items-center justify-between border-b border-gray-700/50">
                            <Image
                                src={logoPath}
                                alt="ViS Logo"
                                width={100}
                                height={100}
                                className="object-contain"
                                priority
                            />
                            <button
                                onClick={toggleSidebar}
                                className="w-[30px] h-[30px] rounded-md flex items-center justify-center text-white bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg hover:from-blue-600 hover:to-indigo-700 transition-all"
                            >
                                <ChevronRight size={18} className="transition-transform duration-300 rotate-180" />
                            </button>
                        </div>

                        {/* Profile */}
                        <div className="p-4 border-b border-gray-700/50 flex items-center gap-3">
                            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                                PP
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-white">Peter Parker</p>
                                <p className="text-xs text-gray-400">Python Developer</p>
                                <p className="text-xs text-green-400 flex items-center gap-1 mt-0.5">
                                    <span className="w-2 h-2 rounded-full bg-green-400" />
                                    online
                                </p>
                            </div>
                            <button className="text-gray-400 hover:text-white transition-colors">
                                <Settings size={18} />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="p-4">
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search"
                                    className="w-full bg-[#252943] border border-gray-700/50 rounded-lg pl-10 pr-3 py-2.5 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        {/* Menu */}
                        <nav className="flex-1 px-3 pb-4">
                            {menuItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = openMenu === item.id;

                                return (
                                    <div key={item.id} className="mb-1">
                                        <button
                                            onClick={() => setOpenMenu(isActive ? '' : item.id)}
                                            className={`flex items-center w-full px-4 py-3 rounded-lg transition-all group ${isActive
                                                ? 'bg-[#5e6c93] text-white shadow-lg'
                                                : 'text-gray-400 hover:bg-[#252943] hover:text-white'
                                                }`}
                                        >
                                            <Icon size={20} className="shrink-0" />
                                            <span className="ml-3 text-sm font-medium flex-1 text-left">{item.label}</span>
                                            {item.submenu && (
                                                <ChevronRight
                                                    size={18}
                                                    className={`transition-transform shrink-0 ${isActive ? 'rotate-90' : ''}`}
                                                />
                                            )}
                                        </button>

                                        {item.submenu && isActive && (
                                            <div className="ml-11 mt-1 space-y-1">
                                                {item.submenu.map((sub, idx) => (
                                                    <button
                                                        key={`${item.id}-${idx}`}
                                                        onClick={() => handleSubmenuClick(item.id, sub)}
                                                        className="flex items-center w-full px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors group"
                                                    >
                                                        <span className="mr-2 text-gray-600">-</span>
                                                        {sub}
                                                        <ChevronRight
                                                            size={16}
                                                            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </nav>
                    </div>
                )}
            </div>

            {/* Toggle Button when collapsed */}
            {!isOpen && (
                <button
                    onClick={toggleSidebar}
                    className="fixed top-5 left-5 z-50 w-[36px] h-[36px] rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl hover:from-blue-600 hover:to-indigo-700 transition-all"
                >
                    <ChevronRight size={18} className="transition-transform duration-300" />
                </button>
            )}

            {/* Content spacer */}
            <div className={`transition-all duration-300 ${isOpen ? 'ml-64' : 'ml-0'}`} />
        </>
    );
}
