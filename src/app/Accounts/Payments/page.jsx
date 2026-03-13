'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isAdmin } from '@/utils/permissions';
import AddPaymentModal from './components/AddPaymentModal';
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

// Animated Counter Component
const AnimatedCounter = ({ value, duration = 600 }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime;
        let animationFrame;

        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;

            if (progress < duration) {
                const percentage = progress / duration;
                const easeOut = 1 - Math.pow(1 - percentage, 4);
                setCount(Math.floor(easeOut * value));
                animationFrame = requestAnimationFrame(animate);
            } else {
                setCount(value);
            }
        };

        animationFrame = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animationFrame);
    }, [value, duration]);

    return <>{count}</>;
};

export default function PaymentsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [mounted, setMounted] = useState(false);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [paymentToDelete, setPaymentToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Get current user from localStorage
        if (typeof window !== 'undefined') {
            const userDataStr = localStorage.getItem('employeeUser') || localStorage.getItem('user');
            if (userDataStr) {
                try {
                    const user = JSON.parse(userDataStr);
                    setCurrentUser(user);
                } catch (e) {
                    console.error('Error parsing user data:', e);
                }
            }
        }
    }, []);

    // Fetch payments from backend
    const fetchPayments = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await axiosInstance.get('/Payment');
            setPayments(response.data.payments || response.data || []);
        } catch (err) {
            console.error('Error fetching payments:', err);
            setError(err.response?.data?.message || err.message || 'Failed to fetch payments');
            setPayments([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (mounted) {
            fetchPayments();
        }
    }, [mounted]);

    const handleAddPayment = () => {
        setIsAddPaymentModalOpen(true);
    };

    const handlePaymentSuccess = () => {
        fetchPayments();
    };

    const handleDeleteClick = (payment) => {
        setPaymentToDelete(payment);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!paymentToDelete) return;

        try {
            setIsDeleting(true);
            await axiosInstance.delete(`/Payment/${paymentToDelete._id}`);
            toast({
                title: "Success",
                description: "Payment record deleted successfully",
                variant: "success",
            });
            fetchPayments();
        } catch (err) {
            console.error('Error deleting payment:', err);
            toast({
                title: "Error",
                description: err.response?.data?.message || "Failed to delete payment",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setPaymentToDelete(null);
        }
    };

    // Calculate stats
    const stats = useMemo(() => {
        const total = payments.length;
        const totalAmount = payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        const completed = payments.filter(p => p.status === 'Completed' || p.status === 'Paid').length;
        const pending = payments.filter(p => p.status === 'Pending' || p.status === 'Processing').length;
        
        return {
            total,
            totalAmount,
            completed,
            pending
        };
    }, [payments]);

    if (!mounted) {
        return null;
    }

    return (
        <PermissionGuard moduleId="accounts" permissionType="view">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                        {/* Header and Actions */}
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800 mb-2">Payments</h1>
                                <p className="text-gray-600">
                                    Manage payment records and transactions
                                </p>
                            </div>

                            <div className="flex items-center gap-4">
                                {/* Add Payment Button */}
                                <button
                                    onClick={handleAddPayment}
                                    className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 5v14M5 12h14"></path>
                                    </svg>
                                    Add Payment
                                </button>
                            </div>
                        </div>

                        {/* Top Two Cards */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* Left Card: Statistics */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden" style={{ height: '320px' }}>
                            </div>

                            {/* Right Card: Additional Stats or Chart */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden" style={{ height: '320px' }}>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 mb-4">
                                {error}
                            </div>
                        )}

                        {/* Payments Table */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full border border-gray-200">
                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full min-w-0 table-auto">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                PAYMENT ID
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                PAYMENT TYPE
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                PAID BY
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                AMOUNT
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                STATUS
                                            </th>
                                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                ACTIONS
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                                                    Loading payments...
                                                </td>
                                            </tr>
                                        ) : payments.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                                                    No payments found. Click "Add Payment" to create one.
                                                </td>
                                            </tr>
                                        ) : (
                                            payments.map((payment) => {
                                                const statusColors = {
                                                    'Completed': 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                                    'Paid': 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                                    'Pending': 'bg-amber-50 text-amber-700 border-amber-200',
                                                    'Processing': 'bg-blue-50 text-blue-700 border-blue-200',
                                                    'Failed': 'bg-red-50 text-red-700 border-red-200',
                                                    'Cancelled': 'bg-gray-50 text-gray-700 border-gray-200',
                                                };

                                                return (
                                                    <tr
                                                        key={payment._id || payment.paymentId}
                                                        className="hover:bg-gray-50 transition-colors"
                                                    >
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            {payment.paymentId || payment._id || 'N/A'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                            {payment.paymentType || 'N/A'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                            {(() => {
                                                                if (payment.paidByName) return payment.paidByName;
                                                                if (payment.paidBy && typeof payment.paidBy === 'object') {
                                                                    return `${payment.paidBy.firstName || ''} ${payment.paidBy.lastName || ''}`.trim() || payment.paidBy.employeeId || 'N/A';
                                                                }
                                                                return payment.paidBy || 'N/A';
                                                            })()}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-bold">
                                                            {Number(payment.amount || 0).toLocaleString()} AED
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span
                                                                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                                                    statusColors[payment.status] || 'bg-gray-50 text-gray-700 border-gray-200'
                                                                }`}
                                                            >
                                                                {payment.status || 'Pending'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {isAdmin() && (
                                                                    <button
                                                                        onClick={() => handleDeleteClick(payment)}
                                                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                        title="Delete Payment"
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Payment Record?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this payment record? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteConfirm();
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Add Payment Modal */}
            <AddPaymentModal
                isOpen={isAddPaymentModalOpen}
                onClose={() => setIsAddPaymentModalOpen(false)}
                onSuccess={handlePaymentSuccess}
            />
        </PermissionGuard>
    );
}
