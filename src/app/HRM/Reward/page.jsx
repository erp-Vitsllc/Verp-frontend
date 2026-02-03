'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import AddRewardModal from './components/AddRewardModal';
import { Trash2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    LabelList,
    Cell
} from 'recharts';
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

function RewardContent() {
    const searchParams = useSearchParams();
    const router = useRouter(); // Initialize router
    const { toast } = useToast();
    const filterType = searchParams.get('filter'); // 'my_team' checking
    const [mounted, setMounted] = useState(false);
    const [rewards, setRewards] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState('All'); // 'All', 'Pending', 'Approved', 'Cash', 'Gift', 'Certificate'
    const [rewardToDelete, setRewardToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedEmployeeRewards, setSelectedEmployeeRewards] = useState(null);
    const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
    const fetchingRef = useRef(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch employees for dropdown
    const fetchEmployees = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/Employee');
            setEmployees(response.data.employees || []);
        } catch (err) {
            console.error('Error fetching employees:', err);
        }
    }, []);

    // Fetch rewards from backend
    const fetchRewards = useCallback(async () => {
        if (fetchingRef.current) {
            return;
        }

        try {
            fetchingRef.current = true;
            setLoading(true);
            setError('');

            let endpoint = '/Reward';
            const params = {};

            // Check if filter=my_team is active
            if (filterType === 'my_team') {
                const userData = localStorage.getItem('employeeUser');
                if (userData) {
                    try {
                        const user = JSON.parse(userData);
                        // backend expects 'reporteeOf' to filter by manager's ID
                        // We use employeeId because backend looks up by employeeId OR _id
                        if (user.employeeId) {
                            params.reporteeOf = user.employeeId;
                        }
                    } catch (e) {
                        console.error('Error parsing user data for filter:', e);
                    }
                }
            }

            const response = await axiosInstance.get(endpoint, { params });
            setRewards(response.data.rewards || response.data || []);
        } catch (err) {
            console.error('Error fetching rewards:', err);
            setError(err.response?.data?.message || err.message || 'Failed to fetch rewards');
            setRewards([]);
        } finally {
            setLoading(false);
            fetchingRef.current = false;
        }
    }, [filterType]);

    useEffect(() => {
        if (mounted) {
            fetchRewards();
            fetchEmployees();
        }
    }, [mounted, fetchRewards, fetchEmployees]);

    const handleAddReward = () => {
        setShowAddModal(true);
    };

    const handleModalSuccess = () => {
        fetchRewards();
    };

    const handleDeleteClick = (reward) => {
        setRewardToDelete(reward);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!rewardToDelete) return;

        try {
            setIsDeleting(true);
            await axiosInstance.delete(`/Reward/${rewardToDelete._id}`);
            toast({
                title: "Success",
                description: "Reward record deleted successfully",
                variant: "success",
            });
            fetchRewards();
        } catch (err) {
            console.error('Error deleting reward:', err);
            toast({
                title: "Error",
                description: err.response?.data?.message || "Failed to delete reward",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setRewardToDelete(null);
        }
    };

    if (!mounted) {
        return null;
    }

    // Calculate Statistics
    const stats = {
        total: rewards.length,
        pending: rewards.filter(r => r.rewardStatus === 'Pending').length,
        approved: rewards.filter(r => r.rewardStatus === 'Approved' || r.rewardStatus === 'Active').length,
        cash: rewards.filter(r => r.rewardType?.toLowerCase() === 'cash').length,
        gift: rewards.filter(r => r.rewardType?.toLowerCase() === 'gift').length,
        certificate: rewards.filter(r => r.rewardType?.toLowerCase() === 'certificate').length
    };

    // Calculate Bar Chart Data (Rewards per employee)
    const empDataMap = Object.create(null);
    rewards.forEach(r => {
        const name = r.employeeName || 'N/A';
        const displayName = name.split(' ')[0]; // Use first name for chart space
        if (!empDataMap[name]) {
            empDataMap[name] = { name: displayName, fullName: name, value: 0, rewards: [] };
        }
        empDataMap[name].value += 1;
        empDataMap[name].rewards.push(r);
    });

    const chartData = Object.values(empDataMap)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8); // Top 8 employees

    const handleBarClick = (data) => {
        if (data && data.rewards) {
            setSelectedEmployeeRewards(data);
            setIsEmpModalOpen(true);
        }
    };

    const filteredRewards = rewards.filter(r => {
        if (selectedStatus === 'All') return true;

        const status = (r.rewardStatus || '').toLowerCase();
        const type = (r.rewardType || '').toLowerCase();

        if (selectedStatus === 'Pending') return status === 'pending';
        if (selectedStatus === 'Approved') return status === 'approved' || status === 'active';
        if (selectedStatus === 'Cash') return type === 'cash';
        if (selectedStatus === 'Gift') return type === 'gift';
        if (selectedStatus === 'Certificate') return type === 'certificate';

        return true;
    });

    return (
        <PermissionGuard moduleId="hrm_reward" permissionType="view">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                        {/* Header and Actions in Single Row */}
                        <div className="flex items-center justify-between mb-8">
                            {/* Left Side - Header */}
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800 mb-2">Rewards</h1>
                                <p className="text-gray-600">
                                    Manage and track employee rewards
                                </p>
                            </div>

                            {/* Right Side - Actions Bar */}
                            <div className="flex items-center gap-4">
                                {mounted && (
                                    <button
                                        onClick={handleAddReward}
                                        className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M12 5v14M5 12h14"></path>
                                        </svg>
                                        Add Reward
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Reward Dashboard */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* Stats Grid (White BG / Grey Boxes) */}
                            <div className={`bg-white rounded-xl p-6 border ${selectedStatus !== 'All' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-100'} shadow-sm flex flex-col min-h-[350px] transition-all`}>
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex justify-between items-center">
                                    Reward Statistics
                                    {selectedStatus !== 'All' && (
                                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">Filtered: {selectedStatus}</span>
                                    )}
                                </h3>
                                <div className="grid grid-cols-3 gap-4 flex-1">
                                    {/* Row 1 */}
                                    <div
                                        onClick={() => setSelectedStatus('All')}
                                        className={`p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${selectedStatus === 'All' ? 'bg-blue-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-2 h-8 flex items-center justify-center">Total Reward</span>
                                        <span className="text-3xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.total} />
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => setSelectedStatus('Pending')}
                                        className={`p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${selectedStatus === 'Pending' ? 'bg-blue-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-2 h-8 flex items-center justify-center">Pending Reward</span>
                                        <span className="text-3xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.pending} />
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => setSelectedStatus('Approved')}
                                        className={`p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${selectedStatus === 'Approved' ? 'bg-blue-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-2 h-8 flex items-center justify-center">Approved Reward</span>
                                        <span className="text-3xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.approved} />
                                        </span>
                                    </div>
                                    {/* Row 2 */}
                                    <div
                                        onClick={() => setSelectedStatus('Cash')}
                                        className={`p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${selectedStatus === 'Cash' ? 'bg-blue-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-2 h-8 flex items-center justify-center">Cash Reward</span>
                                        <span className="text-3xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.cash} />
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => setSelectedStatus('Gift')}
                                        className={`p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${selectedStatus === 'Gift' ? 'bg-blue-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-2 h-8 flex items-center justify-center">Gift Reward</span>
                                        <span className="text-3xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.gift} />
                                        </span>
                                    </div>
                                    <div
                                        onClick={() => setSelectedStatus('Certificate')}
                                        className={`p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02] ${selectedStatus === 'Certificate' ? 'bg-blue-100 shadow-inner' : 'bg-gray-100'}`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-2 h-8 flex items-center justify-center">Certificate Reward</span>
                                        <span className="text-3xl font-black text-[#EA3D2F]">
                                            <AnimatedCounter value={stats.certificate} />
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Bar Chart Panel */}
                            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm flex flex-col min-h-[350px]">
                                <h3 className="text-sm font-bold text-[#475569] mb-8 text-center uppercase tracking-widest">Reward List</h3>
                                <div className="flex-1 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={chartData}
                                            margin={{ top: 20, right: 10, left: -20, bottom: 20 }}
                                            barGap={8}
                                        >
                                            <defs>
                                                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9} />
                                                    <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.8} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="0" vertical={false} stroke="#F1F5F9" />
                                            <XAxis
                                                dataKey="name"
                                                axisLine={{ stroke: '#E2E8F0' }}
                                                tickLine={false}
                                                tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                                                interval={0}
                                                dy={10}
                                            />
                                            <YAxis hide={true} />
                                            <Tooltip
                                                cursor={{ fill: 'transparent' }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const data = payload[0].payload;
                                                        return (
                                                            <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-lg outline-none">
                                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Employee</p>
                                                                <p className="text-sm font-bold text-gray-800">{data.fullName}</p>
                                                                <div className="flex items-center gap-2 mt-2">
                                                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                                    <p className="text-sm font-medium text-gray-600">Rewards: <span className="font-bold text-gray-900">{data.value}</span></p>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar
                                                dataKey="value"
                                                fill="url(#barGradient)"
                                                radius={[4, 4, 0, 0]}
                                                barSize={45}
                                                animationDuration={1000}
                                                onClick={(data) => handleBarClick(data)}
                                                className="cursor-pointer"
                                            >
                                                <LabelList
                                                    dataKey="value"
                                                    position="top"
                                                    style={{ fill: '#475569', fontSize: 13, fontWeight: 'bold' }}
                                                    offset={10}
                                                />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 mb-4">
                                {error}
                            </div>
                        )}

                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-800">Reward Directory</h2>
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

                        {/* Rewards Table */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full border border-gray-200">
                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full min-w-0 table-auto">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                REWARD ID
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                EMP. ID
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                NAME
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                REWARD TYPE
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                REWARD STATUS
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
                                                    Loading rewards...
                                                </td>
                                            </tr>
                                        ) : filteredRewards.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                                                    No rewards found matching "{selectedStatus}".
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRewards.map((reward) => (
                                                <tr
                                                    key={reward._id || reward.rewardId}
                                                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                                                    onClick={() => router.push(`/HRM/Reward/rewrd.${reward.rewardId || reward._id}`)}
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {reward.rewardId || 'N/A'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                        {reward.employeeId || 'N/A'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                        {reward.employeeName || 'N/A'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                        {reward.rewardType || 'N/A'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span
                                                            className={`px-3 py-1 rounded-full text-xs font-medium ${reward.rewardStatus === 'Active' || reward.rewardStatus === 'Approved'
                                                                ? 'bg-green-100 text-green-800'
                                                                : reward.rewardStatus === 'Pending'
                                                                    ? 'bg-yellow-100 text-yellow-800'
                                                                    : reward.rewardStatus === 'Rejected' || reward.rewardStatus === 'Cancelled'
                                                                        ? 'bg-red-100 text-red-800'
                                                                        : 'bg-gray-100 text-gray-700'
                                                                }`}
                                                        >
                                                            {reward.rewardStatus || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteClick(reward);
                                                                }}
                                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                title="Delete Reward"
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

            {/* Add Reward Modal */}
            <AddRewardModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSuccess={handleModalSuccess}
                employees={employees}
            />

            {/* Employee Reward List Modal */}
            {isEmpModalOpen && selectedEmployeeRewards && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                        onClick={() => setIsEmpModalOpen(false)}
                    ></div>
                    <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-[600px] max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">
                                    Rewards: {selectedEmployeeRewards.fullName}
                                </h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    Total Rewards Earned: {selectedEmployeeRewards.value}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsEmpModalOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* List Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                            {selectedEmployeeRewards.rewards.map((reward, idx) => (
                                <div
                                    key={reward._id || idx}
                                    onClick={() => {
                                        setIsEmpModalOpen(false);
                                        router.push(`/HRM/Reward/rewrd.${reward.rewardId || reward._id}`);
                                    }}
                                    className="group p-4 rounded-2xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all cursor-pointer flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                                            #{idx + 1}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">
                                                {reward.title || reward.rewardType || 'Reward'}
                                            </div>
                                            <div className="text-xs text-gray-400 font-medium">
                                                ID: {reward.rewardId || 'N/A'} • {reward.rewardType}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${reward.rewardStatus === 'Approved' || reward.rewardStatus === 'Active'
                                            ? 'bg-green-100 text-green-700'
                                            : reward.rewardStatus === 'Pending'
                                                ? 'bg-yellow-100 text-yellow-700'
                                                : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {reward.rewardStatus}
                                        </span>
                                        {reward.amount && (
                                            <span className="text-sm font-bold text-gray-800">
                                                {reward.amount} AED
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setIsEmpModalOpen(false)}
                                className="px-5 py-2 text-sm font-bold text-gray-600 hover:text-gray-800 transition-colors"
                            >
                                Close Window
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Reward Record?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this reward record? This action cannot be undone.
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

export default function RewardPage() {
    return (
        <Suspense fallback={<div>Loading page...</div>}>
            <RewardContent />
        </Suspense>
    );
}

