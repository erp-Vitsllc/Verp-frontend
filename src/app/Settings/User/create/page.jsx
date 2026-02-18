'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axiosInstance from '@/utils/axios';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import Select from 'react-select';
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

export default function CreateUserPage() {
    const router = useRouter();
    const [creationMode, setCreationMode] = useState('employee'); // 'employee' or 'new'
    const [employees, setEmployees] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    const [alertDialog, setAlertDialog] = useState({
        open: false,
        title: '',
        description: ''
    });

    // Form state
    const [formData, setFormData] = useState({
        employeeId: '',
        username: '',
        email: '',
        name: '',
        password: '',
        confirmPassword: '',
        status: 'Active',
        group: '',
    });

    useEffect(() => {
        fetchEmployees();
        fetchGroups();
    }, []);

    const fetchEmployees = async () => {
        try {
            const response = await axiosInstance.get('/Employee', {
                params: { limit: 1000 }
            });
            if (response.data.employees) {
                setEmployees(response.data.employees || []);
            }
        } catch (err) {
            console.error('Error fetching employees:', err);
        }
    };

    const fetchGroups = async () => {
        try {
            const response = await axiosInstance.get('/User/groups/all');
            if (response.data.groups) {
                setGroups(response.data.groups || []);
            }
        } catch (err) {
            console.error('Error fetching groups:', err);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const handleBlur = (fieldName) => {
        const newErrors = { ...errors };

        if (fieldName === 'username') {
            const usernameError = validateUsername(formData.username);
            if (usernameError) {
                newErrors.username = usernameError;
            } else {
                delete newErrors.username;
            }
        } else if (fieldName === 'password') {
            const paramsValidationMsg = validatePassword(formData.password);
            if (paramsValidationMsg) {
                newErrors.password = paramsValidationMsg;
            } else {
                delete newErrors.password;
            }
            // Also validate confirm password match
            if (formData.confirmPassword && formData.password !== formData.confirmPassword) {
                newErrors.confirmPassword = 'Passwords do not match';
            } else if (formData.confirmPassword) {
                delete newErrors.confirmPassword;
            }
        } else if (fieldName === 'confirmPassword') {
            if (!formData.confirmPassword || formData.confirmPassword.trim() === '') {
                newErrors.confirmPassword = 'Confirmation is required';
            } else if (formData.password !== formData.confirmPassword) {
                newErrors.confirmPassword = 'Passwords do not match';
            } else {
                delete newErrors.confirmPassword;
            }
        } else if (fieldName === 'name' && creationMode === 'new') {
            const nameError = validateName(formData.name);
            if (nameError) {
                newErrors.name = nameError;
            } else {
                delete newErrors.name;
            }
        } else if (fieldName === 'email' && creationMode === 'new') {
            if (!formData.email || formData.email.trim() === '') {
                newErrors.email = 'Email is required';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
                newErrors.email = 'Invalid email format';
            } else {
                delete newErrors.email;
            }
        } else if (fieldName === 'group') {
            if (!formData.group || formData.group.trim() === '') {
                newErrors.group = 'Group is required';
            } else {
                delete newErrors.group;
            }
        }

        setErrors(newErrors);
    };

    const handleEmployeeSelect = (e) => {
        const selectedEmployeeId = e.target.value;
        setFormData(prev => ({
            ...prev,
            employeeId: selectedEmployeeId
        }));

        // Auto-fill username, email and name from selected employee
        if (selectedEmployeeId) {
            const employee = employees.find(emp => emp.employeeId === selectedEmployeeId);
            if (employee) {
                setFormData(prev => ({
                    ...prev,
                    username: employee.email?.split('@')[0] || employee.employeeId || '',
                    email: employee.email || '',
                    name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || ''
                }));
            }
        }
    };


    const validatePassword = (password) => {
        if (!password || password.trim() === '') {
            return 'Password is required';
        }
        if (password.length < 8) {
            return 'Password must be at least 8 characters';
        }
        if (!/[A-Z]/.test(password)) {
            return 'Password must contain at least one uppercase letter';
        }
        if (!/[a-z]/.test(password)) {
            return 'Password must contain at least one lowercase letter';
        }
        if (!/[0-9]/.test(password)) {
            return 'Password must contain at least one number';
        }
        return null;
    };

    const validateUsername = (username) => {
        if (!username || username.trim() === '') {
            return 'Username is required';
        }
        if (username.length < 3) {
            return 'Username must be at least 3 characters';
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return 'Username can only contain letters, numbers, and underscores';
        }
        if (/\s/.test(username)) {
            return 'Username cannot contain spaces';
        }
        return null;
    };

    const validateName = (name) => {
        if (!name || name.trim() === '') {
            return 'Name is required';
        }
        if (name.trim().length < 2) {
            return 'Name must be at least 2 characters';
        }
        if (!/^[a-zA-Z\s'-]+$/.test(name.trim())) {
            return 'Name can only contain letters and spaces'
        }
        return null;
    };

    const validateForm = () => {
        const newErrors = {};

        if (creationMode === 'employee') {
            if (!formData.employeeId) {
                newErrors.employeeId = 'Employee is required';
            } else {
                // Validate that selected employee has email
                const employee = employees.find(emp => emp.employeeId === formData.employeeId);
                if (employee && (!employee.email || employee.email.trim() === '')) {
                    newErrors.employeeId = 'Selected employee does not have an email address';
                }
            }
        } else {
            const nameError = validateName(formData.name);
            if (nameError) {
                newErrors.name = nameError;
            }

            if (!formData.email || formData.email.trim() === '') {
                newErrors.email = 'Email is required';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
                newErrors.email = 'Invalid email format';
            }
        }

        const usernameError = validateUsername(formData.username);
        if (usernameError) {
            newErrors.username = usernameError;
        }

        const paramsValidationMsg = validatePassword(formData.password);
        if (paramsValidationMsg) {
            newErrors.password = paramsValidationMsg;
        }

        if (!formData.confirmPassword || formData.confirmPassword.trim() === '') {
            newErrors.confirmPassword = 'Confirmation is required';
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        // Group is mandatory
        if (!formData.group || formData.group.trim() === '') {
            newErrors.group = 'Group is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Check if form is valid for button disable state
    const isFormValid = () => {
        if (creationMode === 'employee') {
            return formData.employeeId &&
                formData.username &&
                !validateUsername(formData.username) &&
                formData.password &&
                !validatePassword(formData.password) &&
                formData.confirmPassword &&
                formData.password === formData.confirmPassword &&
                formData.group;
        } else {
            return formData.name &&
                !validateName(formData.name) &&
                formData.email &&
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
                formData.username &&
                !validateUsername(formData.username) &&
                formData.password &&
                !validatePassword(formData.password) &&
                formData.confirmPassword &&
                formData.password === formData.confirmPassword &&
                formData.group;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setSubmitting(true);
        try {
            let payload = {
                username: formData.username.trim(),
                password: formData.password,
                status: 'Active', // Default status
                group: formData.group || null, // Optional
            };

            if (creationMode === 'employee') {
                // Get employee details for name and email
                const employee = employees.find(emp => emp.employeeId === formData.employeeId);
                if (employee) {
                    payload.employeeId = formData.employeeId;
                    payload.name = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.employeeId;
                    payload.email = employee.email || `${formData.username}@example.com`;
                    payload.companyEmail = employee.companyEmail || '';
                }
            } else {
                payload.name = formData.name.trim();
                payload.email = formData.email.trim().toLowerCase();
            }

            await axiosInstance.post('/User', payload);
            router.push('/Settings/User');
        } catch (err) {
            console.error('Error creating user:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Failed to create user';
            setAlertDialog({
                open: true,
                title: 'Error',
                description: errorMessage
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                <Navbar />
                <div className="p-8 w-full max-w-full overflow-x-hidden">
                    <div className="max-w-3xl mx-auto space-y-6">
                        {/* Header */}
                        <div className="text-center">
                            <h1 className="text-3xl font-bold text-gray-800">Add User</h1>
                        </div>

                        {/* Main Form Card */}
                        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
                            {/* Creation Mode Selection */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCreationMode('employee');
                                        setFormData({
                                            employeeId: '',
                                            username: '',
                                            email: '',
                                            name: '',
                                            password: '',
                                            confirmPassword: '',
                                            status: 'Active',
                                            group: '',
                                        });
                                        setErrors({});
                                    }}
                                    className={`w-full px-4 py-3 rounded-lg border text-sm font-semibold ${creationMode === 'employee'
                                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                >
                                    From Existing Employee
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCreationMode('new');
                                        setFormData({
                                            employeeId: '',
                                            username: '',
                                            email: '',
                                            name: '',
                                            password: '',
                                            confirmPassword: '',
                                            status: 'Active',
                                            group: '',
                                        });
                                        setErrors({});
                                    }}
                                    className={`w-full px-4 py-3 rounded-lg border text-sm font-semibold ${creationMode === 'new'
                                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                >
                                    Create New User
                                </button>
                            </div>

                            <form onSubmit={handleSubmit}>
                                <div className="space-y-6">
                                    {/* Employee Selection (only for employee mode) */}
                                    {creationMode === 'employee' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Employee <span className="text-red-500">*</span>
                                            </label>
                                            {/* React Select for Employee */}
                                            <Select
                                                name="employeeId"
                                                value={employees
                                                    .map(emp => ({
                                                        value: emp.employeeId,
                                                        label: `${emp.employeeId} - ${emp.firstName} ${emp.lastName}`
                                                    }))
                                                    .find(opt => opt.value === formData.employeeId)}
                                                onChange={(selectedOption) => {
                                                    const e = { target: { name: 'employeeId', value: selectedOption?.value || '' } };
                                                    handleEmployeeSelect(e);
                                                }}
                                                options={employees.map(emp => ({
                                                    value: emp.employeeId,
                                                    label: `${emp.employeeId} - ${emp.firstName} ${emp.lastName}`
                                                }))}
                                                className={`basic-single ${errors.employeeId ? 'border-red-500 rounded-lg' : ''}`}
                                                classNamePrefix="select"
                                                placeholder="Select Employee..."
                                                isClearable
                                                isSearchable
                                                styles={{
                                                    control: (base) => ({
                                                        ...base,
                                                        borderColor: errors.employeeId ? '#ef4444' : '#d1d5db',
                                                        borderRadius: '0.5rem',
                                                        paddingTop: '2.5px',
                                                        paddingBottom: '2.5px',
                                                        '&:hover': {
                                                            borderColor: '#3b82f6'
                                                        }
                                                    })
                                                }}
                                            />
                                            {errors.employeeId && (
                                                <p className="mt-1 text-sm text-red-600">{errors.employeeId}</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Name and Email (only for new user mode) */}
                                    {creationMode === 'new' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Name <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="name"
                                                    value={formData.name}
                                                    onChange={handleInputChange}
                                                    onBlur={() => handleBlur('name')}
                                                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-500' : 'border-gray-300'
                                                        }`}
                                                    placeholder="Enter full name"
                                                />
                                                {errors.name && (
                                                    <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Email <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleInputChange}
                                                    onBlur={() => handleBlur('email')}
                                                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-500' : 'border-gray-300'
                                                        }`}
                                                    placeholder="Enter email address"
                                                />
                                                {errors.email && (
                                                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Username and Group (2 columns) */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Username <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="username"
                                                value={formData.username}
                                                onChange={handleInputChange}
                                                onBlur={() => handleBlur('username')}
                                                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.username ? 'border-red-500' : 'border-gray-300'
                                                    }`}
                                                placeholder="Enter username"
                                            />
                                            {errors.username && (
                                                <p className="mt-1 text-sm text-red-600">{errors.username}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Group <span className="text-red-500">*</span>
                                            </label>
                                            <Select
                                                name="group"
                                                value={groups.map(g => ({ value: g._id, label: g.name })).find(opt => opt.value === formData.group)}
                                                onChange={(selectedOption) => {
                                                    const e = { target: { name: 'group', value: selectedOption?.value || '' } };
                                                    handleInputChange(e);
                                                }}
                                                onBlur={() => handleBlur('group')}
                                                options={groups.map(group => ({ value: group._id, label: group.name }))}
                                                className={`basic-single ${errors.group ? 'border-red-500 rounded-lg' : ''}`}
                                                classNamePrefix="select"
                                                placeholder="Select Group..."
                                                isClearable
                                                styles={{
                                                    control: (base) => ({
                                                        ...base,
                                                        borderColor: errors.group ? '#ef4444' : '#d1d5db',
                                                        borderRadius: '0.5rem',
                                                        paddingTop: '2.5px',
                                                        paddingBottom: '2.5px',
                                                        '&:hover': {
                                                            borderColor: '#3b82f6'
                                                        }
                                                    })
                                                }}
                                            />
                                            {errors.group && (
                                                <p className="mt-1 text-sm text-red-600">{errors.group}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Password Row (2 columns: Pass and Confirm Pass) */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Password <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="password"
                                                name="password"
                                                value={formData.password}
                                                onChange={handleInputChange}
                                                onBlur={() => handleBlur('password')}
                                                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.password ? 'border-red-500' : 'border-gray-300'
                                                    }`}
                                                placeholder="Enter password"
                                            />
                                            {errors.password && (
                                                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Confirm Password <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="password"
                                                name="confirmPassword"
                                                value={formData.confirmPassword}
                                                onChange={handleInputChange}
                                                onBlur={() => handleBlur('confirmPassword')}
                                                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                                                    }`}
                                                placeholder="Confirm password"
                                            />
                                            {errors.confirmPassword && (
                                                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                                            )}
                                        </div>
                                    </div>

                                </div>

                                {/* Submit Button */}
                                <div className="mt-6 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={submitting || !isFormValid()}
                                        className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {submitting ? 'Creating...' : 'Create'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div >

            {/* Alert Dialog */}
            < AlertDialog open={alertDialog.open} onOpenChange={(open) => setAlertDialog((prev) => ({ ...prev, open }))
            }>
                <AlertDialogContent className="sm:max-w-[425px] rounded-[22px] border-gray-200">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {alertDialog.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setAlertDialog({ open: false, title: '', description: '' })}>
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog >
        </div >
    );
}

