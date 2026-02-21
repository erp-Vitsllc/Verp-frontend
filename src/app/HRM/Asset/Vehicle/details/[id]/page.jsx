'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import {
    ArrowLeft,
    Truck,
    Car,
    ShieldCheck,
    AlertCircle,
    FileText,
    PencilLine,
    Download,
    ExternalLink,
    Smartphone,
    UserPlus,
    Printer,
    History,
    Calendar,
    Gauge,
    User,
    ArrowRight,
    Receipt,
    PenTool,
    ClipboardList,
    AlertTriangle,
    Settings,
    Fuel,
    Palette,
    Tag,
    DollarSign,
    Building2,
    Shield,
    CalendarCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AccessoriesModal from '../../../components/AccessoriesModal';
import AssignAssetModal from '../../../components/AssignAssetModal';
import HandoverFormModal from '../../../components/HandoverFormModal';
import HandoverFormView from '../../../components/HandoverFormView';

const getInitials = (name) => {
    if (!name) return 'AS';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
};

export default function VehicleDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const assetId = params.id;
    const { toast } = useToast();

    const [asset, setAsset] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imageError, setImageError] = useState(false);
    const [showAccessoriesModal, setShowAccessoriesModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showHandoverModal, setShowHandoverModal] = useState(false);
    const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [activeTab, setActiveTab] = useState('basic'); // 'basic', 'maintenance', 'transfer', 'fine'
    const [assetHistory, setAssetHistory] = useState([]);
    const [fines, setFines] = useState([]);
    const [loadingFines, setLoadingFines] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            setCurrentUserEmployeeId(user.employeeObjectId);

            const fetchUserProfile = async () => {
                try {
                    const res = await axiosInstance.get('/Employee/me');
                    if (res && res.data) {
                        setCurrentUser(res.data);
                    }
                } catch (err) {
                    console.error("Failed to fetch user profile:", err);
                    setCurrentUser(user);
                }
            };
            fetchUserProfile();
        }
    }, []);

    const fetchAssetDetails = async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get(`/AssetItem/detail/${assetId}`);
            setAsset(response.data);
        } catch (error) {
            console.error('Error fetching asset details:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to fetch vehicle details"
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchAssetHistory = async () => {
        try {
            const response = await axiosInstance.get(`/AssetItem/${assetId}/history`);
            setAssetHistory(response.data);
        } catch (error) {
            console.error('Error fetching asset history:', error);
        }
    };

    const fetchFines = async () => {
        try {
            setLoadingFines(true);
            const response = await axiosInstance.get(`/Fine`, {
                params: { vehicleId: asset?.assetId }
            });
            setFines(response.data.fines || []);
        } catch (error) {
            console.error('Error fetching fines:', error);
        } finally {
            setLoadingFines(false);
        }
    };

    useEffect(() => {
        if (assetId && activeTab === 'transfer') {
            fetchAssetHistory();
        }
        if (assetId && activeTab === 'fine') {
            fetchFines();
        }
    }, [assetId, activeTab, asset?.assetId]);

    useEffect(() => {
        if (assetId) {
            fetchAssetDetails();
        }
    }, [assetId]);

    if (loading) {
        return (
            <div className="flex min-h-screen w-full bg-[#F2F6F9]">
                <Sidebar />
                <div className="flex-1 flex flex-col">
                    <Navbar />
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-gray-500 font-semibold">Loading vehicle details...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!asset) {
        return (
            <div className="flex min-h-screen w-full bg-[#F2F6F9]">
                <Sidebar />
                <div className="flex-1 flex flex-col">
                    <Navbar />
                    <div className="p-8">
                        <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-100">
                            <AlertCircle className="mx-auto text-gray-300 mb-4" size={56} />
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Vehicle Not Found</h2>
                            <button
                                onClick={() => router.back()}
                                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all flex items-center gap-2 mx-auto font-sans"
                            >
                                <ArrowLeft size={20} />
                                Return to List
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const formatDate = (date) => {
        if (!date) return 'Not Set';
        return new Date(date).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const calculateDaysLeft = (date) => {
        if (!date) return null;
        const diff = new Date(date) - new Date();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return days;
    };

    const getExpiryColor = (days) => {
        if (days === null) return 'bg-white/20';
        if (days < 0) return 'bg-rose-400';
        if (days < 30) return 'bg-orange-400';
        return 'bg-emerald-400';
    };

    const getVehicleIcon = () => {
        const type = (asset.typeId?.name || asset.type || '').toLowerCase();
        if (type.includes('car')) return <Car size={64} strokeWidth={1} />;
        if (type.includes('van') || type.includes('pickup') || type.includes('truck') || type.includes('bus')) {
            return <Truck size={64} strokeWidth={1} />;
        }
        return <Truck size={64} strokeWidth={1} />; // Default
    };

    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#F2F6F9]">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Navbar />
                <div className="p-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <button
                            onClick={() => router.back()}
                            className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm text-gray-600 hover:bg-gray-50 transition-all font-bold flex items-center gap-2"
                        >
                            <ArrowLeft size={20} />
                            <span className="text-sm">Back</span>
                        </button>
                    </div>

                    {/* Profile Cards Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-stretch">

                        {/* Card 1: Main Vehicle Profile */}
                        <div className="lg:col-span-7 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-center relative overflow-hidden group">
                            <div className="flex flex-col md:flex-row gap-8 items-center">
                                {/* Photo Section */}
                                <div className="relative w-40 h-40 shrink-0">
                                    <div className="w-full h-full rounded-2xl border border-slate-200 overflow-hidden relative shadow-inner bg-slate-50 flex items-center justify-center">
                                        {(asset.photo || asset.imagePreview) && !imageError ? (
                                            <Image
                                                src={asset.photo || asset.imagePreview}
                                                alt={asset.name}
                                                fill
                                                className="object-cover"
                                                unoptimized
                                                onError={() => setImageError(true)}
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-slate-300">
                                                {getVehicleIcon()}
                                            </div>
                                        )}
                                    </div>
                                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-white ${asset.status === 'Assigned' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                </div>

                                {/* Details Section */}
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <h1 className="text-3xl font-bold text-gray-800 uppercase tracking-tight">
                                            {asset.name}
                                        </h1>
                                        <div className="flex items-center gap-3 mt-1 text-sm font-medium">
                                            <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-bold">
                                                {asset.assetId}
                                            </span>
                                            <span className="text-slate-400">|</span>
                                            <span className="text-slate-700 font-mono tracking-wider">
                                                {asset.plateNumber || 'NO PLATE'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-2.5">
                                        <div className="flex items-center gap-3 text-sm">
                                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${asset.status === 'Assigned' ? 'bg-blue-100 text-blue-700' :
                                                asset.status === 'Maintenance' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                {asset.status}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 group/owner cursor-pointer">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                                                <User size={16} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Current Owner / Driver</span>
                                                <span className="text-sm font-bold text-gray-700">
                                                    {asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : 'Unassigned'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Card 2: Vehicle Summary Expairies */}
                        <div className="lg:col-span-5 bg-gradient-to-r from-sky-500 via-sky-500 to-sky-400 rounded-2xl p-8 shadow-lg relative overflow-hidden text-white flex flex-col justify-between min-h-[320px]">
                            <div className="absolute -left-24 -bottom-24 w-64 h-64 bg-blue-700/40 rounded-full"></div>
                            <div className="absolute -right-16 -top-16 w-48 h-48 bg-sky-300/30 rounded-full"></div>

                            <div className="relative z-10">
                                <h3 className="text-2xl font-bold mb-6 tracking-tight">Vehicle Summary</h3>

                                <div className="flex gap-8 items-start">
                                    {/* Icon Section */}
                                    <div className="hidden md:flex w-24 h-24 items-center justify-center bg-white/10 rounded-2xl shrink-0 backdrop-blur-sm self-center">
                                        <div className="text-white/40">
                                            {getVehicleIcon()}
                                        </div>
                                    </div>

                                    {/* Stats List */}
                                    <div className="flex-1 space-y-3">
                                        {[
                                            { label: 'Insurance', date: asset.insuranceExpiryDate, type: 'expiry' },
                                            { label: 'Registration', date: asset.registrationExpiryDate, type: 'expiry' },
                                            { label: 'Oil Change', date: asset.oilChangeDate, type: 'due' },
                                            { label: 'Gear Oil', date: asset.gearOilDueDate, type: 'due' },
                                            { label: 'Next Service', date: asset.nextServiceDate, type: 'due' }
                                        ]
                                            .filter(item => item.date)
                                            .map((item, idx) => {
                                                const days = calculateDaysLeft(item.date);
                                                const action = item.type === 'expiry' ? 'Expires' : 'Due';
                                                const statusText = days === 0 ? `${item.label} ${action} today` :
                                                    days > 0 ? `${item.label} ${action} in ${days} days` :
                                                        `${item.label} ${action === 'Expires' ? 'Expired' : 'was Due'} ${Math.abs(days)} days ago`;

                                                return (
                                                    <div key={idx} className="flex items-center gap-3">
                                                        <div className={`w-5 h-2 rounded-full ${getExpiryColor(days)}`} />
                                                        <p className="text-white text-sm font-medium">{statusText}</p>
                                                    </div>
                                                );
                                            })}
                                        {/* Fallback if no dates set */}
                                        {[asset.insuranceExpiryDate, asset.registrationExpiryDate, asset.oilChangeDate, asset.gearOilDueDate, asset.nextServiceDate].every(d => !d) && (
                                            <div className="flex items-center gap-3 opacity-60">
                                                <div className="w-5 h-2 rounded-full bg-white/20" />
                                                <p className="text-white text-sm">No expiries or dues set</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Bottom Section: Sub Tabs */}
                    <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[600px] font-sans">
                        {/* Tab Headers */}
                        <div className="px-8 py-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                {[
                                    { id: 'basic', label: 'Basic Details', icon: <ClipboardList size={16} /> },
                                    { id: 'maintenance', label: 'Maintenance Details', icon: <PenTool size={16} /> },
                                    { id: 'transfer', label: 'Transfer History', icon: <History size={16} /> },
                                    { id: 'fine', label: 'Fine', icon: <Receipt size={16} /> }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border-2 ${activeTab === tab.id
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200'
                                            : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-600'
                                            }`}
                                    >
                                        {tab.icon}
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-3">
                                {activeTab === 'basic' && asset.assignedTo && (
                                    <button
                                        onClick={() => setShowHandoverModal(true)}
                                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
                                    >
                                        <Printer size={16} /> Print
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowAssignModal(true)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                                >
                                    {asset.assignedTo ? 'Modify Assignment' : 'Assign Vehicle'}
                                </button>
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 p-8 overflow-y-auto bg-white/50">
                            {activeTab === 'basic' && (
                                <>
                                    {asset.assignedTo ? (
                                        <div className="max-w-5xl mx-auto bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
                                            <HandoverFormView asset={asset} isPrint={false} />
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center py-20 px-4">
                                            <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center mb-6 text-blue-600 shadow-inner">
                                                <UserPlus size={48} strokeWidth={1.5} />
                                            </div>
                                            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-3">Vehicle Unassigned</h3>
                                            <p className="text-slate-400 max-w-md mb-10 text-sm font-medium"> This vehicle is currently available for deployment. Assign it to an employee to generate and maintain a handover form record. </p>
                                            <button
                                                onClick={() => setShowAssignModal(true)}
                                                className="px-10 py-4 bg-blue-600 text-white rounded-[20px] font-black uppercase tracking-[0.15em] hover:bg-blue-700 transition-all shadow-2xl shadow-blue-200 hover:scale-[1.02] active:scale-95 text-xs"
                                            >
                                                Assign Vehicle Now
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}

                            {activeTab === 'maintenance' && (
                                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {[
                                        { label: 'Insurance Expiry', value: asset.insuranceExpiryDate, icon: <ShieldCheck className="text-blue-500" /> },
                                        { label: 'Registration Expiry', value: asset.registrationExpiryDate, icon: <FileText className="text-purple-500" /> },
                                        { label: 'Oil Change Due', value: asset.oilChangeDate, icon: <PenTool className="text-amber-500" /> },
                                        { label: 'Gear Oil Due', value: asset.gearOilDueDate, icon: <Gauge className="text-emerald-500" /> },
                                        { label: 'Next Service Date', value: asset.nextServiceDate, icon: <Calendar className="text-rose-500" /> },
                                        { label: 'Current Kilometer', value: asset.currentKilometer ? `${asset.currentKilometer.toLocaleString()} km` : 'Not Set', icon: <Gauge className="text-indigo-500" /> },
                                        { label: 'Make/Model', value: asset.name, icon: <Car className="text-slate-500" /> },
                                        { label: 'Type', value: asset.type, icon: <Truck className="text-slate-500" /> },
                                        { label: 'Category', value: asset.category, icon: <Tag className="text-slate-500" /> },
                                        { label: 'Model Year', value: asset.modelYear, icon: <Calendar className="text-slate-500" /> },
                                        { label: 'Plate Number', value: asset.plateNumber, icon: <Car className="text-slate-500" /> },
                                        { label: 'Vehicle Code', value: asset.vehicleCode, icon: <Truck className="text-slate-500" /> },
                                    ].map((item, idx) => (
                                        <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-slate-100 transition-colors">
                                                    {item.icon}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.label}</span>
                                                    <span className="text-base font-bold text-slate-700">
                                                        {item.label.includes('Date') || item.label.includes('Expiry') || item.label.includes('Due')
                                                            ? formatDate(item.value)
                                                            : (item.value || 'Not Set')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'transfer' && (
                                <div className="max-w-4xl mx-auto space-y-6">
                                    {assetHistory.length === 0 ? (
                                        <div className="text-center py-20 text-slate-300">
                                            <History size={48} className="mx-auto mb-4 opacity-20" />
                                            <p className="text-sm font-bold uppercase tracking-widest">No transfer history recorded</p>
                                        </div>
                                    ) : (
                                        assetHistory.map((entry, idx) => (
                                            <div key={idx} className="flex gap-4">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-3.5 h-3.5 rounded-full bg-blue-500 border-4 border-white shadow-sm mt-2"></div>
                                                    {idx !== assetHistory.length - 1 && <div className="w-0.5 flex-1 bg-slate-100 my-1"></div>}
                                                </div>
                                                <div className="flex-1 pb-8">
                                                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-100 transition-all">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${entry.action === 'Assign' ? 'bg-emerald-50 text-emerald-600' :
                                                                    entry.action === 'Returned' ? 'bg-rose-50 text-rose-600' :
                                                                        'bg-blue-50 text-blue-600'
                                                                    }`}>
                                                                    {entry.action}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-mono bg-slate-50 px-2 py-1 rounded-md">
                                                                    {new Date(entry.date).toLocaleDateString()} {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                                            <span className="text-blue-600 font-bold">{entry.performedBy?.firstName} {entry.performedBy?.lastName}</span> {entry.message || `Performed ${entry.action} action`}
                                                        </p>
                                                        {entry.comments && (
                                                            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                                <p className="text-xs italic text-slate-500 flex gap-2">
                                                                    <AlertTriangle size={14} className="shrink-0" />
                                                                    "{entry.comments}"
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {activeTab === 'fine' && (
                                <div className="max-w-6xl mx-auto">
                                    {loadingFines ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Loading fines...</p>
                                        </div>
                                    ) : fines.length === 0 ? (
                                        <div className="text-center py-20 text-slate-300">
                                            <Receipt size={48} className="mx-auto mb-4 opacity-20" />
                                            <p className="text-sm font-bold uppercase tracking-widest">No fines recorded for this vehicle</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                    <tr>
                                                        <th className="px-6 py-4">Fine ID</th>
                                                        <th className="px-6 py-4">Type</th>
                                                        <th className="px-6 py-4">Offender</th>
                                                        <th className="px-6 py-4">Amount</th>
                                                        <th className="px-6 py-4">Date</th>
                                                        <th className="px-6 py-4">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {fines.map((fine) => (
                                                        <tr key={fine._id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => router.push(`/HRM/Fine/details/${fine._id}`)}>
                                                            <td className="px-6 py-4 text-sm font-bold text-blue-600">
                                                                {fine.fineId}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-bold text-slate-700">{fine.fineType}</span>
                                                                    <span className="text-[10px] text-slate-400 uppercase font-bold">{fine.category}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-bold text-slate-700">
                                                                        {fine.assignedEmployees?.[0]?.employeeName || 'Unknown'}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                                        {fine.assignedEmployees?.[0]?.employeeId || '-'}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="text-sm font-black text-rose-600">
                                                                    AED {fine.fineAmount?.toLocaleString()}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                                                                {formatDate(fine.awardedDate)}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${fine.fineStatus === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                                                    fine.fineStatus === 'Rejected' ? 'bg-rose-100 text-rose-700' :
                                                                        'bg-amber-100 text-amber-700'
                                                                    }`}>
                                                                    {fine.fineStatus}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <AccessoriesModal
                isOpen={showAccessoriesModal}
                onClose={() => setShowAccessoriesModal(false)}
                asset={asset}
                onUpdate={fetchAssetDetails}
            />

            <AssignAssetModal
                isOpen={showAssignModal}
                onClose={() => setShowAssignModal(false)}
                asset={asset}
                onUpdate={fetchAssetDetails}
            />

            <HandoverFormModal
                isOpen={showHandoverModal}
                onClose={() => setShowHandoverModal(false)}
                asset={asset}
            />
        </div>
    );
}
