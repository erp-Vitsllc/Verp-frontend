'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';

export default function Employee() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [department, setDepartment] = useState('');
    const [designation, setDesignation] = useState('');

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

    // Fetch employees from backend
    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await axiosInstance.get('/Employee');

            if (response.data.employees) {
                const employeesData = response.data.employees || [];
                const normalizedEmployees = employeesData.map(emp => ({
                    ...emp,
                    status: normalizeStatus(emp.status)
                }));
                setEmployees(normalizedEmployees);
            } else {
                setError(response.data.message || 'Failed to fetch employees');
            }
        } catch (err) {
            const errorMessage = err.message || 'Error connecting to server. Please check if the backend is running.';
            setError(errorMessage);
            console.error('Error fetching employees:', err);
            setEmployees([]); // Set empty array on error
        } finally {
            setLoading(false);
        }
    };

    // Filter employees based on search and filters
    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = !searchQuery ||
            `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
            emp.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            emp.email?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesDepartment = !department || emp.department === department;
        const matchesDesignation = !designation || emp.designation === designation;

        return matchesSearch && matchesDepartment && matchesDesignation;
    });

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

    // Calculate incomplete employees (missing required fields)
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

    const isEmployeeIncomplete = (employee) => {
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
    };

    const incompleteEmployees = employees.filter(isEmployeeIncomplete);

    const onViewAll = () => {
        // Filter to show only incomplete employees
        setSearchQuery('');
        // You can add additional logic here to filter or navigate
    };

    const getInitials = (firstName, lastName) => {
        return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    };

    const getContractExpiry = (employee) => {
        if (employee?.nationality?.toLowerCase() === 'uae') {
            return 'Not Applicable (UAE National)';
        }
        const expiryDate =
            employee?.visaDetails?.employment?.expiryDate ||
            employee?.visaDetails?.visit?.expiryDate ||
            employee?.visaDetails?.spouse?.expiryDate ||
            employee?.visaExp;
        if (!expiryDate) return 'N/A';
        const expiry = new Date(expiryDate);
        if (Number.isNaN(expiry.getTime())) return 'N/A';
        const today = new Date();
        const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
            return `${Math.abs(diffDays)} days overdue`;
        }
        if (diffDays === 0) {
            return 'Expires today';
        }
        return `${diffDays} days`;
    };

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                <Navbar />
                <div className="p-8 bg-gray-50">
                    {/* Header and Actions in Single Row */}
                    <div className="flex items-center justify-between mb-6">
                        {/* Left Side - Header */}
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800 mb-2">Employees</h1>
                            <p className="text-gray-600">
                                {employees.filter(e => e.status === 'Permanent').length} Permanent | {employees.filter(e => e.status === 'Notice').length} Notice
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

                            {/* Add New Employee Button - Teal */}
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

                                {/* Clear Filters Button */}
                                {(department || designation) && (
                                    <button
                                        onClick={() => {
                                            setDepartment('');
                                            setDesignation('');
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
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
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
                                        filteredEmployees.map((employee, index) => {
                                            const incomplete = isEmployeeIncomplete(employee);
                                            const rowKey = employee._id || employee.employeeId || `employee-${index}`;
                                            const isUaeNational = (employee?.nationality || '').trim().toLowerCase() === 'uae';
                                            const hasVisaExpiry = Boolean(
                                                employee?.visaDetails?.employment?.expiryDate ||
                                                employee?.visaDetails?.visit?.expiryDate ||
                                                employee?.visaDetails?.spouse?.expiryDate ||
                                                employee?.visaExp
                                            );
                                            const profileStatusValue = (employee.profileStatus || 'inactive').toLowerCase();
                                            const profileStatusLabel = profileStatusValue === 'active' ? 'Active' : 'Inactive';
                                            const profileStatusClass = profileStatusValue === 'active'
                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                : 'bg-gray-100 text-gray-500 border-gray-200';
                                            return (
                                                <tr
                                                    key={rowKey}
                                                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                                                    onClick={() => router.push(`/Employee/${employee._id || employee.employeeId}`)}
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-300 via-blue-300 to-red-300 flex items-center justify-center text-gray-700 font-semibold text-sm flex-shrink-0">
                                                                {getInitials(employee.firstName, employee.lastName)}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div>
                                                                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                                                                        {employee.firstName} {employee.lastName}
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
                                                                    <div className="text-sm text-gray-500">{employee.role || employee.designation || 'Employee'}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                        {employee.department || 'N/A'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                        {employee.employeeId || 'N/A'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                        {isUaeNational ? (
                                                            <span className="text-gray-500">Not Applicable (UAE National)</span>
                                                        ) : !hasVisaExpiry ? (
                                                            <span className="inline-flex items-center gap-2 text-red-600 font-semibold">
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <circle cx="12" cy="12" r="10"></circle>
                                                                    <line x1="12" y1="6" x2="12" y2="14"></line>
                                                                    <circle cx="12" cy="18" r="1"></circle>
                                                                </svg>
                                                                No Visa
                                                            </span>
                                                        ) : (
                                                            getContractExpiry(employee)
                                                        )}
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
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
