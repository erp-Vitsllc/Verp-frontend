'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, Globe, MapPin, Monitor, Search, Smartphone, Users } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import UserGroupDeviceTabs from '@/app/Settings/UserGroupDeviceTabs';
import { hasAnyPermission, hasPermission, isAdmin } from '@/utils/permissions';
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function pictureSrc(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.startsWith('http') ? raw : `https://${raw}`;
}

function timeAgo(value) {
    if (!value) return '—';
    const diff = Date.now() - new Date(value).getTime();
    if (!Number.isFinite(diff) || diff < 0) return 'Just now';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
}

function deviceLabel(row) {
    return row.os || row.deviceName || (row.source === 'app' ? 'Mobile' : 'Web browser');
}

export default function DevicesPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sessions, setSessions] = useState([]);
    const [search, setSearch] = useState('');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [pending, setPending] = useState(null);
    const [busyKey, setBusyKey] = useState('');

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        const token = localStorage.getItem('token');
        if (!token) {
            router.replace('/login');
            return;
        }
        if (!isAdmin() && !hasAnyPermission('settings_user_group')) {
            router.replace('/dashboard');
        }
    }, [router, mounted]);

    const loadSessions = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await axiosInstance.get('/User/devices');
            setSessions(response.data.sessions || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load devices');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (mounted) loadSessions();
    }, [mounted]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        return sessions.filter((row) => {
            if (sourceFilter !== 'all' && row.source !== sourceFilter) return false;
            if (!query) return true;
            const haystack = [
                row.name,
                row.username,
                row.deviceName,
                row.os,
                row.ipAddress,
                row.location,
            ].join(' ').toLowerCase();
            return haystack.includes(query);
        });
    }, [sessions, search, sourceFilter]);

    const canTerminate = mounted && (isAdmin() || hasPermission('settings_user_group', 'isEdit'));

    const confirmTerminate = async () => {
        if (!pending) return;
        const key = `${pending.userId}:${pending.source}:${pending.deviceId}`;
        setBusyKey(key);
        setPending(null);
        try {
            await axiosInstance.delete('/User/devices', {
                data: {
                    userId: pending.userId,
                    source: pending.source,
                    deviceId: pending.deviceId,
                },
            });
            toast({
                title: 'Device removed',
                description: 'The next login from this device needs OTP.',
                variant: 'success',
            });
            await loadSessions();
        } catch (err) {
            toast({
                title: 'Could not remove device',
                description: err.response?.data?.message || 'Failed to remove device',
                variant: 'destructive',
            });
        } finally {
            setBusyKey('');
        }
    };

    return (
        <PermissionGuard moduleId="settings_user_group" permissionType="view">
            <div className="flex min-h-screen bg-[#F2F6F9] w-full max-w-full overflow-x-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden">
                        <UserGroupDeviceTabs />

                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col lg:flex-row lg:items-center gap-4 border-b border-gray-100">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <div className="mt-0.5 text-blue-600">
                                        <Users size={22} />
                                    </div>
                                    <div>
                                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Active User Sessions</h1>
                                        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                                            Monitor and manage signed-in devices. A saved device is removed after 30 days.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                    <label className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search users, devices or IP addresses..."
                                            className="w-full sm:w-72 pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </label>
                                    <label className="relative">
                                        <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                        <select
                                            value={sourceFilter}
                                            onChange={(e) => setSourceFilter(e.target.value)}
                                            className="pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="all">Filter</option>
                                            <option value="web">Web</option>
                                            <option value="app">App</option>
                                        </select>
                                    </label>
                                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-sm font-semibold whitespace-nowrap">
                                        <span className="w-2 h-2 rounded-full bg-green-500" />
                                        {filtered.length} Active
                                    </span>
                                </div>
                            </div>

                            {loading ? (
                                <div className="p-8 text-center text-sm text-gray-500">Loading devices...</div>
                            ) : error ? (
                                <div className="p-8 text-center text-sm text-red-500">{error}</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[880px] text-sm">
                                        <thead className="bg-gray-50 text-gray-500">
                                            <tr>
                                                {['User', 'Device', 'IP Address', 'Location', 'Last Active', 'Source', 'Status', 'Action'].map((heading) => (
                                                    <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                                                        {heading}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filtered.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                                                        No saved devices
                                                    </td>
                                                </tr>
                                            ) : filtered.map((row) => {
                                                const key = `${row.userId}:${row.source}:${row.deviceId}`;
                                                const photo = pictureSrc(row.profilePicture);
                                                const initial = String(row.name || '?').trim().charAt(0).toUpperCase();
                                                return (
                                                    <tr key={key} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                {photo ? (
                                                                    <img src={photo} alt="" className="w-9 h-9 rounded-full object-cover bg-gray-100" />
                                                                ) : (
                                                                    <span className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                                                                        {initial}
                                                                    </span>
                                                                )}
                                                                <span className="font-semibold text-gray-900">{row.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-700">
                                                            <span className="inline-flex items-center gap-2">
                                                                {row.source === 'app' ? (
                                                                    <Smartphone size={16} className="text-green-600" />
                                                                ) : (
                                                                    <Monitor size={16} className="text-blue-600" />
                                                                )}
                                                                {deviceLabel(row)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600">{row.ipAddress || '—'}</td>
                                                        <td className="px-4 py-3 text-gray-600">
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <MapPin size={14} className="text-gray-400" />
                                                                {row.location || '—'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600">{timeAgo(row.lastSeenAt)}</td>
                                                        <td className="px-4 py-3">
                                                            <span className="inline-flex items-center gap-1.5 text-blue-600 font-medium">
                                                                {row.source === 'app' ? <Smartphone size={15} /> : <Globe size={15} />}
                                                                {row.source === 'app' ? 'App' : 'Web'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                                Active
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {canTerminate ? (
                                                                <button
                                                                    type="button"
                                                                    disabled={busyKey === key}
                                                                    onClick={() => setPending(row)}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
                                                                >
                                                                    Terminate Session
                                                                </button>
                                                            ) : (
                                                                <span className="text-xs text-gray-400">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="px-4 sm:px-6 py-3 text-xs text-gray-500 border-t border-gray-100">
                                Showing {filtered.length} active session{filtered.length === 1 ? '' : 's'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <AlertDialog open={Boolean(pending)} onOpenChange={(open) => { if (!open) setPending(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Terminate this session?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This device will be removed. The next login from it needs OTP again. If that OTP is correct, the device is saved for another 30 days.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmTerminate} className="bg-red-600 hover:bg-red-700">
                            Terminate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PermissionGuard>
    );
}
