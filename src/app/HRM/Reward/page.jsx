'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import AddRewardModal from './components/AddRewardModal';

function RewardContent() {
    const searchParams = useSearchParams();
    const filterType = searchParams.get('filter'); // 'my_team' checking
    const [mounted, setMounted] = useState(false);
    const [rewards, setRewards] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
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

    if (!mounted) {
        return null;
    }

    return (
        <PermissionGuard moduleId="hrm_reward" permissionType="view">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                        {/* Header and Actions in Single Row */}
                        <div className="flex items-center justify-between mb-6">
                            {/* Left Side - Header */}
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800 mb-2">Rewards</h1>
                                <p className="text-gray-600">
                                    {rewards.filter(r => r.rewardStatus === 'Approved' || r.rewardStatus === 'Active').length} Approved | {rewards.filter(r => r.rewardStatus === 'Pending').length} Pending
                                </p>
                            </div>

                            {/* Right Side - Actions Bar */}
                            <div className="flex items-center gap-4">
                                {/* Add Reward Button - Teal - Same style as Add New Employee */}
                                {mounted && (
                                    <button
                                        onClick={handleAddReward}
                                        className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="8.5" cy="7" r="4"></circle>
                                            <line x1="20" y1="8" x2="20" y2="14"></line>
                                            <line x1="23" y1="11" x2="17" y2="11"></line>
                                        </svg>
                                        Add Reward
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 mb-4">
                                {error}
                            </div>
                        )}

                        {/* Rewards Table */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full">
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
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                                    Loading rewards...
                                                </td>
                                            </tr>
                                        ) : rewards.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                                    No rewards found. Click "Add Reward" to create one.
                                                </td>
                                            </tr>
                                        ) : (
                                            rewards.map((reward) => (
                                                <tr key={reward._id || reward.rewardId} className="hover:bg-gray-50 transition-colors">
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

