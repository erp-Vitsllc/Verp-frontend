'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import { Trash2 } from 'lucide-react';
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
import axiosInstance from '@/utils/axios';
import AddLoanModal from './components/AddLoanModal';

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

export default function LoanPage() {
    const router = useRouter(); // Initialize router
    const { toast } = useToast();
    const [mounted, setMounted] = useState(false);
    const [loans, setLoans] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Loan'); // 'Loan' or 'Advance'
    const [selectedStatus, setSelectedStatus] = useState('All'); // 'All', 'Pending', 'Approved', 'Outstanding', 'Recovered'
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        setMounted(true);
        fetchEmployees();
        fetchLoans();
    }, []);

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
            fetchLoans();
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

        // Then filter by dashboard selection
        if (selectedStatus === 'All') return true;

        const status = (item.applicationStatus || item.status || '').toLowerCase();

        if (selectedStatus === 'Pending') return status.includes('pending');
        if (selectedStatus === 'Approved') return status === 'approved';
        if (selectedStatus === 'Outstanding') return status === 'approved' && item.activeStatus !== 'Closed';
        if (selectedStatus === 'Recovered') return status === 'approved' && item.activeStatus === 'Closed';

        return true;
    });

    // Calculate Statistics
    const stats = {
        loan: { count: 0, amount: 0, pending: 0, outstanding: 0, recovered: 0, approved: 0 },
        advance: { count: 0, amount: 0, pending: 0, outstanding: 0, recovered: 0, approved: 0 }
    };

    loans.forEach(item => {
        const type = item.type === 'Loan' ? 'loan' : 'advance';
        const s = stats[type];

        s.count++;

        const status = (item.applicationStatus || item.status || '').toLowerCase();

        if (status.includes('pending')) {
            s.pending++;
        } else if (status === 'approved') {
            s.approved++;
            s.amount += (item.amount || 0); // Total Approved Amount

            // Logic for Outstanding vs Recovered
            // Only Approved loans can be Outstanding or Recovered
            if (item.activeStatus === 'Closed') {
                s.recovered += (item.amount || 0);
            } else {
                s.outstanding += (item.amount || 0);
            }
        }
    });

    return (
        <PermissionGuard moduleId="hrm_loan" permissionType="view">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>

                        {/* Header and Actions */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800 mb-2">Loan and Advance Management</h1>
                                <p className="text-gray-600">
                                    Manage employee loans and advances
                                </p>
                            </div>

                            <button
                                onClick={handleAddLoan}
                                className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 5v14M5 12h14"></path>
                                </svg>
                                Add Loan/Advance
                            </button>
                        </div>

                        {/* Stats Dashboard */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* Loan Stats */}
                            <div className={`bg-white rounded-xl p-6 border ${activeTab === 'Loan' && selectedStatus !== 'All' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-100'} shadow-sm transition-all shadow-sm`}>
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex justify-between items-center">
                                    Loan Statistics
                                    {activeTab === 'Loan' && selectedStatus !== 'All' && (
                                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">Filtered: {selectedStatus}</span>
                                    )}
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    {/* Row 1 */}
                                    <div
                                        onClick={() => { setActiveTab('Loan'); setSelectedStatus('All'); }}
                                        className={`p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Loan' && selectedStatus === 'All' ? 'bg-blue-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-2 h-8 flex items-center justify-center">Total Loan Count</span>
                                        <span className="text-3xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.loan.count} />
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => { setActiveTab('Loan'); setSelectedStatus('Approved'); }}
                                        className={`p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Loan' && selectedStatus === 'Approved' ? 'bg-blue-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-2 h-8 flex items-center justify-center">Loan Amount</span>
                                        <span className="text-xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.loan.amount} /> AED
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => { setActiveTab('Loan'); setSelectedStatus('Pending'); }}
                                        className={`p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Loan' && selectedStatus === 'Pending' ? 'bg-blue-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-2 h-8 flex items-center justify-center">Loan Pending</span>
                                        <span className="text-3xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.loan.pending} />
                                        </span>
                                    </div>
                                    {/* Row 2 */}
                                    <div
                                        onClick={() => { setActiveTab('Loan'); setSelectedStatus('Outstanding'); }}
                                        className={`p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Loan' && selectedStatus === 'Outstanding' ? 'bg-blue-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-2 h-8 flex items-center justify-center">Loan Outstanding</span>
                                        <span className="text-xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.loan.outstanding} /> AED
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => { setActiveTab('Loan'); setSelectedStatus('Recovered'); }}
                                        className={`p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Loan' && selectedStatus === 'Recovered' ? 'bg-blue-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-2 h-8 flex items-center justify-center">Loan Recovered</span>
                                        <span className="text-xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.loan.recovered} /> AED
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => { setActiveTab('Loan'); setSelectedStatus('Approved'); }}
                                        className={`p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Loan' && selectedStatus === 'Approved' ? 'bg-blue-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-2 h-8 flex items-center justify-center">Approved Loan</span>
                                        <span className="text-3xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.loan.approved} />
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Advance Stats */}
                            <div className={`bg-white rounded-xl p-6 border ${activeTab === 'Advance' && selectedStatus !== 'All' ? 'border-teal-500 ring-1 ring-teal-500' : 'border-gray-100'} shadow-sm transition-all shadow-sm`}>
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex justify-between items-center">
                                    Advance Statistics
                                    {activeTab === 'Advance' && selectedStatus !== 'All' && (
                                        <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-1 rounded">Filtered: {selectedStatus}</span>
                                    )}
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    {/* Row 1 */}
                                    <div
                                        onClick={() => { setActiveTab('Advance'); setSelectedStatus('All'); }}
                                        className={`p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Advance' && selectedStatus === 'All' ? 'bg-teal-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-2 h-8 flex items-center justify-center">Total Adv Count</span>
                                        <span className="text-3xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.advance.count} />
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => { setActiveTab('Advance'); setSelectedStatus('Approved'); }}
                                        className={`p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Advance' && selectedStatus === 'Approved' ? 'bg-teal-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-2 h-8 flex items-center justify-center">ADV Amount</span>
                                        <span className="text-xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.advance.amount} /> AED
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => { setActiveTab('Advance'); setSelectedStatus('Pending'); }}
                                        className={`p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Advance' && selectedStatus === 'Pending' ? 'bg-teal-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-2 h-8 flex items-center justify-center">ADV Pending</span>
                                        <span className="text-3xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.advance.pending} />
                                        </span>
                                    </div>
                                    {/* Row 2 */}
                                    <div
                                        onClick={() => { setActiveTab('Advance'); setSelectedStatus('Outstanding'); }}
                                        className={`p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Advance' && selectedStatus === 'Outstanding' ? 'bg-teal-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-2 h-8 flex items-center justify-center">ADV Outstanding</span>
                                        <span className="text-xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.advance.outstanding} /> AED
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => { setActiveTab('Advance'); setSelectedStatus('Recovered'); }}
                                        className={`p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Advance' && selectedStatus === 'Recovered' ? 'bg-teal-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-2 h-8 flex items-center justify-center">ADV Recovered</span>
                                        <span className="text-xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.advance.recovered} /> AED
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => { setActiveTab('Advance'); setSelectedStatus('Approved'); }}
                                        className={`p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${activeTab === 'Advance' && selectedStatus === 'Approved' ? 'bg-teal-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-2 h-8 flex items-center justify-center">Approved Advance</span>
                                        <span className="text-3xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.advance.approved} />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex gap-4">
                                <button
                                    onClick={() => { setActiveTab('Loan'); setSelectedStatus('All'); }}
                                    className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'Loan'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'
                                        }`}
                                >
                                    Loan List
                                </button>
                                <button
                                    onClick={() => { setActiveTab('Advance'); setSelectedStatus('All'); }}
                                    className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'Advance'
                                        ? 'bg-teal-600 text-white shadow-md'
                                        : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'
                                        }`}
                                >
                                    Salary Advance List
                                </button>
                            </div>

                            {selectedStatus !== 'All' && (
                                <button
                                    onClick={() => setSelectedStatus('All')}
                                    className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100"
                                >
                                    CLEAR FILTER: {selectedStatus.toUpperCase()}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full border border-gray-200">
                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full min-w-0 table-auto">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                {activeTab === 'Advance' ? 'Salary Advance' : activeTab} ID
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Emp ID
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                User Name
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                {activeTab === 'Advance' ? 'Salary Advance' : activeTab} Amount
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                {activeTab === 'Advance' ? 'Salary Advance' : activeTab} Status
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Application Status
                                            </th>
                                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                                                    Loading...
                                                </td>
                                            </tr>
                                        ) : filteredData.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                                                    No {activeTab === 'Advance' ? 'salary advance' : activeTab.toLowerCase()}s found.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredData.map((item) => (
                                                <tr
                                                    key={item.id}
                                                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                                                    onClick={() => {
                                                        const typeSlug = item.type ? item.type.replace(/\s+/g, '-') : 'Loan';
                                                        router.push(`/HRM/LoanAndAdvance/${typeSlug}-${item.id}`);
                                                    }}
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {item.loanId ? item.loanId.toUpperCase() : item.id.substring(item.id.length - 6).toUpperCase()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                        {item.employeeId}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                                        {item.employeeName}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-semibold">
                                                        AED {Number(item.amount).toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span
                                                            className={`px-3 py-1 rounded-full text-xs font-medium ${item.activeStatus === 'Open'
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-gray-100 text-gray-700'
                                                                }`}
                                                        >
                                                            {item.activeStatus || 'Open'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span
                                                            className={`px-3 py-1 rounded-full text-xs font-medium ${item.applicationStatus === 'Approved'
                                                                ? 'bg-blue-100 text-blue-800'
                                                                : item.applicationStatus === 'Pending'
                                                                    ? 'bg-yellow-100 text-yellow-800'
                                                                    : 'bg-red-100 text-red-800'
                                                                }`}
                                                        >
                                                            {item.applicationStatus || 'Pending'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                                        <div className="flex items-center justify-end gap-2">
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
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
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
