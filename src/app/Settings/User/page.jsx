'use client';

import { useEffect, useState, useMemo } from 'react';
import { usePersistListReturnState } from '@/hooks/usePersistListReturnState';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import axiosInstance from '@/utils/axios';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import NavButton from '@/components/NavButton';
import PermissionGuard from '@/components/PermissionGuard';
import { hasAnyPermission, isAdmin, hasPermission } from '@/utils/permissions';
import { useToast } from '@/hooks/use-toast';
import { navHrefProps } from '@/utils/linkContextMenu';
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

function UserPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(() => parseInt(searchParams.get('page') || '1', 10) || 1);
    const [limit, setLimit] = useState(() => parseInt(searchParams.get('limit') || '50', 10) || 50);
    const [total, setTotal] = useState(0);
    const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'Active');
    const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
    const [deletingUserId, setDeletingUserId] = useState(null);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);

    const listReturnParams = useMemo(() => ({
        page,
        limit,
        status: statusFilter,
        search: searchTerm,
    }), [page, limit, statusFilter, searchTerm]);

    usePersistListReturnState(listReturnParams);

    useEffect(() => {
        const p = searchParams.get('page');
        if (p) setPage(parseInt(p, 10) || 1);
        const l = searchParams.get('limit');
        if (l) setLimit(parseInt(l, 10) || 50);
        const status = searchParams.get('status');
        if (status) setStatusFilter(status);
        const search = searchParams.get('search');
        if (search) setSearchTerm(search);
    }, [searchParams]);

    useEffect(() => {
        fetchUsers();
    }, [page, limit, statusFilter, searchTerm]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                status: statusFilter,
                ...(searchTerm && { search: searchTerm })
            });

            const response = await axiosInstance.get(`/User?${params}`);
            setUsers(response.data.users || []);
            setTotal(response.data.pagination?.total || 0);
        } catch (err) {
            console.error('Error fetching users:', err);
            setError(err.response?.data?.message || 'Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (userId) => {
        setUserToDelete(userId);
        setConfirmDeleteOpen(true);
    };

    const handleDelete = async () => {
        if (!userToDelete) return;

        setDeletingUserId(userToDelete);
        setConfirmDeleteOpen(false);
        try {
            await axiosInstance.delete(`/User/${userToDelete}`);
            toast({
                title: "User Deleted",
                description: "User has been deleted successfully.",
                variant: "success"
            });
            fetchUsers();
        } catch (err) {
            console.error('Error deleting user:', err);
            toast({
                title: "Delete Failed",
                description: err.response?.data?.message || 'Failed to delete user',
                variant: "destructive"
            });
        } finally {
            setDeletingUserId(null);
            setUserToDelete(null);
        }
    };

    const handleEdit = (userId) => {
        router.push(`/Settings/User/edit/${userId}`);
    };

    const [mounted, setMounted] = useState(false);

    // Handle client-side mounting to prevent hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    // Check permission before rendering
    useEffect(() => {
        if (!mounted) return;

        const token = localStorage.getItem('token');
        if (!token) {
            router.replace('/login');
            return;
        }

        // Check if user has permission to view settings
        if (!isAdmin() && !hasAnyPermission('settings_user_group')) {
            router.replace('/dashboard');
        }
    }, [router, mounted]);

    return (
        <PermissionGuard moduleId="settings_user_group" permissionType="view">
            <div className="flex min-h-screen bg-[#F2F6F9] w-full max-w-full overflow-x-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden">
                        {/* Header */}
                        <div className="mb-4 sm:mb-6">
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">Users</h1>
                        </div>

                        {/* Filters and Create Button */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => {
                                        setStatusFilter(e.target.value);
                                        setPage(1);
                                    }}
                                    className="px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg bg-white text-xs sm:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="All">All Status</option>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                    <option value="Suspended">Suspended</option>
                                </select>
                            </div>
                            {mounted && (isAdmin() || hasPermission('settings_user_group', 'isCreate')) && (
                                <NavButton
                                    href="/Settings/User/create"
                                    router={router}
                                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-colors text-xs sm:text-sm whitespace-nowrap"
                                >
                                    <span>+</span>
                                    Create
                                </NavButton>
                            )}
                        </div>

                        {/* Table Controls */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs sm:text-sm text-gray-600">Show</span>
                                <select
                                    value={limit}
                                    onChange={(e) => {
                                        setLimit(Number(e.target.value));
                                        setPage(1);
                                    }}
                                    className="px-2 sm:px-3 py-1 border border-gray-300 rounded bg-white text-xs sm:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                                <span className="text-xs sm:text-sm text-gray-600">entries</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs sm:text-sm text-gray-600">Search:</span>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setPage(1);
                                    }}
                                    placeholder="Search users..."
                                    className="px-2 sm:px-3 py-1 border border-gray-300 rounded bg-white text-xs sm:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto min-w-0"
                                />
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden w-full max-w-full">
                            {loading ? (
                                <div className="p-4 sm:p-8 text-center text-xs sm:text-sm text-gray-500">Loading users...</div>
                            ) : error ? (
                                <div className="p-4 sm:p-8 text-center text-xs sm:text-sm text-red-500">{error}</div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto w-full max-w-full">
                                        <table className="w-full min-w-[720px] table-auto text-xs sm:text-sm">
                                            <thead className="bg-gray-50 border-b border-gray-200">
                                                <tr>
                                                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                        SL.NO
                                                    </th>
                                                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                        USER NAME
                                                    </th>
                                                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                        ACCOUNT NAME
                                                    </th>
                                                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                        STATUS
                                                    </th>
                                                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                        EMPLOYEE ID
                                                    </th>
                                                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                        GROUP
                                                    </th>
                                                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-700 uppercase tracking-wider">ACTIONS</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {users.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={7} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-500">
                                                            No users found
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    users.map((user) => (
                                                        <tr key={user.id} className="hover:bg-gray-50">
                                                            <td className="px-3 sm:px-6 py-2.5 sm:py-4 whitespace-nowrap text-gray-900">
                                                                {user.number}
                                                            </td>
                                                            <td className="px-3 sm:px-6 py-2.5 sm:py-4 whitespace-nowrap text-gray-900">
                                                                {user.username || '-'}
                                                            </td>
                                                            <td className="px-3 sm:px-6 py-2.5 sm:py-4 whitespace-nowrap">
                                                                <a
                                                                    href={`/Settings/User/${user.id}`}
                                                                    className="font-medium text-blue-600 hover:text-blue-800"
                                                                >
                                                                    {user.name}
                                                                </a>
                                                            </td>
                                                            <td className="px-3 sm:px-6 py-2.5 sm:py-4 whitespace-nowrap">
                                                                <span className={`px-2 py-1 text-[10px] sm:text-xs font-semibold rounded-full ${user.status === 'Active'
                                                                    ? 'bg-green-100 text-green-800'
                                                                    : user.status === 'Inactive'
                                                                        ? 'bg-gray-100 text-gray-800'
                                                                        : 'bg-red-100 text-red-800'
                                                                    }`}>
                                                                    {user.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 sm:px-6 py-2.5 sm:py-4 whitespace-nowrap text-gray-900">
                                                                {user.employeeId || '-'}
                                                            </td>
                                                            <td className="px-3 sm:px-6 py-2.5 sm:py-4 whitespace-nowrap text-gray-900">
                                                                {user.isAdministrator ? (
                                                                    <span className="px-2 py-1 text-[10px] sm:text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                                                        Administrator
                                                                    </span>
                                                                ) : (
                                                                    user.group || '-Not Assigned-'
                                                                )}
                                                            </td>
                                                            <td className="px-3 sm:px-6 py-2.5 sm:py-4 whitespace-nowrap font-medium">
                                                                <div className="flex items-center gap-2 sm:gap-3">
                                                                    {mounted && (isAdmin() || hasPermission('settings_user_group', 'isEdit')) && (
                                                                        <button
                                                                            type="button"
                                                                            {...navHrefProps(`/Settings/User/edit/${user.id}`)}
                                                                            onClick={() => handleEdit(user.id)}
                                                                            className="text-blue-600 hover:text-blue-700 hover:brightness-110 active:brightness-90 transition-all duration-200 font-medium"
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                    )}
                                                                    {mounted && (isAdmin() || hasPermission('settings_user_group', 'isDelete')) && !user.isSystemAdmin && (
                                                                        <button
                                                                            onClick={() => handleDeleteClick(user.id)}
                                                                            disabled={deletingUserId === user.id}
                                                                            className="text-red-600 hover:text-red-700 hover:brightness-110 active:brightness-90 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        >
                                                                            {deletingUserId === user.id ? 'Deleting...' : 'Delete'}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination */}
                                    {total > limit && (
                                        <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="text-xs sm:text-sm text-gray-700">
                                                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} entries
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                                    disabled={page === 1}
                                                    className="px-2.5 sm:px-3 py-1 border border-gray-300 rounded bg-white text-xs sm:text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                                >
                                                    Previous
                                                </button>
                                                <button
                                                    onClick={() => setPage(p => p + 1)}
                                                    disabled={page * limit >= total}
                                                    className="px-2.5 sm:px-3 py-1 border border-gray-300 rounded bg-white text-xs sm:text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete User?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this user? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PermissionGuard>
    );
}

export default function UserPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <UserPageContent />
        </Suspense>
    );
}
