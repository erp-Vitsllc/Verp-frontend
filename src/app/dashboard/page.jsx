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
    ChevronRight,
    ArrowUpRight,
    PlayCircle,
    Users,
    Network
} from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import HierarchySelector from '@/components/HierarchySelector';

const isOverdue = (date, status) => {
    if (!date || status !== 'Pending') return false;
    const requested = new Date(date);
    const now = new Date();
    // Assuming overdue if older than 3 days for now, or just past due?
    // Let's stick to a simple check: if requested date is before today (ignoring time) 
    // or maybe strict comparison.
    // Dashboard logic usually implies 'action required within X time'. 
    // Without specific rules, any 'Pending' item from before today could be overdue, 
    // or maybe > 48 hours. 
    // Let's use > 3 days as a safe default for "Overdue" visual warning
    const diffTime = Math.abs(now - requested);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 3;
};

export default function DashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('User');
    const [userStats, setUserStats] = useState({ pending: 0, approved: 0, rejected: 0, accepted: 0, total: 0, items: [] });
    const [derivedStats, setDerivedStats] = useState({ completed: 0, overdue: 0 });
    const [aggregatedStats, setAggregatedStats] = useState({ total: 0, completed: 0, overdue: 0, pending: 0, approved: 0, rejected: 0 });
    const [isExpanded, setIsExpanded] = useState(false);

    const [filter, setFilter] = useState('Total');

    const [viewMode, setViewMode] = useState('requests'); // 'requests' or 'teams'
    const [hierarchyData, setHierarchyData] = useState([]);
    const [teamStats, setTeamStats] = useState({}); // Cache for employee stats: { empId: { pending: 0... } }
    const [expandedRows, setExpandedRows] = useState({}); // { empId: true/false }

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

        const checkTeam = async () => {
            try {
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
    // Fetch Team Stats when entering Team View
    useEffect(() => {
        if (isExpanded && viewMode === 'teams') {
            const fetchTeamStats = async () => {
                try {
                    const params = {};
                    if (selectedUser) params.targetUserId = selectedUser._id;
                    const res = await axiosInstance.get('/Employee/dashboard/team-stats', { params });
                    setAggregatedStats(res.data);
                } catch (e) {
                    console.error("Failed to fetch team stats", e);
                }
            };
            fetchTeamStats();
        }
    }, [isExpanded, viewMode, selectedUser]);



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



    // Fetch hierarchy data for Team View
    useEffect(() => {
        if (isExpanded && viewMode === 'teams' && hierarchyData.length === 0) {
            const loadHierarchy = async () => {
                try {
                    const res = await axiosInstance.get('/Employee/dashboard/hierarchy');
                    const flatList = res.data.hierarchy || [];
                    const manager = res.data.manager;

                    if (manager) {
                        const tree = buildTree(manager, flatList);
                        setHierarchyData(tree);
                        // Fetch stats for the manager (root) and direct reports immediately
                        fetchEmployeeStats(manager._id);
                        tree[0]?.children?.forEach(child => fetchEmployeeStats(child._id));
                    }
                } catch (error) {
                    console.error("Failed to load hierarchy", error);
                }
            };
            loadHierarchy();
        }
    }, [isExpanded, viewMode, hierarchyData.length]);

    const buildTree = (manager, allEmployees) => {
        if (!manager) return [];
        const getChildren = (parentId, visited = new Set()) => {
            if (visited.has(parentId)) return [];
            const currentVisited = new Set(visited);
            currentVisited.add(parentId);
            return allEmployees
                .filter(e => e.primaryReportee === parentId && !currentVisited.has(e._id))
                .map(child => ({
                    ...child,
                    children: getChildren(child._id, currentVisited)
                }));
        };
        return [{
            ...manager,
            children: getChildren(manager._id, new Set())
        }];
    };

    const fetchEmployeeStats = async (userId) => {
        if (teamStats[userId]) return; // Already fetched
        try {
            const res = await axiosInstance.get('/Employee/dashboard/user-stats', { params: { targetUserId: userId } });
            const items = res.data.items || [];
            const completedCount = items.filter(i => i.status === 'Approved' || i.status === 'Rejected').length;
            const overdueCount = items.filter(i => isOverdue(i.requestedDate, i.status)).length;

            setTeamStats(prev => ({
                ...prev,
                [userId]: {
                    ...res.data,
                    completed: completedCount,
                    overdue: overdueCount
                }
            }));
        } catch (error) {
            console.error(`Failed to fetch stats for user ${userId}`, error);
        }
    };

    const toggleRow = (userId) => {
        setExpandedRows(prev => ({ ...prev, [userId]: !prev[userId] }));
    };

    // Recursive Table Row
    const TeamTableRow = ({ node, level = 0 }) => {
        const stats = teamStats[node._id] || { total: '-', completed: '-', overdue: '-', pending: '-', approved: '-', rejected: '-' };
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedRows[node._id];

        // Fetch stats for children when expanded
        useEffect(() => {
            if (isExpanded && hasChildren) {
                node.children.forEach(child => fetchEmployeeStats(child._id));
            }
        }, [isExpanded, hasChildren, node.children, fetchEmployeeStats]);

        return (
            <>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-all">
                    <td className="py-4 px-4">
                        <div
                            className="flex items-center gap-2 cursor-pointer group-hover:bg-slate-100/50 p-1 rounded-md transition-all"
                            style={{ paddingLeft: `${level * 24}px` }}
                            onClick={() => {
                                setSelectedUser(node);
                                setViewMode('requests');
                            }}
                        >
                            {hasChildren ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevent row click when triggering expand
                                        toggleRow(node._id);
                                    }}
                                    className="p-1 hover:bg-slate-200 rounded-md transition-colors"
                                >
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                </button>
                            ) : (
                                <div className="w-6" /> // Spacer
                            )}
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 overflow-hidden relative group-hover:ring-2 group-hover:ring-offset-1 group-hover:ring-blue-400 transition-all">
                                {node.profilePicture ? (
                                    <img src={node.profilePicture} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    (node.firstName || 'U').charAt(0)
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{node.firstName} {node.lastName}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{node.designation || 'Employee'}</p>
                            </div>
                        </div>
                    </td>
                    <td className="py-4 px-4 text-center font-bold text-slate-700">{stats.total}</td>
                    <td className="py-4 px-4 text-center font-bold text-cyan-600 bg-cyan-50/50 rounded-lg">{stats.completed}</td>
                    <td className="py-4 px-4 text-center font-bold text-red-600 bg-red-50/50 rounded-lg">{stats.overdue}</td>
                    <td className="py-4 px-4 text-center font-bold text-yellow-600 bg-yellow-50/50 rounded-lg">{stats.pending}</td>
                    <td className="py-4 px-4 text-center font-bold text-emerald-600 bg-emerald-50/50 rounded-lg">{stats.approved}</td>
                    <td className="py-4 px-4 text-center font-bold text-red-600 bg-red-50/50 rounded-lg">{stats.rejected}</td>
                </tr>
                {isExpanded && node.children && node.children.map(child => (
                    <TeamTableRow key={child._id} node={child} level={level + 1} />
                ))}
            </>
        );
    };

    return (
        <div className="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans">
            <Sidebar />
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                <Navbar />

                <div className="flex-1 overflow-y-auto w-full p-6 lg:p-10 scrollbar-hide">
                    <div className="max-w-7xl mx-auto space-y-10">

                        {/* New Header Section */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Hi, welcome back!</h1>
                                <p className="text-slate-500 font-medium mt-1">Your HR performance and monitoring dashboard template.</p>
                            </div>
                            <div className="hidden md:block">
                                {/* Date or other actions can go here */}
                                <span className="text-slate-400 font-bold text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>
                        </div>

                        {/* Dashboard Content Grid - Interactive Mode */}
                        <div className="grid grid-cols-12 gap-6">

                            {isExpanded ? (
                                /* EXPANDED VIEW: Command Center */
                                <div className="col-span-12 bg-white rounded-[20px] p-6 lg:p-8 shadow-sm border border-slate-100 animate-in fade-in zoom-in duration-300 min-h-[600px]">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                                {viewMode === 'teams'
                                                    ? `${selectedUser ? selectedUser.firstName : 'Your'} Team Overview`
                                                    : `${selectedUser ? selectedUser.firstName + "'s" : 'Request'} Command Center`
                                                }
                                            </h2>
                                            <p className="text-slate-500 text-sm mt-1">
                                                {viewMode === 'teams'
                                                    ? `Aggregated stats for ${selectedUser ? selectedUser.firstName + ' and their team' : 'you and your team'}.`
                                                    : `Manage and track ${selectedUser ? selectedUser.firstName + "'s" : 'your'} requests in one place.`
                                                }
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {/* See Teams Button */}
                                            <button
                                                onClick={() => setViewMode(viewMode === 'requests' ? 'teams' : 'requests')}
                                                className={`
                                                    flex items-center gap-2 px-4 py-2 rounded-full border font-bold text-sm transition-all
                                                    ${viewMode === 'teams'
                                                        ? 'bg-slate-900 text-white border-slate-900'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                    }
                                                `}
                                            >
                                                <Users className="w-4 h-4" />
                                                {viewMode === 'teams' ? 'View Requests' : 'See Teams'}
                                            </button>

                                            <button
                                                onClick={() => setIsExpanded(false)}
                                                className="self-start md:self-auto p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                                                title="Close Command Center"
                                            >
                                                <ChevronUp className="w-6 h-6" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Action Filters - Always Visible */}
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
                                        {(() => {
                                            const activeStats = viewMode === 'teams' ? aggregatedStats : {
                                                ...userStats,
                                                completed: derivedStats.completed,
                                                overdue: derivedStats.overdue
                                            };

                                            return [
                                                {
                                                    label: 'Total', count: activeStats.total || 0,
                                                    activeClass: 'bg-blue-600 text-white border-blue-600 shadow-blue-200',
                                                    inactiveClass: 'bg-white text-blue-600 border-slate-100 hover:border-blue-200 hover:bg-blue-50'
                                                },
                                                {
                                                    label: 'Completed', count: activeStats.completed || 0,
                                                    activeClass: 'bg-cyan-400 text-white border-cyan-400 shadow-cyan-200',
                                                    inactiveClass: 'bg-white text-cyan-600 border-slate-100 hover:border-cyan-200 hover:bg-cyan-50'
                                                },
                                                {
                                                    label: 'Overdue', count: activeStats.overdue || 0,
                                                    activeClass: 'bg-orange-500 text-white border-orange-500 shadow-orange-200',
                                                    inactiveClass: 'bg-white text-orange-600 border-slate-100 hover:border-orange-200 hover:bg-orange-50'
                                                },
                                                {
                                                    label: 'Pending', count: activeStats.pending || 0,
                                                    activeClass: 'bg-yellow-400 text-white border-yellow-400 shadow-yellow-200',
                                                    inactiveClass: 'bg-white text-yellow-600 border-slate-100 hover:border-yellow-200 hover:bg-yellow-50'
                                                },
                                                {
                                                    label: 'Approved', count: activeStats.approved || 0,
                                                    activeClass: 'bg-emerald-500 text-white border-emerald-500 shadow-emerald-200',
                                                    inactiveClass: 'bg-white text-emerald-600 border-slate-100 hover:border-emerald-200 hover:bg-emerald-50'
                                                },
                                                {
                                                    label: 'Rejected', count: activeStats.rejected || 0,
                                                    activeClass: 'bg-red-600 text-white border-red-600 shadow-red-200',
                                                    inactiveClass: 'bg-white text-red-600 border-slate-100 hover:border-red-200 hover:bg-red-50'
                                                }
                                            ].map((f) => (
                                                <button
                                                    key={f.label}
                                                    onClick={() => setFilter(f.label)}
                                                    className={`
                                                        flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-200 border h-28
                                                        ${filter === f.label
                                                            ? `${f.activeClass} shadow-xl scale-105 ring-4 ring-slate-50 z-10`
                                                            : `${f.inactiveClass} hover:-translate-y-1 hover:shadow-md`
                                                        }
                                                    `}
                                                >
                                                    <span className="text-3xl font-black mb-2">
                                                        {f.count}
                                                    </span>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-90">
                                                        {f.label}
                                                    </span>
                                                </button>
                                            ));
                                        })()}
                                    </div>

                                    {viewMode === 'requests' ? (
                                        /* REQUESTS VIEW */
                                        <>
                                            {/* Table Section */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-6">
                                                    <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
                                                    <h3 className="text-sm font-black text-blue-600 uppercase tracking-wider">Latest {filter} Items</h3>
                                                </div>

                                                <div className="overflow-x-auto">
                                                    <table className="w-full">
                                                        <thead>
                                                            <tr className="border-b border-slate-100">
                                                                <th className="text-left py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Type</th>
                                                                <th className="text-left py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Requested By</th>
                                                                <th className="text-left py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Requested Date</th>
                                                                <th className="text-left py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                                                <th className="text-left py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Date (Actioned)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {getFilteredItems().length > 0 ? (
                                                                getFilteredItems().map((item, index) => (
                                                                    <tr
                                                                        key={`${item.id}_${index}`}
                                                                        onClick={() => handleRowClick(item)}
                                                                        className="border-b border-slate-50 hover:bg-slate-50 transition-all cursor-pointer group"
                                                                    >
                                                                        <td className="py-4 px-4">
                                                                            <div className="font-bold text-slate-700 capitalize group-hover:text-blue-600 transition-colors">
                                                                                {item.type?.replace(/_/g, ' ') || 'Request'}
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-4 px-4">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                                                    {(item.employeeName || item.requestedBy || userName || 'U').charAt(0)}
                                                                                </div>
                                                                                <span className="text-sm font-medium text-slate-600">
                                                                                    {item.employeeName || item.requestedBy || 'Me'}
                                                                                </span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-4 px-4 text-sm text-slate-500 font-medium">
                                                                            {item.requestedDate ? new Date(item.requestedDate).toLocaleDateString('en-US', { medium: 'date' }) : '-'}
                                                                        </td>
                                                                        <td className="py-4 px-4">
                                                                            <span className={`
                                                                                inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold capitalize tracking-wide
                                                                                ${item.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                                                    item.status === 'Rejected' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                                                                                        'bg-amber-50 text-amber-600 border border-amber-100'}
                                                                            `}>
                                                                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 
                                                                                    ${item.status === 'Approved' ? 'bg-emerald-500' :
                                                                                        item.status === 'Rejected' ? 'bg-rose-500' :
                                                                                            'bg-amber-500'}
                                                                                `}></span>
                                                                                {item.status || 'Pending'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-4 px-4 text-sm text-slate-400 font-mono">
                                                                            {item.actionedDate ? new Date(item.actionedDate).toLocaleDateString() : '-'}
                                                                        </td>
                                                                    </tr>
                                                                ))
                                                            ) : (
                                                                <tr>
                                                                    <td colSpan="5" className="py-12 text-center">
                                                                        <div className="flex flex-col items-center justify-center">
                                                                            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                                                                <LayoutGrid className="w-6 h-6 text-slate-300" />
                                                                            </div>
                                                                            <p className="text-slate-500 font-medium italic">No {filter.toLowerCase()} items found.</p>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        /* TEAMS VIEW */
                                        <div>
                                            <div className="flex items-center gap-2 mb-6">
                                                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>
                                                <h3 className="text-sm font-black text-indigo-600 uppercase tracking-wider">Team Performance</h3>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead>
                                                        <tr className="border-b border-slate-100 bg-slate-50/50">
                                                            <th className="text-left py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Employees Under {selectedUser ? selectedUser.firstName : 'You'}</th>
                                                            <th className="text-center py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Total</th>
                                                            <th className="text-center py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Completed</th>
                                                            <th className="text-center py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Overdue</th>
                                                            <th className="text-center py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Pending</th>
                                                            <th className="text-center py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Approved</th>
                                                            <th className="text-center py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Rejected</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {hierarchyData.length > 0 ? (
                                                            hierarchyData.map(node => (
                                                                <TeamTableRow key={node._id} node={node} />
                                                            ))
                                                        ) : (
                                                            <tr>
                                                                <td colSpan="7" className="py-12 text-center text-slate-400 italic">
                                                                    Loading hierarchy...
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* DEFAULT VIEW: Summary Cards */
                                <>
                                    {/* Card 1: Request Activity (Pie Chart) - Clickable to Expand */}
                                    <div
                                        onClick={() => setIsExpanded(true)}
                                        className="col-span-12 md:col-span-6 lg:col-span-3 bg-white rounded-[20px] p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[300px] cursor-pointer hover:shadow-md hover:border-blue-100 transition-all group relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ArrowUpRight className="w-5 h-5 text-blue-500" />
                                        </div>

                                        <div className="w-full mb-4">
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Request Activity</h3>
                                            <p className="text-slate-400 text-xs mt-2 leading-relaxed">Status Overview</p>
                                        </div>
                                        <div className="flex-1 flex flex-col items-center justify-center w-full">
                                            <ActivityPieChart data={{ pending: userStats.pending, approved: userStats.approved, rejected: userStats.rejected, total: userStats.total }} size={45} />
                                        </div>
                                        <div className="mt-4 text-xs font-bold text-center text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all">
                                            Click to view details
                                        </div>
                                    </div>

                                    {/* Card 2: Net Profit Margin (Dummy) */}
                                    <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-white rounded-[20px] p-6 shadow-sm border border-slate-100 flex flex-col justify-between min-h-[300px]">
                                        <div>
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Net Profit Margin</h3>
                                            <p className="text-slate-400 text-xs mt-2 leading-relaxed">Measures your business at generating prof... <span className="text-blue-500 cursor-pointer hover:underline">Learn more</span></p>
                                        </div>
                                        <div className="flex items-center justify-center py-4">
                                            <div className="relative w-40 h-40 rounded-full flex items-center justify-center">
                                                {/* Background Circle */}
                                                <svg className="absolute w-full h-full transform -rotate-90">
                                                    <circle cx="80" cy="80" r="70" stroke="#f1f5f9" strokeWidth="12" fill="transparent" />
                                                    <circle cx="80" cy="80" r="70" stroke="#3b82f6" strokeWidth="12" fill="transparent" strokeDasharray="440" strokeDashoffset="140" strokeLinecap="round" />
                                                </svg>
                                                <span className="text-4xl font-black text-blue-600">68%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card 3: Your Balance (Dummy) */}
                                    <div className="col-span-12 lg:col-span-6 bg-white rounded-[20px] p-8 shadow-sm border border-slate-100 flex flex-col justify-between min-h-[300px] relative overflow-hidden">
                                        <div className="flex justify-between items-start z-10">
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Your Balance</p>
                                                <h3 className="text-4xl font-black text-slate-900 tracking-tight">$780,560<span className="text-2xl text-slate-400">.00</span></h3>
                                            </div>
                                            <div className="bg-blue-600 text-white px-3 py-1 rounded font-black italic tracking-tighter text-lg">VISA</div>
                                        </div>

                                        <div className="z-10">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Your Account Number</p>
                                            <div className="flex items-center gap-4 text-slate-900 text-xl font-black tracking-widest">
                                                <span>••••</span>
                                                <span>••••</span>
                                                <span>••••</span>
                                                <span>5637</span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-end z-10 border-t border-slate-100 pt-6 mt-4">
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Account Holder</p>
                                                <p className="text-sm font-bold text-slate-700">Alicia Christensen</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Account Type</p>
                                                <p className="text-sm font-bold text-slate-700">Savings</p>
                                            </div>
                                        </div>

                                        <div className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1/4 opacity-5 pointer-events-none">
                                            <TrendingUp className="w-64 h-64 text-slate-900" />
                                        </div>
                                    </div>

                                    {/* NEW: Pending Approvals Quick List (Always visible in Default View) */}
                                    <div className="col-span-12 bg-white rounded-[20px] p-8 shadow-sm border border-slate-100 min-h-[400px]">
                                        <div className="flex items-center justify-between mb-8">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center">
                                                    <Clock className="w-5 h-5 text-orange-600" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Pending Approvals</h3>
                                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">Needs Your Attention</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { setFilter('Pending'); setIsExpanded(true); }}
                                                className="text-blue-600 text-xs font-black uppercase tracking-widest hover:text-blue-700 transition-colors bg-blue-50 px-4 py-2 rounded-full"
                                            >
                                                View All
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            {userStats.items.filter(i => i.status === 'Pending').length > 0 ? (
                                                userStats.items.filter(i => i.status === 'Pending').slice(0, 5).map((item, idx) => (
                                                    <div
                                                        key={`${item.id}-${idx}`}
                                                        onClick={() => handleRowClick(item)}
                                                        className="group flex items-center justify-between p-4 rounded-2xl border border-slate-50 hover:border-blue-100 hover:bg-blue-50/30 transition-all cursor-pointer"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                                                <span className="text-slate-900 font-black text-xs">{(item.requestedBy || 'E').charAt(0)}</span>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-black text-slate-800 tracking-tight">{item.type || 'Request'}</p>
                                                                <p className="text-xs font-bold text-slate-400">Requested by <span className="text-slate-600">{item.requestedBy || 'Team Member'}</span></p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs font-bold text-slate-900">{new Date(item.requestedDate).toLocaleDateString()}</p>
                                                            <div className="flex items-center gap-1 justify-end mt-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                                                <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Action Required</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                                                    <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-4">
                                                        <Clock className="w-6 h-6 text-slate-200" />
                                                    </div>
                                                    <p className="text-slate-400 font-bold text-sm tracking-tight italic">No pending requests at the moment.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Row 2: Financial Ratios & Details (Dummy) - Only show if NOT expanded */}
                        {!isExpanded && (
                            <div className="grid grid-cols-12 gap-6 mt-6">

                                {/* Col 1: Ratios Card - Span 6 */}
                                <div className="col-span-12 lg:col-span-6 bg-white rounded-[20px] p-6 shadow-sm border border-slate-100 flex flex-col justify-between min-h-[300px]">
                                    <div className="space-y-8">
                                        {/* Quick Ratio */}
                                        <div>
                                            <div className="flex justify-between items-baseline mb-2">
                                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Quick Ratio</h3>
                                                <span className="text-2xl font-black text-slate-900">0.9:8</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full w-[45%] bg-amber-400 rounded-full"></div>
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-2">Quick Ratio Goal: 1.0 or higher</p>
                                            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                                                Measures your Current Assets + Accounts Receivable / Current Liabilities <span className="text-blue-500 cursor-pointer hover:underline">Learn more</span>
                                            </p>
                                        </div>

                                        {/* Current Ratio */}
                                        <div>
                                            <div className="flex justify-between items-baseline mb-2">
                                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Current Ratio</h3>
                                                <span className="text-2xl font-black text-slate-900">2.8</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full w-[70%] bg-emerald-500 rounded-full"></div>
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-2">Quick Ratio Goal: 2.0 or higher</p>
                                            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                                                Measures your Current Assets / Current Liabilities. <span className="text-blue-500 cursor-pointer hover:underline">Learn more</span>
                                            </p>
                                        </div>
                                    </div>

                                </div>

                                {/* Col 2 & 3: 4-Card Grid Stats - Span 6 */}
                                <div className="col-span-12 lg:col-span-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Total Income */}
                                    <div className="bg-white rounded-[20px] p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Total Income</h3>
                                            {/* Dummy Mini Bar Chart */}
                                            <div className="flex items-end gap-1 h-8 mb-4">
                                                <div className="w-2 bg-blue-600 rounded-t-sm h-[40%]"></div>
                                                <div className="w-2 bg-blue-600 rounded-t-sm h-[70%]"></div>
                                                <div className="w-2 bg-blue-600 rounded-t-sm h-[50%]"></div>
                                                <div className="w-2 bg-purple-600 rounded-t-sm h-[100%]"></div>
                                                <div className="w-2 bg-purple-600 rounded-t-sm h-[60%]"></div>
                                                <div className="w-2 bg-purple-600 rounded-t-sm h-[80%]"></div>
                                            </div>
                                            <h4 className="text-2xl font-black text-slate-900 mb-1">$ 83,320<span className="text-lg text-slate-400">.50</span></h4>
                                            <p className="text-xs font-bold text-emerald-500">18.2% <span className="text-slate-400 font-medium">higher vs previous month</span></p>
                                        </div>
                                    </div>

                                    {/* Total Expenses */}
                                    <div className="bg-white rounded-[20px] p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Total Expenses</h3>
                                            {/* Dummy Mini Bar Chart */}
                                            <div className="flex items-end gap-1 h-8 mb-4">
                                                <div className="w-2 bg-blue-400 rounded-t-sm h-[60%]"></div>
                                                <div className="w-2 bg-blue-400 rounded-t-sm h-[30%]"></div>
                                                <div className="w-2 bg-blue-400 rounded-t-sm h-[50%]"></div>
                                                <div className="w-2 bg-blue-400 rounded-t-sm h-[40%]"></div>
                                                <div className="w-2 bg-blue-400 rounded-t-sm h-[80%]"></div>
                                            </div>
                                            <h4 className="text-2xl font-black text-slate-900 mb-1">$ 32,370<span className="text-lg text-slate-400">.00</span></h4>
                                            <p className="text-xs font-bold text-red-500">0.7% <span className="text-slate-400 font-medium">higher vs previous month</span></p>
                                        </div>
                                    </div>

                                    {/* Accounts Receivable */}
                                    <div className="bg-white rounded-[20px] p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Accounts Receivable</h3>
                                            {/* Dummy Mini Bar Chart */}
                                            <div className="flex items-end gap-1 h-8 mb-4">
                                                <div className="w-2 bg-emerald-400 rounded-t-sm h-[50%]"></div>
                                                <div className="w-2 bg-emerald-400 rounded-t-sm h-[70%]"></div>
                                                <div className="w-2 bg-emerald-400 rounded-t-sm h-[40%]"></div>
                                                <div className="w-2 bg-emerald-400 rounded-t-sm h-[80%]"></div>
                                                <div className="w-2 bg-emerald-400 rounded-t-sm h-[60%]"></div>
                                            </div>
                                            <h4 className="text-2xl font-black text-slate-900 mb-1">$ 9,112<span className="text-lg text-slate-400">.00</span></h4>
                                            <p className="text-xs font-bold text-emerald-500">0.7% <span className="text-slate-400 font-medium">higher vs previous month</span></p>
                                        </div>
                                    </div>

                                    {/* Accounts Payable */}
                                    <div className="bg-white rounded-[20px] p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Accounts Payable</h3>
                                            {/* Dummy Mini Bar Chart */}
                                            <div className="flex items-end gap-1 h-8 mb-4">
                                                <div className="w-2 bg-pink-500 rounded-t-sm h-[40%]"></div>
                                                <div className="w-2 bg-pink-500 rounded-t-sm h-[60%]"></div>
                                                <div className="w-2 bg-pink-500 rounded-t-sm h-[30%]"></div>
                                                <div className="w-2 bg-pink-500 rounded-t-sm h-[90%]"></div>
                                                <div className="w-2 bg-pink-500 rounded-t-sm h-[50%]"></div>
                                            </div>
                                            <h4 className="text-2xl font-black text-slate-900 mb-1">$ 8,216<span className="text-lg text-slate-400">.00</span></h4>
                                            <p className="text-xs font-bold text-emerald-500">0.7% <span className="text-slate-400 font-medium">higher vs previous month</span></p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}


                    </div>
                </div>
            </div>
        </div >
    );

}
