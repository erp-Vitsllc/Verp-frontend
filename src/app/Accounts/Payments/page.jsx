'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { Trash2, Check, X as XIcon, ChevronDown, ChevronUp, FileText, Download, Paperclip, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isAdmin } from '@/utils/permissions';
import AddPaymentModal from './components/AddPaymentModal';
import PaymentReceipt from './components/PaymentReceipt'; // Added this import
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
    const [isAccountsResp, setIsAccountsResp] = useState(false);
    const [isResponding, setIsResponding] = useState(false);
    const [expandedPaymentId, setExpandedPaymentId] = useState(null);
    const [showAttachmentModal, setShowAttachmentModal] = useState(false);
    const [selectedAttachment, setSelectedAttachment] = useState(null);

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

    // Check flowchart responsibility
    useEffect(() => {
        const checkAccountsResponsibility = async () => {
            try {
                const response = await axiosInstance.get('/Flowchart');
                const flowchart = response.data.flowcharts || (Array.isArray(response.data) ? response.data : []);
                const accountsEntry = flowchart.find(f => f.category === 'accounts' && f.status === 'Active');

                if (accountsEntry && currentUser) {
                    const isResp = accountsEntry.employeeId === currentUser.employeeId ||
                        (accountsEntry.empObjectId && (accountsEntry.empObjectId._id === currentUser.employeeObjectId || accountsEntry.empObjectId === currentUser.employeeObjectId));
                    setIsAccountsResp(isResp || isAdmin());
                } else if (isAdmin()) {
                    setIsAccountsResp(true);
                }
            } catch (err) {
                console.error('Error checking flowchart:', err);
                if (isAdmin()) setIsAccountsResp(true);
            }
        };

        if (mounted && currentUser) {
            checkAccountsResponsibility();
        }
    }, [mounted, currentUser]);

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

    const handleResponse = async (paymentId, status) => {
        try {
            setIsResponding(true);
            await axiosInstance.put(`/Payment/${paymentId}/respond`, { status });
            toast({
                title: "Success",
                description: `Payment ${status.toLowerCase()} successfully`,
                variant: "success",
            });
            fetchPayments();
        } catch (err) {
            console.error('Error responding to payment:', err);
            toast({
                title: "Error",
                description: err.response?.data?.message || "Failed to respond to payment",
                variant: "destructive",
            });
        } finally {
            setIsResponding(false);
        }
    };

    const toggleRow = (id) => {
        setExpandedPaymentId(expandedPaymentId === id ? null : id);
    };

    const handleViewAttachment = async (payment, e) => {
        e.stopPropagation();
        if (payment.attachment) {
            let attachmentUrl = payment.attachment.url || payment.attachment.data || payment.attachment;
            let attachmentName = payment.attachment.name || 'Attachment';
            let mimeType = payment.attachment.mimeType || payment.attachment.type || '';

            // If we have a publicId but no URL, we might need to get a signed URL
            // For now, we'll use the data if available, otherwise try to construct URL from publicId
            if (!attachmentUrl && payment.attachment.publicId) {
                // If publicId exists but no URL, it might need signing - but for now use publicId as fallback
                attachmentUrl = payment.attachment.publicId;
            }

            // Handle case where attachment is a direct string (legacy format)
            if (typeof payment.attachment === 'string') {
                attachmentUrl = payment.attachment;
            }

            setSelectedAttachment({
                url: attachmentUrl,
                name: attachmentName,
                mimeType: mimeType
            });
            setShowAttachmentModal(true);
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
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                ATTACHMENT
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
                                                    'Rejected': 'bg-red-50 text-red-700 border-red-200',
                                                    'Cancelled': 'bg-gray-50 text-gray-700 border-gray-200',
                                                };

                                                return (
                                                    <React.Fragment key={payment._id || payment.paymentId}>
                                                        <tr
                                                            className={`hover:bg-teal-50/30 transition-all cursor-pointer ${expandedPaymentId === (payment._id || payment.paymentId) ? 'bg-teal-50' : ''}`}
                                                            onClick={() => toggleRow(payment._id || payment.paymentId)}
                                                        >
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center gap-2">
                                                                {expandedPaymentId === (payment._id || payment.paymentId) ? <ChevronUp size={14} className="text-teal-500" /> : <ChevronDown size={14} className="text-gray-400" />}
                                                                {payment.paymentId || 'N/A'}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`p-1.5 rounded-lg ${payment.paymentType === 'Fine' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                                                        <FileText size={14} />
                                                                    </div>
                                                                    {payment.paymentType || 'Other'}
                                                                </div>
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
                                                                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${statusColors[payment.status] || 'bg-gray-50 text-gray-700 border-gray-200'
                                                                        }`}
                                                                >
                                                                    {payment.status || 'Pending'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                                {payment.attachment?.url || (payment.attachment?.data) ? (
                                                                    <button
                                                                        onClick={(e) => handleViewAttachment(payment, e)}
                                                                        className="flex items-center gap-1.5 text-teal-600 hover:text-teal-700 font-medium group"
                                                                        title="View Attachment"
                                                                    >
                                                                        <Paperclip size={16} className="transition-transform group-hover:scale-110" />
                                                                        <span className="truncate max-w-[100px]">{payment.attachment.name || 'View Attachment'}</span>
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-gray-300 italic text-xs">No attachment</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                                    {isAccountsResp && (payment.status === 'Processing' || payment.status === 'Pending') && (
                                                                        <>
                                                                            <button
                                                                                onClick={() => handleResponse(payment._id, 'Completed')}
                                                                                disabled={isResponding}
                                                                                className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                                                                                title="Approve Payment"
                                                                            >
                                                                                <Check size={18} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleResponse(payment._id, 'Rejected')}
                                                                                disabled={isResponding}
                                                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                                title="Reject Payment"
                                                                            >
                                                                                <XIcon size={18} />
                                                                            </button>
                                                                        </>
                                                                    )}
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
                                                        {expandedPaymentId === (payment._id || payment.paymentId) && (
                                                            <tr>
                                                                <td colSpan="7" className="bg-gray-50/50 p-0 overflow-hidden">
                                                                    <div className="animate-in slide-in-from-top duration-300">
                                                                        <PaymentReceipt payment={payment} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
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

            {/* Attachment Viewer Modal */}
            {showAttachmentModal && selectedAttachment && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-3">
                                <FileText size={20} className="text-teal-600" />
                                {selectedAttachment.name}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowAttachmentModal(false);
                                    setSelectedAttachment(null);
                                }}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-all shadow-sm"
                            >
                                <XIcon size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-8 bg-gray-50 flex items-center justify-center">
                            {(() => {
                                const attachmentUrl = selectedAttachment.url;
                                if (!attachmentUrl) {
                                    return (
                                        <div className="text-center p-12">
                                            <div className="w-24 h-24 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6 text-gray-400">
                                                <FileText size={48} />
                                            </div>
                                            <p className="text-sm text-gray-600 font-semibold">No attachment available</p>
                                        </div>
                                    );
                                }

                                const isImage = attachmentUrl.match(/\.(jpeg|jpg|gif|png|webp|bmp|svg)(\?.*)?$/i) ||
                                    attachmentUrl.startsWith('data:image') ||
                                    selectedAttachment.mimeType?.startsWith('image/');
                                const isPdf = attachmentUrl.match(/\.pdf(\?.*)?$/i) ||
                                    attachmentUrl.startsWith('data:application/pdf') ||
                                    selectedAttachment.mimeType === 'application/pdf';

                                if (isImage) {
                                    return (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <img
                                                src={attachmentUrl}
                                                alt={selectedAttachment.name}
                                                className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                                                onError={(e) => {
                                                    // Fallback if image fails to load
                                                    e.target.style.display = 'none';
                                                    const fallback = e.target.nextSibling;
                                                    if (fallback) fallback.style.display = 'block';
                                                }}
                                            />
                                            <div style={{ display: 'none' }} className="text-center p-12">
                                                <div className="w-24 h-24 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6 text-gray-400">
                                                    <FileText size={48} />
                                                </div>
                                                <p className="text-sm text-gray-600 font-semibold mb-4">Image failed to load</p>
                                                <a
                                                    href={attachmentUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-6 py-3 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors inline-flex items-center gap-2 shadow-sm"
                                                >
                                                    <Download size={16} />
                                                    Download File
                                                </a>
                                            </div>
                                        </div>
                                    );
                                } else if (isPdf) {
                                    return (
                                        <iframe
                                            src={attachmentUrl}
                                            className="w-full h-full min-h-[600px] border-none rounded-lg bg-white shadow-xl"
                                            title={selectedAttachment.name}
                                            onError={() => {
                                                console.error('PDF failed to load');
                                            }}
                                        />
                                    );
                                } else {
                                    return (
                                        <div className="text-center p-12">
                                            <div className="w-24 h-24 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6 text-gray-400">
                                                <FileText size={48} />
                                            </div>
                                            <p className="text-sm text-gray-600 font-semibold mb-4">File preview not available</p>
                                            <div className="flex items-center justify-center gap-3">
                                                <a
                                                    href={attachmentUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    download={selectedAttachment.name}
                                                    className="px-6 py-3 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors inline-flex items-center gap-2 shadow-sm"
                                                >
                                                    <Download size={16} />
                                                    Download File
                                                </a>
                                                <button
                                                    onClick={() => {
                                                        window.open(attachmentUrl, '_blank');
                                                    }}
                                                    className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors inline-flex items-center gap-2"
                                                >
                                                    <Eye size={16} />
                                                    Open in New Tab
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </PermissionGuard>
    );
}
