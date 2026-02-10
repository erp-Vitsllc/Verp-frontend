'use client';

import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
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
    Search,
    Building
} from 'lucide-react';
import { hasAnyPermission, isAdmin, getUserPermissions } from '@/utils/permissions';

// Menu items with their permission mappings
const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permissionModule: 'dashboard' },
    {
        id: 'HRM',
        label: 'HRM',
        icon: Users,
        permissionModule: 'hrm',
        submenu: [
            { label: 'Company' },
            { label: 'Employees', permissionModule: 'hrm_employees_list' },
            { label: 'Attendance', permissionModule: 'hrm_attendance' },
            { label: 'Leave', permissionModule: 'hrm_leave' },
            { label: 'NCR', permissionModule: 'hrm_ncr' },
            { label: 'Fine', permissionModule: 'hrm_fine' },
            { label: 'Loan/Advance', permissionModule: 'hrm_loan' },
            { label: 'Reward', permissionModule: 'hrm_reward' },
            { label: 'Asset', permissionModule: 'hrm_asset' }
        ]
    },
    { id: 'CRM', label: 'CRM', icon: Layers, permissionModule: 'crm' },
    { id: 'Purchases', label: 'Purchases', icon: ShoppingCart, permissionModule: 'purchases' },
    { id: 'Accounts', label: 'Accounts', icon: FileText, permissionModule: 'accounts' },
    { id: 'Production', label: 'Production', icon: Factory, permissionModule: 'production' },
    { id: 'Reports', label: 'Reports', icon: BarChart3, permissionModule: 'reports' },
    {
        id: 'Settings',
        label: 'Settings',
        icon: Settings,
        permissionModule: 'settings',
        submenu: [
            {
                label: 'Users & Groups',
                permissionModule: 'settings_user_group',
                children: [
                    { label: 'User', permissionModule: 'settings_user_group' },
                    { label: 'Group', permissionModule: 'settings_user_group' },
                ]
            },

        ]
    }
];

const logoPath = '/assets/employee/sidebar-logo.png';

export default function Sidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(true);
    const [openMenu, setOpenMenu] = useState('');
    const [openSubmenu, setOpenSubmenu] = useState('');
    const [mounted, setMounted] = useState(false);
    const sidebarRef = useRef(null);
    const menuItemRefs = useRef({});
    const hasInitializedRef = useRef(false);
    const [userData, setUserData] = useState({
        name: 'User',
        designation: '',
        status: 'online'
    });

    // Handle client-side mounting to prevent hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    // Get user data from localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const userDataStr = localStorage.getItem('employeeUser') || localStorage.getItem('user');
            if (userDataStr) {
                try {
                    const user = JSON.parse(userDataStr);
                    setUserData({
                        name: user.name || user.username || 'User',
                        designation: user.designation || user.department || '',
                        status: 'online'
                    });
                } catch (e) {
                    console.error('Error parsing user data:', e);
                }
            }
        }
    }, []);

    // Determine which menu should be open based on current pathname
    // Only auto-open on initial load (first time mounted becomes true)
    useEffect(() => {
        if (!pathname || !mounted || hasInitializedRef.current) return;

        // Only auto-open on initial mount, not on subsequent pathname changes
        hasInitializedRef.current = true;

        // Check if we're on an Employee page
        if (pathname.startsWith('/emp')) {
            setOpenMenu('HRM');
        }
        // Check if we're on a Reward page
        else if (pathname.startsWith('/HRM/Reward')) {
            setOpenMenu('HRM');
        }
        // Check if we're on a Fine page
        else if (pathname.startsWith('/HRM/Fine')) {
            setOpenMenu('HRM');
        }
        // Check if we're on a Loan page
        else if (pathname.startsWith('/HRM/LoanAndAdvance')) {
            setOpenMenu('HRM');
        }
        // Check if we're on a Settings page
        else if (pathname.startsWith('/Settings')) {
            setOpenMenu('Settings');
            // Also open Users & Groups submenu if on User or Group page
            if (pathname.startsWith('/Settings/User') || pathname.startsWith('/Settings/Group')) {
                setOpenSubmenu('Settings-Users & Groups');
            }
        }
        // Check if we're on a Company page
        else if (pathname.startsWith('/Company')) {
            setOpenMenu('HRM');
        }
    }, [pathname, mounted]);

    // Auto-scroll to opened dropdown
    useEffect(() => {
        if (!isOpen || !sidebarRef.current) return;

        // Wait for DOM to update after state change
        const timeoutId = setTimeout(() => {
            let elementToScroll = null;

            // If a menu is open, scroll to it
            if (openMenu) {
                const menuElement = menuItemRefs.current[openMenu];
                if (menuElement) {
                    elementToScroll = menuElement;
                }
            }

            // If a submenu is open, scroll to it (higher priority)
            if (openSubmenu) {
                const submenuElement = menuItemRefs.current[openSubmenu];
                if (submenuElement) {
                    elementToScroll = submenuElement;
                }
            }

            // Scroll to the element if found
            if (elementToScroll && sidebarRef.current) {
                const sidebar = sidebarRef.current;
                const sidebarRect = sidebar.getBoundingClientRect();
                const elementRect = elementToScroll.getBoundingClientRect();

                // Check if element is outside visible area
                const isAboveViewport = elementRect.top < sidebarRect.top;
                const isBelowViewport = elementRect.bottom > sidebarRect.bottom;

                if (isAboveViewport || isBelowViewport) {
                    // Use scrollIntoView for reliable scrolling
                    elementToScroll.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'nearest'
                    });
                }
            }
        }, 100); // Small delay to ensure DOM is updated

        return () => clearTimeout(timeoutId);
    }, [openMenu, openSubmenu, isOpen]);

    const toggleSidebar = () => setIsOpen((prev) => !prev);

    const handleSubmenuClick = (parentId, subItem) => {
        if (subItem.children) {
            const key = `${parentId}-${subItem.label}`;
            setOpenSubmenu(openSubmenu === key ? '' : key);
            return;
        }

        if (parentId === 'HRM' && subItem.label === 'Employees') {
            router.push('/emp');
        } else if (parentId === 'HRM' && subItem.label === 'Reward') {
            router.push('/HRM/Reward');
        } else if (parentId === 'HRM' && subItem.label === 'Fine') {
            router.push('/HRM/Fine');
        } else if (parentId === 'HRM' && subItem.label === 'Loan/Advance') {
            router.push('/HRM/LoanAndAdvance');
        } else if (parentId === 'HRM' && subItem.label === 'Asset') {
            router.push('/HRM/Asset');
        } else if (parentId === 'Settings' && subItem.label === 'User') {
            router.push('/Settings/User');
        } else if (parentId === 'Settings' && subItem.label === 'Group') {
            router.push('/Settings/Group');
        } else if (parentId === 'Settings' && subItem.label === 'Logout') {
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
        } else if (parentId === 'HRM' && subItem.label === 'Company') {
            router.push('/Company');
        }
    };

    // Determine if a subsection is active based on pathname
    const isSubmenuActive = (parentId, subItem) => {
        if (subItem?.children && subItem.children.length) {
            return subItem.children.some(child => isSubmenuActive(parentId, child));
        }
        if (parentId === 'HRM' && subItem.label === 'Employees') {
            return pathname?.startsWith('/emp');
        } else if (parentId === 'HRM' && subItem.label === 'Reward') {
            return pathname?.startsWith('/HRM/Reward');
        } else if (parentId === 'HRM' && subItem.label === 'Fine') {
            return pathname?.startsWith('/HRM/Fine');
        } else if (parentId === 'HRM' && subItem.label === 'Loan/Advance') {
            return pathname?.startsWith('/HRM/LoanAndAdvance');
        } else if (parentId === 'HRM' && subItem.label === 'Asset') {
            return pathname?.startsWith('/HRM/Asset');
        } else if (parentId === 'Settings' && subItem.label === 'User') {
            return pathname?.startsWith('/Settings/User');
        } else if (parentId === 'Settings' && subItem.label === 'Group') {
            return pathname?.startsWith('/Settings/Group');
        } else if (parentId === 'HRM' && subItem.label === 'Company') {
            return pathname?.startsWith('/Company');
        }
        return false;
    };

    // Check if menu item should be visible based on permissions
    const isMenuItemVisible = (item) => {
        // During SSR or before mount, show all items to prevent hydration mismatch
        if (!mounted) {
            return true;
        }

        // Dashboard is always visible
        if (item.id === 'dashboard') {
            return true;
        }

        // Admin sees everything
        if (isAdmin()) {
            return true;
        }

        // Check if user has isView permission for this module
        if (item.permissionModule) {
            const permissions = getUserPermissions();
            const modulePermission = permissions[item.permissionModule];

            // Check if module has View permission (isView must be true, or isActive for backward compatibility)
            if (modulePermission && (modulePermission.isView === true || modulePermission.isActive === true)) {
                return true;
            }

            // Also check child modules
            const childModules = Object.keys(permissions).filter(key => key.startsWith(item.permissionModule + '_'));
            for (const childModuleId of childModules) {
                const childPermission = permissions[childModuleId];
                if (childPermission && (childPermission.isView === true || childPermission.isActive === true)) {
                    return true;
                }
            }

            return false;
        }

        // If no permission module specified, show it
        return true;
    };

    // Check if submenu item should be visible
    const isSubmenuItemVisible = (subItem) => {
        // During SSR or before mount, show all items to prevent hydration mismatch
        if (!mounted) {
            return true;
        }

        // Logout is always visible
        if (subItem.label === 'Logout') {
            return true;
        }

        // If this subitem has children, visibility depends on itself
        if (subItem.children) {
            return isMenuItemVisible(subItem); // reuse permission logic
        }

        // Admin sees everything
        if (isAdmin()) {
            return true;
        }

        // Check if user has isView permission for this submenu item
        if (subItem.permissionModule) {
            const permissions = getUserPermissions();
            const modulePermission = permissions[subItem.permissionModule];

            // Check if module has View permission (isView must be true, or isActive for backward compatibility)
            if (modulePermission && (modulePermission.isView === true || modulePermission.isActive === true)) {
                return true;
            }

            return false;
        }

        // If no permission module specified, show it by default
        return true;
    };

    return (
        <>
            {/* Sidebar Container */}
            <div
                ref={sidebarRef}
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
                                style={{ height: 'auto', width: 'auto' }}
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
                                {userData.name ? userData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-white">{userData.name}</p>
                                <p className="text-xs text-gray-400">{userData.designation || 'Employee'}</p>
                                <p className="text-xs text-green-400 flex items-center gap-1 mt-0.5">
                                    <span className="w-2 h-2 rounded-full bg-green-400" />
                                    {userData.status}
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
                                // Only show menu items user has permission for
                                if (!isMenuItemVisible(item)) {
                                    return null;
                                }

                                const Icon = item.icon;
                                const isMenuOpen = openMenu === item.id;
                                // Check if any submenu item is active (for visual indication only)
                                const hasActiveSubmenu = item.submenu?.some(sub => isSubmenuActive(item.id, sub));

                                // Check if dashboard is active
                                const isDashboardActive = item.id === 'dashboard' && pathname === '/dashboard';
                                // Visual active state: menu is open OR has active submenu OR is dashboard
                                const finalIsActive = isMenuOpen || hasActiveSubmenu || isDashboardActive;

                                return (
                                    <div
                                        key={item.id}
                                        className="mb-1"
                                        ref={(el) => {
                                            if (el && item.submenu) {
                                                menuItemRefs.current[item.id] = el;
                                            }
                                        }}
                                    >
                                        <button
                                            onClick={() => {
                                                if (item.id === 'dashboard') {
                                                    router.push('/dashboard');
                                                } else if (item.submenu) {
                                                    setOpenMenu(isMenuOpen ? '' : item.id);
                                                }
                                            }}
                                            className={`flex items-center w-full px-4 py-3 rounded-lg transition-all group ${finalIsActive
                                                ? 'bg-[#5e6c93] text-white shadow-lg'
                                                : 'text-gray-400 hover:bg-[#252943] hover:text-white'
                                                }`}
                                        >
                                            <Icon size={20} className={`shrink-0 ${finalIsActive ? 'text-white' : ''}`} />
                                            <span className={`ml-3 text-sm font-medium flex-1 text-left ${finalIsActive ? 'text-white' : ''}`}>{item.label}</span>
                                            {item.submenu && (
                                                <ChevronRight
                                                    size={18}
                                                    className={`transition-transform shrink-0 ${isMenuOpen ? 'rotate-90' : ''}`}
                                                />
                                            )}
                                        </button>

                                        {item.submenu && isMenuOpen && (
                                            <div className="ml-11 mt-1 space-y-1">
                                                {item.submenu.map((subItem, idx) => {
                                                    // Only show submenu items user has permission for
                                                    if (!isSubmenuItemVisible(subItem)) {
                                                        return null;
                                                    }

                                                    const hasChildren = Array.isArray(subItem.children) && subItem.children.length > 0;
                                                    const subKey = `${item.id}-${subItem.label}`;
                                                    // Only check openSubmenu state, not active state - allow closing even if active
                                                    const isSubOpen = openSubmenu === subKey;
                                                    const isSubActive = isSubmenuActive(item.id, subItem);
                                                    const isLogout = subItem.label === 'Logout';

                                                    return (
                                                        <div
                                                            key={`${item.id}-${idx}`}
                                                            ref={(el) => {
                                                                if (el) {
                                                                    menuItemRefs.current[subKey] = el;
                                                                }
                                                            }}
                                                        >
                                                            <button
                                                                onClick={() => handleSubmenuClick(item.id, subItem)}
                                                                className={`flex items-center w-full px-3 py-2 text-sm transition-colors group ${isLogout
                                                                    ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                                                                    : isSubActive
                                                                        ? 'text-white font-medium rounded'
                                                                        : 'text-gray-400 hover:text-white'
                                                                    }`}
                                                                style={{ backgroundColor: 'transparent' }}
                                                            >
                                                                <span className={`mr-2 ${isSubActive ? 'text-white' : isLogout ? 'text-red-400' : 'text-gray-600'}`}>-</span>
                                                                {subItem.label}
                                                                {hasChildren ? (
                                                                    <ChevronRight
                                                                        size={16}
                                                                        className={`ml-auto transition-transform ${isSubOpen ? 'rotate-90' : ''}`}
                                                                    />
                                                                ) : (
                                                                    <ChevronRight
                                                                        size={16}
                                                                        className={`ml-auto transition-opacity ${isSubActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                                                    />
                                                                )}
                                                            </button>

                                                            {hasChildren && isSubOpen && (
                                                                <div className="ml-6 space-y-1">
                                                                    {subItem.children.map((child, childIdx) => {
                                                                        if (!isSubmenuItemVisible(child)) {
                                                                            return null;
                                                                        }
                                                                        const isChildActive = isSubmenuActive(item.id, child);
                                                                        const childIsLogout = child.label === 'Logout';
                                                                        return (
                                                                            <button
                                                                                key={`${item.id}-${idx}-${childIdx}`}
                                                                                onClick={() => handleSubmenuClick(item.id, child)}
                                                                                className={`flex items-center w-full px-3 py-2 text-sm transition-colors group ${childIsLogout
                                                                                    ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                                                                                    : isChildActive
                                                                                        ? 'text-white font-medium rounded'
                                                                                        : 'text-gray-400 hover:text-white'
                                                                                    }`}
                                                                                style={{ backgroundColor: 'transparent' }}
                                                                            >
                                                                                <span className={`mr-2 ${isChildActive ? 'text-white' : childIsLogout ? 'text-red-400' : 'text-gray-600'}`}>•</span>
                                                                                {child.label}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
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
