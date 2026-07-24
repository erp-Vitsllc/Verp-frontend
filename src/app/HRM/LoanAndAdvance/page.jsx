'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePersistListReturnState } from '@/hooks/usePersistListReturnState';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react'; // Import useRouter
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import ListTableRowLink from '@/components/ListTableRowLink';
import { Trash2, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isAdmin } from '@/utils/permissions';
import {
    canAccessAddLoanOrAdvance,
    canViewAdvanceList,
    canViewLoanList,
} from './utils/loanPermissionAccess';
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
import axiosInstance from '@/utils/axios';
import AddLoanModal from './components/AddLoanModal';
import PendingLoanRequestsModal from './components/PendingLoanRequestsModal';
import {
    countVisibleLoanPendingInbox,
    notifyLoanPendingInboxChanged,
} from './utils/loanPendingInboxCount';
import { fetchLoanPendingInbox } from '@/utils/pendingInboxFetch';
import { clearModuleNotificationFeedsCache } from '@/utils/moduleNotifications';

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
                // Ease out quart
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

function LoanPageContent() {
    const router = useRouter(); // Initialize router
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [mounted, setMounted] = useState(false);
    const [loans, setLoans] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'Loan');
    const [selectedStatus, setSelectedStatus] = useState(() => searchParams.get('status') || 'Pending');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [pendingInboxModalOpen, setPendingInboxModalOpen] = useState(false);
    const [pendingInboxCount, setPendingInboxCount] = useState(0);

    const showLoanTab = !mounted || canViewLoanList();
    const showAdvanceTab = !mounted || canViewAdvanceList();
    const canAdd = mounted && canAccessAddLoanOrAdvance();

    const listReturnParams = useMemo(() => ({
        tab: activeTab,
        status: selectedStatus,
    }), [activeTab, selectedStatus]);

    usePersistListReturnState(listReturnParams);

    useEffect(() => {
        const status = searchParams.get('status');
        if (status) setSelectedStatus(status);
        const tab = searchParams.get('tab');
        if (tab) setActiveTab(tab);
    }, [searchParams]);

    useEffect(() => {
        setMounted(true);
        fetchEmployees();
        fetchLoans();
    }, []);

    useEffect(() => {
        if (!mounted) return;
        if (activeTab === 'Loan' && !canViewLoanList() && canViewAdvanceList()) {
            setActiveTab('Advance');
        } else if (activeTab === 'Advance' && !canViewAdvanceList() && canViewLoanList()) {
            setActiveTab('Loan');
        }
    }, [mounted, activeTab]);

    const fetchEmployees = async () => {
        try {
            const response = await axiosInstance.get('/Employee/loan-eligible');
            setEmployees(response.data.employees || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const fetchLoans = async () => {
        try {
            const response = await axiosInstance.get('/Employee/loans');
            setLoans(response.data.loans || []);
        } catch (error) {
            console.error('Error fetching loans:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddLoan = () => {
        setShowAddModal(true);
    };

    const handleModalSuccess = () => {
        fetchLoans();
    };

    const handleDeleteClick = (record) => {
        setRecordToDelete(record);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!recordToDelete) return;

        try {
            setIsDeleting(true);
            await axiosInstance.delete(`/Employee/loans/${recordToDelete._id || recordToDelete.id}`);
            toast({
                title: "Success",
                description: "Record deleted successfully",
                variant: "success",
            });
            clearModuleNotificationFeedsCache();
            notifyLoanPendingInboxChanged();
            fetchLoans();
            try {
                const items = await fetchLoanPendingInbox(axiosInstance, { force: true, skipToast: true });
                setPendingInboxCount(countVisibleLoanPendingInbox(items));
            } catch {
                setPendingInboxCount(0);
            }
        } catch (err) {
            console.error('Error deleting record:', err);
            toast({
                title: "Error",
                description: err.response?.data?.message || "Failed to delete record",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setRecordToDelete(null);
        }
    };

    if (!mounted) {
        return null;
    }

    const filteredData = loans.filter(item => {
        // First filter by Tab (Loan vs Advance)
        if (item.type !== activeTab) return false;

        // Then filter by status dropdown / dashboard selection
        if (selectedStatus === 'All') return true;

        const status = (item.applicationStatus || item.status || '').toLowerCase();
        const selected = String(selectedStatus || '').toLowerCase();

        // Dashboard buckets
        if (selectedStatus === 'Outstanding') {
            return (
                (status === 'approved' || status === 'pending payment to employee') &&
                item.activeStatus !== 'Closed'
            );
        }
        if (selectedStatus === 'Recovered') {
            return status === 'paid' || (status === 'approved' && item.activeStatus === 'Closed');
        }
        // Approval-stage pending (exclude Pending Payment to Employee)
        if (selectedStatus === 'Pending') {
            if (status === 'pending payment to employee') return false;
            return status.includes('pending') || status === 'draft';
        }
        // "Approved" card includes awaiting payment after Management
        if (selectedStatus === 'Approved') {
            return status === 'approved' || status === 'pending payment to employee';
        }

        // Exact application status (Draft, Pending HR, Pending Payment to Employee, …)
        return status === selected;
    });

    // Calculate Statistics
    const stats = {
        loan: { count: 0, amount: 0, pending: 0, outstanding: 0, recovered: 0, approved: 0 },
        advance: { count: 0, amount: 0, pending: 0, outstanding: 0, recovered: 0, approved: 0 }
    };

    loans.forEach(item => {
        const type = item.type === 'Loan' ? 'loan' : 'advance';
        const s = stats[type];

        const status = (item.applicationStatus || item.status || '').toLowerCase();
        const isPostMgt =
            status === 'approved' ||
            status === 'pending payment to employee' ||
            status === 'paid';

        if (isPostMgt && status !== 'paid') {
            s.count++;
            s.amount += (item.amount || 0);
        }

        if (status.includes('pending') && status !== 'pending payment to employee') {
            s.pending++;
        } else if (status === 'approved' || status === 'pending payment to employee') {
            s.approved++;

            // Logic for Outstanding vs Recovered
            if (item.activeStatus === 'Closed' || status === 'paid') {
                s.recovered += (item.amount || 0);
            } else {
                s.outstanding += (item.amount || 0);
            }
        } else if (status === 'paid') {
            s.approved++;
            s.recovered += (item.amount || 0);
        }
    });

    return (
        <PermissionGuard moduleId="hrm_loan" permissionType="view">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>

                        {/* Header and Actions */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                            <div className="min-w-0">
                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">Loan and Advance Management</h1>
                                <p className="text-sm sm:text-base text-gray-600">
                                    Manage employee loans and advances
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4">
                                <button
                                    type="button"
                                    onClick={() => setPendingInboxModalOpen(true)}
                                    className="relative p-1.5 sm:p-2 hover:bg-amber-50 rounded-lg transition-colors bg-white shadow-sm border border-amber-200/80 text-amber-800 shrink-0"
                                    title="Loan & Advance notifications assigned to you"
                                >
                                    <Bell size={20} />
                                    {pendingInboxCount > 0 ? (
                                        <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-black leading-none flex items-center justify-center border-2 border-white shadow-sm tabular-nums">
                                            {pendingInboxCount > 99 ? '99+' : pendingInboxCount}
                                        </span>
                                    ) : null}
                                </button>
                                {canAdd ? (
                                <button
                                    onClick={handleAddLoan}
                                    className="bg-teal-500 hover:bg-teal-600 text-white px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 5v14M5 12h14"></path>
                                    </svg>
                                    Add Loan/Advance
                                </button>
                                ) : null}
                            </div>
                        </div>

                        {/* Stats Dashboard */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8 items-stretch">
                            {/* Loan Stats */}
                            {showLoanTab ? (
                            <div className={`bg-white rounded-xl p-3 sm:p-4 lg:p-6 border ${activeTab === 'Loan' && selectedStatus !== 'All' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-100'} shadow-sm transition-all overflow-hidden h-auto min-h-[220px] sm:min-h-[280px] lg:h-[320px]`}>
                                <h3 className="text-sm sm:text-base lg:text-lg font-bold text-gray-800 mb-2 sm:mb-4 flex justify-between items-center gap-2">
                                    Loan Statistics
                                    {activeTab === 'Loan' && selectedStatus !== 'All' && (
                                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">Filtered: {selectedStatus}</span>
                                    )}
                                </h3>
                                <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
                                    {/* Row 1 */}
                                    <div
                                        onClick={() => { setActiveTab('Loan'); setSelectedStatus('All'); }}
                                        className={`p-2 sm:p-3 lg:p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Loan' && selectedStatus === 'All' ? 'bg-blue-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-[9px] sm:text-xs font-bold text-gray-500 uppercase mb-1 sm:mb-2 min-h-[1.5rem] sm:h-8 flex items-center justify-center leading-tight">Total Loans</span>
                                        <span className="text-xl sm:text-2xl lg:text-3xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.loan.count} />
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => { setActiveTab('Loan'); setSelectedStatus('Approved'); }}
                                        className={`p-2 sm:p-3 lg:p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Loan' && selectedStatus === 'Approved' ? 'bg-blue-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-[9px] sm:text-xs font-bold text-gray-500 uppercase mb-1 sm:mb-2 min-h-[1.5rem] sm:h-8 flex items-center justify-center leading-tight">Loan Amount</span>
                                        <span className="text-sm sm:text-base lg:text-xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.loan.amount} /> AED
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => { setActiveTab('Loan'); setSelectedStatus('Pending'); }}
                                        className={`p-2 sm:p-3 lg:p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Loan' && selectedStatus === 'Pending' ? 'bg-blue-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-[9px] sm:text-xs font-bold text-gray-500 uppercase mb-1 sm:mb-2 min-h-[1.5rem] sm:h-8 flex items-center justify-center leading-tight">Loan Pending</span>
                                        <span className="text-xl sm:text-2xl lg:text-3xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.loan.pending} />
                                        </span>
                                    </div>
                                    {/* Row 2 */}
                                    <div
                                        onClick={() => { setActiveTab('Loan'); setSelectedStatus('Outstanding'); }}
                                        className={`p-2 sm:p-3 lg:p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Loan' && selectedStatus === 'Outstanding' ? 'bg-blue-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-[9px] sm:text-xs font-bold text-gray-500 uppercase mb-1 sm:mb-2 min-h-[1.5rem] sm:h-8 flex items-center justify-center leading-tight">Loan Outstanding</span>
                                        <span className="text-sm sm:text-base lg:text-xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.loan.outstanding} /> AED
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => { setActiveTab('Loan'); setSelectedStatus('Recovered'); }}
                                        className={`p-2 sm:p-3 lg:p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Loan' && selectedStatus === 'Recovered' ? 'bg-blue-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-[9px] sm:text-xs font-bold text-gray-500 uppercase mb-1 sm:mb-2 min-h-[1.5rem] sm:h-8 flex items-center justify-center leading-tight">Loan Recovered</span>
                                        <span className="text-sm sm:text-base lg:text-xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.loan.recovered} /> AED
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => { setActiveTab('Loan'); setSelectedStatus('Approved'); }}
                                        className={`p-2 sm:p-3 lg:p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Loan' && selectedStatus === 'Approved' ? 'bg-blue-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-[9px] sm:text-xs font-bold text-gray-500 uppercase mb-1 sm:mb-2 min-h-[1.5rem] sm:h-8 flex items-center justify-center leading-tight">Approved Loan</span>
                                        <span className="text-xl sm:text-2xl lg:text-3xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.loan.approved} />
                                        </span>
                                    </div>
                                </div>
                            </div>
                            ) : null}

                            {/* Advance Stats */}
                            {showAdvanceTab ? (
                            <div className={`bg-white rounded-xl p-3 sm:p-4 lg:p-6 border ${activeTab === 'Advance' && selectedStatus !== 'All' ? 'border-teal-500 ring-1 ring-teal-500' : 'border-gray-100'} shadow-sm transition-all overflow-hidden h-auto min-h-[220px] sm:min-h-[280px] lg:h-[320px]`}>
                                <h3 className="text-sm sm:text-base lg:text-lg font-bold text-gray-800 mb-2 sm:mb-4 flex justify-between items-center gap-2">
                                    Advance Statistics
                                    {activeTab === 'Advance' && selectedStatus !== 'All' && (
                                        <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-1 rounded">Filtered: {selectedStatus}</span>
                                    )}
                                </h3>
                                <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
                                    {/* Row 1 */}
                                    <div
                                        onClick={() => { setActiveTab('Advance'); setSelectedStatus('All'); }}
                                        className={`p-2 sm:p-3 lg:p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Advance' && selectedStatus === 'All' ? 'bg-teal-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-[9px] sm:text-xs font-bold text-gray-500 uppercase mb-1 sm:mb-2 min-h-[1.5rem] sm:h-8 flex items-center justify-center leading-tight">Total Advances</span>
                                        <span className="text-xl sm:text-2xl lg:text-3xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.advance.count} />
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => { setActiveTab('Advance'); setSelectedStatus('Approved'); }}
                                        className={`p-2 sm:p-3 lg:p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Advance' && selectedStatus === 'Approved' ? 'bg-teal-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-[9px] sm:text-xs font-bold text-gray-500 uppercase mb-1 sm:mb-2 min-h-[1.5rem] sm:h-8 flex items-center justify-center leading-tight">ADV Amount</span>
                                        <span className="text-sm sm:text-base lg:text-xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.advance.amount} /> AED
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => { setActiveTab('Advance'); setSelectedStatus('Pending'); }}
                                        className={`p-2 sm:p-3 lg:p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Advance' && selectedStatus === 'Pending' ? 'bg-teal-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-[9px] sm:text-xs font-bold text-gray-500 uppercase mb-1 sm:mb-2 min-h-[1.5rem] sm:h-8 flex items-center justify-center leading-tight">ADV Pending</span>
                                        <span className="text-xl sm:text-2xl lg:text-3xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.advance.pending} />
                                        </span>
                                    </div>
                                    {/* Row 2 */}
                                    <div
                                        onClick={() => { setActiveTab('Advance'); setSelectedStatus('Outstanding'); }}
                                        className={`p-2 sm:p-3 lg:p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Advance' && selectedStatus === 'Outstanding' ? 'bg-teal-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-[9px] sm:text-xs font-bold text-gray-500 uppercase mb-1 sm:mb-2 min-h-[1.5rem] sm:h-8 flex items-center justify-center leading-tight">ADV Outstanding</span>
                                        <span className="text-sm sm:text-base lg:text-xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.advance.outstanding} /> AED
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => { setActiveTab('Advance'); setSelectedStatus('Recovered'); }}
                                        className={`p-2 sm:p-3 lg:p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Advance' && selectedStatus === 'Recovered' ? 'bg-teal-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-[9px] sm:text-xs font-bold text-gray-500 uppercase mb-1 sm:mb-2 min-h-[1.5rem] sm:h-8 flex items-center justify-center leading-tight">ADV Recovered</span>
                                        <span className="text-sm sm:text-base lg:text-xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.advance.recovered} /> AED
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => { setActiveTab('Advance'); setSelectedStatus('Approved'); }}
                                        className={`p-2 sm:p-3 lg:p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Advance' && selectedStatus === 'Approved' ? 'bg-teal-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-[9px] sm:text-xs font-bold text-gray-500 uppercase mb-1 sm:mb-2 min-h-[1.5rem] sm:h-8 flex items-center justify-center leading-tight">Approved Advance</span>
                                        <span className="text-xl sm:text-2xl lg:text-3xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.advance.approved} />
                                        </span>
                                    </div>
                                </div>
                            </div>
                            ) : null}
                        </div>

                        {/* Tabs */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                            <div className="flex flex-wrap gap-2 sm:gap-4">
                                {showLoanTab ? (
                                <button
                                    onClick={() => { setActiveTab('Loan'); setSelectedStatus('All'); }}
                                    className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${activeTab === 'Loan'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'
                                        }`}
                                >
                                    Loan List
                                </button>
                                ) : null}
                                {showAdvanceTab ? (
                                <button
                                    onClick={() => { setActiveTab('Advance'); setSelectedStatus('All'); }}
                                    className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${activeTab === 'Advance'
                                        ? 'bg-teal-600 text-white shadow-md'
                                        : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'
                                        }`}
                                >
                                    Salary Advance List
                                </button>
                                ) : null}
                            </div>

                            <div className="relative min-w-[160px] sm:min-w-[200px]">
                                <select
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                    className="w-full h-[34px] sm:h-[38px] px-3 sm:px-4 border border-gray-800/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm bg-white appearance-none cursor-pointer shadow-sm transition-all font-medium"
                                    aria-label="Filter by status"
                                >
                                    <option value="All">All Statuses</option>
                                    <option value="Draft">Draft</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Pending HR">Pending HR</option>
                                    <option value="Pending Accounts">Pending Accounts</option>
                                    <option value="Pending Authorization">Pending Authorization</option>
                                    <option value="Pending Payment to Employee">Pending Payment to Employee</option>
                                    <option value="Approved">Approved</option>
                                    <option value="Outstanding">Outstanding</option>
                                    <option value="Recovered">Recovered</option>
                                    <option value="Paid">Paid</option>
                                    <option value="Rejected">Rejected</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full border border-gray-200">
                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full min-w-[640px] sm:min-w-[780px] lg:min-w-0 table-auto text-xs sm:text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                {activeTab === 'Advance' ? 'Salary Advance' : activeTab} ID
                                            </th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Emp ID
                                            </th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                User Name
                                            </th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                {activeTab === 'Advance' ? 'Salary Advance' : activeTab} Amount
                                            </th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                {activeTab === 'Advance' ? 'Salary Advance' : activeTab} Status
                                            </th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Application Status
                                            </th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="7" className="px-2 sm:px-4 lg:px-6 py-6 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
                                                    Loading...
                                                </td>
                                            </tr>
                                        ) : filteredData.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="px-2 sm:px-4 lg:px-6 py-6 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
                                                    No {activeTab === 'Advance' ? 'salary advance' : activeTab.toLowerCase()}s found.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredData.map((item) => {
                                                const loanHref = `/HRM/LoanAndAdvance/${(item.type ? item.type.replace(/\s+/g, '-') : 'Loan')}-${item.id}`;
                                                return (
                                                <ListTableRowLink
                                                    key={item.id}
                                                    href={loanHref}
                                                    router={router}
                                                >
                                                <tr
                                                    className="relative hover:bg-gray-50 transition-colors group cursor-pointer"
                                                >
                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                                                        <div className="relative z-10 pointer-events-none">
                                                            {item.loanId ? item.loanId.toUpperCase() : item.id.substring(item.id.length - 6).toUpperCase()}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                                                        <div className="relative z-10 pointer-events-none">{item.employeeId}</div>
                                                    </td>
                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 font-medium">
                                                        <div className="relative z-10 pointer-events-none">{item.employeeName}</div>
                                                    </td>
                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700 font-semibold">
                                                        AED {Number(item.amount).toLocaleString()}
                                                    </td>
                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap">
                                                        <span
                                                            className={`px-3 py-1 rounded-full text-xs font-medium ${item.activeStatus === 'Open'
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-gray-100 text-gray-700'
                                                                }`}
                                                        >
                                                            {item.activeStatus || 'Open'}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap">
                                                        <span
                                                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                                item.applicationStatus === 'Paid'
                                                                    ? 'bg-green-100 text-green-800'
                                                                    : item.applicationStatus === 'Approved' ||
                                                                        item.applicationStatus === 'Pending Payment to Employee'
                                                                      ? 'bg-blue-100 text-blue-800'
                                                                      : String(item.applicationStatus || '').includes('Pending') ||
                                                                          item.applicationStatus === 'Draft'
                                                                        ? 'bg-yellow-100 text-yellow-800'
                                                                        : 'bg-red-100 text-red-800'
                                                            }`}
                                                        >
                                                            {item.applicationStatus || 'Pending'}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-right">
                                                        <div className="relative z-20 flex items-center justify-end gap-2">
                                                            {isAdmin() && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteClick(item);
                                                                    }}
                                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                    title="Delete Request"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                </ListTableRowLink>
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

            <AddLoanModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSuccess={handleModalSuccess}
                employees={employees}
                existingLoans={loans}
            />

            <PendingLoanRequestsModal
                isOpen={pendingInboxModalOpen}
                onClose={() => setPendingInboxModalOpen(false)}
                onRefreshParent={fetchLoans}
                onPendingInboxCount={setPendingInboxCount}
            />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {activeTab} Request?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this request? This action cannot be undone.
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
        </PermissionGuard>
    );
}

export default function LoanPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <LoanPageContent />
        </Suspense>
    );
}
