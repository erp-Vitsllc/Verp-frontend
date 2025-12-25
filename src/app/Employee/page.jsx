'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import { hasAnyPermission, isAdmin, hasPermission } from '@/utils/permissions';
import axiosInstance from '@/utils/axios';

export default function Employee() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [department, setDepartment] = useState('');
    const [designation, setDesignation] = useState('');
    const [jobStatus, setJobStatus] = useState('');
    const [profileStatus, setProfileStatus] = useState('');
    const [sortByContractExpiry, setSortByContractExpiry] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

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

    // Compute the effective status taking probation dates into account.
    // If joining date + probation period is already in the past,
    // we treat the employee as Permanent immediately (even if backend still says Probation).
    const getEffectiveStatus = (employee) => {
        const baseStatus = normalizeStatus(employee.status);

        if (
            baseStatus === 'Probation' &&
            employee.dateOfJoining &&
            employee.probationPeriod
        ) {
            try {
                const joiningDate = new Date(employee.dateOfJoining);
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
                // If anything goes wrong with dates, just fall back to baseStatus
            }
        }

        return baseStatus;
    };

    // Set mounted state after component mounts (client-side only)
    useEffect(() => {
        setMounted(true);
    }, []);

    // Request deduplication - prevent multiple simultaneous calls
    const fetchingRef = useRef(false);
    
    // Fetch employees from backend - memoized to prevent unnecessary re-renders
    const fetchEmployees = useCallback(async () => {
        // Prevent duplicate calls
        if (fetchingRef.current) {
            return;
        }
        
        try {
            fetchingRef.current = true;
            setLoading(true);
            setError('');

            const response = await axiosInstance.get('/Employee', {
                params: { limit: 200 }, // Reduced limit for better performance
            });

            // Handle response - employees can be an array or empty
            // Empty data is not an error, just means no employees exist
            const employeesData = response.data?.employees || response.data || [];

            // If it's an array, normalize it (even if empty)
            if (Array.isArray(employeesData)) {
                const normalizedEmployees = employeesData.map(emp => {
                    const effectiveStatus = getEffectiveStatus(emp);
                    return {
                        ...emp,
                        status: effectiveStatus
                    };
                });
                setEmployees(normalizedEmployees);
            } else {
                // If it's not an array, set empty array (no employees)
                setEmployees([]);
            }
        } catch (err) {
            // Handle different error types
            // Check if it's an authentication error (401/403) - these should redirect (handled by interceptor)
            if (err.response?.status === 401 || err.response?.status === 403) {
                // Authentication error - interceptor will handle redirect
                // Just set empty array and no error message
                setError('');
                setEmployees([]);
            } else if (err.response?.status === 404) {
                // Not found - just means no employees exist (not an error)
                setEmployees([]);
                setError('');
            } else if (err.response?.status >= 500) {
                // Server errors
                setError('Server error. Please try again later.');
                setEmployees([]);
                console.error('Server error fetching employees:', err);
            } else {
                // Network errors or other issues
                // Only show error if it's a real connection problem
                if (err.message?.includes('Network') || err.message?.includes('timeout')) {
                    setError('Error connecting to server. Please check if the backend is running.');
                } else {
                    // Other errors - just show empty state (no employees)
                    setError('');
                }
                setEmployees([]);
                console.error('Error fetching employees:', err);
            }
        } finally {
            setLoading(false);
            fetchingRef.current = false;
        }
    }, []);

    // Fetch employees from backend - use ref to prevent duplicate calls in Strict Mode
    const hasFetchedRef = useRef(false);
    
    useEffect(() => {
        if (!hasFetchedRef.current) {
            hasFetchedRef.current = true;
            fetchEmployees();
        }
    }, []); // Empty deps - only run once on mount

    // Helper function to get contract expiry date for sorting
    const getContractExpiryDate = (employee) => {
        if (employee?.nationality?.toLowerCase() === 'uae') {
            return null; // UAE nationals don't have expiry
        }
        const expiryDate =
            employee?.visaDetails?.employment?.expiryDate ||
            employee?.visaDetails?.visit?.expiryDate ||
            employee?.visaDetails?.spouse?.expiryDate ||
            employee?.visaExp;
        if (!expiryDate) return null;
        const expiry = new Date(expiryDate);
        return Number.isNaN(expiry.getTime()) ? null : expiry;
    };

    // Helper functions for checking employee details (must be defined before useCallback hooks)
    const hasAddressDetails = (employee) => {
        const permanentFilled = [
            employee.addressLine1,
            employee.addressLine2,
            employee.city,
            employee.state,
            employee.country,
            employee.postalCode
        ].some(Boolean);

        const currentFilled = [
            employee.currentAddressLine1,
            employee.currentAddressLine2,
            employee.currentCity,
            employee.currentState,
            employee.currentCountry,
            employee.currentPostalCode
        ].some(Boolean);

        return permanentFilled && currentFilled;
    };

    const hasPersonalDetails = (employee) => (
        employee.email &&
        employee.contactNumber &&
        employee.dateOfBirth &&
        employee.gender &&
        (employee.nationality || employee.country)
    );

    const hasPassportDetails = (employee) => (
        employee.passportDetails?.number &&
        employee.passportDetails?.issueDate &&
        employee.passportDetails?.expiryDate
    );

    const hasVisaDetails = (employee) => (
        employee.visaDetails?.employment?.number ||
        employee.visaDetails?.visit?.number ||
        employee.visaDetails?.spouse?.number
    );

    const hasContactDetails = (employee) => {
        if (Array.isArray(employee?.emergencyContacts) && employee.emergencyContacts.length > 0) {
            return true;
        }
        return Boolean(
            employee?.emergencyContactName ||
            employee?.emergencyContactRelation ||
            employee?.emergencyContactNumber
        );
    };

    // Memoize isEmployeeIncomplete to avoid recreating function on every render
    const isEmployeeIncomplete = useCallback((employee) => {
        if (employee.status !== 'Probation') {
            return false;
        }

        const requirements = [
            hasPassportDetails(employee),
            hasVisaDetails(employee),
            hasPersonalDetails(employee),
            hasContactDetails(employee),
            hasAddressDetails(employee)
        ];

        return requirements.some(req => !req);
    }, []);

    // Memoize getContractExpiry to avoid recreating function on every render
    const getContractExpiry = useCallback((employee) => {
        // Check visaDetails first (if populated)
        let expiryDate = null;
        
        if (employee?.visaDetails) {
            expiryDate = 
                employee.visaDetails.employment?.expiryDate ||
                employee.visaDetails.visit?.expiryDate ||
                employee.visaDetails.spouse?.expiryDate;
        }
        
        // Fallback to visaExp field if visaDetails not populated
        if (!expiryDate) {
            expiryDate = employee?.visaExp;
        }
        
        // If still no expiry date, check if visa exists but expiry is missing
        if (!expiryDate) {
            // Check if any visa exists (has number but no expiry date)
            const hasVisaNumber = 
                employee?.visaDetails?.employment?.number ||
                employee?.visaDetails?.visit?.number ||
                employee?.visaDetails?.spouse?.number;
            
            if (hasVisaNumber) {
                // Visa exists but no expiry date - return a message
                return 'Visa (No Expiry)';
            }
            return 'No Visa';
        }
        
        // Parse and validate the expiry date
        const expiry = new Date(expiryDate);
        if (Number.isNaN(expiry.getTime())) {
            return 'No Visa';
        }
        
        // Calculate days difference
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expiry.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        return `${diffDays} days`;
    }, []);

    const filteredEmployees = useMemo(() => {
        let result = employees.filter(emp => {
            const matchesSearch = !searchQuery ||
                `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
                emp.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                emp.email?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesDepartment = !department || emp.department === department;
            const matchesDesignation = !designation || emp.designation === designation;
            const matchesJobStatus = !jobStatus || normalizeStatus(emp.status) === jobStatus;
            const matchesProfileStatus = !profileStatus || (emp.profileStatus || 'inactive').toLowerCase() === profileStatus.toLowerCase();

            return matchesSearch && matchesDepartment && matchesDesignation && matchesJobStatus && matchesProfileStatus;
        });

        // Sort by contract expiry if selected
        if (sortByContractExpiry) {
            result = [...result].sort((a, b) => {
                const dateA = getContractExpiryDate(a);
                const dateB = getContractExpiryDate(b);

                // Handle null values (UAE nationals or no visa)
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1; // Put nulls at the end
                if (!dateB) return -1;

                return sortByContractExpiry === 'asc' ? dateA - dateB : dateB - dateA;
            });
        }

        return result;
    }, [employees, searchQuery, department, designation, jobStatus, profileStatus, sortByContractExpiry]);

    // Pagination calculations with pre-computed expensive values
    const { totalItems, totalPages, startIndex, endIndex, currentPageData } = useMemo(() => {
        const totalItemsCount = filteredEmployees.length;
        const totalPagesCount = Math.max(1, Math.ceil(totalItemsCount / itemsPerPage));
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageData = filteredEmployees.slice(start, end);
        
        // Pre-compute expensive calculations for each employee in current page
        const enrichedPageData = pageData.map(employee => ({
            ...employee,
            _computed: {
                incomplete: isEmployeeIncomplete(employee),
                contractExpiry: getContractExpiry(employee)
            }
        }));
        
        return {
            totalItems: totalItemsCount,
            totalPages: totalPagesCount,
            startIndex: start,
            endIndex: end,
            currentPageData: enrichedPageData,
        };
    }, [filteredEmployees, itemsPerPage, currentPage, isEmployeeIncomplete, getContractExpiry]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, department, designation, jobStatus, profileStatus, sortByContractExpiry, itemsPerPage]);

    const departmentOptions = [
        { value: 'admin', label: 'Administration' },
        { value: 'hr', label: 'Human Resources' },
        { value: 'it', label: 'IT' }
    ];

    const designationOptions = [
        { value: 'manager', label: 'Manager' },
        { value: 'developer', label: 'Developer' },
        { value: 'hr-manager', label: 'HR Manager' }
    ];

    // Calculate incomplete employees (missing required fields) - helper functions moved above

    // Memoize incomplete employees calculation
    const incompleteEmployees = useMemo(() => {
        return employees.filter(isEmployeeIncomplete);
    }, [employees, isEmployeeIncomplete]);

    // Memoize status counts to avoid filtering on every render
    const statusCounts = useMemo(() => {
        return {
            permanent: employees.filter(e => e.status === 'Permanent').length,
            notice: employees.filter(e => e.status === 'Notice').length
        };
    }, [employees]);

    const onViewAll = () => {
        // Filter to show only incomplete employees
        setSearchQuery('');
        // You can add additional logic here to filter or navigate
    };

    const getInitials = (firstName, lastName) => {
        return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
    };

    const capitalizeFirstLetter = (str) => {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    const formatDesignation = (str) => {
        if (!str) return '';
        // Replace hyphens with spaces and split by spaces
        return str
            .replace(/-/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    };

    // Check permission before rendering
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const token = localStorage.getItem('token');
        if (!token) {
            router.replace('/login');
            return;
        }

        // Check if user has permission to view employees
        if (!isAdmin() && !hasAnyPermission('hrm_employees_list')) {
            // Redirect to dashboard if no permission
            router.replace('/dashboard');
        }
    }, [router]);

    // Don't render if user doesn't have permission (will redirect)
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (!token) {
            return null;
        }
        if (!isAdmin() && !hasAnyPermission('hrm_employees_list')) {
            return null; // Will redirect via useEffect
        }
    }

    return (
        <PermissionGuard moduleId="hrm_employees_list" permissionType="view">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                        {/* Header and Actions in Single Row */}
                        <div className="flex items-center justify-between mb-6">
                            {/* Left Side - Header */}
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800 mb-2">Employees</h1>
                                <p className="text-gray-600">
                                    {statusCounts.permanent} Permanent | {statusCounts.notice} Notice
                                </p>
                            </div>

                            {/* Right Side - Actions Bar */}
                            <div className="flex items-center gap-4">
                                {/* Filter Icon */}
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`p-2 hover:bg-gray-100 rounded-lg transition-colors bg-white shadow-sm border border-gray-800/20 ${showFilters ? 'bg-gray-100' : ''}`}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                                    </svg>
                                </button>

                                {/* Search */}
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
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-800/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                    />
                                </div>

                                {/* Add New Employee Button - Teal - Only show if user has permission (after mount to prevent hydration mismatch) */}
                                {mounted && (isAdmin() || hasPermission('hrm_employees_add', 'isCreate')) && (
                                    <Link
                                        href="/Employee/add-employee"
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

                        {/* Filter Panel */}
                        {showFilters && (
                            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <span className="text-sm font-medium text-gray-700">Filter by</span>

                                    {/* Department Dropdown */}
                                    <div className="relative">
                                        <select
                                            value={department}
                                            onChange={(e) => setDepartment(e.target.value)}
                                            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white appearance-none pr-8 cursor-pointer"
                                        >
                                            <option value="">Select Department</option>
                                            {departmentOptions.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                                        >
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </div>

                                    {/* Designation Dropdown */}
                                    <div className="relative">
                                        <select
                                            value={designation}
                                            onChange={(e) => setDesignation(e.target.value)}
                                            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white appearance-none pr-8 cursor-pointer"
                                        >
                                            <option value="">Select Designation</option>
                                            {designationOptions.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                                        >
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </div>

                                    {/* Job Status Filter */}
                                    <div className="relative">
                                        <select
                                            value={jobStatus}
                                            onChange={(e) => setJobStatus(e.target.value)}
                                            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white appearance-none pr-8 cursor-pointer"
                                        >
                                            <option value="">All Job Status</option>
                                            <option value="Probation">Probation</option>
                                            <option value="Permanent">Permanent</option>
                                            <option value="Temporary">Temporary</option>
                                            <option value="Notice">Notice</option>
                                        </select>
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                                        >
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </div>

                                    {/* Profile Status Filter */}
                                    <div className="relative">
                                        <select
                                            value={profileStatus}
                                            onChange={(e) => setProfileStatus(e.target.value)}
                                            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white appearance-none pr-8 cursor-pointer"
                                        >
                                            <option value="">All Profile Status</option>
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                                        >
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </div>

                                    {/* Sort by Contract Expiry */}
                                    <div className="relative">
                                        <select
                                            value={sortByContractExpiry}
                                            onChange={(e) => setSortByContractExpiry(e.target.value)}
                                            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white appearance-none pr-8 cursor-pointer"
                                        >
                                            <option value="">Sort by Contract Expiry</option>
                                            <option value="asc">Expiring Soon (Oldest First)</option>
                                            <option value="desc">Expiring Later (Newest First)</option>
                                        </select>
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                                        >
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </div>

                                    {/* Clear Filters Button */}
                                    {(department || designation || jobStatus || profileStatus || sortByContractExpiry) && (
                                        <button
                                            onClick={() => {
                                                setDepartment('');
                                                setDesignation('');
                                                setJobStatus('');
                                                setProfileStatus('');
                                                setSortByContractExpiry('');
                                            }}
                                            className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                                        >
                                            Clear Filters
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Incomplete Employees Alert Banner */}
                        {incompleteEmployees.length > 0 && (
                            <div className="bg-red-100 px-4 py-3 mb-6 flex items-center gap-3 rounded">
                                {/* Circular Red Icon with Exclamation Mark Symbol */}
                                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="white"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        {/* Exclamation mark (!) */}
                                        <line x1="12" y1="5" x2="12" y2="14"></line>
                                        <circle cx="12" cy="20" r="1" fill="white"></circle>
                                    </svg>
                                </div>
                                {/* Text with inline link */}
                                <span className="text-gray-800 text-sm">
                                    You have {incompleteEmployees.length} probationary employee
                                    {incompleteEmployees.length !== 1 ? "s" : ""} missing mandatory onboarding information.
                                </span>
                            </div>
                        )}

                        {/* Employee Table */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full">
                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full min-w-0 table-auto">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                NAME
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                DEPARTMENT
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                EMP. ID
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                CONTRACT EXPIRY
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                JOB STATUS
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                PROFILE STATUS
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                                                    Loading employees...
                                                </td>
                                            </tr>
                                        ) : filteredEmployees.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                                                    No employees found
                                                </td>
                                            </tr>
                                        ) : (
                                            currentPageData.map((employee, index) => {
                                                // Use pre-computed values from memoization
                                                const incomplete = employee._computed?.incomplete ?? isEmployeeIncomplete(employee);
                                                const contractExpiry = employee._computed?.contractExpiry ?? getContractExpiry(employee);
                                                const rowKey = employee._id || employee.employeeId || `employee-${index}`;
                                                const profileStatusValue = (employee.profileStatus || 'inactive').toLowerCase();
                                                const profileStatusLabel = profileStatusValue === 'active' ? 'Active' : 'Inactive';
                                                const profileStatusClass = profileStatusValue === 'active'
                                                    ? 'bg-green-50 text-green-700 border-green-200'
                                                    : 'bg-gray-100 text-gray-500 border-gray-200';
                                                // Check if user has permission to view employee profile (only after mount)
                                                const canViewProfile = mounted && (isAdmin() || hasPermission('hrm_employees_view', 'isActive'));

                                                return (
                                                    <tr
                                                        key={rowKey}
                                                        className={`hover:bg-gray-50 transition-colors ${canViewProfile ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                                                        onClick={canViewProfile ? () => router.push(`/Employee/${employee._id || employee.employeeId}`) : undefined}
                                                    >
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center gap-3">
                                                                {employee.profilePicture || employee.profilePic || employee.avatar ? (
                                                                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 relative bg-gray-200">
                                                                        <Image
                                                                            src={employee.profilePicture || employee.profilePic || employee.avatar}
                                                                            alt={`${employee.firstName} ${employee.lastName}`}
                                                                            width={40}
                                                                            height={40}
                                                                            className="object-cover w-full h-full"
                                                                            unoptimized
                                                                            onError={(e) => {
                                                                                // Hide image and show fallback
                                                                                e.target.style.display = 'none';
                                                                                const fallback = e.target.parentElement?.querySelector('.fallback-initials');
                                                                                if (fallback) fallback.style.display = 'flex';
                                                                            }}
                                                                        />
                                                                        <div className="fallback-initials w-10 h-10 rounded-full bg-gradient-to-br from-yellow-300 via-blue-300 to-red-300 flex items-center justify-center text-gray-700 font-semibold text-sm absolute inset-0" style={{ display: 'none' }}>
                                                                            {getInitials(employee.firstName, employee.lastName)}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-300 via-blue-300 to-red-300 flex items-center justify-center text-gray-700 font-semibold text-sm flex-shrink-0">
                                                                        {getInitials(employee.firstName, employee.lastName)}
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center gap-2">
                                                                    <div>
                                                                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                                                                            {capitalizeFirstLetter(employee.firstName)} {capitalizeFirstLetter(employee.lastName)}
                                                                            {incomplete && (
                                                                                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                                                                                    <svg
                                                                                        width="12"
                                                                                        height="12"
                                                                                        viewBox="0 0 24 24"
                                                                                        fill="none"
                                                                                        stroke="white"
                                                                                        strokeWidth="3"
                                                                                        strokeLinecap="round"
                                                                                        strokeLinejoin="round"
                                                                                    >
                                                                                        {/* Exclamation mark (!) */}
                                                                                        <line x1="12" y1="5" x2="12" y2="14"></line>
                                                                                        <circle cx="12" cy="20" r="1" fill="white"></circle>
                                                                                    </svg>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-sm text-gray-500">{formatDesignation(employee.role || employee.designation || 'Employee')}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                            {employee.department ? employee.department.toUpperCase() : 'N/A'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                            {employee.employeeId || 'N/A'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                            {contractExpiry}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColorClasses[employee.status] || 'bg-gray-100 text-gray-700'}`}>
                                                                {employee.status || 'Probation'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className={`px-4 py-1 rounded-full text-xs font-semibold border ${profileStatusClass}`}>
                                                                {profileStatusLabel}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                            {canViewProfile ? (
                                                                <Link
                                                                    href={`/Employee/${employee._id || employee.employeeId}`}
                                                                    className="inline-flex items-center text-gray-400 hover:text-gray-600"
                                                                >
                                                                    <span className="sr-only">View Details</span>
                                                                    <svg
                                                                        width="20"
                                                                        height="20"
                                                                        viewBox="0 0 24 24"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        strokeWidth="2"
                                                                    >
                                                                        <polyline points="9 18 15 12 9 6"></polyline>
                                                                    </svg>
                                                                </Link>
                                                            ) : (
                                                                <span className="inline-flex items-center text-gray-300 cursor-not-allowed" title="You don't have permission to view employee profiles">
                                                                    <svg
                                                                        width="20"
                                                                        height="20"
                                                                        viewBox="0 0 24 24"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        strokeWidth="2"
                                                                    >
                                                                        <polyline points="9 18 15 12 9 6"></polyline>
                                                                    </svg>
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            {filteredEmployees.length > 0 && (
                                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-600">Show</span>
                                            <select
                                                value={itemsPerPage}
                                                onChange={(e) => {
                                                    setItemsPerPage(Number(e.target.value));
                                                    setCurrentPage(1);
                                                }}
                                                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="5">5</option>
                                                <option value="10">10</option>
                                                <option value="20">20</option>
                                                <option value="50">50</option>
                                                <option value="100">100</option>
                                            </select>
                                            <span className="text-sm text-gray-600">per page</span>
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} employees
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className={`px-3 py-1 rounded-lg text-sm bg-gray-200 text-blue-600 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'
                                                }`}
                                        >
                                            &lt;
                                        </button>

                                        {/* Page Numbers */}
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (currentPage <= 3) {
                                                pageNum = i + 1;
                                            } else if (currentPage >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = currentPage - 2 + i;
                                            }

                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setCurrentPage(pageNum)}
                                                    className={`px-3 py-1 rounded-lg text-sm border ${currentPage === pageNum
                                                        ? 'bg-blue-500 text-white border-blue-500'
                                                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}

                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                            className={`px-3 py-1 rounded-lg text-sm bg-gray-200 text-blue-600 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'
                                                }`}
                                        >
                                            &gt;
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
