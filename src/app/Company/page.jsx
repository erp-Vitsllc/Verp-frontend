'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import { Building, Search, Plus, MoreVertical, Mail, Phone, Trash2, Users, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
    LabelList
} from 'recharts';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Pie } from 'react-chartjs-2';
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

// Register ChartJS
ChartJS.register(ArcElement, ChartTooltip, ChartLegend);

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

export default function CompanyPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [companyToDelete, setCompanyToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [stats, setStats] = useState({
        total: 0,
        withEmployees: 0,
        active: 0,
        inactive: 0,
        totalEmployees: 0,
        docExpiryData: [],
        statusChartData: null,
        statusProgress: 0,
        nationalityPieData: { labels: [], datasets: [] },
        nationalityBarData: []
    });
    const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [isNatModalOpen, setIsNatModalOpen] = useState(false);
    const [selectedDocBucket, setSelectedDocBucket] = useState(null);
    const [selectedNationality, setSelectedNationality] = useState(null);
    const [selectedNatCompany, setSelectedNatCompany] = useState(null);
    const [companyMap, setCompanyMap] = useState({});
    const [employeesWithCompany, setEmployeesWithCompany] = useState([]);

    const fetchCompanies = useCallback(async () => {
        try {
            setLoading(true);
            const [companyRes, employeeRes] = await Promise.all([
                axiosInstance.get('/Company'),
                axiosInstance.get('/Employee', { params: { limit: 1000 } })
            ]);

            const data = companyRes.data.companies || [];
            const allEmployees = employeeRes.data?.employees || employeeRes.data || [];

            setCompanies(data);

            // Calculate Stats
            const total = data.length;
            const withEmployees = companyRes.data.totalCompaniesWithEmployees || 0;

            // Filter employees who have a company assigned and pre-calculate normalized nationality
            const employeesWithComp = allEmployees.filter(emp => emp.company).map(emp => {
                const nat = emp.nationality || emp.country || 'Other';
                const trimmed = nat.trim().toUpperCase();

                // Map common codes to full names
                const codeMap = {
                    'AS': 'ASIA',
                    'IN': 'INDIA',
                    'IND': 'INDIA',
                    'INDIAN': 'INDIA',
                    'PK': 'PAKISTAN',
                    'BD': 'BANGLADESH',
                    'NP': 'NEPAL',
                    'AE': 'UAE',
                    'PH': 'PHILIPPINES',
                    'EG': 'EGYPT',
                    'SY': 'SYRIA',
                    'JO': 'JORDAN',
                    'LB': 'LEBANON',
                    'GB': 'UK',
                    'US': 'USA'
                };

                let normalized = codeMap[trimmed] || trimmed;

                // Standardize common names to full uppercase as per user request
                if (normalized.includes('INDIA')) normalized = 'INDIA';
                else if (normalized.includes('NEPAL')) normalized = 'NEPAL';
                else if (normalized.includes('BANGLA')) normalized = 'BANGLADESH';
                else if (normalized.includes('PAKISTAN')) normalized = 'PAKISTAN';
                else if (normalized.includes('UAE')) normalized = 'UAE';

                // Ensure all are uppercase for the "Premium" look
                normalized = normalized.toUpperCase();

                return { ...emp, normalizedNat: normalized };
            });
            const totalEmployees = employeesWithComp.length;

            const active = data.filter(c => (c.status || 'Active') === 'Active').length;
            const inactive = data.filter(c => (c.status || 'Active') !== 'Active').length;

            // Document Expiry Data
            const buckets = {
                '1 Wk': [], '2 Wk': [], '3 Wk': [], '30 D': [], '60 D': [], '90 D': [], 'More': []
            };
            const today = new Date();

            data.forEach(comp => {
                const dates = [];
                const collect = (d, type, name) => {
                    if (d) {
                        const date = new Date(d);
                        if (!isNaN(date.getTime())) {
                            dates.push({ date, type, name, compName: comp.name, compId: comp._id });
                        }
                    }
                };

                collect(comp.tradeLicenseExpiry, 'Trade License', 'Trade License');
                collect(comp.establishmentCardExpiry, 'Est. Card', 'Establishment Card');

                if (Array.isArray(comp.ejari)) {
                    comp.ejari.forEach(e => collect(e.expiryDate, 'Ejari', e.type || 'Ejari'));
                }
                if (Array.isArray(comp.insurance)) {
                    comp.insurance.forEach(i => collect(i.expiryDate, 'Insurance', i.type || 'Insurance'));
                }
                if (Array.isArray(comp.documents)) {
                    comp.documents.forEach(d => collect(d.expiryDate, 'Document', d.type || 'Document'));
                }

                dates.forEach(d => {
                    const diffDays = Math.ceil((d.date - today) / (1000 * 60 * 60 * 24));
                    let key = 'More';
                    if (diffDays <= 7) key = '1 Wk';
                    else if (diffDays <= 14) key = '2 Wk';
                    else if (diffDays <= 21) key = '3 Wk';
                    else if (diffDays <= 30) key = '30 D';
                    else if (diffDays <= 60) key = '60 D';
                    else if (diffDays <= 90) key = '90 D';

                    buckets[key].push({ ...d, daysRemaining: diffDays });
                });
            });

            const docExpiryData = Object.entries(buckets).map(([name, docs]) => ({
                name,
                value: docs.length,
                docs
            }));

            // Nationality Calculations
            const normalizeNationality = (input) => {
                if (!input) return 'OTHER';
                const trimmed = input.trim().toUpperCase();
                const codeMap = {
                    'AS': 'ASIA', 'IN': 'INDIA', 'IND': 'INDIA', 'INDIAN': 'INDIA',
                    'PK': 'PAKISTAN', 'BD': 'BANGLADESH', 'NP': 'NEPAL', 'AE': 'UAE'
                };
                let normalized = codeMap[trimmed] || trimmed;
                if (normalized.includes('INDIA')) normalized = 'INDIA';
                if (normalized.includes('NEPAL')) normalized = 'NEPAL';
                if (normalized.includes('BANGLA')) normalized = 'BANGLADESH';
                if (normalized.includes('PAKISTAN')) normalized = 'PAKISTAN';
                if (normalized.includes('UAE')) normalized = 'UAE';
                return normalized.toUpperCase();
            };

            // 1. Grouped Bar Data: Nationality by Company
            const natByComp = {}; // { Nationality: { CompanyA: 5, CompanyB: 2 } }
            const companyNamesById = data.reduce((acc, c) => ({ ...acc, [c._id]: c.nickName || c.name }), {});
            const uniqueCompanyNames = Object.values(companyNamesById);

            employeesWithComp.forEach(emp => {
                const nat = normalizeNationality(emp.nationality || emp.country);
                const compName = companyNamesById[emp.company];
                if (!compName) return;

                if (!natByComp[nat]) natByComp[nat] = {};
                natByComp[nat][compName] = (natByComp[nat][compName] || 0) + 1;
            });

            const nationalityBarData = Object.entries(natByComp).map(([nat, counts]) => ({
                nationality: nat,
                ...counts
            })).sort((a, b) => {
                const sumA = Object.values(a).reduce((s, v) => (typeof v === 'number' ? s + v : s), 0);
                const sumB = Object.values(b).reduce((s, v) => (typeof v === 'number' ? s + v : s), 0);
                return sumB - sumA;
            }).slice(0, 6);

            // 2. Pie Data: Nationality Total
            const natTotals = {};
            employeesWithComp.forEach(emp => {
                const nat = normalizeNationality(emp.nationality || emp.country);
                natTotals[nat] = (natTotals[nat] || 0) + 1;
            });

            const sortedNats = Object.entries(natTotals)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count);

            const nationalityPieData = {
                labels: sortedNats.map(n => n.name),
                datasets: [{
                    data: sortedNats.map(n => n.count),
                    backgroundColor: ['#E67E22', '#27AE60', '#2980B9', '#8E44AD', '#C0392B', '#16A085'],
                    borderWidth: 0
                }]
            };

            setEmployeesWithCompany(employeesWithComp);

            setStats({
                total,
                withEmployees,
                active,
                inactive,
                totalEmployees,
                docExpiryData,
                nationalityBarData,
                nationalityPieData,
                uniqueCompanyNames: uniqueCompanyNames.slice(0, 3), // Show first 3 for bar colors
                statusProgress: total > 0 ? (active / total) * 100 : 0
            });

        } catch (err) {
            console.error('Error fetching companies:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCompanies();
    }, [fetchCompanies]);

    const handleDeleteClick = (company) => {
        setCompanyToDelete(company);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!companyToDelete) return;

        try {
            setIsDeleting(true);
            await axiosInstance.delete(`/Company/${companyToDelete._id}`);
            toast({
                title: "Success",
                description: "Company deleted successfully",
                variant: "success",
            });
            fetchCompanies();
        } catch (err) {
            console.error('Error deleting company:', err);
            toast({
                title: "Error",
                description: err.response?.data?.message || "Failed to delete company",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setCompanyToDelete(null);
        }
    };

    const filteredCompanies = useMemo(() => {
        return companies.filter(company =>
            company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            company.companyId.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [companies, searchQuery]);

    return (
        <div className="flex min-h-screen w-full bg-[#F2F6F9]" style={{ backgroundColor: '#F2F6F9' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Navbar />
                <div className="p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>

                    {/* Header and Actions */}
                    <div className="flex items-center justify-between mb-6">
                        {/* Left Side - Header */}
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800 mb-2">Companies</h1>
                            <p className="text-gray-600">
                                {stats.withEmployees} Companies with Employees | {stats.total} Total Companies
                            </p>
                        </div>

                        {/* Right Side - Actions Bar */}
                        <div className="flex items-center gap-4">
                            {/* Search */}
                            <div className="relative flex-1 max-w-md w-64">
                                <Search
                                    size={16}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                />
                                <input
                                    type="text"
                                    placeholder="Search companies..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-800/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                />
                            </div>

                            {/* Add Company Button */}
                            <button
                                onClick={() => router.push('/Company/add-company')}
                                className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                            >
                                <Plus size={18} />
                                Add Company
                            </button>
                        </div>
                    </div>
                    {/* Profile Head Section */}
                    <div className="flex gap-6 mb-8 h-[320px]">
                        {/* Left Card: Stats + Document Expiry Bar Chart (50%) */}
                        <div className="flex-[1] bg-white rounded-xl shadow-sm border border-gray-100 flex p-6 gap-6 overflow-hidden">
                            {/* Vertical Stats Column */}
                            <div className="w-[140px] flex flex-col gap-4">
                                {[
                                    { label: 'COMPANY', value: stats.total },
                                    {
                                        label: 'TOTAL EMP',
                                        value: stats.totalEmployees,
                                        onClick: () => setIsEmpModalOpen(true)
                                    }
                                ].map((item, idx) => (
                                    <div
                                        key={idx}
                                        onClick={item.onClick}
                                        className={`flex-1 bg-gray-50 rounded-lg border border-gray-100 flex flex-col items-center justify-center text-center p-2 hover:bg-white hover:shadow-md transition-all duration-300 ${item.onClick ? 'cursor-pointer active:scale-95' : ''}`}
                                    >
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{item.label}</span>
                                        <span className="text-4xl font-black" style={{ color: '#dc2626' }}>
                                            <AnimatedCounter value={item.value || 0} />
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Document Expiry Bar Chart */}
                            <div className="flex-1 flex flex-col">
                                <h3 className="text-[11px] font-bold text-gray-400 text-center uppercase tracking-[0.2em] mb-4">Document Expiry</h3>
                                <div className="flex-1">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={stats.docExpiryData || []}
                                            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                        >
                                            <XAxis
                                                dataKey="name"
                                                fontSize={10}
                                                fontWeight="700"
                                                axisLine={false}
                                                tickLine={false}
                                                dy={5}
                                            />
                                            <YAxis hide={true} />
                                            <RechartsTooltip
                                                cursor={{ fill: 'transparent' }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Bar
                                                dataKey="value"
                                                radius={[6, 6, 0, 0]}
                                                isAnimationActive={true}
                                                animationDuration={1500}
                                                barSize={30}
                                                onClick={(data) => {
                                                    setSelectedDocBucket(data);
                                                    setIsDocModalOpen(true);
                                                }}
                                                className="cursor-pointer"
                                            >
                                                <LabelList
                                                    dataKey="value"
                                                    position="top"
                                                    style={{ fill: '#dc2626', fontSize: '12px', fontWeight: '900' }}
                                                    offset={8}
                                                />
                                                {(stats.docExpiryData || []).map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={`url(#barBlueGradient)`} />
                                                ))}
                                            </Bar>
                                            <defs>
                                                <linearGradient id="barBlueGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="#1E40AF" stopOpacity={1} />
                                                </linearGradient>
                                            </defs>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Right Card: Nationality Dashboard (50%) */}
                        <div className="flex-[1] bg-white rounded-xl shadow-sm border border-gray-100 flex p-6 gap-6 overflow-hidden">
                            {/* Grouped Bar Chart: Nationality by Company */}
                            <div className="flex-[1.4] flex flex-col pt-2">
                                <h3 className="text-[11px] font-bold text-gray-500 text-center uppercase tracking-[0.3em] mb-4 border-b border-gray-50 pb-2">NATIONALITY</h3>
                                <div className="flex-1">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={stats.nationalityBarData || []}
                                            margin={{ top: 20, right: 15, left: -25, bottom: 5 }}
                                            barGap={4}
                                        >
                                            <XAxis
                                                dataKey="nationality"
                                                fontSize={9}
                                                fontWeight="800"
                                                axisLine={{ stroke: '#E5E7EB' }}
                                                tickLine={false}
                                                stroke="#64748B"
                                                dy={5}
                                            />
                                            <YAxis
                                                fontSize={9}
                                                axisLine={false}
                                                tickLine={false}
                                                stroke="#94A3B8"
                                                tickCount={6}
                                            />
                                            <CartesianGrid vertical={false} stroke="#F1F5F9" strokeDasharray="3 3" />
                                            <RechartsTooltip
                                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '11px' }}
                                            />
                                            {(stats.uniqueCompanyNames || []).map((name, i) => (
                                                <Bar
                                                    key={name}
                                                    dataKey={name}
                                                    radius={[3, 3, 0, 0]}
                                                    fill={`url(#natGradient${i})`}
                                                    barSize={14}
                                                    onClick={(data) => {
                                                        setSelectedNationality(data.nationality);
                                                        setSelectedNatCompany(name); // Specific company clicked
                                                        setIsNatModalOpen(true);
                                                    }}
                                                    className="cursor-pointer"
                                                >
                                                    <LabelList dataKey={name} position="top" style={{ fill: '#dc2626', fontSize: '10px', fontWeight: '900' }} offset={4} />
                                                </Bar>
                                            ))}
                                            <defs>
                                                <linearGradient id="natGradient0" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="#1E40AF" stopOpacity={1} />
                                                </linearGradient>
                                                <linearGradient id="natGradient1" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#60A5FA" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="#2563EB" stopOpacity={1} />
                                                </linearGradient>
                                                <linearGradient id="natGradient2" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#93C5FD" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={1} />
                                                </linearGradient>
                                            </defs>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Legend */}
                                <div className="flex justify-center gap-3 mt-4">
                                    {(stats.uniqueCompanyNames || []).map((name, i) => (
                                        <div key={name} className="flex items-center gap-1">
                                            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: ['#3B82F6', '#60A5FA', '#93C5FD'][i % 3] }}></div>
                                            <span className="text-[10px] font-extrabold text-gray-500 uppercase">{name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Pie Chart: Nationality Distribution */}
                            <div className="flex-[0.8] flex flex-col items-center justify-center">
                                <h3 className="text-[11px] font-bold text-[#1E293B] uppercase tracking-[0.2em] mb-4">Nationality</h3>
                                <div className="flex-1 w-full max-h-[190px] flex items-center justify-center">
                                    <Pie
                                        data={stats.nationalityPieData}
                                        plugins={[ChartDataLabels]}
                                        options={{
                                            maintainAspectRatio: false,
                                            responsive: true,
                                            onClick: (evt, elements) => {
                                                if (elements && elements.length > 0) {
                                                    const index = elements[0].index;
                                                    const nationality = stats.nationalityPieData.labels[index];
                                                    setSelectedNationality(nationality);
                                                    setSelectedNatCompany(null); // All companies for this nationality
                                                    setIsNatModalOpen(true);
                                                }
                                            },
                                            plugins: {
                                                legend: { display: false },
                                                datalabels: {
                                                    color: '#fff',
                                                    font: { weight: '900', size: 9 },
                                                    formatter: (value, ctx) => {
                                                        const label = ctx.chart.data.labels[ctx.dataIndex];
                                                        return value > 0 ? `${label}\n${value}` : '';
                                                    },
                                                    textAlign: 'center'
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Companies Grid/Table */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sl No</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Company ID</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Company Name</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employees</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-gray-400">Loading companies...</td>
                                    </tr>
                                ) : filteredCompanies.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-gray-400">No companies found</td>
                                    </tr>
                                ) : (
                                    filteredCompanies.map((company, index) => (
                                        <tr
                                            key={company._id}
                                            className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                            onClick={() => router.push(`/Company/${company.companyId}`)}
                                        >
                                            <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                                                {String(index + 1).padStart(2, '0')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-mono font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded inline-block">
                                                    {company.companyId}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 shadow-sm">
                                                        {company.logo ? (
                                                            <Image src={company.logo} alt={company.name} width={40} height={40} className="object-cover" />
                                                        ) : (
                                                            <Building className="text-gray-400" size={20} />
                                                        )}
                                                    </div>
                                                    <div className="font-bold text-gray-800">{company.name}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Users size={14} className="text-gray-400" />
                                                    <span className="text-sm font-bold text-gray-700">{company.employeeCount || 0}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${company.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {company.status || 'Active'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteClick(company);
                                                        }}
                                                        className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all"
                                                        title="Delete Company"
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

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Company?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <span className="font-bold text-gray-900">{companyToDelete?.name}</span>? This action cannot be undone and will break any references to this company.
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

            {/* Total Employees Modal */}
            {isEmpModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-2xl">
                            <div>
                                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                    <Users className="text-blue-500" size={24} />
                                    Employees by Company
                                </h3>
                                <p className="text-sm text-gray-500 font-medium">Showing {employeesWithCompany.length} employees currently assigned to companies</p>
                            </div>
                            <button
                                onClick={() => setIsEmpModalOpen(false)}
                                className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-600 shadow-sm border border-transparent hover:border-gray-200"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-0">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Sl No</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Employee Name</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Company</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Designation</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {employeesWithCompany.map((emp, idx) => (
                                        <tr
                                            key={emp._id}
                                            className="hover:bg-blue-50/50 cursor-pointer transition-all border-l-4 border-l-transparent hover:border-l-blue-500 group"
                                            onClick={() => router.push(`/emp/${emp.employeeId}`)}
                                        >
                                            <td className="px-6 py-4 text-xs font-bold text-gray-400">{String(idx + 1).padStart(2, '0')}</td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                                                    {emp.firstName} {emp.lastName}
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-mono">{emp.employeeId}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-teal-50 text-teal-700 text-[10px] font-black uppercase tracking-wider">
                                                    {emp.companyName || emp.companyNickName || companyMap[emp.company?._id || emp.company] || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-gray-600 italic">
                                                {emp.designation || '---'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl text-center">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">End of List</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Document Expiry Details Modal */}
            {isDocModalOpen && selectedDocBucket && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-2xl">
                            <div>
                                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                    <Clock className="text-orange-500" size={24} />
                                    Documents Expiring: {selectedDocBucket.name}
                                </h3>
                                <p className="text-sm text-gray-500 font-medium">Found {selectedDocBucket.docs?.length || 0} documents in this timeframe</p>
                            </div>
                            <button onClick={() => setIsDocModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-600 shadow-sm border border-transparent hover:border-gray-200">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Sl No</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Company Name</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Doc Type</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Expiry Date</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-right">Remaining</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {(selectedDocBucket.docs || []).map((doc, idx) => (
                                        <tr
                                            key={idx}
                                            className="hover:bg-orange-50/50 cursor-pointer transition-all border-l-4 border-l-transparent hover:border-l-orange-500 group"
                                            onClick={() => router.push(`/Company/${doc.compId}`)}
                                        >
                                            <td className="px-6 py-4 text-xs font-bold text-gray-400">{String(idx + 1).padStart(2, '0')}</td>
                                            <td className="px-6 py-4 font-bold text-gray-800 group-hover:text-orange-600 transition-colors">{doc.compName}</td>
                                            <td className="px-6 py-4"><span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold uppercase">{doc.name}</span></td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-600 text-center">
                                                {new Date(doc.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`text-[11px] font-black px-2 py-1 rounded-full ${doc.daysRemaining < 0 ? 'bg-red-600 text-white shadow-sm' : doc.daysRemaining <= 7 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                                    {doc.daysRemaining < 0
                                                        ? `Expired (${Math.abs(doc.daysRemaining)} Days)`
                                                        : `${doc.daysRemaining} Days`
                                                    }
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Nationality Group Modal */}
            {isNatModalOpen && selectedNationality && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-2xl">
                            <div>
                                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2 uppercase tracking-tight">
                                    <Users className="text-teal-500" size={24} />
                                    {selectedNationality} {selectedNatCompany ? `- ${selectedNatCompany}` : ''}
                                </h3>
                                <p className="text-sm text-gray-500 font-medium">List of employees from {selectedNationality} {selectedNatCompany ? `at ${selectedNatCompany}` : ''}</p>
                            </div>
                            <button onClick={() => { setIsNatModalOpen(false); setSelectedNatCompany(null); }} className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-600 shadow-sm border border-transparent hover:border-gray-200">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Sl No</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Employee Name</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Company</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Designation</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {employeesWithCompany
                                        .filter(emp => {
                                            const matchesNat = emp.normalizedNat === selectedNationality;
                                            const matchesComp = !selectedNatCompany ||
                                                (emp.companyName === selectedNatCompany || emp.companyNickName === selectedNatCompany);
                                            return matchesNat && matchesComp;
                                        })
                                        .map((emp, idx) => (
                                            <tr
                                                key={emp._id}
                                                className="hover:bg-teal-50/50 cursor-pointer transition-all border-l-4 border-l-transparent hover:border-l-teal-500 group"
                                                onClick={() => router.push(`/emp/${emp.employeeId}`)}
                                            >
                                                <td className="px-6 py-4 text-xs font-bold text-gray-400">{String(idx + 1).padStart(2, '0')}</td>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-gray-800 group-hover:text-teal-600 transition-colors">{emp.firstName} {emp.lastName}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono">{emp.employeeId}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-teal-50 text-teal-700 text-[10px] font-black uppercase tracking-wider">
                                                        {emp.companyName || emp.companyNickName || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold text-gray-600 italic">{emp.designation || '---'}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
