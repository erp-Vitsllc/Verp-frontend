'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { ArrowLeft, FileText, User, Calendar, DollarSign, AlertCircle } from 'lucide-react';
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
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function FineDetailsPage({ params }) {
    const { id } = use(params);
    const router = useRouter();
    const { toast } = useToast();
    const [fine, setFine] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchFineDetails = async () => {
            try {
                setLoading(true);
                const response = await axiosInstance.get(`/Fine/${id}`);
                setFine(response.data);
            } catch (err) {
                console.error('Error fetching fine details:', err);
                setError(err.response?.data?.message || 'Failed to load fine details');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchFineDetails();
        }
    }, [id]);

    const handleApproveFine = async () => {
        try {
            setLoading(true); // Or use a separate loading state for button
            await axiosInstance.put(`/Fine/${fine.fineId}/approve`);

            // Refresh data
            const response = await axiosInstance.get(`/Fine/${id}`);
            setFine(response.data);

            toast({
                title: "Approved",
                description: "Fine approved successfully.",
                variant: "success",
                className: "bg-green-50 border-green-200 text-green-800"
            });

        } catch (err) {
            console.error('Error approving fine:', err);
            toast({
                title: "Error",
                description: err.response?.data?.message || 'Failed to approve fine',
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F2F6F9]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F2F6F9] flex-col gap-4">
                <p className="text-red-500 font-medium">{error}</p>
                <button
                    onClick={() => router.back()}
                    className="text-blue-600 hover:underline flex items-center gap-2"
                >
                    <ArrowLeft size={16} /> Go Back
                </button>
            </div>
        );
    }

    if (!fine) return null;

    return (
        <PermissionGuard moduleId="hrm_fine" permissionType="view">
            <div className="flex min-h-screen w-full bg-[#F2F6F9]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />
                    <div className="p-8 w-full max-w-7xl mx-auto">

                        {/* Header */}
                        <div className="mb-6 flex items-center justify-between">
                            <button
                                onClick={() => router.back()}
                                className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors"
                            >
                                <ArrowLeft size={20} />
                                <span className="font-medium">Back to Fines</span>
                            </button>
                            <div className={`px-4 py-1.5 rounded-full text-sm font-semibold 
                                ${fine.fineStatus === 'Active' || fine.fineStatus === 'Approved' ? 'bg-green-100 text-green-700' :
                                    fine.fineStatus === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-red-100 text-red-700'}`}>
                                {fine.fineStatus}
                            </div>
                        </div>

                        {/* Title Section */}
                        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 mb-1">
                                        Fine #{fine.fineId}
                                    </h1>
                                    <p className="text-gray-500 flex items-center gap-2">
                                        <Calendar size={16} />
                                        Awarded on {new Date(fine.awardedDate).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="text-left md:text-right">
                                    <p className="text-sm text-gray-500 mb-1">Total Fine Amount</p>
                                    <p className="text-3xl font-bold text-gray-900">
                                        {Number(fine.fineAmount).toLocaleString()} <span className="text-sm font-normal text-gray-400">AED</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Left Column: Details */}
                            <div className="lg:col-span-2 space-y-6">

                                {/* Info Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white p-5 rounded-2xl shadow-sm">
                                        <h3 className="text-gray-500 text-sm font-medium mb-1">Fine Type</h3>
                                        <p className="text-lg font-semibold text-gray-800">{fine.fineType}</p>
                                        <p className="text-xs text-gray-400 mt-1">{fine.category} / {fine.subCategory || 'General'}</p>
                                    </div>
                                    <div className="bg-white p-5 rounded-2xl shadow-sm">
                                        <h3 className="text-gray-500 text-sm font-medium mb-1">Responsible Party</h3>
                                        <p className="text-lg font-semibold text-gray-800">{fine.responsibleFor || 'Employee'}</p>
                                        <div className="text-xs text-gray-400 mt-1 flex gap-3">
                                            <span>Emp: {fine.employeeAmount?.toLocaleString() ?? 0}</span>
                                            <span>Comp: {fine.companyAmount?.toLocaleString() ?? 0}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Assigned Employees List */}
                                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                                        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                            <User size={18} /> Assigned Employees
                                        </h2>
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                                            {fine.assignedEmployees?.length || 0} Person(s)
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50 text-gray-500">
                                                <tr>
                                                    <th className="px-6 py-3 font-medium">Employee ID</th>
                                                    <th className="px-6 py-3 font-medium">Name</th>
                                                    <th className="px-6 py-3 font-medium text-right">Liability</th>
                                                    <th className="px-6 py-3 font-medium text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {fine.assignedEmployees && fine.assignedEmployees.map((emp, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50">
                                                        <td className="px-6 py-3 font-medium text-gray-900">{emp.employeeId}</td>
                                                        <td className="px-6 py-3 text-gray-600">{emp.employeeName}</td>
                                                        <td className="px-6 py-3 text-right font-semibold text-gray-800">
                                                            {((fine.employeeAmount || 0) / (fine.assignedEmployees.length || 1)).toLocaleString()}
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                                                ${emp.approvalStatus === 'Approved' ? 'bg-green-100 text-green-800' :
                                                                    emp.approvalStatus === 'Rejected' ? 'bg-red-100 text-red-800' :
                                                                        'bg-yellow-100 text-yellow-800'}`}>
                                                                {emp.approvalStatus || 'Pending'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {(!fine.assignedEmployees || fine.assignedEmployees.length === 0) && (
                                                    <tr>
                                                        <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                                                            No employees assigned.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="bg-white rounded-2xl shadow-sm p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                            <AlertCircle size={18} /> Description & Remarks
                                        </h2>

                                        {/* Approve Button Logic */}
                                        {(() => {
                                            // Get User from localStorage or Context (Assuming stored in localStorage 'user' for now based on axios util usage usually)
                                            // Ideally useAuth() context if available. I'll fallback to reading storage here for simplicity if context hook is missing.
                                            // Checking imported PermissionGuard suggesting context might not be globally exposed in this file yet.
                                            // Let's try to get user data safely.
                                            let currentUser = null;
                                            if (typeof window !== 'undefined') {
                                                const storedUser = localStorage.getItem('user');
                                                if (storedUser) currentUser = JSON.parse(storedUser);
                                            }

                                            // Permission Logic
                                            const isPending = fine.fineStatus !== 'Approved';
                                            let canApprove = false;

                                            if (currentUser && isPending) {
                                                // Admin Override
                                                if (['Admin', 'SuperAdmin'].includes(currentUser.role)) {
                                                    canApprove = true;
                                                } else {
                                                    // Check if Manager of any PENDING employee
                                                    const pendingEmployees = fine.assignedEmployees.filter(e => e.approvalStatus !== 'Approved');

                                                    canApprove = pendingEmployees.some(emp => {
                                                        const manager = emp.managerInfo;
                                                        if (!manager) return false;

                                                        // Check ID (if available in user object)
                                                        if (currentUser.employeeId && manager.employeeId === currentUser.employeeId) return true;
                                                        if (currentUser._id && manager._id === currentUser._id) return true;

                                                        // Check Email
                                                        if (currentUser.email && manager.companyEmail &&
                                                            currentUser.email.toLowerCase() === manager.companyEmail.toLowerCase()) return true;

                                                        return false;
                                                    });
                                                }
                                            } else if (!currentUser) {
                                                // Debug
                                                // console.log("No current user found");
                                            }

                                            if (canApprove) {
                                                return (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <button
                                                                className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
                                                            >
                                                                <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                                                                Approve Fine
                                                            </button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="bg-white">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Approve Fine?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Are you sure you want to approve this fine?
                                                                    This action will mark your assigned reportees as approved.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={handleApproveFine} className="bg-black text-white hover:bg-gray-800">
                                                                    Confirm Approval
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Description</label>
                                            <p className="text-gray-700 mt-1 whitespace-pre-wrap">{fine.description || "No description provided."}</p>
                                        </div>
                                        {fine.remarks && (
                                            <div>
                                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Remarks</label>
                                                <p className="text-gray-700 mt-1 bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-sm">
                                                    {fine.remarks}
                                                </p>
                                            </div>
                                        )}
                                        {fine.companyDescription && (
                                            <div>
                                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Company Note</label>
                                                <p className="text-gray-600 mt-1 text-sm italic">
                                                    "{fine.companyDescription}"
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Meta & Actions */}
                            <div className="space-y-6">
                                {/* Context Details */}
                                <div className="bg-white rounded-2xl shadow-sm p-6">
                                    <h3 className="font-semibold text-gray-800 mb-4">Context</h3>
                                    <ul className="space-y-3 text-sm">
                                        {fine.vehicleId && (
                                            <li className="flex justify-between">
                                                <span className="text-gray-500">Vehicle ID</span>
                                                <span className="font-medium text-gray-900">{fine.vehicleId}</span>
                                            </li>
                                        )}
                                        {fine.projectId && (
                                            <li className="flex justify-between">
                                                <span className="text-gray-500">Project</span>
                                                <span className="font-medium text-gray-900 max-w-[60%] text-right truncate">{fine.projectName || fine.projectId}</span>
                                            </li>
                                        )}
                                        {fine.assetId && ( // Assuming assetId exists in schema or passed
                                            <li className="flex justify-between">
                                                <span className="text-gray-500">Asset ID</span>
                                                <span className="font-medium text-gray-900">{fine.assetId}</span>
                                            </li>
                                        )}
                                        <li className="flex justify-between border-t border-gray-100 pt-3">
                                            <span className="text-gray-500">Created At</span>
                                            <span className="text-gray-900">{new Date(fine.createdAt).toLocaleDateString()}</span>
                                        </li>
                                    </ul>
                                </div>

                                {/* Attachments */}
                                {fine.attachment && (
                                    <div className="bg-white rounded-2xl shadow-sm p-6">
                                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                            <FileText size={18} /> Attachment
                                        </h3>
                                        <div className="p-3 border border-gray-200 rounded-xl flex items-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer"
                                            onClick={() => window.open(fine.attachment.url, '_blank')}>
                                            <div className="bg-red-50 p-2 rounded-lg text-red-500">
                                                <FileText size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {fine.attachment.name || "Document"}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Click to view
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
