'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import {
    Loader2,
    TrendingUp,
    Clock,
    X,
    LayoutGrid,
    ChevronDown,
    ChevronUp,
    ArrowUpRight,
    PlayCircle,
    Users,
    Network
} from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import HierarchySelector from '@/components/HierarchySelector';

export default function DashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('User');
    const [userStats, setUserStats] = useState({ pending: 0, approved: 0, rejected: 0, accepted: 0, total: 0, items: [] });
    const [derivedStats, setDerivedStats] = useState({ completed: 0, overdue: 0 });
    const [isExpanded, setIsExpanded] = useState(false);

    const [filter, setFilter] = useState('Total');

    // Hierarchy State
    const [showHierarchyModal, setShowHierarchyModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null); // null = self
    const [hasTeam, setHasTeam] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.replace('/login');
            return;
        }

        const userData = localStorage.getItem('user');
        if (userData) {
            try {
                const user = JSON.parse(userData);
                setUserName(user.name || user.firstName || 'User');
            } catch (e) {
                console.error("Error parsing user", e);
            }
        }

        const fetchUserStats = async () => {
            try {
                setLoading(true);

                // Add targetUserId param if viewing someone else
                const params = {};
                if (selectedUser) params.targetUserId = selectedUser._id;

                const res = await axiosInstance.get('/Employee/dashboard/user-stats', { params });
                const items = res.data.items || [];

                // Calculate derived stats
                const completedCount = items.filter(i => i.status === 'Approved' || i.status === 'Rejected').length;
                const overdueCount = items.filter(i => isOverdue(i.requestedDate, i.status)).length;

                setUserStats({
                    ...res.data,
                    items: items
                });
                setDerivedStats({
                    completed: completedCount,
                    overdue: overdueCount
                });

            } catch (error) {
                console.error("Failed to fetch user activity stats", error);
            } finally {
                setLoading(false);
            }
        };

        // Check for hierarchy initially (to show/hide View Team button)
        const checkTeam = async () => {
            try {
                // Only fetch if we haven't checked yet
                if (!hasTeam) {
                    const res = await axiosInstance.get('/Employee/dashboard/hierarchy');
                    if (res.data.hierarchy && res.data.hierarchy.length > 0) {
                        setHasTeam(true);
                    }
                }
            } catch (e) { console.error("Team check failed", e); }
        };

        checkTeam();
        fetchUserStats();
    }, [router, selectedUser]);

    // Helper: Check if an item is overdue based on 2 PM rule
    const isOverdue = (dateString, status) => {
        if (!status || status !== 'Pending') return false;
        if (!dateString) return false;

        const requestDate = new Date(dateString);
        const now = new Date();

        // Logic: If request time > 2 PM (14:00), start count from next day
        // Otherwise, start count from request day
        let startDate = new Date(requestDate);

        if (requestDate.getHours() >= 14) {
            startDate.setDate(startDate.getDate() + 1);
        }

        // Deadline is start date + 3 days
        const deadline = new Date(startDate);
        deadline.setDate(deadline.getDate() + 3);

        return now > deadline;
    };

    const fetchUserStats = async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get('/Employee/dashboard/user-stats');
            const items = res.data.items || [];

            // Calculate derived stats
            const completedCount = items.filter(i => i.status === 'Approved' || i.status === 'Rejected').length;
            const overdueCount = items.filter(i => isOverdue(i.requestedDate, i.status)).length;

            setUserStats({
                ...res.data,
                items: items
            });
            setDerivedStats({
                completed: completedCount,
                overdue: overdueCount
            });

        } catch (error) {
            console.error("Failed to fetch user activity stats", error);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredItems = () => {
        if (!userStats.items) return [];

        switch (filter) {
            case 'Total':
                return userStats.items.slice(0, 20);
            case 'Completed':
                return userStats.items.filter(item => item.status === 'Approved' || item.status === 'Rejected').slice(0, 20);
            case 'Overdue':
                return userStats.items.filter(item => isOverdue(item.requestedDate, item.status)).slice(0, 20);
            default:
                return userStats.items.filter(item => item.status === filter).slice(0, 20);
        }
    };

    const { toast } = useToast();

    // Navigation Handler
    const handleRowClick = (item) => {
        if (!item) return;

        // 1. Check if completed
        if (item.status === 'Approved' || item.status === 'Rejected') {
            toast({
                title: "Request Completed",
                description: "This request has already been actioned and is closed.",
                variant: "default" // or just default info
            });
            return;
        }

        const type = item.type?.toLowerCase() || '';

        // 2. Navigate to Detail Page if Pending
        if (type.includes('loan')) {
            // Direct to Detail Page
            router.push(`/HRM/LoanAndAdvance/${item.id}`);
        } else if (type.includes('reward')) {
            router.push(`/HRM/Reward/${item.id}`);
        } else if (type.includes('fine')) {
            router.push(`/HRM/Fine/${item.id}`);
        } else if (type.includes('profile') || type.includes('notice')) {
            // Navigate to employee profile for Profile Activation or Notice
            if (item.targetEmployeeId) {
                router.push(`/emp/${item.targetEmployeeId}`);
            } else if (item.extra1 && !item.extra1.includes(' ')) {
                // Fallback: Profile Activation puts employeeId in extra1
                router.push(`/emp/${item.extra1}`);
            }
        }
    };

    // Simple SVG Pie Chart Component
    const ActivityPieChart = ({ data, size = 56 }) => {
        const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, label: '', value: 0, color: '', extra: null });

        const total = data.total || 0;
        const pendingPercent = total > 0 ? (data.pending / total) * 100 : 0;
        const approvedPercent = total > 0 ? (data.approved / total) * 100 : 0;
        const rejectedPercent = total > 0 ? (data.rejected / total) * 100 : 0;

        const circumference = 2 * Math.PI * 40; // r=40

        const styles = {
            pending: {
                strokeDasharray: `${(pendingPercent / 100) * circumference} ${circumference}`,
                strokeDashoffset: 0,
                stroke: '#F59E0B' // Amber-500
            },
            approved: {
                strokeDasharray: `${(approvedPercent / 100) * circumference} ${circumference}`,
                strokeDashoffset: -((pendingPercent / 100) * circumference),
                stroke: '#10B981' // Emerald-500
            },
            rejected: {
                strokeDasharray: `${(rejectedPercent / 100) * circumference} ${circumference}`,
                strokeDashoffset: -(((pendingPercent + approvedPercent) / 100) * circumference),
                stroke: '#EF4444' // Red-500
            }
        };

        const handleMouseEnter = (e, label, value, color) => {
            setTooltip({ visible: true, x: e.clientX, y: e.clientY, label, value, color });
        };

        return (
            <div className="flex flex-col items-center relative">
                <div style={{ width: `${size * 4}px`, height: `${size * 4}px` }} className="relative group">
                    <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#F1F5F9" strokeWidth="15" />
                        {total > 0 ? (
                            <>
                                <circle cx="50" cy="50" r="40" fill="transparent" stroke={styles.rejected.stroke} strokeWidth="15"
                                    strokeDasharray={styles.rejected.strokeDasharray} strokeDashoffset={styles.rejected.strokeDashoffset}
                                    className="transition-all duration-300 cursor-pointer hover:stroke-[18px]"
                                    onMouseEnter={(e) => handleMouseEnter(e, 'Rejected', data.rejected, 'bg-red-500')}
                                    onMouseMove={(e) => setTooltip(p => ({ ...p, x: e.clientX, y: e.clientY }))}
                                    onMouseLeave={() => setTooltip(p => ({ ...p, visible: false }))}
                                />
                                <circle cx="50" cy="50" r="40" fill="transparent" stroke={styles.approved.stroke} strokeWidth="15"
                                    strokeDasharray={styles.approved.strokeDasharray} strokeDashoffset={styles.approved.strokeDashoffset}
                                    className="transition-all duration-300 cursor-pointer hover:stroke-[18px]"
                                    onMouseEnter={(e) => handleMouseEnter(e, 'Approved', data.approved, 'bg-emerald-500')}
                                    onMouseMove={(e) => setTooltip(p => ({ ...p, x: e.clientX, y: e.clientY }))}
                                    onMouseLeave={() => setTooltip(p => ({ ...p, visible: false }))}
                                />
                                <circle cx="50" cy="50" r="40" fill="transparent" stroke={styles.pending.stroke} strokeWidth="15"
                                    strokeDasharray={styles.pending.strokeDasharray} strokeDashoffset={styles.pending.strokeDashoffset}
                                    className="transition-all duration-300 cursor-pointer hover:stroke-[18px]"
                                    onMouseEnter={(e) => handleMouseEnter(e, 'Pending', data.pending, 'bg-amber-500')}
                                    onMouseMove={(e) => setTooltip(p => ({ ...p, x: e.clientX, y: e.clientY }))}
                                    onMouseLeave={() => setTooltip(p => ({ ...p, visible: false }))}
                                />
                            </>
                        ) : (
                            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#E2E8F0" strokeWidth="15" strokeDasharray="1, 5" />
                        )}
                        <circle cx="50" cy="50" r="28" fill="white" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-black text-slate-800 leading-none">{total}</span>
                    </div>
                </div>

                {/* Simple Legend for clarity */}
                <div className="flex gap-4 mt-4 animate-in fade-in duration-1000">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Pending</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Approved</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Rejected</span>
                    </div>
                </div>

                {tooltip.visible && (
                    <div className="fixed z-[9999] pointer-events-none bg-slate-900 text-white p-2.5 rounded-xl shadow-2xl border border-slate-700/50 backdrop-blur-sm transform -translate-x-1/2 -translate-y-[calc(100%+15px)]"
                        style={{ left: tooltip.x, top: tooltip.y }}
                    >
                        <div className="flex items-center gap-2 mb-0.5">
                            <div className={`w-2 h-2 rounded-full ${tooltip.color}`}></div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tooltip.label}</span>
                        </div>
                        <div className="text-lg font-black">{tooltip.value}</div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans">
            <Sidebar />
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                <Navbar />

                <div className="flex-1 overflow-y-auto w-full p-6 lg:p-10 scrollbar-hide">
                    <div className="max-w-7xl mx-auto space-y-10">

                        {/* Header */}
                        <div className="flex justify-between items-end">
                            <div>
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight"> Dashboard</h1>
                                <p className="text-slate-500 mt-1 flex items-center gap-2 font-medium">
                                    <Clock className="w-4 h-4 text-blue-500" />
                                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center items-center h-96">
                                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                            </div>
                        ) : (
                            <div className="flex flex-col lg:flex-row gap-8 items-stretch w-full min-h-[480px]">

                                {/* Welcome Card */}
                                <div
                                    onClick={() => isExpanded && setIsExpanded(false)}
                                    style={{ flex: isExpanded ? '1' : '4', transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}
                                    className={`bg-white rounded-[3rem] p-12 lg:p-16 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center space-y-8 relative overflow-hidden group order-first min-w-0 ${isExpanded ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                                >
                                    <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-700">
                                        <TrendingUp className="w-64 h-64 text-blue-600" />
                                    </div>
                                    <div className="p-8 bg-blue-50 rounded-[2.5rem] shadow-inner shadow-blue-100/50">
                                        <TrendingUp className="w-16 h-16 text-blue-600" />
                                    </div>
                                    <div className="max-w-2xl w-full">
                                        <h2 className={`font-black text-slate-900 mb-4 tracking-tighter transition-all duration-700 ${isExpanded ? 'text-2xl opacity-40' : 'text-4xl lg:text-5xl'}`}>Welcome, {userName}!</h2>
                                        {!isExpanded && (
                                            <p className="text-slate-400 font-medium leading-relaxed text-xl lg:text-2xl animate-in fade-in duration-700">
                                                You have <span className="text-blue-600 font-bold">{userStats.pending}</span> pending items.
                                            </p>
                                        )}
                                    </div>
                                    {!isExpanded && (
                                        <div className="flex flex-wrap justify-center gap-4 animate-in fade-in duration-700">
                                            <button
                                                onClick={() => router.push('/HRM/Employee')}
                                                className="px-10 py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-lg hover:bg-blue-600 transition-all shadow-xl shadow-slate-200"
                                            >
                                                Manage Workspace
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Activity Card - Swapping Flex Proportions */}
                                <div
                                    onClick={() => !isExpanded && setIsExpanded(true)}
                                    style={{ flex: isExpanded ? '9' : '1', transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}
                                    className={`bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 overflow-hidden order-last flex flex-col justify-center min-w-0 ${isExpanded ? 'ring-2 ring-blue-500 shadow-2xl' : 'cursor-pointer hover:shadow-md'
                                        }`}
                                >
                                    {isExpanded ? (
                                        // Expanded Interactive View
                                        <div className="flex flex-col h-full animate-in fade-in zoom-in duration-700">
                                            <div className="flex items-center justify-between w-full mb-6">
                                                <div className="flex flex-col">
                                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                                        {selectedUser ? (
                                                            <>
                                                                <span className="text-slate-400 font-medium">Viewing:</span>
                                                                <span className="text-blue-600">{selectedUser.firstName} {selectedUser.lastName}</span>
                                                            </>
                                                        ) : (
                                                            "Request Command Center"
                                                        )}
                                                    </h3>
                                                    {selectedUser && (
                                                        <button
                                                            onClick={() => setSelectedUser(null)}
                                                            className="text-xs font-bold text-slate-400 hover:text-red-500 uppercase tracking-wider text-left mt-1 flex items-center gap-1"
                                                        >
                                                            <X className="w-3 h-3" /> Return to my requests
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {hasTeam && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setShowHierarchyModal(true); }}
                                                            className="p-3 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-full transition-all flex items-center gap-2 px-4"
                                                            title="View Team Requests"
                                                        >
                                                            <Network className="w-5 h-5" />
                                                            <span className="text-xs font-bold uppercase hidden xl:block">View Team</span>
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                                                        className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600  rounded-full transition-all hover:bg-blue-50"
                                                    >
                                                        <ChevronUp className="w-6 h-6" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Hierarchy Modal */}
                                            {showHierarchyModal && (
                                                <HierarchySelector
                                                    onClose={() => setShowHierarchyModal(false)}
                                                    onSelect={(user) => {
                                                        setSelectedUser(user);
                                                        setShowHierarchyModal(false);
                                                    }}
                                                />
                                            )}

                                            <div className="flex flex-col h-full w-full space-y-6">
                                                {/* Top Row: Filter Buttons */}
                                                <div className="flex flex-nowrap items-center gap-2 pb-4 border-b border-slate-50 overflow-x-hidden">
                                                    {[
                                                        { label: 'Total', count: userStats.total, color: 'bg-slate-900', text: 'text-white' },
                                                        { label: 'Completed', count: derivedStats.completed, color: 'bg-blue-600', text: 'text-white' },
                                                        { label: 'Overdue', count: derivedStats.overdue, color: 'bg-orange-500', text: 'text-white' },
                                                        { label: 'Pending', count: userStats.pending, color: 'bg-amber-500', text: 'text-white' },
                                                        { label: 'Approved', count: userStats.approved, color: 'bg-emerald-500', text: 'text-white' },
                                                        { label: 'Rejected', count: userStats.rejected, color: 'bg-red-500', text: 'text-white' }
                                                    ].map((btn) => (
                                                        <button
                                                            key={btn.label}
                                                            onClick={(e) => { e.stopPropagation(); setFilter(btn.label); }}
                                                            className={`px-3 py-2 rounded-lg transition-all transform active:scale-95 flex items-center gap-2 shadow-sm whitespace-nowrap ${filter === btn.label ? `${btn.color} ${btn.text} ring-2 ring-offset-2 ring-slate-200` : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                                                }`}
                                                        >
                                                            <span className="text-[10px] font-black uppercase tracking-wider">{btn.label}</span>
                                                            <span className="px-1.5 py-0.5 bg-white/20 rounded-md text-[10px] font-bold min-w-[18px]">{btn.count}</span>
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Data Table */}
                                                <div className="flex-1 flex flex-col min-w-0">
                                                    <div className="flex items-center justify-between mb-4 px-2">
                                                        <span className="text-xs font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></div>
                                                            Latest {filter} Items
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400 italic">Showing top {getFilteredItems().length} items</span>
                                                    </div>

                                                    <div className="flex-1 overflow-y-auto overflow-x-auto min-h-[300px] scrollbar-hide hover:scrollbar-default transition-all pr-1">
                                                        <table className="w-full text-left border-separate border-spacing-0">
                                                            <thead className="sticky top-0 z-20">
                                                                <tr className="bg-white">
                                                                    <th className="py-4 px-4 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 bg-white">Type</th>
                                                                    <th className="py-4 px-4 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 bg-white">Requested By</th>
                                                                    <th className="py-4 px-4 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 bg-white">Requested Date</th>
                                                                    <th className="py-4 px-4 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 bg-white">Status</th>
                                                                    <th className="py-4 px-4 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 bg-white">Date (Actioned)</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {getFilteredItems().map((item) => (
                                                                    <tr key={item.id} onClick={() => handleRowClick(item)} className="group hover:bg-blue-50/30 transition-colors cursor-pointer">
                                                                        <td className="py-4 px-4 font-bold text-slate-900 text-sm whitespace-nowrap">{item.type}</td>
                                                                        <td className="py-4 px-4 text-slate-500 text-sm">{item.requestedBy}</td>
                                                                        <td className="py-4 px-4 text-slate-500 text-sm whitespace-nowrap">
                                                                            {item.requestedDate ? new Date(item.requestedDate).toLocaleDateString() : '-'}
                                                                        </td>
                                                                        <td className="py-4 px-4">
                                                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${item.status === 'Approved' ? 'bg-emerald-100 text-emerald-600' :
                                                                                item.status === 'Rejected' ? 'bg-red-100 text-red-600' :
                                                                                    'bg-amber-100 text-amber-600'
                                                                                }`}>
                                                                                {item.status}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-4 px-4 text-slate-400 text-xs italic">
                                                                            {item.actionedDate ? new Date(item.actionedDate).toLocaleDateString() : '-'}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                                {getFilteredItems().length === 0 && (
                                                                    <tr>
                                                                        <td colSpan="5" className="py-12 text-center text-slate-400 font-medium italic">
                                                                            No {filter.toLowerCase()} items found.
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // Compact View
                                        <div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-700">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Insights</span>
                                            <ActivityPieChart data={userStats} size={38} />
                                            <div className="bg-blue-50 text-blue-600 p-3 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-all transform group-hover:scale-110 shadow-sm">
                                                <ChevronDown className="w-5 h-5" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

