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

// Invoice Component for Row Expansion
const PaymentInvoice = ({ payment }) => {
    const [relatedData, setRelatedData] = useState(null);
    const [otherDebts, setOtherDebts] = useState([]);
    const [totalRemainingAll, setTotalRemainingAll] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!payment.paidBy) return;
            setLoading(true);
            try {
                // 1. Fetch current related item
                let url = '';
                const refId = payment.relatedEntityId || payment.referenceId;
                if (payment.relatedEntityType === 'Fine') {
                    url = `/Fine/${refId}`;
                } else if (payment.relatedEntityType === 'Loan') {
                    url = `/Employee/loans/${refId}`;
                }

                if (url) {
                    const res = await axiosInstance.get(url);
                    setRelatedData(res.data);
                }

                // 2. Fetch all other debts for this employee
                const empId = typeof payment.paidBy === 'object' ? payment.paidBy.employeeId : payment.paidBy;
                if (empId) {
                    const [finesRes, loansRes] = await Promise.all([
                        axiosInstance.get('/Fine', { params: { employeeId: empId, status: 'Approved' } }),
                        axiosInstance.get('/Employee/loans', { params: { employeeId: empId } })
                    ]);

                    const allFines = finesRes.data.fines || [];
                    const allLoans = (loansRes.data.loans || []).filter(l => ['Approved', 'Paid'].includes(l.status || l.approvalStatus));

                    let total = 0;
                    const debts = [];

                    allFines.forEach(f => {
                        const share = calculateEmployeeShare(f);
                        const rem = Math.max(0, share - (f.paidAmount || 0));
                        if (rem > 0.01) {
                            total += rem;
                            if (f._id !== payment.relatedEntityId && f.fineId !== payment.referenceId) {
                                debts.push({ type: 'Fine', id: f.fineId, balance: rem });
                            }
                        }
                    });

                    allLoans.forEach(l => {
                        const rem = Math.max(0, (l.amount || 0) - (l.paidAmount || 0));
                        if (rem > 0.01 && (l.status !== 'Paid' && l.approvalStatus !== 'Paid')) {
                            total += rem;
                            if (l._id !== payment.relatedEntityId && l.loanId !== payment.referenceId) {
                                debts.push({ type: l.type || 'Loan', id: l.loanId || 'N/A', balance: rem });
                            }
                        }
                    });

                    setTotalRemainingAll(total);
                    setOtherDebts(debts);
                }
            } catch (e) {
                console.error("Error fetching invoice data:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [payment]);

    const calculateEmployeeShare = (fine, targetEmpId) => {
        if (!fine) return 0;

        // 1. Specific Employee ID Priority
        if (targetEmpId && fine.assignedEmployees?.length > 0) {
            const record = fine.assignedEmployees.find(e => e.employeeId === targetEmpId);
            if (record && record.individualAmount > 0) {
                return parseFloat(record.individualAmount);
            }
        }

        const isCo = (fine.responsibleFor || '').toLowerCase() === 'company';
        if (isCo) return 0;
        const realEmps = (fine.assignedEmployees || []).filter(e => !['VEGA-HR-0000', 'VEGA_INTERNAL'].includes(e.employeeId));

        const coAmt = parseFloat(fine.companyAmount || 0);
        const fAmt = parseFloat(fine.fineAmount || 0);
        const eAmt = parseFloat(fine.employeeAmount || 0);
        if (realEmps.length === 1 && coAmt === 0) return fAmt;
        if (eAmt > 0 && eAmt <= fAmt && realEmps.length > 1) return eAmt / realEmps.length;
        if (realEmps.length === 1 && eAmt > 0 && eAmt <= fAmt) return eAmt;
        return (fAmt - coAmt) / (realEmps.length || 1);
    };

    if (loading) return <div className="p-8 text-center text-gray-400">Loading invoice details...</div>;

    const targetEmpId = typeof payment.paidBy === 'object' ? payment.paidBy.employeeId : payment.paidBy;
    const share = payment.relatedEntityType === 'Fine' ? calculateEmployeeShare(relatedData, targetEmpId) : (relatedData?.amount || 0);
    const duration = (payment.relatedEntityType === 'Fine' ? relatedData?.payableDuration : relatedData?.duration) || 1;
    const paidByNow = parseFloat(payment.amount || 0);
    const totalPaid = parseFloat(relatedData?.paidAmount || 0);
    const paidEarlier = Math.max(0, totalPaid - (payment.status === 'Completed' || payment.status === 'Paid' ? paidByNow : 0));
    const balance = Math.max(0, share - totalPaid);

    const empName = payment.paidBy?.firstName ? `${payment.paidBy.firstName} ${payment.paidBy.lastName}` : (payment.paidByName || 'Employee');

    return (
        <div className="p-10 bg-white border border-gray-200 rounded-2xl m-4 shadow-xl max-w-4xl mx-auto">
            <div className="flex justify-between items-start mb-8 border-b-2 border-blue-600 pb-6">
                <div>
                    <h1 className="text-3xl font-black text-blue-700 tracking-tighter">INVOICE</h1>
                    <p className="text-sm text-gray-400 mt-1 font-medium">Reference: <span className="text-gray-900 font-bold">{payment.paymentId}</span></p>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-black text-gray-800 tracking-tighter">VERP</h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Digital Payment Confirmation</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-10">
                <div>
                    <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-3">BILL TO</h3>
                    <p className="text-lg font-bold text-gray-900">{empName}</p>
                    <p className="text-sm text-gray-500 mt-1">Employee ID: <span className="font-semibold text-gray-700">{payment.paidBy?.employeeId || 'N/A'}</span></p>
                    <p className="text-sm text-blue-600 underline font-medium mt-1">{payment.paidBy?.companyEmail || 'n/a@company.com'}</p>
                </div>
                <div className="text-right">
                    <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-3">DETAILS</h3>
                    <p className="text-sm text-gray-600">Date: <span className="font-bold text-gray-900">{new Date(payment.paymentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
                    <p className="text-sm text-gray-600 mt-1">Ref Type: <span className="font-bold text-blue-600">{payment.paymentType}</span></p>
                    <p className="text-sm text-gray-600 mt-1">Ref ID: <span className="font-bold text-gray-900">{payment.referenceId || 'N/A'}</span></p>
                </div>
            </div>

            <div className="bg-gray-50/50 rounded-xl overflow-hidden border border-gray-100 mb-8">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                            <th className="px-6 py-3 text-left">Item Description</th>
                            <th className="px-6 py-3 text-right">Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-t border-gray-100">
                            <td className="px-6 py-5">
                                <p className="font-bold text-gray-800 text-base">{payment.paymentType} Payment</p>
                                <p className="text-xs text-gray-500 mt-1 italic">{payment.description || `Payment for ${payment.referenceId}`}</p>
                            </td>
                            <td className="px-6 py-5 text-right">
                                <p className="text-xs text-gray-600 font-medium">Applied Month: <span className="font-bold text-gray-900">{relatedData?.monthStart || 'N/A'}</span></p>
                                <p className="text-xs text-gray-600 mt-1 font-medium">Plan Duration: <span className="font-bold text-gray-900">{duration} Month(s)</span></p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end mb-10">
                <div className="w-72 space-y-3">
                    <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <span>Total Amount:</span>
                        <span className="text-gray-900">{share.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <span>Paid Earlier:</span>
                        <span className="text-gray-900">{paidEarlier.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
                    </div>
                    <div className="flex justify-between py-4 border-y-2 border-blue-600">
                        <span className="font-black text-gray-800 text-sm">PAID NOW:</span>
                        <span className="font-black text-blue-700 text-xl">{paidByNow.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
                    </div>
                    <div className="flex justify-between pt-2">
                        <span className="font-black text-red-500 text-xs">BALANCE:</span>
                        <span className="font-black text-red-600 text-lg">{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded-r-xl mb-8">
                <p className="text-sm text-blue-900 leading-relaxed">
                    <span className="font-bold italic">Note:</span> {empName} has successfully paid <span className="font-bold">{paidByNow.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>.
                    The current outstanding balance for this item is <span className="font-bold">{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>.
                    {duration > 1 && ` Estimated Monthly Installment: ${(share / duration).toLocaleString(undefined, { minimumFractionDigits: 2 })} AED`}
                </p>
            </div>

            {totalRemainingAll > balance && (
                <div className="mt-8 p-6 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/30">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Total Financial Snapshot</h4>
                    <div className="flex justify-between items-baseline mb-4">
                        <span className="text-sm font-bold text-gray-500">Global Outstanding Balance:</span>
                        <span className="text-xl font-black text-red-500">{totalRemainingAll.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
                    </div>
                    {otherDebts.length > 0 && (
                        <div className="grid grid-cols-2 gap-y-2 gap-x-8 pt-3 border-t border-gray-200/50">
                            {otherDebts.map((d, i) => (
                                <div key={i} className="flex justify-between text-[11px] font-medium text-gray-500">
                                    <span>• {d.type} ({d.id})</span>
                                    <span className="font-bold text-gray-700">{d.balance.toLocaleString()} AED</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="mt-12 pt-6 border-t border-gray-100 text-center">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Generated by VeRP System • Automated Information Only</p>
            </div>
        </div>
    );
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
                                                                        <PaymentInvoice payment={payment} />
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
