'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import axiosInstance from '@/utils/axios';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
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

export default function EditUserPage() {
    const router = useRouter();
    const params = useParams();
    const userId = params.userId;
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    const [groups, setGroups] = useState([]);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordErrors, setPasswordErrors] = useState({});
    const [alertDialog, setAlertDialog] = useState({
        open: false,
        title: '',
        description: ''
    });

    // Form state
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        companyEmail: '',
        name: '',
        password: '',
        status: 'Active',
        group: '',
    });
    const [isAdminUser, setIsAdminUser] = useState(false);

    useEffect(() => {
        if (userId) {
            fetchUser();
            fetchGroups();
        }
    }, [userId]);

    const fetchUser = async () => {
        if (!userId) {
            console.error('No userId provided');
            router.push('/Settings/User');
            return;
        }

        try {
            setLoading(true);
            const response = await axiosInstance.get(`/User/${userId}`);
            const user = response.data.user;
            if (user) {
                // Check if this is the admin user - check both username and isSystemAdmin flag
                const isAdmin = user.isSystemAdmin || user.username?.toLowerCase() === 'admin';
                setIsAdminUser(isAdmin);

                setFormData({
                    username: user.username || '',
                    email: user.email || '',
                    companyEmail: user.companyEmail || '',
                    name: user.name || '',
                    password: '', // Don't pre-fill password
                    status: user.status || 'Active',
                    group: user.group?._id || user.group || '',
                });
            } else {
                setAlertDialog({
                    open: true,
                    title: 'User Not Found',
                    description: 'The user you are trying to edit does not exist.'
                });
                setTimeout(() => {
                    router.push('/Settings/User');
                }, 2000);
            }
        } catch (err) {
            console.error('Error fetching user:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Failed to load user';
            setAlertDialog({
                open: true,
                title: 'Error',
                description: errorMessage
            });
            setTimeout(() => {
                router.push('/Settings/User');
            }, 2000);
        } finally {
            setLoading(false);
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

    const validatePassword = (password) => {
        if (password && password.trim() !== '') {
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
        }
        return null;
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.username || formData.username.trim() === '') {
            newErrors.username = 'Username is required';
        }

        if (!formData.name || formData.name.trim() === '') {
            newErrors.name = 'Name is required';
        }

        if (!formData.email || formData.email.trim() === '') {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }

        // Only validate password if status is Active and password is provided
        if (formData.status === 'Active' && formData.password && formData.password.trim() !== '') {
            const passwordError = validatePassword(formData.password);
            if (passwordError) {
                newErrors.password = passwordError;
            }
        }

        if (!formData.status) {
            newErrors.status = 'Status is required';
        }

        // Group is optional - no validation needed

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Prevent form submission for admin users
        if (isAdminUser) {
            return;
        }

        if (!validateForm()) {
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                username: formData.username.trim(),
                status: formData.status,
                group: formData.group || null, // Ensure null instead of empty string
            };

            // Only include password if it's been changed
            if (formData.password && formData.password.trim() !== '') {
                payload.password = formData.password;
            }

            // Include name and email
            payload.name = formData.name.trim();
            payload.email = formData.email.trim().toLowerCase();
            payload.companyEmail = formData.companyEmail.trim().toLowerCase();

            await axiosInstance.patch(`/User/${userId}`, payload);
            router.push('/Settings/User');
        } catch (err) {
            console.error('Error updating user:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Failed to update user';
            setAlertDialog({
                open: true,
                title: 'Error',
                description: errorMessage
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-8 w-full max-w-full overflow-x-hidden">
                        <div className="text-center text-gray-500">Loading...</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                <Navbar />
                <div className="p-8 w-full max-w-full overflow-x-hidden">
                    <div className="max-w-3xl mx-auto space-y-6">
                        {/* Header */}
                        <div className="text-center">
                            <h1 className="text-3xl font-bold text-gray-800">Edit User</h1>
                        </div>

                        {/* Main Form Card */}
                        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
                            {isAdminUser && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                    <p className="text-sm text-center text-blue-800">
                                        <strong>System Admin User</strong>

                                    </p>
                                </div>
                            )}
                            <form
                                onSubmit={isAdminUser ? (e) => { e.preventDefault(); return false; } : handleSubmit}
                                onKeyDown={(e) => {
                                    // Prevent form submission on Enter key for admin users
                                    if (isAdminUser && e.key === 'Enter') {
                                        e.preventDefault();
                                        return false;
                                    }
                                }}
                            >
                                <div className="space-y-6">
                                    {/* Name and Email (2 columns) */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Name
                                            </label>
                                            <input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleInputChange}
                                                disabled={isAdminUser}
                                                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isAdminUser ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''} ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                                                placeholder="Enter full name"
                                            />
                                            {errors.name && (
                                                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Email
                                            </label>
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                disabled={isAdminUser}
                                                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isAdminUser ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''} ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                                                placeholder="Enter email address"
                                            />
                                            {errors.email && (
                                                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Username and Group (2 columns) */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Username
                                            </label>
                                            <input
                                                type="text"
                                                name="username"
                                                value={formData.username}
                                                onChange={handleInputChange}
                                                disabled={isAdminUser}
                                                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isAdminUser ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''} ${errors.username ? 'border-red-500' : 'border-gray-300'}`}
                                                placeholder="Enter username"
                                            />
                                            {errors.username && (
                                                <p className="mt-1 text-sm text-red-600">{errors.username}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {isAdminUser ? 'Employee ID' : 'Group'}
                                            </label>
                                            {isAdminUser ? (
                                                <input
                                                    type="text"
                                                    value="System Users"
                                                    disabled
                                                    className="w-full px-4 py-2.5 border rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                                                />
                                            ) : (
                                                <>
                                                    <select
                                                        name="group"
                                                        value={formData.group}
                                                        onChange={handleInputChange}
                                                        className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.group ? 'border-red-500' : 'border-gray-300'}`}
                                                    >
                                                        <option value="">Select</option>
                                                        {groups.map((group) => (
                                                            <option key={group._id} value={group._id}>
                                                                {group.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {errors.group && (
                                                        <p className="mt-1 text-sm text-red-600">{errors.group}</p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Status and Reset Password (2 columns) */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Status
                                            </label>
                                            <select
                                                name="status"
                                                value={formData.status}
                                                onChange={handleInputChange}
                                                disabled={isAdminUser}
                                                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isAdminUser ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''} ${errors.status ? 'border-red-500' : 'border-gray-300'}`}
                                            >
                                                <option value="Active">Active</option>
                                                <option value="Inactive">Inactive</option>
                                            </select>
                                            {errors.status && (
                                                <p className="mt-1 text-sm text-red-600">{errors.status}</p>
                                            )}
                                        </div>
                                        <div className="flex items-end">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowPasswordModal(true);
                                                    setPasswordForm({ newPassword: '', confirmPassword: '' });
                                                    setPasswordErrors({});
                                                }}
                                                className={`w-full md:w-3/4 px-4 py-2.5 rounded-lg font-medium transition-colors border ${isAdminUser
                                                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
                                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-200'
                                                    }`}
                                            >
                                                Reset Password
                                            </button>
                                            {formData.password && !isAdminUser && (
                                                <p className="ml-3 text-sm text-green-600">
                                                    Will update on save.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Submit Button - Only show for non-admin users */}
                                {!isAdminUser && (
                                    <div className="mt-6 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => router.push('/Settings/User')}
                                            className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className={`px-5 py-2.5 rounded-lg text-white font-semibold transition-colors shadow-sm ${submitting ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                                        >
                                            {submitting ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                )}
                            </form>
                            {/* Back button for admin user */}
                            {isAdminUser && (
                                <div className="mt-6 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => router.push('/Settings/User')}
                                        className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        Back
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Password Reset Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0"
                        style={{ backgroundColor: '#00000063' }}
                        onClick={() => {
                            setShowPasswordModal(false);
                            setPasswordForm({ newPassword: '', confirmPassword: '' });
                            setPasswordErrors({});
                        }}
                    />
                    <div
                        className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-800">Reset Password</h2>
                            <button
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setPasswordForm({ newPassword: '', confirmPassword: '' });
                                    setPasswordErrors({});
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    value={passwordForm.newPassword}
                                    onChange={(e) => {
                                        setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }));
                                        if (passwordErrors.newPassword) {
                                            setPasswordErrors(prev => {
                                                const newErrors = { ...prev };
                                                delete newErrors.newPassword;
                                                return newErrors;
                                            });
                                        }
                                    }}
                                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${passwordErrors.newPassword ? 'border-red-500' : 'border-gray-300'}`}
                                    placeholder="Enter new password"
                                />
                                {passwordErrors.newPassword && (
                                    <p className="mt-1 text-sm text-red-600">{passwordErrors.newPassword}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Confirm Password
                                </label>
                                <input
                                    type="password"
                                    value={passwordForm.confirmPassword}
                                    onChange={(e) => {
                                        setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }));
                                        if (passwordErrors.confirmPassword) {
                                            setPasswordErrors(prev => {
                                                const newErrors = { ...prev };
                                                delete newErrors.confirmPassword;
                                                return newErrors;
                                            });
                                        }
                                    }}
                                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${passwordErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'}`}
                                    placeholder="Confirm new password"
                                />
                                {passwordErrors.confirmPassword && (
                                    <p className="mt-1 text-sm text-red-600">{passwordErrors.confirmPassword}</p>
                                )}
                            </div>

                            <p className="text-xs text-gray-500">
                                Password must be at least 8 characters with uppercase, lowercase, and number.
                            </p>
                        </div>

                        <div className="mt-6 flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setPasswordForm({ newPassword: '', confirmPassword: '' });
                                    setPasswordErrors({});
                                }}
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    const newErrors = {};

                                    // Validate new password
                                    if (!passwordForm.newPassword || passwordForm.newPassword.trim() === '') {
                                        newErrors.newPassword = 'New password is required';
                                    } else {
                                        const passwordError = validatePassword(passwordForm.newPassword);
                                        if (passwordError) {
                                            newErrors.newPassword = passwordError;
                                        }
                                    }

                                    // Validate confirm password
                                    if (!passwordForm.confirmPassword || passwordForm.confirmPassword.trim() === '') {
                                        newErrors.confirmPassword = 'Please confirm your password';
                                    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                                        newErrors.confirmPassword = 'Passwords do not match';
                                    }

                                    setPasswordErrors(newErrors);

                                    // If client-side validation passes, check with server
                                    if (Object.keys(newErrors).length === 0) {
                                        try {
                                            if (isAdminUser) {
                                                // For admin user, update password in .env file
                                                const response = await axiosInstance.patch(`/User/${userId}`, {
                                                    password: passwordForm.newPassword
                                                });
                                                console.log('Password update response:', response.data);
                                                setShowPasswordModal(false);
                                                setPasswordForm({ newPassword: '', confirmPassword: '' });
                                                setPasswordErrors({});
                                                setAlertDialog({
                                                    open: true,
                                                    title: 'Password Updated',
                                                    description: response.data?.message || 'Admin password has been updated in .env file. Please restart the server for the change to take full effect.'
                                                });
                                            } else {
                                                // For regular users, validate password with server (check if it matches current password)
                                                await axiosInstance.post(`/User/${userId}/validate-password`, {
                                                    password: passwordForm.newPassword
                                                });

                                                // If validation passes, set the password
                                                setFormData(prev => ({
                                                    ...prev,
                                                    password: passwordForm.newPassword
                                                }));
                                                setShowPasswordModal(false);
                                                setPasswordForm({ newPassword: '', confirmPassword: '' });
                                                setPasswordErrors({});
                                                setAlertDialog({
                                                    open: true,
                                                    title: 'Password Set',
                                                    description: 'Password will be updated when you save the form.'
                                                });
                                            }
                                        } catch (err) {
                                            // Server validation failed (password matches current password or other error)
                                            console.error('Password update error:', err);
                                            const errorMessage = err.response?.data?.message || err.message || 'Password validation failed';
                                            setPasswordErrors({
                                                newPassword: errorMessage
                                            });
                                            // Also show error in alert dialog for admin users
                                            if (isAdminUser) {
                                                setAlertDialog({
                                                    open: true,
                                                    title: 'Password Update Failed',
                                                    description: errorMessage
                                                });
                                            }
                                        }
                                    }
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Set Password
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Alert Dialog */}
            <AlertDialog open={alertDialog.open} onOpenChange={(open) => setAlertDialog((prev) => ({ ...prev, open }))}>
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
            </AlertDialog>
        </div>
    );
}

