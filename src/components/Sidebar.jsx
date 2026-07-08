'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import {
    LayoutDashboard,
    Users2,
    User,
    Users,
    Building2,
    CalendarClock,
    CalendarX2,
    ClipboardList,
    FileWarning,
    HandCoins,
    Award,
    Package,
    Car,
    Wrench,
    ContactRound,
    ShoppingCart,
    TrendingUp,
    Calculator,
    CreditCard,
    Factory,
    FileBarChart2,
    Settings,
    GitBranch,
    Trash2,
    ChevronRight,
    Search,
} from 'lucide-react';
import { hasAnyPermission, isAdmin, getUserPermissions } from '@/utils/permissions';
import axiosInstance, { isSessionAuthError, shouldSkipSidebarPolling, pauseSidebarPolling, blockSidebarPollingForAuth } from '@/utils/axios';
import { performLogout } from '@/utils/authSession';
import {
    collectEmployeeLiveExpiryNotifications,
    mergeExpiryNotificationDedupe,
} from '@/utils/expiryNotificationFallbacks';
import { buildCompanyPageNotifications, loadCompanyNotificationBundle } from '@/utils/companyPageNotifications';
import {
    getViewerEmployeeObjectIdFromStorage,
    isFlowchartHrForExpiryTasks,
} from '@/utils/flowchartHrExpiryVisibility';
import { filterActionableDashboardItems } from '@/utils/activationNotificationFilters';
import {
    ASSET_PENDING_INBOX_CHANGED,
    countVisibleAssetPendingInbox,
} from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import {
    fetchAssetPendingInbox,
    getCachedPendingInbox,
    ASSET_PENDING_INBOX_ENDPOINT,
} from '@/utils/pendingInboxFetch';
import {
    FINE_PENDING_INBOX_CHANGED,
    countVisibleFinePendingInbox,
} from '@/app/HRM/Fine/utils/finePendingInboxCount';
import {
    PAYMENT_PENDING_INBOX_CHANGED,
    countVisiblePaymentPendingInbox,
} from '@/app/Accounts/Payments/utils/paymentPendingInboxCount';
import { handleLinkContextMenu } from '@/utils/linkContextMenu';

const logoPath = '/assets/employee/sidebar-logo.png';

const SIDEBAR_ICON_STROKE = 1.75;

function scheduleWhenIdle(callback, maxWaitMs = 3000) {
    if (typeof window === 'undefined') {
        const timeoutId = setTimeout(callback, maxWaitMs);
        return () => clearTimeout(timeoutId);
    }
    let cancelled = false;
    const run = () => {
        if (!cancelled) callback();
    };
    if (typeof window.requestIdleCallback === 'function') {
        const idleId = window.requestIdleCallback(run, { timeout: maxWaitMs });
        return () => {
            cancelled = true;
            window.cancelIdleCallback(idleId);
        };
    }
    const timeoutId = setTimeout(run, Math.min(maxWaitMs, 2000));
    return () => {
        cancelled = true;
        clearTimeout(timeoutId);
    };
}

function SidebarNavIcon({ icon: Icon, active, size = 18, className = '' }) {
    if (!Icon) return null;
    return (
        <Icon
            size={size}
            strokeWidth={SIDEBAR_ICON_STROKE}
            className={`shrink-0 ${active ? '!text-white' : 'text-slate-400 group-hover:text-slate-200'} ${className}`}
        />
    );
}

// Menu items with their permission mappings
const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permissionModule: 'dashboard' },
    {
        id: 'HRM',
        label: 'HRM',
        icon: Users2,
        permissionModule: 'hrm',
        submenu: [
            { label: 'Company', icon: Building2, permissionModule: 'hrm_company' },
            { label: 'Employees', icon: User, permissionModule: 'hrm_employees_list' },
            { label: 'Attendance', icon: CalendarClock, permissionModule: 'hrm_attendance' },
            { label: 'Leave', icon: CalendarX2, permissionModule: 'hrm_leave' },
            { label: 'NCR', icon: ClipboardList, permissionModule: 'hrm_ncr' },
            { label: 'Fine', icon: FileWarning, permissionModule: 'hrm_fine' },
            { label: 'Loan/Advance', icon: HandCoins, permissionModule: 'hrm_loan' },
            { label: 'Reward', icon: Award, permissionModule: 'hrm_reward' },
            {
                label: 'Asset',
                icon: Package,
                permissionModule: 'hrm_asset',
                children: [
                    { label: 'Vehicle Asset', icon: Car, permissionModule: 'hrm_asset_vehicle' },
                    { label: 'Tools Assets', icon: Wrench, permissionModule: 'hrm_asset_tools' },
                ],
            },
        ],
    },
    { id: 'CRM', label: 'CRM', icon: ContactRound, permissionModule: 'crm' },
    {
        id: 'Purchases',
        label: 'Purchases',
        icon: ShoppingCart,
        permissionModule: 'purchases',
        submenu: [{ label: 'Vendors', icon: Users, permissionModule: 'purchases' }],
    },
    {
        id: 'Sales',
        label: 'Sales',
        icon: TrendingUp,
        permissionModule: 'sales',
        submenu: [{ label: 'Customers', icon: Users, permissionModule: 'sales' }],
    },
    {
        id: 'Accounts',
        label: 'Accounts',
        icon: Calculator,
        permissionModule: 'accounts',
        submenu: [{ label: 'Payments', icon: CreditCard, permissionModule: 'accounts' }],
    },
    { id: 'Production', label: 'Production', icon: Factory, permissionModule: 'production' },
    { id: 'Reports', label: 'Reports', icon: FileBarChart2, permissionModule: 'reports' },
    {
        id: 'Settings',
        label: 'Settings',
        icon: Settings,
        permissionModule: 'settings',
        submenu: [
            {
                label: 'Users & Groups',
                icon: Users,
                permissionModule: 'settings_user_group',
                children: [
                    { label: 'User', icon: User, permissionModule: 'settings_user_group' },
                    { label: 'Group', icon: Users2, permissionModule: 'settings_user_group' },
                ],
            },
            { label: 'Flowchart', icon: GitBranch, permissionModule: 'settings' },
            { label: 'Deleted Records', icon: Trash2, restoreRecovery: true },
        ],
    },
];

/**
 * Path for real links so right-click / middle-click get standard browser behavior (e.g. Open in new tab).
 * Returns null for expand-only rows, Logout, and items with no route wired in the sidebar.
 */
function getSidebarSubmenuHref(parentId, subItem) {
    if (!subItem?.label || (Array.isArray(subItem.children) && subItem.children.length > 0)) return null;
    if (subItem.label === 'Logout') return null;

    const label = subItem.label;
    if (parentId === 'HRM') {
        if (label === 'Employees') return '/emp';
        if (label === 'Reward') return '/HRM/Reward';
        if (label === 'Fine') return '/HRM/Fine';
        if (label === 'Loan/Advance') return '/HRM/LoanAndAdvance';
        if (label === 'Vehicle Asset') return '/HRM/Asset/Vehicle/dashboard';
        if (label === 'Telecommunication') return '/HRM/Asset/Telecommunication';
        if (label === 'Tools Assets') return '/HRM/Asset';
        if (label === 'Company') return '/Company';
    }
    if (parentId === 'Settings') {
        if (label === 'User') return '/Settings/User';
        if (label === 'Group') return '/Settings/Group';
        if (label === 'Flowchart') return '/Settings/FlowChart';
        if (label === 'Deleted Records') return '/Settings/DeletedRecords';
    }
    if (parentId === 'Accounts' && label === 'Payments') return '/Accounts/Payments';
    if (parentId === 'Purchases' && label === 'Vendors') return '/Purchases/Vendors';
    if (parentId === 'Sales' && label === 'Customers') return '/Sales/Customers';
    return null;
}

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
    const [sidebarCounts, setSidebarCounts] = useState({
        company: 0,
        employee: 0,
        fine: 0,
        toolsAsset: 0,
        vehicleAsset: 0,
        payments: 0,
    });
    const [canRestoreRecovery, setCanRestoreRecovery] = useState(false);

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

    useEffect(() => {
        if (!mounted) return;
        if (isAdmin()) {
            setCanRestoreRecovery(true);
            return;
        }
        axiosInstance
            .get('/AdminDeletionArchive/access')
            .then((res) => setCanRestoreRecovery(!!res.data?.allowed))
            .catch(() => setCanRestoreRecovery(false));
    }, [mounted]);

    useEffect(() => {
        if (!mounted) return;

        let inFlight = false;
        let debounceTimer = null;
        let cancelIdleEmployeeFetch = null;

        const loadSidebarCounts = async () => {
            if (shouldSkipSidebarPolling()) return;
            if (inFlight) return;
            inFlight = true;
            try {
                const viewerId = typeof window !== 'undefined' ? getViewerEmployeeObjectIdFromStorage() : null;
                const hrLiveGuess = isAdmin() || isFlowchartHrForExpiryTasks(null, viewerId);

                const [toolsItems, vehicleItems, fineRes, paymentInboxRes, notificationBundle] = await Promise.all([
                    fetchAssetPendingInbox(axiosInstance, {
                        inboxScope: 'tools',
                        skipSync: true,
                        skipToast: true,
                    }),
                    fetchAssetPendingInbox(axiosInstance, {
                        inboxScope: 'vehicle',
                        skipSync: true,
                        skipToast: true,
                    }),
                    axiosInstance.get('/Fine/dashboard/pending-inbox', { skipToast: true }),
                    axiosInstance.get('/Payment/dashboard/pending-inbox', { skipToast: true }),
                    loadCompanyNotificationBundle(axiosInstance, {
                        hrLive: hrLiveGuess,
                        cachedCompanies: [],
                        skipExpirySync: true,
                    }),
                ]);

                const { statsRes, companiesList } = notificationBundle;
                const items = Array.isArray(statsRes.data?.items) ? statsRes.data.items : [];
                const pendingItems = filterActionableDashboardItems(items);

                const toolsAsset = countVisibleAssetPendingInbox(toolsItems);
                const vehicleAsset = countVisibleAssetPendingInbox(vehicleItems);
                const fine = countVisibleFinePendingInbox(fineRes?.data?.items);
                const payments = countVisiblePaymentPendingInbox(paymentInboxRes?.data?.items);

                const flowchartHrId = statsRes?.data?.flowchartHrEmployeeObjectId ?? null;
                const liveExpiryHrView = isAdmin() || isFlowchartHrForExpiryTasks(flowchartHrId, viewerId);

                const companyCount = buildCompanyPageNotifications(
                    pendingItems,
                    companiesList,
                    liveExpiryHrView,
                ).length;

                const employeeFiltered = pendingItems
                    .filter((item) =>
                        ['Profile Activation', 'Employee Document Expiry Reminder', 'Probation Change', 'Employee Document Not Renew', 'Profile Incomplete'].includes(item.type),
                    );
                const employeeCountBase = mergeExpiryNotificationDedupe(employeeFiltered, []).length;

                setSidebarCounts({
                    company: companyCount,
                    employee: employeeCountBase,
                    fine,
                    toolsAsset,
                    vehicleAsset,
                    payments,
                });

                if (liveExpiryHrView) {
                    if (cancelIdleEmployeeFetch) cancelIdleEmployeeFetch();
                    cancelIdleEmployeeFetch = scheduleWhenIdle(async () => {
                        try {
                            const empRes = await axiosInstance
                                .get('/Employee', { params: { limit: 1000 }, skipToast: true })
                                .catch(() => ({ data: {} }));
                            const empPayload = empRes?.data?.employees ?? empRes?.data;
                            const employeesList = Array.isArray(empPayload) ? empPayload : [];
                            const employeeCount = mergeExpiryNotificationDedupe(
                                employeeFiltered,
                                collectEmployeeLiveExpiryNotifications(employeesList),
                            ).length;
                            setSidebarCounts((prev) => ({ ...prev, employee: employeeCount }));
                        } catch {
                            /* keep base count from dashboard stats */
                        }
                    });
                }
            } catch (err) {
                if (isSessionAuthError(err)) {
                    blockSidebarPollingForAuth();
                } else if (!err?.response) {
                    pauseSidebarPolling(30000);
                }
                setSidebarCounts({
                    company: 0,
                    employee: 0,
                    fine: 0,
                    toolsAsset: 0,
                    vehicleAsset: 0,
                    payments: 0,
                });
            } finally {
                inFlight = false;
            }
        };

        const scheduleRefresh = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                debounceTimer = null;
                loadSidebarCounts();
            }, 3000);
        };

        let cancelInitialIdle = scheduleWhenIdle(() => {
            loadSidebarCounts();
        }, 2500);
        const intervalId = setInterval(() => loadSidebarCounts(), 90 * 1000);
        const handleFocus = () => scheduleRefresh();
        const handleVisibility = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                scheduleRefresh();
            }
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('focus', handleFocus);
        }
        const handleAssetInboxChanged = () => {
            loadSidebarCounts();
        };
        const handleFineInboxChanged = () => {
            loadSidebarCounts();
        };
        const handlePaymentInboxChanged = () => {
            loadSidebarCounts();
        };
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibility);
            document.addEventListener(ASSET_PENDING_INBOX_CHANGED, handleAssetInboxChanged);
            document.addEventListener(FINE_PENDING_INBOX_CHANGED, handleFineInboxChanged);
            document.addEventListener(PAYMENT_PENDING_INBOX_CHANGED, handlePaymentInboxChanged);
        }
        return () => {
            if (cancelInitialIdle) cancelInitialIdle();
            if (cancelIdleEmployeeFetch) cancelIdleEmployeeFetch();
            clearInterval(intervalId);
            if (debounceTimer) clearTimeout(debounceTimer);
            if (typeof window !== 'undefined') {
                window.removeEventListener('focus', handleFocus);
            }
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', handleVisibility);
                document.removeEventListener(ASSET_PENDING_INBOX_CHANGED, handleAssetInboxChanged);
                document.removeEventListener(FINE_PENDING_INBOX_CHANGED, handleFineInboxChanged);
                document.removeEventListener(PAYMENT_PENDING_INBOX_CHANGED, handlePaymentInboxChanged);
            }
        };
    }, [mounted]);

    const getSidebarBadgeCount = (parentId, label) => {
        if (parentId === 'HRM') {
            if (label === 'Company') return sidebarCounts.company;
            if (label === 'Employees') return sidebarCounts.employee;
            if (label === 'Fine') return sidebarCounts.fine;
            if (label === 'Asset') return (sidebarCounts.vehicleAsset || 0) + (sidebarCounts.toolsAsset || 0);
            if (label === 'Vehicle Asset') return sidebarCounts.vehicleAsset;
            if (label === 'Tools Assets') return sidebarCounts.toolsAsset;
            return 0;
        }
        if (parentId === 'Accounts' && label === 'Payments') return sidebarCounts.payments;
        return 0;
    };

    const accountsTotalBadgeCount = sidebarCounts.payments || 0;

    const hrmTotalBadgeCount =
        (sidebarCounts.company || 0) +
        (sidebarCounts.employee || 0) +
        (sidebarCounts.fine || 0) +
        (sidebarCounts.toolsAsset || 0) +
        (sidebarCounts.vehicleAsset || 0);

    // Load sidebar state from localStorage on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedIsOpen = localStorage.getItem('sidebar_isOpen');
            const savedOpenMenu = localStorage.getItem('sidebar_openMenu');
            const savedOpenSubmenu = localStorage.getItem('sidebar_openSubmenu');

            if (savedIsOpen !== null) setIsOpen(savedIsOpen === 'true');
            if (savedOpenMenu) setOpenMenu(savedOpenMenu);
            if (savedOpenSubmenu) setOpenSubmenu(savedOpenSubmenu);
        }
    }, []);

    // Save sidebar state to localStorage whenever it changes
    useEffect(() => {
        if (mounted) {
            localStorage.setItem('sidebar_isOpen', isOpen);
            localStorage.setItem('sidebar_openMenu', openMenu);
            localStorage.setItem('sidebar_openSubmenu', openSubmenu);
        }
    }, [isOpen, openMenu, openSubmenu, mounted]);

    // Determine which menu should be open based on current pathname
    // Robust detection for HRM, Asset, and Settings modules
    useEffect(() => {
        if (!pathname || !mounted) return;

        const lowPath = pathname.toLowerCase();

        // HRM Detection (Employees, Attendance, Leave, Fine, Reward, Loan, Asset, Company)
        if (
            pathname.startsWith('/emp') ||
            pathname.startsWith('/HRM') ||
            pathname.startsWith('/Company')
        ) {
            setOpenMenu('HRM');

            // Sub-module detection for HRM
            if (pathname.includes('/Asset')) {
                setOpenSubmenu('HRM-Asset');
            }
        }
        // Purchases Detection
        else if (pathname.startsWith('/Purchases')) {
            setOpenMenu('Purchases');
        }
        // Sales Detection
        else if (pathname.startsWith('/Sales')) {
            setOpenMenu('Sales');
        }
        // Settings Detection
        else if (pathname.startsWith('/Settings')) {
            setOpenMenu('Settings');
            if (pathname.includes('/User') || pathname.includes('/Group')) {
                setOpenSubmenu('Settings-Users & Groups');
            } else if (pathname.includes('/FlowChart')) {
                setOpenSubmenu('Settings-Flowchart');
            }
        }
        // Dashboard Detection
        else if (pathname === '/dashboard') {
            // Usually we don't need to force open anything for dashboard, but let's be clean
            // setOpenMenu('dashboard'); 
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
                        block: 'start',
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
        } else if (parentId === 'HRM' && subItem.label === 'Vehicle Asset') {
            router.push('/HRM/Asset/Vehicle/dashboard');
        } else if (parentId === 'HRM' && subItem.label === 'Telecommunication') {
            router.push('/HRM/Asset/Telecommunication');
        } else if (parentId === 'HRM' && subItem.label === 'Tools Assets') {
            router.push('/HRM/Asset');
        } else if (parentId === 'Settings' && subItem.label === 'User') {
            router.push('/Settings/User');
        } else if (parentId === 'Settings' && subItem.label === 'Group') {
            router.push('/Settings/Group');
        } else if (parentId === 'Settings' && subItem.label === 'Logout') {
            performLogout({ reason: 'manual' });
        } else if (parentId === 'Settings' && subItem.label === 'Flowchart') {
            router.push('/Settings/FlowChart');
        } else if (parentId === 'Settings' && subItem.label === 'Deleted Records') {
            router.push('/Settings/DeletedRecords');
        } else if (parentId === 'HRM' && subItem.label === 'Company') {
            router.push('/Company');
        } else if (parentId === 'Accounts' && subItem.label === 'Payments') {
            router.push('/Accounts/Payments');
        } else if (parentId === 'Purchases' && subItem.label === 'Vendors') {
            router.push('/Purchases/Vendors');
        } else if (parentId === 'Sales' && subItem.label === 'Customers') {
            router.push('/Sales/Customers');
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
        } else if (parentId === 'HRM' && subItem.label === 'Vehicle Asset') {
            return pathname?.startsWith('/HRM/Asset/Vehicle');
        } else if (parentId === 'HRM' && subItem.label === 'Telecommunication') {
            return pathname?.startsWith('/HRM/Asset/Telecommunication');
        } else if (parentId === 'HRM' && subItem.label === 'Tools Assets') {
            return pathname === '/HRM/Asset';
        } else if (parentId === 'Settings' && subItem.label === 'User') {
            return pathname?.startsWith('/Settings/User');
        } else if (parentId === 'Settings' && subItem.label === 'Group') {
            return pathname?.startsWith('/Settings/Group');
        } else if (parentId === 'Settings' && subItem.label === 'Flowchart') {
            return pathname?.startsWith('/Settings/FlowChart');
        } else if (parentId === 'Settings' && subItem.label === 'Deleted Records') {
            return pathname?.startsWith('/Settings/DeletedRecords');
        } else if (parentId === 'HRM' && subItem.label === 'Company') {
            return pathname?.startsWith('/Company');
        } else if (parentId === 'Accounts' && subItem.label === 'Payments') {
            return pathname?.startsWith('/Accounts/Payments') || pathname?.startsWith('/Accounts/Payment');
        } else if (parentId === 'Purchases' && subItem.label === 'Vendors') {
            return pathname?.startsWith('/Purchases/Vendors');
        } else if (parentId === 'Sales' && subItem.label === 'Customers') {
            return pathname?.startsWith('/Sales/Customers');
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

        if (subItem.restoreRecovery) {
            return isAdmin() || canRestoreRecovery;
        }

        // Asset parent: show only when at least one sub-item (Vehicle / Tools) is allowed.
        // Parent View alone must not reveal unchecked children.
        if (subItem.children && subItem.permissionModule === 'hrm_asset') {
            return subItem.children.some((child) => isSubmenuItemVisible(child));
        }

        if (subItem.children) {
            return isMenuItemVisible(subItem);
        }

        // Admin sees everything
        if (isAdmin()) {
            return true;
        }

        // Match PermissionGuard / route access: any view on this module OR on descendants (e.g. hrm_company_list).
        // Groups often grant only child keys (hrm_company_*) without a row for the parent hrm_company.
        if (subItem.permissionModule) {
            return hasAnyPermission(subItem.permissionModule);
        }

        // If no permission module specified, show it by default
        return true;
    };

    return (
        <>
            {/* Sidebar Container */}
            <div
                ref={sidebarRef}
                className={`fixed top-0 left-0 h-screen bg-[#141622] text-slate-100 shadow-2xl transition-all duration-300 overflow-y-auto z-40 [&_span]:text-inherit ${isOpen ? 'w-72' : 'w-0'
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
                                <p className="text-xs text-slate-300">{userData.designation || 'Employee'}</p>
                                <p className="text-xs text-green-400 flex items-center gap-1 mt-0.5">
                                    <span className="w-2 h-2 rounded-full bg-green-400" />
                                    {userData.status}
                                </p>
                            </div>
                            <button className="text-slate-300 hover:text-white transition-colors">
                                <Settings size={18} strokeWidth={SIDEBAR_ICON_STROKE} />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="p-4">
                            <div className="relative">
                                <Search size={18} strokeWidth={SIDEBAR_ICON_STROKE} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Search"
                                    className="w-full bg-[#252943] border border-gray-700/50 rounded-lg pl-10 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
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
                                        {item.id === 'dashboard' ? (
                                            <Link
                                                href="/dashboard"
                                                onContextMenu={(event) => handleLinkContextMenu(event, '/dashboard')}
                                                className={`flex items-center w-full px-4 py-3 rounded-lg transition-all group ${finalIsActive
                                                    ? 'bg-[#5e6c93] !text-white shadow-lg'
                                                    : 'text-slate-100 hover:bg-[#252943] hover:text-white'
                                                    }`}
                                            >
                                                <Icon size={20} strokeWidth={SIDEBAR_ICON_STROKE} className={`shrink-0 ${finalIsActive ? '!text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                                                <span className={`ml-3 text-sm font-medium flex-1 text-left ${finalIsActive ? '!text-white' : ''}`}>{item.label}</span>
                                            </Link>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (item.submenu) {
                                                        setOpenMenu(isMenuOpen ? '' : item.id);
                                                    }
                                                }}
                                                className={`flex items-center w-full px-4 py-3 rounded-lg transition-all group ${finalIsActive
                                                    ? 'bg-[#5e6c93] !text-white shadow-lg'
                                                    : 'text-slate-100 hover:bg-[#252943] hover:text-white'
                                                    }`}
                                            >
                                                <Icon size={20} strokeWidth={SIDEBAR_ICON_STROKE} className={`shrink-0 ${finalIsActive ? '!text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                                                <span className={`ml-3 text-sm font-medium flex-1 text-left ${finalIsActive ? '!text-white' : ''}`}>{item.label}</span>
                                                {item.id === 'HRM' && hrmTotalBadgeCount > 0 && (
                                                    <span className="mr-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#141622] tabular-nums">
                                                        {hrmTotalBadgeCount > 99 ? '99+' : hrmTotalBadgeCount}
                                                    </span>
                                                )}
                                                {item.id === 'Accounts' && accountsTotalBadgeCount > 0 && (
                                                    <span className="mr-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#141622] tabular-nums">
                                                        {accountsTotalBadgeCount > 99 ? '99+' : accountsTotalBadgeCount}
                                                    </span>
                                                )}
                                                {item.submenu && (
                                                    <ChevronRight
                                                        size={18}
                                                        className={`transition-transform shrink-0 ${isMenuOpen ? 'rotate-90' : ''}`}
                                                    />
                                                )}
                                            </button>
                                        )}

                                        {item.submenu && isMenuOpen && (
                                            <div className="ml-3 mt-1 space-y-0.5">
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

                                                    const subNavClass = `flex items-center w-full px-3 py-2.5 text-sm transition-colors group rounded-lg ${isLogout
                                                        ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                                                        : isSubActive
                                                            ? 'bg-[#5e6c93] !text-white font-medium shadow-sm'
                                                            : 'text-slate-100 hover:text-white hover:bg-[#252943]/80'
                                                        }`;

                                                    const subHref = !hasChildren ? getSidebarSubmenuHref(item.id, subItem) : null;

                                                    return (
                                                        <div
                                                            key={`${item.id}-${idx}`}
                                                            ref={(el) => {
                                                                if (el) {
                                                                    menuItemRefs.current[subKey] = el;
                                                                }
                                                            }}
                                                        >
                                                            {subHref ? (
                                                                <Link
                                                                    href={subHref}
                                                                    onContextMenu={(event) => handleLinkContextMenu(event, subHref)}
                                                                    className={subNavClass}
                                                                >
                                                                    <SidebarNavIcon icon={subItem.icon} active={isSubActive && !isLogout} size={17} className="mr-2.5" />
                                                                    <span className={`flex-1 text-left ${isSubActive && !isLogout ? '!text-white' : ''}`}>{subItem.label}</span>
                                                                    {getSidebarBadgeCount(item.id, subItem.label) > 0 && (
                                                                        <span className="mr-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#141622]">
                                                                            {getSidebarBadgeCount(item.id, subItem.label) > 99 ? '99+' : getSidebarBadgeCount(item.id, subItem.label)}
                                                                        </span>
                                                                    )}
                                                                    {hasChildren ? (
                                                                        <ChevronRight
                                                                            size={16}
                                                                            className={`ml-auto transition-transform ${isSubOpen ? 'rotate-90' : ''} ${isSubActive ? '!text-white' : ''}`}
                                                                        />
                                                                    ) : (
                                                                        <ChevronRight
                                                                            size={16}
                                                                            className={`ml-auto transition-opacity ${isSubActive ? 'opacity-100 !text-white' : 'opacity-0 group-hover:opacity-100'}`}
                                                                        />
                                                                    )}
                                                                </Link>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSubmenuClick(item.id, subItem)}
                                                                    className={subNavClass}
                                                                >
                                                                    <SidebarNavIcon icon={subItem.icon} active={isSubActive && !isLogout} size={17} className="mr-2.5" />
                                                                    <span className={`flex-1 text-left ${isSubActive && !isLogout ? '!text-white' : ''}`}>{subItem.label}</span>
                                                                    {getSidebarBadgeCount(item.id, subItem.label) > 0 && (
                                                                        <span className="mr-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#141622]">
                                                                            {getSidebarBadgeCount(item.id, subItem.label) > 99 ? '99+' : getSidebarBadgeCount(item.id, subItem.label)}
                                                                        </span>
                                                                    )}
                                                                    {hasChildren ? (
                                                                        <ChevronRight
                                                                            size={16}
                                                                            className={`ml-auto transition-transform ${isSubOpen ? 'rotate-90' : ''} ${isSubActive ? '!text-white' : ''}`}
                                                                        />
                                                                    ) : (
                                                                        <ChevronRight
                                                                            size={16}
                                                                            className={`ml-auto transition-opacity ${isSubActive ? 'opacity-100 !text-white' : 'opacity-0 group-hover:opacity-100'}`}
                                                                        />
                                                                    )}
                                                                </button>
                                                            )}

                                                            {hasChildren && isSubOpen && (
                                                                <div className="ml-4 mt-0.5 space-y-0.5">
                                                                    {subItem.children.map((child, childIdx) => {
                                                                        if (!isSubmenuItemVisible(child)) {
                                                                            return null;
                                                                        }
                                                                        const isChildActive = isSubmenuActive(item.id, child);
                                                                        const childIsLogout = child.label === 'Logout';
                                                                        const childNavClass = `flex items-center w-full px-3 py-2.5 text-sm transition-colors group rounded-lg ${childIsLogout
                                                                            ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                                                                            : isChildActive
                                                                                ? 'bg-[#5e6c93] !text-white font-medium shadow-sm'
                                                                                : 'text-slate-100 hover:text-white hover:bg-[#252943]/80'
                                                                            }`;
                                                                        const childHref = getSidebarSubmenuHref(item.id, child);
                                                                        return (
                                                                            <div key={`${item.id}-${idx}-${childIdx}`}>
                                                                                {childHref ? (
                                                                                    <Link
                                                                                        href={childHref}
                                                                                        onContextMenu={(event) => handleLinkContextMenu(event, childHref)}
                                                                                        className={childNavClass}
                                                                                    >
                                                                                        <SidebarNavIcon icon={child.icon} active={isChildActive && !childIsLogout} size={16} className="mr-2.5" />
                                                                                        <span className={`flex-1 text-left ${isChildActive && !childIsLogout ? '!text-white' : ''}`}>{child.label}</span>
                                                                                        {getSidebarBadgeCount(item.id, child.label) > 0 && (
                                                                                            <span className="mr-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#141622]">
                                                                                                {getSidebarBadgeCount(item.id, child.label) > 99 ? '99+' : getSidebarBadgeCount(item.id, child.label)}
                                                                                            </span>
                                                                                        )}
                                                                                    </Link>
                                                                                ) : (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleSubmenuClick(item.id, child)}
                                                                                        className={childNavClass}
                                                                                    >
                                                                                        <SidebarNavIcon icon={child.icon} active={isChildActive && !childIsLogout} size={16} className="mr-2.5" />
                                                                                        <span className={`flex-1 text-left ${isChildActive && !childIsLogout ? '!text-white' : ''}`}>{child.label}</span>
                                                                                        {getSidebarBadgeCount(item.id, child.label) > 0 && (
                                                                                            <span className="mr-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#141622]">
                                                                                                {getSidebarBadgeCount(item.id, child.label) > 99 ? '99+' : getSidebarBadgeCount(item.id, child.label)}
                                                                                            </span>
                                                                                        )}
                                                                                    </button>
                                                                                )}
                                                                            </div>
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
            <div className={`transition-all duration-300 ${isOpen ? 'ml-72' : 'ml-0'}`} />
        </>
    );
}
