'use client';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import { hasAnyPermission, isAdmin, hasPermission } from '@/utils/permissions';
import dynamic from 'next/dynamic';
import { apiGet } from '@/lib/api-client';
import EmployeeTable from './EmployeeTable';

// Dynamic imports for heavy components
const EmployeeFilters = dynamic(() => import('./EmployeeFilters'), { ssr: false });
const EmployeePagination = dynamic(() => import('./EmployeePagination'), { ssr: false });

const statusColorClasses = {
    Probation: 'bg-[#3B82F6]/15 text-[#1D4ED8]',
    Permanent: 'bg-[#10B981]/15 text-[#065F46]',
    Temporary: 'bg-[#F59E0B]/15 text-[#92400E]',
    Notice: 'bg-[#EF4444]/15 text-[#991B1B]'
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
        default:
            return status ? status : 'Probation';
    }
};

const getEffectiveStatus = (employee) => {
    const baseStatus = normalizeStatus(employee.status);
    const startRef = employee.contractJoiningDate || employee.dateOfJoining;

    if (
        baseStatus === 'Probation' &&
        startRef &&
        employee.probationPeriod
    ) {
        try {
            const joiningDate = new Date(startRef);
            const probationEndDate = new Date(joiningDate);
            probationEndDate.setMonth(
                probationEndDate.getMonth() + Number(employee.probationPeriod || 0)
            );

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            probationEndDate.setHours(0, 0, 0, 0);

            if (probationEndDate <= today) {
                return 'Permanent';
            }
        } catch {
            // Fallback to baseStatus
        }
    }

    return baseStatus;
};

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

    useEffect(() => {
        setMounted(true);
    }, []);

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
            setTotal(data?.pagination?.total || normalizedEmployees.length);
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
        return {
            permanent: employees.filter(e => e.status === 'Permanent').length,
            notice: employees.filter(e => e.status === 'Notice').length,
            probation: employees.filter(e => e.status === 'Probation').length,
            temporary: employees.filter(e => e.status === 'Temporary').length,
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

                                {(isAdmin() || hasPermission('hrm_employees_add', 'isCreate')) && (
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
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                                {error}
                            </div>
                        )}

                        {/* Loading State */}
                        {loading && (
                            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                                <p className="mt-4 text-gray-600">Loading employees...</p>
                            </div>
                        )}

                        {/* Employee Table */}
                        {!loading && <EmployeeTable employees={currentPageData} canViewProfile={canViewProfile} />}

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
        </PermissionGuard>
    );
}

export default memo(EmployeeListClient);

