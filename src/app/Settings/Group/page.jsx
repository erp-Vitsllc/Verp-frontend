'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axiosInstance from '@/utils/axios';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import { hasAnyPermission, isAdmin } from '@/utils/permissions';
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

export default function GroupPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState(null);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState(null);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get('/User/groups/all');
            setGroups(response.data.groups || []);
        } catch (err) {
            console.error('Error fetching groups:', err);
            setError(err.response?.data?.message || 'Failed to fetch groups');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (groupId) => {
        router.push(`/Settings/Group/${groupId}/edit`);
    };

    const handleDeleteClick = (groupId) => {
        setGroupToDelete(groupId);
        setConfirmDeleteOpen(true);
    };

    const handleDelete = async () => {
        if (!groupToDelete) return;

        setDeletingId(groupToDelete);
        setConfirmDeleteOpen(false);
        try {
            await axiosInstance.delete(`/User/groups/${groupToDelete}`);
            toast({
                title: "Group Deleted",
                description: "Group has been deleted successfully.",
                variant: "success"
            });
            fetchGroups(); // Refresh the list
        } catch (err) {
            console.error('Error deleting group:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Failed to delete group';
            toast({
                title: "Delete Failed",
                description: errorMessage,
                variant: "destructive"
            });
        } finally {
            setDeletingId(null);
            setGroupToDelete(null);
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

        // Check if user has permission to view settings
        if (!isAdmin() && !hasAnyPermission('settings_user_group')) {
            router.replace('/dashboard');
        }
    }, [router]);

    // Don't render if user doesn't have permission
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (!token) {
            return null;
        }
        if (!isAdmin() && !hasAnyPermission('settings_user_group')) {
            return null;
        }
    }

    return (
        <PermissionGuard moduleId="settings_user_group" permissionType="view">
            <div className="flex min-h-screen" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col">
                    <Navbar />
                    <div className="p-8">
                        {/* Header */}
                        <div className="mb-6">
                            <h1 className="text-3xl font-bold text-gray-800 mb-2">Groups</h1>
                            <nav className="text-sm text-gray-600">
                                <span>Home</span>
                                <span className="mx-2">/</span>
                                <span>Settings</span>
                                <span className="mx-2">/</span>
                                <span className="text-gray-800 font-medium">Groups</span>
                            </nav>
                        </div>

                        {/* Create Button */}
                        <div className="flex items-center justify-end mb-4">
                            <button
                                onClick={() => router.push('/Settings/Group/create')}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                            >
                                <span>+</span>
                                Create Group
                            </button>
                        </div>

                        {/* Groups List */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            {loading ? (
                                <div className="p-8 text-center text-gray-500">Loading groups...</div>
                            ) : error ? (
                                <div className="p-8 text-center text-red-500">{error}</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {groups.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                                                        No groups found
                                                    </td>
                                                </tr>
                                            ) : (
                                                groups.map((group) => (
                                                    <tr key={group._id} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            {group.name}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${group.status === 'Active'
                                                                    ? 'bg-green-100 text-green-800'
                                                                    : 'bg-gray-100 text-gray-800'
                                                                }`}>
                                                                {group.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                            <div className="flex items-center gap-3">
                                                                <button
                                                                    onClick={() => handleEdit(group._id)}
                                                                    className="text-blue-600 hover:text-blue-700 hover:brightness-110 active:brightness-90 transition-all duration-200 font-medium"
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteClick(group._id)}
                                                                    disabled={deletingId === group._id}
                                                                    className="text-red-600 hover:text-red-700 hover:brightness-110 active:brightness-90 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                    {deletingId === group._id ? 'Deleting...' : 'Delete'}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Group?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this group? This action cannot be undone.
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

