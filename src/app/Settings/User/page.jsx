'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axiosInstance from '@/utils/axios';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import { hasAnyPermission, isAdmin, hasPermission } from '@/utils/permissions';
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
} from "@/components/ui/alert-dialog";

export default function UserPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);
    const [total, setTotal] = useState(0);
    const [statusFilter, setStatusFilter] = useState('Active');
    const [searchTerm, setSearchTerm] = useState('');
    const [deletingUserId, setDeletingUserId] = useState(null);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);

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
        router.push(`/Settings/User/${userId}/edit`);
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
            <div className="flex min-h-screen bg-[#F2F6F9]">
                <Sidebar />
                <div className="flex-1 flex flex-col">
                    <Navbar />
                    <div className="p-8">
                        {/* Header */}
                        <div className="mb-6">
                            <h1 className="text-3xl font-bold text-gray-800 mb-2">Users</h1>
                        </div>

                        {/* Filters and Create Button */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => {
                                        setStatusFilter(e.target.value);
                                        setPage(1);
                                    }}
                                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="All">All Status</option>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                    <option value="Suspended">Suspended</option>
                                </select>
                            </div>
                            {(isAdmin() || hasPermission('settings_user_group', 'isCreate')) && (
                                <button
                                    onClick={() => router.push('/Settings/User/create')}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                                >
                                    <span>+</span>
                                    Create
                                </button>
                            )}
                        </div>

                        {/* Table Controls */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">Show</span>
                                <select
                                    value={limit}
                                    onChange={(e) => {
                                        setLimit(Number(e.target.value));
                                        setPage(1);
                                    }}
                                    className="px-3 py-1 border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                                <span className="text-sm text-gray-600">entries</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">Search:</span>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setPage(1);
                                    }}
                                    placeholder="Search users..."
                                    className="px-3 py-1 border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            {loading ? (
                                <div className="p-8 text-center text-gray-500">Loading users...</div>
                            ) : error ? (
                                <div className="p-8 text-center text-red-500">{error}</div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 border-b border-gray-200">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                        SL.NO
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                        USER NAME
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                        ACCOUNT NAME
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                        STATUS
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                        EMPLOYEE ID
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                        GROUP
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">ACTIONS</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {users.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                                            No users found
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    users.map((user) => (
                                                        <tr key={user.id} className="hover:bg-gray-50">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                {user.number}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                {user.username || '-'}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <a
                                                                    href={`/Settings/User/${user.id}`}
                                                                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                                                                >
                                                                    {user.name}
                                                                </a>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.status === 'Active'
                                                                    ? 'bg-green-100 text-green-800'
                                                                    : user.status === 'Inactive'
                                                                        ? 'bg-gray-100 text-gray-800'
                                                                        : 'bg-red-100 text-red-800'
                                                                    }`}>
                                                                    {user.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                {user.employeeId || '-'}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                {user.isAdministrator ? (
                                                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                                                        Administrator
                                                                    </span>
                                                                ) : (
                                                                    user.group || '-Not Assigned-'
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                                <div className="flex items-center gap-3">
                                                                    {(isAdmin() || hasPermission('settings_user_group', 'isEdit')) && (
                                                                        <button
                                                                            onClick={() => handleEdit(user.id)}
                                                                            className="text-blue-600 hover:text-blue-700 hover:brightness-110 active:brightness-90 transition-all duration-200 font-medium"
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                    )}
                                                                    {(isAdmin() || hasPermission('settings_user_group', 'isDelete')) && (
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
                                        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                                            <div className="text-sm text-gray-700">
                                                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} entries
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                                    disabled={page === 1}
                                                    className="px-3 py-1 border border-gray-300 rounded bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                                >
                                                    Previous
                                                </button>
                                                <button
                                                    onClick={() => setPage(p => p + 1)}
                                                    disabled={page * limit >= total}
                                                    className="px-3 py-1 border border-gray-300 rounded bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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

