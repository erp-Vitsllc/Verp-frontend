'use client';

import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import { hasAnyPermission, isAdmin, hasPermission, canAccessAddEmployee } from '@/utils/permissions';
import dynamic from 'next/dynamic';
import { apiGet } from '@/lib/api-client';
import EmployeeTable from './EmployeeTable';
import axiosInstance from '@/utils/axios';
import { deleteEmployeeDashboardNotification } from '@/utils/deleteEmployeeDashboardNotification';
import { buildEmployeeListBellFromStats, buildEmployeePageNotifications } from '@/utils/employeePageNotifications';
import {
    clearEmployeeDashboardStatsCache,
    fetchEmployeeDashboardStats,
    getCachedEmployeeDashboardStats,
} from '@/utils/employeeDashboardStatsFetch';
import { buildDashboardNotificationPath } from '@/utils/dashboardNotificationRouting';
import { mapDashboardNotificationToRow } from '@/utils/notificationInboxPresentation';
import NotificationInboxModal from '@/components/notifications/NotificationInboxModal';
import {
    getViewerEmployeeObjectIdFromStorage,
    isFlowchartHrForExpiryTasks,
} from '@/utils/flowchartHrExpiryVisibility';
import { navigateFromNotificationClick } from '@/utils/listReturnNavigation';
import { useToast } from '@/hooks/use-toast';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import { Bell } from 'lucide-react';
import { getProbationAwareDisplayStatus } from '@/utils/employeeWorkDetailsValidation';

// Dynamic imports for heavy components
const EmployeeFilters = dynamic(() => import('./EmployeeFilters'), { ssr: false });
const EmployeePagination = dynamic(() => import('./EmployeePagination'), { ssr: false });

const statusColorClasses = {
    Probation: 'bg-[#3B82F6]/15 text-[#1D4ED8]',
    Permanent: 'bg-[#10B981]/15 text-[#065F46]',
    Temporary: 'bg-[#F59E0B]/15 text-[#92400E]',
    Notice: 'bg-[#EF4444]/15 text-[#991B1B]',
    'Left User': 'bg-gray-200 text-gray-700',
};

const normalizeStatus = (status) => {
    const value = (status || '').toLowerCase();
    switch (value) {
        case 'active':
        case 'permanent':
        case 'permenent':
            return 'Permanent';
        case 'probation':
            return 'Probation';
        case 'temporary':
        case 'temp':
            return 'Temporary';
        case 'notice':
            return 'Notice';
        case 'left user':
            return 'Left User';
        default:
            return status ? status : 'Probation';
    }
};

const getEffectiveStatus = (employee) => getProbationAwareDisplayStatus(employee, normalizeStatus);

const isEmployeeIncomplete = (employee) => {
    const requiredFields = [
        'firstName', 'lastName', 'email', 'contactNumber',
        'dateOfBirth', 'gender', 'maritalStatus', 'nationality',
        'dateOfJoining', 'department', 'designation'
    ];
    return requiredFields.some(field => !employee[field]);
};

const getContractExpiry = (employee) => {
    if (!employee.visaDetails) return null;

    const visas = [
        employee.visaDetails.employment,
        employee.visaDetails.visit,
        employee.visaDetails.spouse
    ].filter(Boolean);

    if (visas.length === 0) return null;

    const expiryDates = visas
        .map(v => v.expiryDate ? new Date(v.expiryDate) : null)
        .filter(Boolean)
        .sort((a, b) => a - b);

    if (expiryDates.length === 0) return null;

    const earliestExpiry = expiryDates[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntilExpiry = Math.ceil((earliestExpiry - today) / (1000 * 60 * 60 * 24));

    return {
        date: earliestExpiry,
        daysUntilExpiry,
        formatted: earliestExpiry.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    };
};

function EmployeeListClient({ initialEmployees, initialTotal }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [mounted, setMounted] = useState(false);
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const [employees, setEmployees] = useState(initialEmployees || []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [department, setDepartment] = useState(searchParams.get('department') || '');
    const [designation, setDesignation] = useState(searchParams.get('designation') || '');
    const [jobStatus, setJobStatus] = useState(searchParams.get('status') || '');
    const [profileStatus, setProfileStatus] = useState(searchParams.get('profileStatus') || '');
    const [sortByContractExpiry, setSortByContractExpiry] = useState('');
    const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page')) || 1);
    const [itemsPerPage, setItemsPerPage] = useState(parseInt(searchParams.get('limit')) || 10);
    const [total, setTotal] = useState(initialTotal || 0);
    const [myRequestCount, setMyRequestCount] = useState(0);
    const [showNotificationsModal, setShowNotificationsModal] = useState(false);
    const [notificationItems, setNotificationItems] = useState([]);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [notificationsRefreshing, setNotificationsRefreshing] = useState(false);
    const [notificationsError, setNotificationsError] = useState('');
    const notificationItemsRef = useRef(notificationItems);
    notificationItemsRef.current = notificationItems;
    const prefetchedNotificationsRef = useRef([]);

    const buildNotificationsFromStats = useCallback((statsData, employeesList) => {
        return buildEmployeeListBellFromStats(statsData, employeesList);
    }, []);

    const applyDashboardStats = useCallback(
        (statsRes, employeesList) => {
            const built = buildNotificationsFromStats(statsRes?.data, employeesList);
            prefetchedNotificationsRef.current = built;
            setMyRequestCount(built.length);
            return built;
        },
        [buildNotificationsFromStats],
    );

    const loadMyRequestCount = useCallback(async () => {
        try {
            const res = await fetchEmployeeDashboardStats(axiosInstance);
            applyDashboardStats(res, employees);
        } catch {
            const viewerId = typeof window !== 'undefined' ? getViewerEmployeeObjectIdFromStorage() : null;
            const hrLive =
                typeof window !== 'undefined' &&
                (isAdmin() || isFlowchartHrForExpiryTasks(null, viewerId));
            setMyRequestCount(buildEmployeePageNotifications([], employees, hrLive, false).length);
        }
    }, [employees, applyDashboardStats]);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        loadMyRequestCount();
    }, [mounted, loadMyRequestCount]);

    useEffect(() => {
        const cached = getCachedEmployeeDashboardStats();
        if (!cached) return;
        const built = applyDashboardStats(cached, employees);
        if (showNotificationsModal) {
            setNotificationItems(built);
        }
    }, [employees, applyDashboardStats, showNotificationsModal]);

    const loadNotifications = useCallback(async ({ force = false } = {}) => {
        const prefetched = prefetchedNotificationsRef.current;
        if (notificationItemsRef.current.length === 0 && prefetched.length > 0) {
            setNotificationItems(prefetched);
        }

        const cachedStats = !force ? getCachedEmployeeDashboardStats() : null;
        if (cachedStats) {
            setNotificationItems(applyDashboardStats(cachedStats, employees));
            return;
        }

        const hasVisibleItems =
            notificationItemsRef.current.length > 0 || prefetchedNotificationsRef.current.length > 0;
        try {
            if (hasVisibleItems) setNotificationsRefreshing(true);
            else setNotificationsLoading(true);
            setNotificationsError('');

            const res = await fetchEmployeeDashboardStats(axiosInstance, { force });
            setNotificationItems(applyDashboardStats(res, employees));
        } catch (err) {
            const viewerId = typeof window !== 'undefined' ? getViewerEmployeeObjectIdFromStorage() : null;
            const hrLive =
                typeof window !== 'undefined' &&
                (isAdmin() || isFlowchartHrForExpiryTasks(null, viewerId));
            const fallback = buildEmployeePageNotifications([], employees, hrLive, false);
            if (notificationItemsRef.current.length === 0) {
                setNotificationItems(fallback);
            }
            setNotificationsError(err?.response?.data?.message || err?.message || 'Failed to load notifications.');
        } finally {
            setNotificationsLoading(false);
            setNotificationsRefreshing(false);
        }
    }, [employees, applyDashboardStats]);

    useEffect(() => {
        if (!showNotificationsModal) return;
        loadNotifications();
    }, [showNotificationsModal, loadNotifications]);

    const notificationRows = useMemo(
        () => notificationItems.map((item, index) => mapDashboardNotificationToRow(item, index)),
        [notificationItems],
    );

    const handleDeleteNotification = async (item) => {
        try {
            await deleteEmployeeDashboardNotification(item);
            clearEmployeeDashboardStatsCache();
            setNotificationItems((prev) => {
                if (item?.actionId) {
                    return prev.filter((x) => x.actionId !== item.actionId);
                }
                if (item?.type === 'Profile Activation' && item?.id != null) {
                    return prev.filter(
                        (x) => !(x.type === 'Profile Activation' && String(x.id) === String(item.id)),
                    );
                }
                return prev.filter(
                    (x) => `${x.type}|${x.id}|${x.extra1 || ''}` !== `${item.type}|${item.id}|${item.extra1 || ''}`,
                );
            });
            loadMyRequestCount();
            toast({ title: 'Removed', description: 'Notification removed successfully.' });
        } catch (err) {
            if (err?.code === 'NO_SERVER_DELETE_TARGET') {
                toast({
                    variant: 'destructive',
                    title: 'Cannot remove',
                    description: 'This reminder is not linked to a removable server task.',
                });
                return;
            }
            toast({
                variant: 'destructive',
                title: 'Delete failed',
                description: err?.response?.data?.message || err?.message || 'Failed to remove notification.',
            });
        }
    };

    // Debounced search
    const debouncedSearch = useMemo(() => {
        let timeoutId;
        return (value) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                setSearchQuery(value);
                setCurrentPage(1);
            }, 300);
        };
    }, []);

    // Fetch employees with optimized API call
    const fetchEmployees = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const params = {
                limit: itemsPerPage,
                page: currentPage,
                ...(searchQuery && { search: searchQuery }),
                ...(department && { department }),
                ...(designation && { designation }),
                ...(jobStatus && { status: jobStatus }),
                ...(profileStatus && { profileStatus }),
            };

            const data = await apiGet('/Employee', { params, useCache: true });
            const employeesData = data?.employees || data || [];

            const normalizedEmployees = employeesData.map(emp => {
                const effectiveStatus = getEffectiveStatus(emp);
                return {
                    ...emp,
                    status: effectiveStatus,
                    _computed: {
                        incomplete: isEmployeeIncomplete(emp),
                        contractExpiry: getContractExpiry(emp)
                    }
                };
            });

            setEmployees(normalizedEmployees);
            setTotal(
                jobStatus === 'Left User'
                    ? data?.pagination?.total || normalizedEmployees.length
                    : data?.activeRosterTotal ?? data?.pagination?.total ?? normalizedEmployees.length,
            );
        } catch (err) {
            if (err.response?.status === 401 || err.response?.status === 403) {
                setError('');
                setEmployees([]);
            } else {
                setError(err.response?.data?.message || err.message || 'Failed to fetch employees');
            }
        } finally {
            setLoading(false);
        }
    }, [searchQuery, department, designation, jobStatus, profileStatus, currentPage, itemsPerPage]);

    // Fetch when filters change
    useEffect(() => {
        if (mounted) {
            fetchEmployees();
        }
    }, [mounted, fetchEmployees]);

    // Update URL when filters change (for shareable URLs)
    useEffect(() => {
        if (!mounted) return;

        const params = new URLSearchParams();
        if (searchQuery) params.set('search', searchQuery);
        if (department) params.set('department', department);
        if (designation) params.set('designation', designation);
        if (jobStatus) params.set('status', jobStatus);
        if (profileStatus) params.set('profileStatus', profileStatus);
        if (currentPage > 1) params.set('page', currentPage);
        if (itemsPerPage !== 10) params.set('limit', itemsPerPage);

        const newUrl = params.toString() ? `?${params.toString()}` : '/emp';
        router.replace(newUrl, { scroll: false });
    }, [searchQuery, department, designation, jobStatus, profileStatus, currentPage, itemsPerPage, mounted, router]);

    // Memoized filtered employees
    const filteredEmployees = useMemo(() => {
        let result = [...employees];

        if (sortByContractExpiry === 'asc') {
            result.sort((a, b) => {
                const aExpiry = a._computed?.contractExpiry?.date;
                const bExpiry = b._computed?.contractExpiry?.date;
                if (!aExpiry && !bExpiry) return 0;
                if (!aExpiry) return 1;
                if (!bExpiry) return -1;
                return aExpiry - bExpiry;
            });
        } else if (sortByContractExpiry === 'desc') {
            result.sort((a, b) => {
                const aExpiry = a._computed?.contractExpiry?.date;
                const bExpiry = b._computed?.contractExpiry?.date;
                if (!aExpiry && !bExpiry) return 0;
                if (!aExpiry) return 1;
                if (!bExpiry) return -1;
                return bExpiry - aExpiry;
            });
        }

        return result;
    }, [employees, sortByContractExpiry]);

    // Pagination
    const { totalPages, currentPageData } = useMemo(() => {
        const totalPagesCount = Math.max(1, Math.ceil(filteredEmployees.length / itemsPerPage));
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageData = filteredEmployees.slice(start, end);

        return {
            totalPages: totalPagesCount,
            currentPageData: pageData,
        };
    }, [filteredEmployees, itemsPerPage, currentPage]);

    // Status counts
    const statusCounts = useMemo(() => {
        const roster = employees.filter((e) => e.status !== 'Left User');
        return {
            permanent: roster.filter(e => e.status === 'Permanent').length,
            notice: roster.filter(e => e.status === 'Notice').length,
            probation: roster.filter(e => e.status === 'Probation').length,
            temporary: roster.filter(e => e.status === 'Temporary').length,
        };
    }, [employees]);

    const canViewProfile = mounted && (isAdmin() || hasPermission('hrm_employees_view', 'isActive'));

    if (!mounted) {
        return (
            <PermissionGuard moduleId="hrm_employees_list" permissionType="view">
                <div className="flex min-h-screen" style={{ backgroundColor: '#F2F6F9' }}>
                    <Sidebar />
                    <div className="flex-1 flex flex-col">
                        <Navbar />
                        <div className="p-8" style={{ backgroundColor: '#F2F6F9' }}>
                            <div className="animate-pulse">Loading...</div>
                        </div>
                    </div>
                </div>
            </PermissionGuard>
        );
    }

    return (
        <PermissionGuard moduleId="hrm_employees_list" permissionType="view">
            <div className="flex min-h-screen" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col">
                    <Navbar />
                    <div className="p-8" style={{ backgroundColor: '#F2F6F9' }}>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800 mb-2">Employees</h1>
                                <p className="text-gray-600">
                                    {statusCounts.permanent} Permanent | {statusCounts.notice} Notice
                                </p>
                            </div>

                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (prefetchedNotificationsRef.current.length > 0) {
                                            setNotificationItems(prefetchedNotificationsRef.current);
                                        }
                                        setShowNotificationsModal(true);
                                    }}
                                    className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors bg-white shadow-sm border border-gray-800/20"
                                    title="My request notifications"
                                >
                                    <Bell size={18} />
                                    {myRequestCount > 0 && (
                                        <span className="absolute -top-2 -right-2 z-10 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                                            {myRequestCount > 99 ? '99+' : myRequestCount}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`p-2 hover:bg-gray-100 rounded-lg transition-colors bg-white shadow-sm border border-gray-800/20 ${showFilters ? 'bg-gray-100' : ''}`}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                                    </svg>
                                </button>

                                <div className="relative flex-1 max-w-md">
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                    >
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <path d="m21 21-4.35-4.35"></path>
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search"
                                        defaultValue={searchQuery}
                                        onChange={(e) => debouncedSearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-800/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                    />
                                </div>

                                {canAccessAddEmployee() && (
                                    <Link
                                        href="/emp/add-employee"
                                        className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="8.5" cy="7" r="4"></circle>
                                            <line x1="20" y1="8" x2="20" y2="14"></line>
                                            <line x1="23" y1="11" x2="17" y2="11"></line>
                                        </svg>
                                        Add New Employee
                                    </Link>
                                )}
                            </div>
                        </div>

                        {/* Filters */}
                        {showFilters && <EmployeeFilters
                            department={department}
                            setDepartment={setDepartment}
                            designation={designation}
                            setDesignation={setDesignation}
                            jobStatus={jobStatus}
                            setJobStatus={setJobStatus}
                            profileStatus={profileStatus}
                            setProfileStatus={setProfileStatus}
                            sortByContractExpiry={sortByContractExpiry}
                            setSortByContractExpiry={setSortByContractExpiry}
                        />}

                        {/* Error State */}
                        {error && <ErpErrorBanner className="mb-4" />}

                        {/* Loading State */}
                        {loading && (
                            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                                <p className="mt-4 text-gray-600">Loading employees...</p>
                            </div>
                        )}

                        {/* Employee Table */}
                        {!loading && (
                            <EmployeeTable
                                employees={currentPageData}
                                canViewProfile={canViewProfile}
                                startIndex={startIndex}
                            />
                        )}

                        {/* Pagination */}
                        {!loading && totalPages > 1 && (
                            <EmployeePagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                itemsPerPage={itemsPerPage}
                                totalItems={filteredEmployees.length}
                                onPageChange={setCurrentPage}
                                onItemsPerPageChange={setItemsPerPage}
                            />
                        )}
                    </div>
                </div>
            </div>

            <NotificationInboxModal
                isOpen={showNotificationsModal}
                onClose={() => setShowNotificationsModal(false)}
                subtitle="Profile activations, company activations, and pending items."
                items={notificationRows}
                loading={notificationsLoading && notificationItems.length === 0}
                refreshing={notificationsRefreshing}
                error={notificationsError}
                onItemClick={(item) => {
                    const path = buildDashboardNotificationPath(item);
                    if (path) {
                        navigateFromNotificationClick(router, path);
                        setShowNotificationsModal(false);
                    }
                }}
                getItemHref={(item) => buildDashboardNotificationPath(item) || ''}
                onDelete={isAdmin() ? handleDeleteNotification : undefined}
            />
        </PermissionGuard>
    );
}

export default memo(EmployeeListClient);

