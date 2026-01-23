'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import axiosInstance from '@/utils/axios';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import { isAdmin, hasPermission } from '@/utils/permissions';
import { useToast } from '@/hooks/use-toast';
import {
    Camera,
    Edit2,
    Lock,
    User as UserIcon,
    Mail,
    Shield,
    Activity,
    Briefcase,
    ArrowLeft
} from 'lucide-react';

export default function UserProfilePage() {
    const router = useRouter();
    const params = useParams();
    const { userId } = params;
    const { toast } = useToast();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [imageError, setImageError] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // Password change states
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    useEffect(() => {
        if (userId) {
            fetchUser();
        }
    }, [userId]);

    const fetchUser = async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get(`/User/${userId}`);
            setUser(response.data.user);
        } catch (err) {
            console.error('Error fetching user:', err);
            setError(err.response?.data?.message || 'Failed to fetch user');
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Basic validation
        if (!file.type.startsWith('image/')) {
            toast({
                title: "Invalid file",
                description: "Please select an image file.",
                variant: "destructive"
            });
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                const base64Image = reader.result;
                const response = await axiosInstance.post(`/User/${userId}/upload-profile-picture`, {
                    image: base64Image
                });

                setUser(prev => ({
                    ...prev,
                    profilePicture: response.data.profilePicture
                }));
                setImageError(false);

                toast({
                    title: "Success",
                    description: "Profile picture updated successfully.",
                    variant: "success"
                });
            } catch (err) {
                console.error('Error uploading profile picture:', err);
                toast({
                    title: "Error",
                    description: err.response?.data?.message || "Failed to upload profile picture",
                    variant: "destructive"
                });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleStatusChange = async () => {
        const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
        try {
            setIsUpdatingStatus(true);
            await axiosInstance.patch(`/User/${userId}`, { status: newStatus });
            setUser(prev => ({ ...prev, status: newStatus }));
            toast({
                title: "Status Updated",
                description: `User is now ${newStatus}.`,
                variant: "success"
            });
        } catch (err) {
            console.error('Error updating status:', err);
            toast({
                title: "Update Failed",
                description: err.response?.data?.message || "Failed to update status",
                variant: "destructive"
            });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handlePasswordChange = async () => {
        if (!newPassword || !confirmPassword) {
            toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
            return;
        }
        if (newPassword.length < 8) {
            toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" });
            return;
        }

        try {
            setIsUpdatingPassword(true);
            await axiosInstance.patch(`/User/${userId}`, { password: newPassword });
            toast({ title: "Success", description: "Password updated successfully", variant: "success" });
            setIsPasswordModalOpen(false);
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            console.error('Error changing password:', err);
            toast({
                title: "Error",
                description: err.response?.data?.message || "Failed to change password",
                variant: "destructive"
            });
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen bg-white">
                <Sidebar />
                <div className="flex-1 flex flex-col">
                    <Navbar />
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-gray-500">Loading profile...</div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !user) {
        return (
            <div className="flex min-h-screen bg-white">
                <Sidebar />
                <div className="flex-1 flex flex-col">
                    <Navbar />
                    <div className="p-8">
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                            {error || 'User not found'}
                        </div>
                        <button
                            onClick={() => router.push('/Settings/User')}
                            className="mt-4 flex items-center gap-2 text-blue-600 hover:underline"
                        >
                            <ArrowLeft size={16} /> Back to Users
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <PermissionGuard moduleId="settings_user_group" permissionType="view">
            <div className="flex min-h-screen bg-white">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />

                    <div className="p-8 max-w-5xl mx-auto w-full">
                        {/* Header Actions */}
                        <div className="flex items-center justify-between mb-8">
                            <button
                                onClick={() => router.push('/Settings/User')}
                                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                <ArrowLeft size={20} />
                                <span className="font-medium">Back to Users</span>
                            </button>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => router.push(`/Settings/User/${userId}/edit`)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                                >
                                    <Edit2 size={16} />
                                    Edit Profile
                                </button>
                                <button
                                    onClick={handleStatusChange}
                                    disabled={isUpdatingStatus}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors shadow-sm ${user.status === 'Active'
                                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                                        }`}
                                >
                                    {isUpdatingStatus ? 'Updating...' : user.status === 'Active' ? 'Deactivate' : 'Activate'}
                                </button>
                            </div>
                        </div>

                        {/* Profile Content */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-8 md:p-12 flex flex-col md:flex-row gap-12">

                                {/* Left Column: Avatar */}
                                <div className="flex flex-col items-center bg-gray-50/50 p-8 rounded-3xl border border-gray-100">
                                    <div className="text-center mb-8">
                                        <h2 className="text-3xl font-bold text-gray-900">{user.name}</h2>
                                        <p className="text-blue-600 font-semibold mt-1 flex items-center justify-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                            {user.group?.name || 'No Group'}
                                        </p>
                                    </div>

                                    <div className="relative group">
                                        <div className="w-56 h-56 rounded-full border-8 border-white overflow-hidden shadow-xl bg-white flex items-center justify-center relative">
                                            {(() => {
                                                const rawUrl = user.profilePicture;
                                                const safeUrl = rawUrl && !rawUrl.startsWith('http') ? `https://${rawUrl}` : rawUrl;

                                                return (safeUrl && !imageError) ? (
                                                    <Image
                                                        src={safeUrl}
                                                        alt={user.name}
                                                        width={224}
                                                        height={224}
                                                        className="object-cover w-full h-full"
                                                        onError={() => setImageError(true)}
                                                        unoptimized={true}
                                                    />
                                                ) : (
                                                    <div className="text-gray-300">
                                                        <UserIcon size={100} strokeWidth={1} />
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Camera Overlay */}
                                        <label className="absolute bottom-4 right-4 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full cursor-pointer shadow-xl transition-all scale-95 group-hover:scale-105 active:scale-95">
                                            <Camera size={22} />
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleFileSelect}
                                            />
                                        </label>
                                    </div>

                                    <div className="mt-8 flex flex-col items-center gap-4">
                                        <div className="capitalize">
                                            <span className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-sm ${user.status === 'Active' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                                                }`}>
                                                {user.status}
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => setIsPasswordModalOpen(true)}
                                            className="mt-2 flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-blue-700 transition-all bg-white px-6 py-3 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md active:scale-95"
                                        >
                                            <Lock size={18} />
                                            Change Password
                                        </button>
                                    </div>
                                </div>

                                {/* Right Column: Details */}
                                <div className="flex-1 py-4">
                                    <h3 className="text-xl font-bold text-gray-900 mb-8 border-b border-gray-100 pb-4">Account Information</h3>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-10 gap-x-12">
                                        <DetailItem
                                            icon={<UserIcon size={20} className="text-blue-500" />}
                                            label="Username"
                                            value={user.username}
                                        />
                                        <DetailItem
                                            icon={<Mail size={20} className="text-blue-500" />}
                                            label="Email Address"
                                            value={user.email}
                                        />
                                        <DetailItem
                                            icon={<Shield size={20} className="text-blue-500" />}
                                            label="Access Group"
                                            value={user.group?.name || 'No Group assigned'}
                                        />
                                        <DetailItem
                                            icon={<Activity size={20} className="text-blue-500" />}
                                            label="Account Status"
                                            value={user.status}
                                        />
                                        <DetailItem
                                            icon={<Briefcase size={20} className="text-blue-500" />}
                                            label="Existed Employee"
                                            value={user.employeeId ? 'YES' : 'NO'}
                                        />
                                        {user.employeeId && (
                                            <DetailItem
                                                icon={<Shield size={20} className="text-blue-500" />}
                                                label="Employee ID"
                                                value={user.employeeId}
                                            />
                                        )}
                                    </div>


                                </div>

                            </div>
                        </div>
                    </div>
                </div>

                {/* Password Change Modal */}
                {isPasswordModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                            <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                                <Lock className="text-blue-600" size={20} />
                                Change Password
                            </h3>
                            <p className="text-sm text-gray-500 mb-6">Enter a new secure password for this account.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        placeholder="Min 8 characters"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        placeholder="Repeat your password"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <button
                                    onClick={() => {
                                        setIsPasswordModalOpen(false);
                                        setNewPassword('');
                                        setConfirmPassword('');
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePasswordChange}
                                    disabled={isUpdatingPassword}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50"
                                >
                                    {isUpdatingPassword ? 'Updating...' : 'Save Password'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PermissionGuard>
    );
}

function DetailItem({ icon, label, value }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                {icon}
                {label}
            </span>
            <span className="text-base font-semibold text-gray-800">{value || '-'}</span>
        </div>
    );
}
