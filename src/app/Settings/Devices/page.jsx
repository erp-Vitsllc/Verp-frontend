'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Globe, Monitor, Search, Smartphone, Users } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { LocationMapPin, punchCoords } from '@/app/HRM/Attendance/mark/components/MarkAttendancePunchCells';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import UserGroupDeviceTabs from '@/app/Settings/UserGroupDeviceTabs';
import { hasAnyPermission, hasPermission, isAdmin } from '@/utils/permissions';
import { clearAuthSession } from '@/utils/authSession';
import { getWebDeviceId } from '@/utils/webLoginDevice';
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

function formatPersonName(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/(^|[^a-z])([a-z])/g, (_, sep, letter) => sep + letter.toUpperCase());
}

function sessionCoords(row) {
    const fromFields = punchCoords({
        latitude: row?.latitude,
        longitude: row?.longitude,
        label: row?.location,
    });
    if (fromFields) return fromFields;
    const text = String(row?.location || '').trim();
    const match = text.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) return null;
    return punchCoords({ latitude: match[1], longitude: match[2] });
}

const SORT_COLUMNS = [
    { key: 'user', label: 'User' },
    { key: 'device', label: 'Device' },
    { key: 'ip', label: 'IP Address' },
    { key: 'location', label: 'Location' },
    { key: 'lastActive', label: 'Last Active' },
    { key: 'source', label: 'Source' },
    { key: 'status', label: 'Status' },
];

function sortValue(row, key) {
    if (key === 'user') return formatPersonName(row.name);
    if (key === 'device') return deviceLabel(row);
    if (key === 'ip') return String(row.ipAddress || '');
    if (key === 'location') return String(row.location || '');
    if (key === 'lastActive') return row.lastSeenAt ? new Date(row.lastSeenAt).getTime() : 0;
    if (key === 'source') return row.source === 'app' ? 'App' : 'Web';
    return 'Active';
}

function SessionLocationPin({ row }) {
    const coords = sessionCoords(row);
    if (coords) {
        return <LocationMapPin coords={coords} kind={row.source === 'app' ? 'app' : 'web'} />;
    }
    const place = String(row?.location || '').trim();
    return <span className="text-gray-600">{place || '—'}</span>;
}

export default function DevicesPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sessions, setSessions] = useState([]);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState({ key: 'lastActive', dir: 'desc' });
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
        const rows = sessions.filter((row) => {
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
        const direction = sort.dir === 'asc' ? 1 : -1;
        return rows.sort((a, b) => {
            const left = sortValue(a, sort.key);
            const right = sortValue(b, sort.key);
            if (typeof left === 'number' && typeof right === 'number') {
                return (left - right) * direction;
            }
            return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' }) * direction;
        });
    }, [sessions, search, sort]);

    const toggleSort = (key) => {
        setSort((current) => {
            if (current.key === key) {
                return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
            }
            return { key, dir: key === 'lastActive' ? 'desc' : 'asc' };
        });
    };

    const canTerminate = mounted && (isAdmin() || hasPermission('settings_user_group', 'isEdit'));

    const confirmTerminate = async () => {
        if (!pending) return;
        const key = `${pending.userId}:${pending.source}:${pending.deviceId}`;
        setBusyKey(key);
        setPending(null);
        try {
            const removedSelf = pending.source === 'web' && pending.deviceId === getWebDeviceId();
            await axiosInstance.delete('/User/devices', {
                data: {
                    userId: pending.userId,
                    source: pending.source,
                    deviceId: pending.deviceId,
                },
            });
            if (removedSelf) {
                clearAuthSession();
                window.location.href = '/login';
                return;
            }
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
                                                {SORT_COLUMNS.map((column) => {
                                                    const active = sort.key === column.key;
                                                    return (
                                                        <th key={column.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleSort(column.key)}
                                                                className={`inline-flex items-center gap-1 uppercase tracking-wide ${active ? 'text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                                                            >
                                                                {column.label}
                                                                {active ? (
                                                                    sort.dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                                                ) : (
                                                                    <ChevronDown size={14} className="opacity-30" />
                                                                )}
                                                            </button>
                                                        </th>
                                                    );
                                                })}
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                    Action
                                                </th>
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
                                                const personName = formatPersonName(row.name) || 'User';
                                                const initial = personName.charAt(0).toUpperCase();
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
                                                                <span className="font-semibold text-gray-900">{personName}</span>
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
                                                        <td className="px-4 py-3">
                                                            <SessionLocationPin row={row} />
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
