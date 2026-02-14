'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import FineFlowManager from './components/FineFlowManager';
import { Trash2, X, Pencil } from 'lucide-react';
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
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Pie } from 'react-chartjs-2';

// Register ChartJS
ChartJS.register(ArcElement, ChartTooltip, ChartLegend, ChartDataLabels);

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

export default function FinePage() {
    const router = useRouter();
    const { toast } = useToast();
    const [mounted, setMounted] = useState(false);
    const [fines, setFines] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddFlow, setShowAddFlow] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [fineToDelete, setFineToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
    const [selectedEmployeeFines, setSelectedEmployeeFines] = useState(null);
    const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
    const [selectedTypeFines, setSelectedTypeFines] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFineType, setSelectedFineType] = useState('');
    const fetchingRef = useRef(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch employees for dropdown in modal
    const fetchEmployees = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/Employee');
            setEmployees(response.data.employees || []);
        } catch (err) {
            console.error('Error fetching employees:', err);
        }
    }, []);

    // Fetch fines from backend
    const fetchFines = useCallback(async () => {
        if (fetchingRef.current) {
            return;
        }

        try {
            fetchingRef.current = true;
            setLoading(true);
            setError('');

            // Fetch with high limit to support client-side filtering
            // ideally this should be moved to server-side filtering in the future
            const response = await axiosInstance.get('/Fine?limit=1000');
            const finesData = response.data.fines || response.data || [];

            const validFines = finesData
                .filter(fine =>
                    fine != null &&
                    typeof fine === 'object' &&
                    (fine.fineId || fine._id)
                )
                .flatMap(fine => {
                    const rows = [];
                    const baseFineId = fine.fineId || fine._id?.slice(-8) || 'N/A';

                    // 1. Employee Rows
                    if (fine.assignedEmployees && fine.assignedEmployees.length > 0) {
                        const count = fine.assignedEmployees.length;
                        const totalEmpLiability = fine.employeeAmount || 0;
                        const shareAmount = count > 0 ? (totalEmpLiability / count) : 0;

                        fine.assignedEmployees.forEach(emp => {
                            // Backend now stores Company as a separate 'User' fine record.
                            // We display it just like any other employee fine.

                            // Optional: Clean up Company ID for display
                            const dispEmpId = (emp.employeeId === 'VEGA_INTERNAL' || emp.employeeName === 'Vega Digital IT Solutions') ? null : emp.employeeId;

                            rows.push({
                                ...fine,
                                fineId: baseFineId,
                                employeeId: dispEmpId,
                                employeeName: emp.employeeName,
                                fineStatus: fine.fineStatus || 'Pending',
                                fineType: fine.fineType || 'Other',
                                displayAmount: shareAmount,
                                category: fine.category || 'Other',
                                _uiKey: `${fine._id}_${emp.employeeId}`,
                                isGroupChild: true
                            });
                        });
                    } else {
                        // Single Fine (Employee or Company-as-User)
                        const empName = fine.employeeName || 'N/A';

                        // Check if this is a Company Record (stored as user)
                        const isCompanyRec = empName === 'Vega Digital IT Solutions' || fine.employeeId === 'VEGA_INTERNAL';
                        const dispEmpId = isCompanyRec ? null : (fine.employeeId || 'N/A');

                        rows.push({
                            ...fine,
                            fineId: baseFineId,
                            fineStatus: fine.fineStatus || 'Pending',
                            employeeName: empName,
                            fineType: fine.fineType || 'Other',
                            employeeId: dispEmpId, // Hide ID for company
                            displayAmount: fine.employeeAmount || 0,
                            category: fine.category || 'Other',
                            _uiKey: fine._id
                        });
                    }

                    // 2. Suffix Calculation (For Group Fines Only)
                    if (rows.length > 1) {
                        rows.forEach((row, index) => {
                            const suffix = String.fromCharCode(65 + index); // 0->A, 1->B...
                            row.fineId = `${baseFineId}-${suffix}`;
                        });
                    }

                    return rows;
                });
            setFines(validFines);
        } catch (err) {
            console.error('Error fetching fines:', err);
            setError(err.response?.data?.message || err.message || 'Failed to fetch fines');
            setFines([]);
        } finally {
            setLoading(false);
            fetchingRef.current = false;
        }
    }, []);

    useEffect(() => {
        if (mounted) {
            fetchFines();
            fetchEmployees();
        }
    }, [mounted, fetchFines, fetchEmployees]);

    const handleAddFine = () => {
        setShowAddFlow(true);
    };

    const handleModalSuccess = () => {
        fetchFines();
    };

    const handleDeleteClick = (fine) => {
        setFineToDelete(fine);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!fineToDelete) return;

        try {
            setIsDeleting(true);
            await axiosInstance.delete(`/Fine/${fineToDelete._id}`);
            toast({
                title: "Success",
                description: "Fine record deleted successfully",
                variant: "success",
            });
            fetchFines();
        } catch (err) {
            console.error('Error deleting fine:', err);
            toast({
                title: "Error",
                description: err.response?.data?.message || "Failed to delete fine",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setFineToDelete(null);
        }
    };

    const filteredFines = useMemo(() => {
        if (!fines || !Array.isArray(fines)) return [];

        let result = fines;

        // Filter by Fine Type or Category
        if (selectedFineType) {
            if (selectedFineType === 'Other') {
                // 'Other' in the dashboard boxes acts as a catch-all for types not specifically categorized in other boxes
                const specificTypes = ['Vehicle Fine', 'Safety Fine', 'Project Damage', 'Loss & Damage'];
                result = result.filter(fine => !specificTypes.includes(fine.fineType));
            } else if (selectedFineType === 'Damage' || selectedFineType === 'Violation') {
                result = result.filter(fine => fine.category === selectedFineType || fine.fineType === selectedFineType);
            } else {
                result = result.filter(fine => fine.fineType === selectedFineType);
            }
        }

        // Filter by Search Query
        const query = searchQuery.toLowerCase().trim();
        if (query) {
            result = result.filter(fine =>
                (fine.fineId && fine.fineId.toLowerCase().includes(query)) ||
                (fine.employeeId && fine.employeeId.toLowerCase().includes(query)) ||
                (fine.employeeName && fine.employeeName.toLowerCase().includes(query)) ||
                (fine.fineType && fine.fineType.toLowerCase().includes(query)) ||
                (fine.fineStatus && fine.fineStatus.toLowerCase().includes(query))
            );
        }

        return result;
    }, [fines, searchQuery, selectedFineType]);

    if (!mounted) {
        return null;
    }

    // Prepare Dashboard Stats
    const nonCancelledFines = fines.filter(f => f.fineStatus !== 'Cancelled');
    const confirmedFines = fines.filter(f => ['Approved', 'Active', 'Completed'].includes(f.fineStatus));
    const pendingCollectionFines = fines.filter(f => ['Approved', 'Active'].includes(f.fineStatus));

    const dashboardStats = {
        count: nonCancelledFines.length,
        value: confirmedFines.reduce((acc, f) => acc + (f.displayAmount || 0), 0),
        outstanding: pendingCollectionFines.reduce((acc, f) => acc + (f.displayAmount || 0), 0),
        vehicle: nonCancelledFines.filter(f => f.fineType === 'Vehicle Fine').length,
        safety: nonCancelledFines.filter(f => f.fineType === 'Safety Fine').length,
        project: nonCancelledFines.filter(f => f.fineType === 'Project Damage').length,
        lossDamage: nonCancelledFines.filter(f => f.fineType === 'Loss & Damage').length,
        other: nonCancelledFines.filter(f => !['Vehicle Fine', 'Safety Fine', 'Project Damage', 'Loss & Damage'].includes(f.fineType)).length,
    };

    // Prepare Chart Data
    // 1. Finer User (Top Users by Fine Count)
    const userMap = {};
    fines.forEach(f => {
        const name = f.employeeName || 'N/A';
        const displayName = name.split(' ')[0];
        userMap[name] = (userMap[name] || 0) + 1;
    });
    const finerUserData = Object.entries(userMap)
        .map(([name, value]) => ({ name: name.split(' ')[0], fullName: name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

    // 2. Fine Type (Pie Chart)
    const typeMap = {};
    const typeListMap = {};
    fines.forEach(f => {
        const type = f.fineType || 'Other';
        typeMap[type] = (typeMap[type] || 0) + 1;
        if (!typeListMap[type]) typeListMap[type] = [];
        typeListMap[type].push(f);
    });
    const fineTypeData = {
        labels: Object.keys(typeMap),
        datasets: [{
            data: Object.values(typeMap),
            backgroundColor: ['#F97316', '#15803D', '#3B82F6', '#A855F7', '#10B981', '#6366F1'],
            borderWidth: 0,
            borderColor: 'transparent',
            lists: Object.values(typeListMap)
        }]
    };

    return (
        <PermissionGuard moduleId="hrm_fine" permissionType="view">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                        {/* Header and Actions */}
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800 mb-2">Fine Management</h1>
                                <p className="text-gray-600">
                                    Manage employee fines and split liability tracking
                                </p>
                            </div>

                            <div className="flex items-center gap-4">
                                {/* Search */}
                                <div className="relative flex-1 min-w-[300px]">
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                    >
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <path d="m21 21-4.35-4.35"></path>
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search Fines"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-800/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white shadow-sm transition-all"
                                    />
                                </div>

                                {/* Add Fine Button */}
                                <button
                                    onClick={handleAddFine}
                                    className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 5v14M5 12h14"></path>
                                    </svg>
                                    Add Fine
                                </button>
                            </div>
                        </div>

                        {/* Redesigned Dashboard Header */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* Left Panel: Statistics Grid */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[350px]">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Fine Overview</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                                    {[
                                        { label: 'Fine Count', value: dashboardStats.count, color: 'text-red-600', filter: '' },
                                        { label: 'Fine Value', value: dashboardStats.value, color: 'text-red-600', isCurrency: true },
                                        { label: 'Outstanding', value: dashboardStats.outstanding, color: 'text-red-600', isCurrency: true },
                                        { label: 'Other', value: dashboardStats.other, color: 'text-red-600', filter: 'Other' },
                                        { label: 'Vehicle', value: dashboardStats.vehicle, color: 'text-red-600', filter: 'Vehicle Fine' },
                                        { label: 'Safety', value: dashboardStats.safety, color: 'text-red-600', filter: 'Safety Fine' },
                                        { label: 'Project', value: dashboardStats.project, color: 'text-red-600', filter: 'Project Damage' },
                                        { label: 'Los/Damage', value: dashboardStats.lossDamage, color: 'text-red-600', filter: 'Loss & Damage' },
                                    ].map((item, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => item.filter !== undefined && setSelectedFineType(item.filter)}
                                            className="bg-gray-50 p-4 rounded-xl flex flex-col items-center justify-center text-center group hover:bg-white hover:shadow-md transition-all cursor-pointer border border-transparent hover:border-gray-200"
                                        >
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-2">{item.label}</span>
                                            <div
                                                className="flex items-baseline justify-center gap-1 font-black group-hover:scale-105 transition-transform"
                                                style={{ color: '#dc2626' }}
                                            >
                                                {item.isCurrency ? (
                                                    <>
                                                        <span className="text-sm font-bold">AED</span>
                                                        <span className="text-2xl"><AnimatedCounter value={item.value} /></span>
                                                    </>
                                                ) : (
                                                    <span className="text-3xl"><AnimatedCounter value={item.value} /></span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right Panel: Charts */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-6 min-h-[350px]">
                                {/* Bar Chart: Finer User */}
                                <div className="flex-[3] flex flex-col">
                                    <h3 className="text-sm font-bold text-gray-400 text-center uppercase tracking-widest mb-6">Finer User</h3>
                                    <div className="flex-1 min-h-[220px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={finerUserData} margin={{ top: 15, right: 0, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="fineBarGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#1E3A8A" stopOpacity={1} />
                                                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.8} />
                                                    </linearGradient>
                                                </defs>
                                                <XAxis
                                                    dataKey="name"
                                                    fontSize={10}
                                                    axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                                                    tickLine={false}
                                                    dy={5}
                                                />
                                                <YAxis hide={true} />
                                                <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                                <Bar
                                                    dataKey="value"
                                                    radius={[4, 4, 0, 0]}
                                                    barSize={24}
                                                    animationDuration={1200}
                                                    onClick={(data) => {
                                                        if (data) {
                                                            const employeeFines = fines.filter(f => f.employeeName === data.fullName);
                                                            setSelectedEmployeeFines({
                                                                fullName: data.fullName,
                                                                value: data.value,
                                                                fines: employeeFines
                                                            });
                                                            setIsEmpModalOpen(true);
                                                        }
                                                    }}
                                                    cursor="pointer"
                                                >
                                                    {finerUserData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill="url(#fineBarGradient)" />
                                                    ))}
                                                    <LabelList dataKey="value" position="top" style={{ fill: '#DC2626', fontSize: '11px', fontWeight: '800' }} />
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Pie Chart: Fine Type */}
                                <div className="flex-[2] flex flex-col items-center justify-center">
                                    <h3 className="text-sm font-bold text-gray-400 text-center uppercase tracking-widest mb-6">Fine Type</h3>
                                    <div className="w-[230px] h-[230px] flex items-center justify-center relative">
                                        <Pie
                                            data={fineTypeData}
                                            options={{
                                                plugins: {
                                                    legend: { display: false },
                                                    datalabels: {
                                                        color: '#fff',
                                                        font: {
                                                            weight: 'bold',
                                                            size: 14
                                                        },
                                                        formatter: (value) => value
                                                    }
                                                },
                                                maintainAspectRatio: false,
                                                onClick: (event, elements) => {
                                                    if (elements && elements.length > 0) {
                                                        const index = elements[0].index;
                                                        const label = fineTypeData.labels[index];
                                                        const list = fineTypeData.datasets[0].lists[index] || [];

                                                        setSelectedTypeFines({
                                                            title: label,
                                                            fines: list
                                                        });
                                                        setIsTypeModalOpen(true);
                                                    }
                                                },
                                                onHover: (event, elements) => {
                                                    event.native.target.style.cursor = (elements && elements.length > 0) ? 'pointer' : 'default';
                                                },
                                                animation: {
                                                    animateRotate: true,
                                                    animateScale: true,
                                                    duration: 1200,
                                                    easing: 'easeOutQuart'
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-800">Fine Directory</h2>
                            <div className="flex items-center gap-3">
                                {selectedFineType && (
                                    <button
                                        onClick={() => setSelectedFineType('')}
                                        className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 flex items-center gap-1 cursor-pointer transition-all"
                                    >
                                        CLEAR FILTER: {selectedFineType.toUpperCase()}
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
                                )}
                                {/* Fine Type Filter Dropdown */}
                                <div className="relative min-w-[200px]">
                                    <select
                                        value={selectedFineType}
                                        onChange={(e) => setSelectedFineType(e.target.value)}
                                        className="w-full h-[38px] px-4 border border-gray-800/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white appearance-none cursor-pointer shadow-sm transition-all"
                                    >
                                        <option value="">All Fine Types</option>
                                        <option value="Vehicle Fine">Vehicle Fine</option>
                                        <option value="Safety Fine">Safety Fine</option>
                                        <option value="Violation">Violation</option>
                                        <option value="Project Damage">Project Damage</option>
                                        <option value="Loss & Damage">Loss & Damage</option>
                                        <option value="Other Damage">Other Damage</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m6 9 6 6 6-6" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 mb-4">
                                {error}
                            </div>
                        )}

                        {/* Fines Table */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full border border-gray-200">
                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full min-w-0 table-auto">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                FINE ID
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                EMP. ID
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                NAME
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                FINE TYPE
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
                                                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                                                    Loading fines...
                                                </td>
                                            </tr>
                                        ) : filteredFines.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                                                    No fines found. Click "Add Fine" to create one.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredFines.map((fine) => {
                                                const isCompanyRow = fine.isCompany || fine.employeeName === 'Vega Digital IT Solutions';
                                                return (
                                                    <tr
                                                        key={fine._uiKey || fine._id || fine.fineId}
                                                        onClick={() => !isCompanyRow && router.push(`/HRM/Fine/${fine.fineId}`)}
                                                        className={`transition-colors ${isCompanyRow ? 'cursor-default' : 'hover:bg-gray-50 cursor-pointer'}`}
                                                    >
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            {fine.fineId}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                            {(fine.employeeId || '').replace(/\s+/g, '')}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                            {fine.employeeName}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                            {fine.fineType}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-bold">
                                                            {Number(fine.displayAmount || 0).toLocaleString()} AED
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span
                                                                className={`px-3 py-1 rounded-full text-xs font-medium ${fine.fineStatus === 'Active' || fine.fineStatus === 'Approved' || fine.fineStatus === 'Completed'
                                                                    ? 'bg-green-100 text-green-800'
                                                                    : fine.fineStatus === 'Pending'
                                                                        ? 'bg-yellow-100 text-yellow-800'
                                                                        : fine.fineStatus === 'Cancelled'
                                                                            ? 'bg-red-100 text-red-800'
                                                                            : 'bg-gray-100 text-gray-700'
                                                                    }`}
                                                            >
                                                                {fine.fineStatus}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        !isCompanyRow && router.push(`/HRM/Fine/${fine.fineId}`);
                                                                    }}
                                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                    title="Edit Fine"
                                                                >
                                                                    <Pencil size={18} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteClick(fine);
                                                                    }}
                                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                    title="Delete Fine Transaction"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
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

            <FineFlowManager
                isOpen={showAddFlow}
                onClose={() => setShowAddFlow(false)}
                onSuccess={handleModalSuccess}
                employees={employees}
            />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Fine Transaction?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this fine record? If this is a split fine, all associated employee/company entries for this transaction will be removed. This action cannot be undone.
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

            {isTypeModalOpen && selectedTypeFines && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                        onClick={() => setIsTypeModalOpen(false)}
                    ></div>
                    <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-[600px] max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">
                                    Category: {selectedTypeFines.title}
                                </h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    Total Records: {selectedTypeFines.fines.length}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsTypeModalOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* List Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                            {selectedTypeFines.fines.map((fine, idx) => (
                                <div
                                    key={fine._id || idx}
                                    onClick={() => {
                                        setIsTypeModalOpen(false);
                                        router.push(`/HRM/Fine/${fine.fineId}`);
                                    }}
                                    className="group p-4 rounded-2xl border border-gray-100 hover:border-red-200 hover:bg-red-50/50 transition-all cursor-pointer flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm">
                                            #{idx + 1}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-800 group-hover:text-red-700 transition-colors">
                                                {fine.employeeName || 'N/A'}
                                            </div>
                                            <div className="text-xs text-gray-400 font-medium">
                                                ID: {fine.fineId} • {fine.fineStatus}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${fine.fineStatus === 'Active' || fine.fineStatus === 'Approved' || fine.fineStatus === 'Completed'
                                            ? 'bg-green-100 text-green-700'
                                            : fine.fineStatus === 'Pending'
                                                ? 'bg-yellow-100 text-yellow-700'
                                                : 'bg-red-100 text-red-700'
                                            }`}>
                                            {fine.fineStatus}
                                        </span>
                                        <span className="text-sm font-bold text-red-600">
                                            {Number(fine.displayAmount || 0).toLocaleString()} AED
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isEmpModalOpen && selectedEmployeeFines && (
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
                                    Fines: {selectedEmployeeFines.fullName}
                                </h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    Total Fine Records: {selectedEmployeeFines.value}
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
                            {selectedEmployeeFines.fines.map((fine, idx) => (
                                <div
                                    key={fine._id || idx}
                                    onClick={() => {
                                        setIsEmpModalOpen(false);
                                        router.push(`/HRM/Fine/${fine.fineId}`);
                                    }}
                                    className="group p-4 rounded-2xl border border-gray-100 hover:border-red-200 hover:bg-red-50/50 transition-all cursor-pointer flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm">
                                            #{idx + 1}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-800 group-hover:text-red-700 transition-colors">
                                                {fine.fineType || 'Fine'}
                                            </div>
                                            <div className="text-xs text-gray-400 font-medium">
                                                ID: {fine.fineId} • {fine.fineStatus}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${fine.fineStatus === 'Active' || fine.fineStatus === 'Approved' || fine.fineStatus === 'Completed'
                                            ? 'bg-green-100 text-green-700'
                                            : fine.fineStatus === 'Pending'
                                                ? 'bg-yellow-100 text-yellow-700'
                                                : 'bg-red-100 text-red-700'
                                            }`}>
                                            {fine.fineStatus}
                                        </span>
                                        <span className="text-sm font-bold text-red-600">
                                            {Number(fine.displayAmount || 0).toLocaleString()} AED
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>


                    </div>
                </div>
            )}
        </PermissionGuard>
    );
}
