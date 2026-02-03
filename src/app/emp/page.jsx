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
import { Trash2, Users, Building, UserCheck, UserMinus, ShieldAlert, Award, FileText, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Country } from 'country-state-city';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
    Legend, LabelList
} from 'recharts';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Pie } from 'react-chartjs-2';

// Register ChartJS components immediately
ChartJS.register(ArcElement, ChartTooltip, ChartLegend);
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";



const AnimatedCounter = ({ value, duration = 600 }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime;
        let animationFrame;

        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;

            if (progress < duration) {
                const percentage = progress / duration;
                // Ease out quart for fast start and smooth end
                const easeOut = 1 - Math.pow(1 - percentage, 4);
                setCount(Math.floor(easeOut * value));
                animationFrame = requestAnimationFrame(animate);
            } else {
                setCount(value);
            }
        };

        animationFrame = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animationFrame);
    }, [value, duration]);

    return <>{count}</>;
};

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
    const [gender, setGender] = useState('');
    const [sortByContractExpiry, setSortByContractExpiry] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const { toast } = useToast();
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [employeeToDelete, setEmployeeToDelete] = useState(null);

    // Document Expiry Modal State
    const [docModalOpen, setDocModalOpen] = useState(false);
    const [selectedDocBucket, setSelectedDocBucket] = useState('');
    const [selectedDocList, setSelectedDocList] = useState([]);



    const resetFilters = () => {
        setDepartment('');
        setDesignation('');
        setJobStatus('');
        setProfileStatus('');
        setGender('');
        setSearchQuery('');
    };

    // Nationality Modal State
    const [natModalOpen, setNatModalOpen] = useState(false);
    const [selectedNatLabel, setSelectedNatLabel] = useState('');
    const [selectedNatList, setSelectedNatList] = useState([]);

    const [isDeleting, setIsDeleting] = useState(false);

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

    // Register ChartJS components


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
            const matchesGender = !gender || (emp.gender || '').toLowerCase() === gender.toLowerCase();

            return matchesSearch && matchesDepartment && matchesDesignation && matchesJobStatus && matchesProfileStatus && matchesGender;
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
    }, [employees, searchQuery, department, designation, jobStatus, profileStatus, gender, sortByContractExpiry]);

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

    const stats = useMemo(() => {
        const total = employees.length;
        const male = employees.filter(e => (e.gender || '').toLowerCase() === 'male').length;
        const female = employees.filter(e => (e.gender || '').toLowerCase() === 'female').length;
        const active = employees.filter(e => (e.profileStatus || 'inactive').toLowerCase() === 'active').length;
        const inactive = employees.filter(e => (e.profileStatus || 'inactive').toLowerCase() === 'inactive').length;

        const probation = employees.filter(e => e.status === 'Probation').length;
        const permanent = employees.filter(e => e.status === 'Permanent').length;
        const notice = employees.filter(e => e.status === 'Notice').length;

        const companies = new Set(employees.map(e => e.companyName || e.company || 'Standard')).size;

        // Nationality Data for Pie Chart
        const nationalities = {};

        const normalizeNationality = (input) => {
            if (!input) return 'Other';
            const trimmed = input.trim();
            const byCode = Country.getCountryByCode(trimmed.toUpperCase());
            if (byCode) return byCode.name;
            return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
        };

        employees.forEach(e => {
            const raw = e.nationality || e.country;
            const n = normalizeNationality(raw);
            if (!nationalities[n]) nationalities[n] = [];
            nationalities[n].push({
                name: `${e.firstName} ${e.lastName}`,
                id: e.employeeId,
                designation: e.designation?.name || 'N/A',
                _id: e._id,
                department: e.department?.name || 'N/A'
            });
        });

        const sortedNationalities = Object.entries(nationalities)
            .map(([name, list]) => ({ name, value: list.length, list }))
            .sort((a, b) => b.value - a.value);

        const generateColors = (count) => {
            const baseColors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];
            const colors = [];
            for (let i = 0; i < count; i++) {
                colors.push(baseColors[i % baseColors.length]);
            }
            return colors;
        };

        const nationalityChartData = {
            labels: sortedNationalities.map(n => n.name),
            datasets: [
                {
                    data: sortedNationalities.map(n => n.value),
                    backgroundColor: generateColors(sortedNationalities.length),
                    borderWidth: 0,
                    // Store the full lists in the dataset metadata or handle via index lookup
                    lists: sortedNationalities.map(n => n.list)
                },
            ],
        };

        // Document Expiry Data for Bar Chart
        const buckets = {
            '1 Wk': [],
            '2 Wk': [],
            '3 Wk': [],
            '30 D': [],
            '60 D': [],
            '90 D': [],
            'More': []
        };

        const today = new Date();
        employees.forEach(emp => {
            const documentDates = [];

            // Helper to collect dates
            // Helper to collect dates with metadata
            const collect = (d, type, docName) => {
                if (d) {
                    documentDates.push({
                        date: new Date(d),
                        type: type || 'Document',
                        name: docName || type || 'Document',
                        empId: emp.employeeId,
                        empName: `${emp.firstName} ${emp.lastName}`,
                        _id: emp._id
                    });
                }
            };

            // 1. Passport (prefer detailed object, fallback to root field)
            collect(emp.passportDetails?.expiryDate || emp.passportExp, 'Passport');

            // 2. Emirates ID
            collect(emp.eidExp, 'Emirates ID');

            // 3. Medical Insurance
            collect(emp.medExp, 'Medical Insurance');

            // 4. Labour Card
            collect(emp.labourCardExp, 'Labour Card');

            // 5. Visa (Check all types)
            if (emp.visaDetails) {
                collect(emp.visaDetails.employment?.expiryDate, 'Visa', 'Employment Visa');
                collect(emp.visaDetails.visit?.expiryDate, 'Visa', 'Visit Visa');
                collect(emp.visaDetails.spouse?.expiryDate, 'Visa', 'Spouse Visa');
            } else {
                // Fallback to legacy field if no detailed visa object
                collect(emp.visaExp, 'Visa');
            }

            // 6. Generic Documents Array
            if (Array.isArray(emp.documents)) {
                emp.documents.forEach(doc => collect(doc.expiryDate, 'Other', doc.type || 'Document'));
            }

            // If no documents found, skip this employee for the document chart
            if (documentDates.length === 0) return;

            // Process each document date
            documentDates.forEach(docInfo => {
                const expiry = docInfo.date;
                if (isNaN(expiry.getTime())) return;

                const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

                let bucketKey = 'More';
                if (diffDays <= 7) bucketKey = '1 Wk';
                else if (diffDays <= 14) bucketKey = '2 Wk';
                else if (diffDays <= 21) bucketKey = '3 Wk';
                else if (diffDays <= 30) bucketKey = '30 D';
                else if (diffDays <= 60) bucketKey = '60 D';
                else if (diffDays <= 90) bucketKey = '90 D';

                buckets[bucketKey].push({
                    ...docInfo,
                    expiryDate: expiry.toISOString().split('T')[0],
                    daysRemaining: diffDays
                });
            });
        });

        const docExpiryData = Object.entries(buckets).map(([name, docs]) => ({
            name,
            value: docs.length,
            docs
        }));

        return {
            total, male, female, active, inactive, probation, permanent, notice, companies,
            nationalityChartData, docExpiryData: docExpiryData.map(d => ({ ...d, label: d.name })),
            statusProgress: total > 0 ? (active / total) * 100 : 0
        };
    }, [employees]);

    const CHART_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

    const handleDeleteClick = (employee) => {
        setEmployeeToDelete(employee);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!employeeToDelete) return;

        try {
            setIsDeleting(true);
            const employeeId = employeeToDelete.employeeId || employeeToDelete._id;
            await axiosInstance.delete(`/Employee/${employeeId}`);
            toast({
                title: "Success",
                description: "Employee deleted successfully",
                variant: "success",
            });
            fetchEmployees();
        } catch (err) {
            console.error('Error deleting employee:', err);
            toast({
                title: "Error",
                description: err.response?.data?.message || "Failed to delete employee",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setEmployeeToDelete(null);
        }
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

                        {/* Profile Head Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* Left Card: Stats Grid */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                                    {[
                                        {
                                            label: 'COMPANY',
                                            value: stats.companies,
                                            icon: Building,
                                            onClick: () => router.push('/Company')
                                        },
                                        {
                                            label: 'TOTAL EMP',
                                            value: stats.total,
                                            icon: Users,
                                            onClick: resetFilters
                                        },
                                        {
                                            label: 'Male / Female',
                                            isGenderBox: true,
                                            icon: Users
                                        },
                                        {
                                            label: 'Active EMP',
                                            value: stats.active,
                                            icon: UserCheck,
                                            onClick: () => {
                                                resetFilters();
                                                setProfileStatus('active');
                                                setShowFilters(true);
                                            }
                                        },
                                        {
                                            label: 'PROBATION',
                                            value: stats.probation,
                                            icon: Clock,
                                            onClick: () => {
                                                resetFilters();
                                                setJobStatus('Probation');
                                                setShowFilters(true);
                                            }
                                        },
                                        {
                                            label: 'PERMANENT',
                                            value: stats.permanent,
                                            icon: ShieldAlert,
                                            onClick: () => {
                                                resetFilters();
                                                setJobStatus('Permanent');
                                                setShowFilters(true);
                                            }
                                        },
                                        {
                                            label: 'NOTICE',
                                            value: stats.notice,
                                            icon: Award,
                                            onClick: () => {
                                                resetFilters();
                                                setJobStatus('Notice');
                                                setShowFilters(true);
                                            }
                                        },
                                        {
                                            label: 'Inactive EMP',
                                            value: stats.inactive,
                                            icon: UserMinus,
                                            onClick: () => {
                                                resetFilters();
                                                setProfileStatus('inactive');
                                                setShowFilters(true);
                                            }
                                        },
                                    ].map((item, idx) => (
                                        item.isGenderBox ? (
                                            <div key={idx} className="bg-gray-100 p-4 rounded-lg border border-gray-100 flex flex-col items-center justify-center text-center transition-all duration-300">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{item.label}</span>
                                                <div className="flex items-center gap-2 text-3xl font-black" style={{ color: '#dc2626' }}>
                                                    <span
                                                        className="cursor-pointer hover:scale-110 transition-transform"
                                                        onClick={() => {
                                                            resetFilters();
                                                            setGender('male');
                                                            setShowFilters(true);
                                                        }}
                                                        title="Filter Male"
                                                    >
                                                        <AnimatedCounter value={stats.male} />
                                                    </span>
                                                    <span className="cursor-default">/</span>
                                                    <span
                                                        className="cursor-pointer hover:scale-110 transition-transform"
                                                        onClick={() => {
                                                            resetFilters();
                                                            setGender('female');
                                                            setShowFilters(true);
                                                        }}
                                                        title="Filter Female"
                                                    >
                                                        <AnimatedCounter value={stats.female} />
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                key={idx}
                                                className="bg-gray-100 p-4 rounded-lg border border-gray-100 flex flex-col items-center justify-center text-center group hover:bg-white hover:shadow-md transition-all duration-300 cursor-pointer"
                                                onClick={item.onClick}
                                            >
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{item.label}</span>
                                                <span className="text-3xl font-black group-hover:scale-110 transition-transform" style={{ color: '#dc2626' }}>
                                                    <AnimatedCounter value={item.value} />
                                                </span>
                                            </div>
                                        )
                                    ))}
                                </div>
                                <div className="mt-auto">
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">Profile Status</span>
                                        <span className="text-sm font-black text-blue-600">{Math.round(stats.statusProgress)}%</span>
                                    </div>
                                    <div className="h-3 bg-blue-50 rounded-full overflow-hidden border border-blue-100 shadow-inner">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="w-full h-full cursor-pointer">
                                                        <div
                                                            className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out"
                                                            style={{ width: `${stats.statusProgress}%` }}
                                                        />
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-white text-black border shadow-md">
                                                    <p>Active : {stats.active}</p>
                                                    <p>Inactive : {stats.inactive}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>
                            </div>

                            {/* Right Card: Charts Grid */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-6">
                                {/* Bar Chart: Document Expiry */}
                                <div className="flex-1 flex flex-col">
                                    <h3 className="text-sm font-bold text-gray-500 text-center uppercase tracking-widest mb-4">Document Expiry</h3>
                                    <div className="flex-1 min-h-[180px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={stats.docExpiryData}
                                                margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
                                                className="cursor-pointer"
                                            >
                                                <XAxis
                                                    dataKey="name"
                                                    fontSize={10}
                                                    axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                                                    tickLine={false}
                                                    dy={5}
                                                />
                                                <YAxis hide={true} />
                                                <RechartsTooltip
                                                    cursor={{ fill: 'transparent' }}
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Bar
                                                    dataKey="value"
                                                    radius={[4, 4, 0, 0]}
                                                    isAnimationActive={true}
                                                    animationDuration={1500}
                                                    onClick={(data) => {
                                                        if (data) {
                                                            setSelectedDocBucket(data.name);
                                                            setSelectedDocList(data.docs || []);
                                                            setDocModalOpen(true);
                                                        }
                                                    }}
                                                >
                                                    <LabelList dataKey="value" position="top" style={{ fill: '#DC2626', fontSize: '11px', fontWeight: '800' }} />
                                                    {stats.docExpiryData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={`url(#barGradient)`} cursor="pointer" />
                                                    ))}
                                                </Bar>
                                                <defs>
                                                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#1E3A8A" stopOpacity={0.9} />
                                                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.8} />
                                                    </linearGradient>
                                                </defs>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Pie Chart: Nationality */}
                                <div className="w-full sm:w-[250px] flex flex-col items-center justify-center">
                                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Nationality</h3>
                                    <div className="flex-1 w-full min-h-[230px] flex items-center justify-center">
                                        <Pie
                                            plugins={[ChartDataLabels]}
                                            data={stats.nationalityChartData}
                                            options={{
                                                maintainAspectRatio: false,
                                                responsive: true,
                                                animation: {
                                                    animateRotate: true,
                                                    animateScale: true,
                                                    duration: 1200,
                                                    easing: 'easeOutQuart'
                                                },
                                                onClick: (event, elements) => {
                                                    if (elements && elements.length > 0) {
                                                        const index = elements[0].index;
                                                        const label = stats.nationalityChartData.labels[index];
                                                        // Access the lists we stored in the dataset metadata
                                                        const list = stats.nationalityChartData.datasets[0].lists[index] || [];

                                                        setSelectedNatLabel(label);
                                                        setSelectedNatList(list);
                                                        setNatModalOpen(true);
                                                    }
                                                },
                                                onHover: (event, chartElement) => {
                                                    event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                                                },
                                                plugins: {
                                                    legend: { display: false },
                                                    tooltip: {
                                                        enabled: true,
                                                        callbacks: {
                                                            label: function (context) {
                                                                // Show "Nationality: Count" on hover
                                                                return ` ${context.label}: ${context.raw}`;
                                                            }
                                                        }
                                                    },
                                                    datalabels: {
                                                        color: '#fff',
                                                        font: {
                                                            weight: 'bold',
                                                            size: 13
                                                        },
                                                        formatter: (value) => {
                                                            // Display the count inside the pie slice
                                                            return value;
                                                        }
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Filter Panel */}
                        {showFilters && (
                            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <span className="text-sm font-medium text-gray-700">Filter by</span>

                                    {/* Gender Dropdown */}
                                    <div className="relative">
                                        <select
                                            value={gender}
                                            onChange={(e) => setGender(e.target.value)}
                                            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white appearance-none pr-8 cursor-pointer"
                                        >
                                            <option value="">All Genders</option>
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
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
                                                SL NO
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                NAME
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                EMP. ID
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                GENDER
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                DEPARTMENT
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
                                                <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                                                    Loading employees...
                                                </td>
                                            </tr>
                                        ) : filteredEmployees.length === 0 ? (
                                            <tr>
                                                <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
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
                                                const canViewProfile = mounted && (isAdmin() || hasPermission('hrm_employees_view', 'isActive'));

                                                return (
                                                    <tr
                                                        key={rowKey}
                                                        className={`hover:bg-gray-50 transition-colors ${canViewProfile ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                                                        onClick={canViewProfile ? () => {
                                                            const nameSlug = `${employee.firstName || ''}-${employee.lastName || ''}`.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                                                            const displayId = employee.employeeId || employee._id;
                                                            router.push(`/emp/${displayId}.${nameSlug}`);
                                                        } : undefined}
                                                    >
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                            {startIndex + index + 1}
                                                        </td>
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
                                                            {employee.employeeId || 'N/A'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                            {employee.gender ? capitalizeFirstLetter(employee.gender) : 'N/A'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                            {employee.department ? employee.department.toUpperCase() : 'N/A'}
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
                                                            <div className="flex items-center justify-end gap-3">
                                                                {(isAdmin() || hasPermission('hrm_employees', 'delete')) && (
                                                                    <button
                                                                        onClick={() => handleDeleteClick(employee)}
                                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                        title="Delete Employee"
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                )}
                                                                {canViewProfile ? (
                                                                    <Link
                                                                        href={`/emp/${employee.employeeId || employee._id}.${(`${employee.firstName || ''}-${employee.lastName || ''}`).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`}
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
                                                            </div>
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

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Employee Profile?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this employee profile? This will remove all their data from the system. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteConfirm();
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {docModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-800">Documents Expiring - {selectedDocBucket}</h2>
                            <button
                                onClick={() => setDocModalOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors font-bold text-gray-500"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-0">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3 w-[50px]">Sl</th>
                                        <th className="px-6 py-3">Document</th>
                                        <th className="px-6 py-3">Employee</th>
                                        <th className="px-6 py-3">Expires On</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {selectedDocList.map((doc, index) => (
                                        <tr
                                            key={index}
                                            className="hover:bg-blue-50 cursor-pointer transition-colors"
                                            onClick={() => window.open(`/emp/${doc._id}`, '_blank')}
                                        >
                                            <td className="px-6 py-3 text-gray-500">{index + 1}</td>
                                            <td className="px-6 py-3 font-medium text-gray-800">{doc.name}</td>
                                            <td className="px-6 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-800">{doc.empName}</span>
                                                    <span className="text-xs text-blue-500">{doc.empId}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex flex-col">
                                                    <span className="text-gray-800">{doc.expiryDate}</span>
                                                    <span className="text-xs text-red-600 font-bold">{doc.daysRemaining} days</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {selectedDocList.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                                No documents found in this category.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setDocModalOpen(false)}
                                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {natModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-800">Employees - {selectedNatLabel}</h2>
                            <button
                                onClick={() => setNatModalOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors font-bold text-gray-500"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-0">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3 w-[50px]">Sl</th>
                                        <th className="px-6 py-3">Employee Name</th>
                                        <th className="px-6 py-3">ID</th>
                                        <th className="px-6 py-3">Designation</th>
                                        <th className="px-6 py-3">Department</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {selectedNatList.map((emp, index) => (
                                        <tr
                                            key={index}
                                            className="hover:bg-blue-50 cursor-pointer transition-colors"
                                            onClick={() => window.open(`/emp/${emp._id}`, '_blank')}
                                        >
                                            <td className="px-6 py-3 text-gray-500">{index + 1}</td>
                                            <td className="px-6 py-3 font-medium text-gray-800">{emp.name}</td>
                                            <td className="px-6 py-3 text-blue-600 font-medium">{emp.id}</td>
                                            <td className="px-6 py-3 text-gray-600">{emp.designation}</td>
                                            <td className="px-6 py-3 text-gray-600">{emp.department}</td>
                                        </tr>
                                    ))}
                                    {selectedNatList.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                                No employees found for this nationality.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setNatModalOpen(false)}
                                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PermissionGuard>
    );
}
