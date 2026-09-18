'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useListReturnBack } from '@/hooks/useListReturnBack';
import ListReturnBackButton from '@/components/ListReturnBackButton';
import axiosInstance from '@/utils/axios';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import { useToast } from '@/hooks/use-toast';
import { ERP_JPEG_ACCEPT, validateErpJpegFile } from '@/utils/uploadFileTypes';
import { navHrefProps } from '@/utils/linkContextMenu';
import {
    Camera,
    Clock,
    Edit2,
    Lock,
    User as UserIcon,
    Mail,
    Shield,
    Activity,
    Briefcase,
    Smartphone,
    MapPin,
    Globe,
    Monitor,
} from 'lucide-react';
import {
    LocationMapPin,
    PunchLocationPinCell,
    PunchTypeCell,
    punchCoords,
} from '@/app/HRM/Attendance/mark/components/MarkAttendancePunchCells';

export default function UserProfilePage() {
    const router = useRouter();
    const handleUserListBack = useListReturnBack(() => router.push('/Settings/User'));
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
    const [isUpdatingDevice, setIsUpdatingDevice] = useState(false);
    const [isUpdatingLoginThrough, setIsUpdatingLoginThrough] = useState(false);

    useEffect(() => {
        if (!userId) return undefined;
        const controller = new AbortController();
        const load = async () => {
            try {
                setLoading(true);
                setError('');
                const response = await axiosInstance.get(`/User/${userId}`, {
                    signal: controller.signal,
                });
                if (!controller.signal.aborted) {
                    setUser(response.data.user);
                }
            } catch (err) {
                if (controller.signal.aborted || err?.code === 'ERR_CANCELED') return;
                console.error('Error fetching user:', err);
                setError(err.response?.data?.message || 'Failed to fetch user');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        load();
        return () => controller.abort();
    }, [userId]);

    const handleFileSelect = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const check = validateErpJpegFile(file);
        if (!check.ok) {
            toast({
                title: "Invalid file",
                description: check.message,
                variant: "destructive"
            });
            event.target.value = '';
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

    const handleFixMobileDevice = async () => {
        if (!window.confirm('Lock this user so they can only log in from the current mobile device?')) {
            return;
        }
        try {
            setIsUpdatingDevice(true);
            const response = await axiosInstance.post(`/User/${userId}/mobile-device/fix`);
            setUser((prev) => ({ ...prev, mobileDevice: response.data.mobileDevice }));
            toast({
                title: 'Device Fixed',
                description: response.data.message || 'This user can only log in from this phone.',
                variant: 'success',
            });
        } catch (err) {
            toast({
                title: 'Could not fix device',
                description: err.response?.data?.message || 'Failed to lock this user to the current phone.',
                variant: 'destructive',
            });
        } finally {
            setIsUpdatingDevice(false);
        }
    };

    const handleChangeMobileDevice = async () => {
        if (!window.confirm('Remove the current device? The next phone that logs in will become the new current device. Until you click Fix, they can log in from any phone.')) {
            return;
        }
        try {
            setIsUpdatingDevice(true);
            const response = await axiosInstance.post(`/User/${userId}/mobile-device/change`);
            setUser((prev) => ({ ...prev, mobileDevice: response.data.mobileDevice }));
            toast({
                title: 'Device unlocked',
                description: response.data.message || 'Current device removed. Next login will set a new phone.',
                variant: 'success',
            });
        } catch (err) {
            toast({
                title: 'Could not change device',
                description: err.response?.data?.message || 'Failed to change device details.',
                variant: 'destructive',
            });
        } finally {
            setIsUpdatingDevice(false);
        }
    };

    const handleToggleLoginThrough = async (channel, checked) => {
        if (isUpdatingLoginThrough || user?.isSystemAdmin) return;
        if (!user?.employeeId || user.employeeId === 'System Users') {
            toast({
                title: 'Link an employee first',
                description: 'App and Web access belong to the linked employee profile.',
                variant: 'destructive',
            });
            return;
        }
        const next = {
            portalApp: user.loginThrough?.portalApp === true,
            web: user.loginThrough?.web === true,
            [channel]: checked,
        };
        try {
            setIsUpdatingLoginThrough(true);
            const response = await axiosInstance.patch(`/User/${userId}`, { loginThrough: next });
            const saved = response.data?.user?.loginThrough || next;
            setUser((prev) => ({
                ...prev,
                loginThrough: saved,
                employee: prev?.employee ? { ...prev.employee, loginThrough: saved } : prev?.employee,
            }));
            toast({
                title: 'Access updated',
                description: `${channel === 'portalApp' ? 'App access' : 'Web access'} ${checked ? 'enabled' : 'disabled'}.`,
                variant: 'success',
            });
        } catch (err) {
            toast({
                title: 'Could not update access',
                description: err.response?.data?.message || 'Failed to update App / Web access.',
                variant: 'destructive',
            });
        } finally {
            setIsUpdatingLoginThrough(false);
        }
    };

    return (
        <PermissionGuard moduleId="settings_user_group" permissionType="view">
            <div className="flex min-h-screen bg-white">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />

                    {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-gray-500">Loading profile...</div>
                    </div>
                    ) : error || !user ? (
                    <div className="p-3 sm:p-5 lg:p-8">
                        <div className="bg-red-50 text-red-600 p-3 sm:p-4 rounded-lg text-xs sm:text-sm">
                            {error || 'User not found'}
                        </div>
                        <ListReturnBackButton onNavigate={handleUserListBack} className="mt-3 sm:mt-4" />
                    </div>
                    ) : (
                    <div className="p-3 sm:p-5 lg:p-8 max-w-5xl mx-auto w-full">
                        {/* Header Actions */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-8">
                            <ListReturnBackButton onNavigate={handleUserListBack} />
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                <button
                                    type="button"
                                    {...navHrefProps(`/Settings/User/edit/${userId}`)}
                                    onClick={() => router.push(`/Settings/User/edit/${userId}`)}
                                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap"
                                >
                                    <Edit2 size={16} />
                                    Edit Profile
                                </button>
                                <button
                                    onClick={handleStatusChange}
                                    disabled={isUpdatingStatus}
                                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap ${user.status === 'Active'
                                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                                        }`}
                                >
                                    {isUpdatingStatus ? 'Updating...' : user.status === 'Active' ? 'Deactivate' : 'Activate'}
                                </button>
                            </div>
                        </div>

                        {/* Profile Content */}
                        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 sm:p-6 md:p-8 lg:p-12 flex flex-col md:flex-row gap-6 sm:gap-8 lg:gap-12">

                                {/* Left Column: Avatar */}
                                <div className="flex flex-col items-center bg-gray-50/50 p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl border border-gray-100">
                                    <div className="text-center mb-4 sm:mb-6 lg:mb-8">
                                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{user.name}</h2>
                                        <p className="text-blue-600 font-semibold mt-1 flex items-center justify-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                            {user.group?.name || 'No Group'}
                                        </p>
                                    </div>

                                    <div className="relative group">
                                        <div className="w-56 h-56 rounded-full border-8 border-white overflow-hidden shadow-xl bg-white flex items-center justify-center relative">
                                            {user.profilePicture && !imageError ? (
                                                <img
                                                    src={
                                                        String(user.profilePicture).startsWith('http')
                                                            ? user.profilePicture
                                                            : `https://${user.profilePicture}`
                                                    }
                                                    alt={user.name || 'User'}
                                                    width={224}
                                                    height={224}
                                                    className="object-cover w-full h-full"
                                                    onError={() => setImageError(true)}
                                                />
                                            ) : (
                                                <div className="text-gray-300">
                                                    <UserIcon size={100} strokeWidth={1} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Camera Overlay */}
                                        <label className="absolute bottom-4 right-4 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full cursor-pointer shadow-xl transition-all scale-95 group-hover:scale-105 active:scale-95">
                                            <Camera size={22} />
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept={ERP_JPEG_ACCEPT}
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
                                        <DetailItem
                                            icon={<Clock size={20} className="text-blue-500" />}
                                            label="Last Login"
                                            value={formatDeviceSeen(user.lastLogin || user.mobileDevice?.lastSeenAt)}
                                        />
                                        <LoginAccessItem
                                            icon={<Smartphone size={20} className="text-blue-500" />}
                                            label="App Access"
                                            checked={user.loginThrough?.portalApp === true}
                                            disabled={
                                                isUpdatingLoginThrough ||
                                                user.isSystemAdmin ||
                                                !user.employeeId ||
                                                user.employeeId === 'System Users'
                                            }
                                            onChange={(checked) => handleToggleLoginThrough('portalApp', checked)}
                                        />
                                        <LoginAccessItem
                                            icon={<Monitor size={20} className="text-blue-500" />}
                                            label="Web Access"
                                            checked={user.loginThrough?.web === true}
                                            disabled={
                                                isUpdatingLoginThrough ||
                                                user.isSystemAdmin ||
                                                !user.employeeId ||
                                                user.employeeId === 'System Users'
                                            }
                                            onChange={(checked) => handleToggleLoginThrough('web', checked)}
                                        />
                                    </div>

                                    {!user.isSystemAdmin && (
                                        <CurrentDevicePanel
                                            device={user.mobileDevice}
                                            lastLogin={user.lastLogin}
                                            busy={isUpdatingDevice}
                                            onFix={handleFixMobileDevice}
                                            onChange={handleChangeMobileDevice}
                                        />
                                    )}
                                    <WebLoginPanel webLogin={user.webLogin} lastLogin={user.lastLogin} />
                                    {!user.isSystemAdmin ? (
                                        <AttendancePunchPanel attendance={user.todayAttendance} />
                                    ) : null}
                                </div>

                            </div>
                        </div>
                    </div>
                    )}

                {isPasswordModalOpen && user ? (
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
                ) : null}
                </div>
            </div>
        </PermissionGuard>
    );
}

function DetailItem({ icon, label, value, emptyDisplay = '-' }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                {icon}
                {label}
            </span>
            <span className="text-base font-semibold text-gray-800">{value || emptyDisplay}</span>
        </div>
    );
}

function LoginAccessItem({ icon, label, checked, disabled, onChange }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                {icon}
                {label}
            </span>
            <label className={`mt-1 inline-flex items-center gap-2 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
                />
                <span className="text-base font-semibold text-gray-800">
                    {checked ? 'Enabled' : 'Disabled'}
                </span>
            </label>
        </div>
    );
}

function formatDeviceSeen(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
}

function toFiniteNumber(value) {
    if (value == null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(String(value).trim());
    return Number.isFinite(n) ? n : null;
}

function parseLoginCoordinates(device) {
    let lat = toFiniteNumber(device?.latitude);
    let lng = toFiniteNumber(device?.longitude);
    if (lat == null || lng == null) {
        const text = String(device?.location || '').trim();
        const match = text.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
        if (match) {
            lat = toFiniteNumber(match[1]);
            lng = toFiniteNumber(match[2]);
        }
    }
    if (lat == null || lng == null) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
}

function prefersAppleMaps() {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent || '');
}

function mapsHrefForLoginLocation(device) {
    const coords = parseLoginCoordinates(device);
    const locationText = String(device?.location || '').trim();
    const apple = prefersAppleMaps();
    if (coords) {
        const { lat, lng } = coords;
        if (apple) {
            return {
                href: `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent('Login location')}`,
                provider: 'Apple Maps',
            };
        }
        return {
            href: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
            provider: 'Google Maps',
        };
    }
    if (!locationText) return null;
    const query = encodeURIComponent(locationText);
    if (apple) {
        return { href: `https://maps.apple.com/?q=${query}`, provider: 'Apple Maps' };
    }
    return {
        href: `https://www.google.com/maps/search/?api=1&query=${query}`,
        provider: 'Google Maps',
    };
}

function LoginLocationPin({ device, emptyDisplay = '-' }) {
    const maps = mapsHrefForLoginLocation(device);
    if (!maps) {
        return <span className="text-base font-semibold text-gray-800">{emptyDisplay}</span>;
    }

    return (
        <a
            href={maps.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-1 inline-flex items-center gap-3 rounded-xl border border-blue-100 bg-white px-3 py-2 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            title={`Open login location in ${maps.provider}`}
        >
            <span className="relative flex h-11 w-9 shrink-0 items-end justify-center">
                <span className="absolute bottom-0 h-1.5 w-4 rounded-full bg-black/20 blur-[1px]" />
                <MapPin
                    size={36}
                    className="relative text-red-500 drop-shadow-md transition group-hover:-translate-y-0.5 group-hover:scale-110"
                    fill="currentColor"
                    strokeWidth={1.6}
                />
            </span>
            <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-gray-900">Open in {maps.provider}</span>
                <span className="text-xs text-blue-600">Click the pin to open this login GPS</span>
            </span>
        </a>
    );
}

function CurrentDevicePanel({ device, lastLogin, busy, onFix, onChange }) {
    const status = device?.status === 'fixed' ? 'fixed' : 'not_fixed';
    const isFixed = status === 'fixed';
    const deviceName = String(device?.deviceName || '').trim();
    const location = String(device?.location || '').trim();
    const ipAddress = String(device?.ipAddress || '').trim();
    const hasDevice = Boolean(
        device?.hasDevice ||
            device?.deviceId ||
            deviceName ||
            location ||
            ipAddress ||
            device?.latitude != null ||
            device?.longitude != null
    );
    const canFix = Boolean(device?.canFix || String(device?.deviceId || '').trim());
    const lastSeen = formatDeviceSeen(device?.lastSeenAt || (hasDevice ? lastLogin : null));
    const coords = punchCoords(device);

    return (
        <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/80 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                    <h4 className="text-base font-bold text-gray-900">Current Device Logged In</h4>
                    <p className="text-xs text-gray-500 mt-1">
                        Login info from the VeRP mobile app: device, GPS location, and IP.
                    </p>
                </div>
                <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        isFixed
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                    }`}
                >
                    {device?.statusLabel || (isFixed ? 'Fixed' : 'Not Fixed')}
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <DetailItem
                    icon={<Smartphone size={18} className="text-blue-500" />}
                    label="Device Name"
                    value={deviceName}
                    emptyDisplay={hasDevice ? '-' : ''}
                />
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <MapPin size={18} className="text-blue-500" />
                        Location
                    </span>
                    {coords ? (
                        <LocationMapPin coords={coords} kind="app" />
                    ) : (
                        <LoginLocationPin device={device} emptyDisplay={hasDevice ? '-' : ''} />
                    )}
                </div>
                <DetailItem
                    icon={<Globe size={18} className="text-blue-500" />}
                    label="IP Address"
                    value={ipAddress}
                    emptyDisplay={hasDevice ? '-' : ''}
                />
                <DetailItem
                    icon={<Clock size={18} className="text-blue-500" />}
                    label="Last Login"
                    value={lastSeen}
                    emptyDisplay={hasDevice ? '-' : ''}
                />
            </div>

            {!hasDevice ? (
                <p className="text-sm text-gray-600 mb-5">
                    No mobile has logged in yet
                </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={onFix}
                    disabled={busy || isFixed || !canFix}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {busy ? 'Saving...' : 'Fix'}
                </button>
                <button
                    type="button"
                    onClick={onChange}
                    disabled={busy || (!hasDevice && !isFixed)}
                    className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-xs sm:text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Change device
                </button>
            </div>
        </div>
    );
}

function WebLoginPanel({ webLogin, lastLogin }) {
    const hasSession = Boolean(webLogin?.hasSession);
    const coords = punchCoords(webLogin);
    const ipAddress = String(webLogin?.ipAddress || '').trim();
    const deviceName = String(webLogin?.deviceName || '').trim();
    const lastSeen = formatDeviceSeen(webLogin?.lastSeenAt || (hasSession ? lastLogin : null));

    return (
        <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5 sm:p-6">
            <div className="mb-4">
                <h4 className="text-base font-bold text-gray-900">Web login (laptop)</h4>
                <p className="text-xs text-gray-500 mt-1">
                    Current location captured when this user signs in on the website from a laptop or browser.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailItem
                    icon={<Monitor size={18} className="text-indigo-500" />}
                    label="Device"
                    value={deviceName}
                    emptyDisplay={hasSession ? '-' : ''}
                />
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <MapPin size={18} className="text-indigo-500" />
                        Location
                    </span>
                    {coords ? (
                        <LocationMapPin coords={coords} kind="web" />
                    ) : (
                        <span className="text-base font-semibold text-gray-800">
                            {hasSession ? 'No GPS' : '-'}
                        </span>
                    )}
                </div>
                <DetailItem
                    icon={<Globe size={18} className="text-indigo-500" />}
                    label="IP Address"
                    value={ipAddress}
                    emptyDisplay={hasSession ? '-' : ''}
                />
                <DetailItem
                    icon={<Clock size={18} className="text-indigo-500" />}
                    label="Last Web Login"
                    value={lastSeen}
                    emptyDisplay={hasSession ? '-' : ''}
                />
            </div>

            {!hasSession ? (
                <p className="text-sm text-gray-600 mt-4">No website login location yet</p>
            ) : null}
        </div>
    );
}

function AttendancePunchPanel({ attendance }) {
    const hasPunch = Boolean(attendance?.timeIn || attendance?.timeOut);

    return (
        <div className="mt-6 rounded-2xl border border-rose-100 bg-rose-50/60 p-5 sm:p-6">
            <div className="mb-4">
                <h4 className="text-base font-bold text-gray-900">Check-in / Check-out location</h4>
                <p className="text-xs text-gray-500 mt-1">
                    Today&apos;s dashboard punch GPS from the website or mobile app.
                </p>
            </div>

            {!hasPunch ? (
                <p className="text-sm text-gray-600">No check-in yet today</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Check-in
                        </span>
                        <PunchLocationPinCell
                            location={attendance.checkInLocation}
                            time={attendance.timeIn}
                            kind="in"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Check-out
                        </span>
                        <PunchLocationPinCell
                            location={attendance.checkOutLocation}
                            time={attendance.timeOut}
                            kind="out"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Type
                        </span>
                        <PunchTypeCell
                            punchSource={attendance.punchSource}
                            checkOutSource={attendance.checkOutSource}
                            timeOut={attendance.timeOut}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
