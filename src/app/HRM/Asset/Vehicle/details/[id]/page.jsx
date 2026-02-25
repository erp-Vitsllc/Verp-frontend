'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
    CalendarCheck,
    Eye,
    PlusCircle,
    ChevronDown,
    XCircle,
    RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AccessoriesModal from '../../../components/AccessoriesModal';
import AssignAssetModal from '../../../components/AssignAssetModal';
import HandoverFormModal from '../../../components/HandoverFormModal';
import HandoverFormView from '../../../components/HandoverFormView';
import VehicleDocumentModal from '../../components/VehicleDocumentModal';
import VehicleServiceModal from '../../components/VehicleServiceModal';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
} from '@/components/ui/alert-dialog';

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
    const [showDocModal, setShowDocModal] = useState(false);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [selectedDocType, setSelectedDocType] = useState('Mulkia');
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [isRenewMode, setIsRenewMode] = useState(false);
    const [docToDelete, setDocToDelete] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [activeTab, setActiveTab] = useState('basic'); // 'basic', 'maintenance', 'transfer', 'fine'
    const [assetHistory, setAssetHistory] = useState([]);
    const [fines, setFines] = useState([]);
    const [loadingFines, setLoadingFines] = useState(false);
    const [showResponseModal, setShowResponseModal] = useState(false);
    const [responseAction, setResponseAction] = useState(null);
    const [responseComment, setResponseComment] = useState('');
    const [responseFile, setResponseFile] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [showFileModal, setShowFileModal] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        description: '',
        onConfirm: () => { }
    });

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

    const updateAssetStatus = async (newStatus) => {
        try {
            await axiosInstance.put(`/AssetType/${assetId}`, { status: newStatus });
            fetchAssetDetails();
            toast({
                title: "Status Updated",
                description: `Vehicle status changed to ${newStatus}`
            });
        } catch (error) {
            console.error('Error updating status:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to update status"
            });
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

    const refreshData = useCallback(() => {
        if (!assetId) return;
        fetchAssetDetails();
        if (activeTab === 'transfer') fetchAssetHistory();
        if (activeTab === 'fine') fetchFines();
    }, [assetId, activeTab, asset?.assetId]);

    useEffect(() => {
        if (assetId) {
            refreshData();
        }
    }, [assetId, activeTab, refreshData]);

    const handleDeleteDoc = async () => {
        if (!docToDelete) return;
        setDeleteLoading(true);
        try {
            await axiosInstance.delete(`/AssetItem/${assetId}/document/${docToDelete._id}`);
            toast({ title: 'Deleted', description: `${docToDelete.type} document deleted successfully` });
            setDocToDelete(null);
            fetchAssetDetails();
        } catch (error) {
            console.error('Error deleting document:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete document' });
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = () => {
                setResponseFile(reader.result);
            };
        }
    };

    const checkSignature = () => {
        if (!currentUser?.signature) {
            toast({
                variant: "destructive",
                title: "Digital Signature Required",
                description: "You must set your digital signature in your profile before accepting an asset."
            });
            return false;
        }
        return true;
    };

    const handleResponse = async () => {
        try {
            await axiosInstance.put(`/AssetItem/${assetId}/respond`, {
                action: responseAction,
                comments: responseComment,
                file: responseFile
            });
            toast({
                title: "Success",
                description: `Vehicle assignment ${responseAction === 'Accept' || responseAction === 'AcceptWithComments' ? 'accepted' : 'rejected'} successfully.`
            });
            setShowResponseModal(false);
            setResponseComment('');
            setResponseFile(null);
            fetchAssetDetails();
        } catch (error) {
            console.error('Error responding to assignment:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || "Failed to submit response"
            });
        }
    };

    const openResponseModal = (action) => {
        if ((action === 'AcceptWithComments' || action === 'Accept') && !checkSignature()) return;
        setResponseAction(action);
        setShowResponseModal(true);
    };

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
                                                asset.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                                                    asset.status === 'Maintenance' || asset.status === 'On Service' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-emerald-100 text-emerald-700' // Unassigned or Others
                                                }`}>
                                                {asset.status}
                                            </div>
                                        </div>

                                        <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${asset.assignedTo ? 'bg-blue-50/30 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-black shadow-lg ${asset.assignedTo ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-slate-200 text-slate-400 border-2 border-dashed border-slate-300'}`}>
                                                    {asset.assignedTo ? getInitials(`${asset.assignedTo.firstName} ${asset.assignedTo.lastName}`) : <User size={20} />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={`text-[9px] font-black uppercase tracking-[0.2em] mb-0.5 ${asset.assignedTo ? 'text-blue-600' : 'text-slate-400'}`}>Current Owner / Driver</span>
                                                    <span className={`text-lg font-black tracking-tight uppercase ${asset.assignedTo ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                                                        {asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : 'UNASSIGNED'}
                                                    </span>
                                                </div>
                                            </div>

                                            {!asset.assignedTo && (
                                                <button
                                                    onClick={() => setShowAssignModal(true)}
                                                    className="px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
                                                >
                                                    <UserPlus size={14} /> Assign Now
                                                </button>
                                            )}
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
                                        {(() => {
                                            const getLatestDocExpiry = (type) => {
                                                if (!asset.documents || !Array.isArray(asset.documents)) return null;
                                                const docsOfType = asset.documents.filter(d => d.type === type && d.expiryDate);
                                                if (docsOfType.length === 0) return null;
                                                return docsOfType.sort((a, b) => new Date(b.expiryDate) - new Date(a.expiryDate))[0].expiryDate;
                                            };

                                            const items = [];
                                            const docTypes = [...new Set(asset.documents?.filter(d => d.expiryDate).map(d => d.type) || [])];

                                            docTypes.forEach(type => {
                                                const date = getLatestDocExpiry(type);
                                                items.push({ label: `${type} Expiry`, date, type: 'expiry' });
                                            });

                                            // Fallbacks for main documents if they aren't in the documents array but have top-level fields
                                            if (!docTypes.includes('Insurance') && asset.insuranceExpiryDate) {
                                                items.push({ label: 'Insurance Expiry', date: asset.insuranceExpiryDate, type: 'expiry' });
                                            }
                                            if (!docTypes.includes('Mulkia') && asset.registrationExpiryDate) {
                                                items.push({ label: 'Registration Expiry', date: asset.registrationExpiryDate, type: 'expiry' });
                                            }

                                            return items;
                                        })()
                                            .map((item, idx) => {
                                                const days = calculateDaysLeft(item.date);
                                                let statusText = '';
                                                let displayDate = item.date ? formatDate(item.date) : 'Not Set';

                                                if (!item.date) {
                                                    statusText = `${item.label}: ${displayDate}`;
                                                } else if (item.type === 'fact') {
                                                    statusText = `${item.label}: ${displayDate}`;
                                                } else {
                                                    const action = item.type === 'expiry' ? 'expired' : 'was due';
                                                    statusText = days === 0 ? `${item.label} today (${displayDate})` :
                                                        days > 0 ? `${item.label} in ${days} days (${displayDate})` :
                                                            `${item.label} ${action} ${Math.abs(days)} days ago (${displayDate})`;
                                                }

                                                return (
                                                    <div key={idx} className="flex items-center gap-3">
                                                        <div className={`w-5 h-2 rounded-full ${!item.date ? 'bg-white/20' : (item.type === 'fact' ? 'bg-white/40' : getExpiryColor(days))}`} />
                                                        <p className="text-white text-sm font-medium">{statusText}</p>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Bottom Section: Sub Tabs (Employee Profile Style) */}
                    <div className="mt-10 space-y-8">
                        {/* Tab Headers */}
                        <div className="flex items-center justify-between border-b border-slate-200 px-2">
                            <div className="flex items-center gap-10">
                                {[
                                    { id: 'basic', label: 'Basic Details' },
                                    { id: 'maintenance', label: 'Maintenance Details' },
                                    { id: 'transfer', label: 'Transfer History' },
                                    { id: 'fine', label: 'Fine' }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`pb-4 text-sm font-bold tracking-tight transition-all relative ${activeTab === tab.id
                                            ? 'text-blue-600'
                                            : 'text-slate-500 hover:text-slate-600'
                                            }`}
                                    >
                                        {tab.label}
                                        {activeTab === tab.id && (
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-3 pb-4">
                                {activeTab === 'basic' && asset.assignedTo && (
                                    <button
                                        onClick={() => setShowHandoverModal(true)}
                                        className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
                                    >
                                        <Printer size={14} /> Print
                                    </button>
                                )}

                                {/* Acceptance Buttons */}
                                {(currentUserEmployeeId && asset.actionRequiredBy === currentUserEmployeeId && asset.acceptanceStatus === 'Pending') && (
                                    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-200 shadow-inner">
                                        <button
                                            onClick={() => openResponseModal('Reject')}
                                            className="px-6 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (!checkSignature()) return;
                                                setConfirmDialog({
                                                    isOpen: true,
                                                    title: 'Accept Vehicle Assignment?',
                                                    description: 'Are you sure you want to accept this vehicle assignment? This will acknowledge that you have received the vehicle.',
                                                    onConfirm: () => {
                                                        axiosInstance.put(`/AssetItem/${assetId}/respond`, {
                                                            action: 'Accept',
                                                            comments: ''
                                                        }).then(() => {
                                                            toast({ title: "Success", description: "Vehicle accepted successfully." });
                                                            fetchAssetDetails();
                                                        }).catch(e => {
                                                            toast({ variant: "destructive", title: "Error", description: "Failed to accept vehicle." });
                                                        });
                                                    }
                                                });
                                            }}
                                            className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                                        >
                                            Accept
                                        </button>
                                        <button
                                            onClick={() => openResponseModal('AcceptWithComments')}
                                            className="px-6 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                                        >
                                            Accept with Comment
                                        </button>
                                    </div>
                                )}

                                {(activeTab === 'basic' || activeTab === 'maintenance') && (
                                    <>
                                        <button
                                            onClick={() => setShowAssignModal(true)}
                                            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center gap-2"
                                        >
                                            <UserPlus size={14} strokeWidth={2.5} />
                                            Assign
                                        </button>
                                        <div className="relative group">
                                            <button
                                                onClick={() => {
                                                    const menu = document.getElementById('add-more-menu');
                                                    menu.classList.toggle('hidden');
                                                }}
                                                className="px-5 py-2.5 bg-[#00B5AD] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#00928C] transition-all shadow-xl shadow-teal-100 flex items-center gap-2"
                                            >
                                                Add More <ChevronDown size={14} />
                                            </button>
                                            <div
                                                id="add-more-menu"
                                                className="hidden absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200"
                                            >
                                                <button
                                                    onClick={() => {
                                                        setShowAssignModal(true);
                                                        document.getElementById('add-more-menu').classList.add('hidden');
                                                    }}
                                                    className="w-full px-5 py-3 text-left hover:bg-slate-50 flex items-center gap-3 transition-colors"
                                                >
                                                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                                        <UserPlus size={14} />
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Assign Asset</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowAccessoriesModal(true);
                                                        document.getElementById('add-more-menu').classList.add('hidden');
                                                    }}
                                                    className="w-full px-5 py-3 text-left hover:bg-slate-50 flex items-center gap-3 transition-colors"
                                                >
                                                    <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                                                        <PlusCircle size={14} />
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Add Accessory</span>
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div className="min-h-[600px]">
                            {activeTab === 'basic' && (
                                <div className="max-w-full mx-auto space-y-8 px-2">
                                    {/* Document Cards Only - Grid Layout with reduced gap for wider cards */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                                        {asset.documents && asset.documents.length > 0 ? (
                                            asset.documents.map((doc, idx) => (
                                                <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                                                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                                                        <h3 className="text-base font-bold text-slate-800">{doc.type || 'Document'} Details</h3>
                                                        <div className="flex items-center gap-3">
                                                            {doc.attachment && (
                                                                <a
                                                                    href={doc.attachment}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-emerald-500 hover:text-emerald-600 transition-colors"
                                                                    title="Download"
                                                                >
                                                                    <Download size={16} />
                                                                </a>
                                                            )}
                                                            <button
                                                                onClick={() => { setSelectedDocType(doc.type); setSelectedDoc(doc); setIsRenewMode(false); setShowDocModal(true); }}
                                                                className="text-blue-500 hover:text-blue-600 transition-colors"
                                                                title="Edit"
                                                            >
                                                                <PencilLine size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => { setSelectedDocType(doc.type); setSelectedDoc(doc); setIsRenewMode(true); setShowDocModal(true); }}
                                                                className="text-teal-500 hover:text-teal-600 transition-colors"
                                                                title="Renew"
                                                            >
                                                                <RefreshCw size={16} />
                                                            </button>
                                                            <button className="text-rose-400 hover:text-rose-500 transition-colors" title="Delete"
                                                                onClick={() => setDocToDelete(doc)}
                                                            >
                                                                <XCircle size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="p-6 divide-y divide-slate-100">
                                                        {doc.issueAuthority && (
                                                            <div className="flex items-center justify-between py-3 first:pt-0">
                                                                <span className="text-sm text-slate-400 font-medium">Authority</span>
                                                                <span className="text-sm font-bold text-slate-400">{doc.issueAuthority}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-between py-3 first:pt-0">
                                                            <span className="text-sm text-slate-400 font-medium">Issue date</span>
                                                            <span className="text-sm font-bold text-slate-400">{formatDate(doc.issueDate)}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between py-3">
                                                            <span className="text-sm text-slate-400 font-medium">Expiry date</span>
                                                            <span className={`text-sm font-bold ${calculateDaysLeft(doc.expiryDate) < 30 ? 'text-rose-500' : 'text-slate-400'}`}>
                                                                {formatDate(doc.expiryDate)}
                                                            </span>
                                                        </div>
                                                        {doc.attachment && (
                                                            <div className="flex items-center justify-between py-3 last:pb-0">
                                                                <span className="text-sm text-slate-400 font-medium">Attachment</span>
                                                                <a
                                                                    href={doc.attachment}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-500 hover:text-blue-600 text-sm font-bold flex items-center gap-1.5"
                                                                >
                                                                    <Eye size={14} /> View Document
                                                                </a>
                                                            </div>
                                                        )}
                                                        {doc.description && (
                                                            <div className="pt-4 border-t border-slate-100">
                                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Note</p>
                                                                <p className="text-xs text-slate-500 leading-relaxed italic font-medium">"{doc.description}"</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-full bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-100 py-20 flex flex-col items-center justify-center text-center px-6">
                                                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-slate-200 mb-4 shadow-sm border border-slate-50">
                                                    <FileText size={32} />
                                                </div>
                                                <p className="text-sm font-bold text-slate-400 tracking-wide">No Documents Uploaded</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons — only show add button if that doc type doesn't exist yet */}
                                    {(() => {
                                        const hasMulkia = asset.documents?.some(d => d.type === 'Mulkia');
                                        const hasInsurance = asset.documents?.some(d => d.type === 'Insurance');
                                        const showRow = !hasMulkia || !hasInsurance;
                                        if (!showRow) return null;
                                        return (
                                            <div className="flex items-center gap-4 pt-10 border-t border-slate-100">
                                                {!hasMulkia && (
                                                    <button
                                                        onClick={() => { setSelectedDocType('Mulkia'); setSelectedDoc(null); setShowDocModal(true); }}
                                                        className="px-6 py-3 bg-[#00B5AD] hover:bg-[#00928C] text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-teal-100 flex items-center gap-2"
                                                    >
                                                        Add Mulkia
                                                    </button>
                                                )}
                                                {!hasInsurance && (
                                                    <button
                                                        onClick={() => { setSelectedDocType('Insurance'); setSelectedDoc(null); setShowDocModal(true); }}
                                                        className="px-6 py-3 bg-[#00B5AD] hover:bg-[#00928C] text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-teal-100 flex items-center gap-2"
                                                    >
                                                        Add Insurance
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => { setSelectedDocType('Other'); setSelectedDoc(null); setShowDocModal(true); }}
                                                    className="px-6 py-3 bg-[#00B5AD] hover:bg-[#00928C] text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-teal-100 flex items-center gap-2"
                                                >
                                                    Other
                                                </button>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {activeTab === 'maintenance' && (
                                <div className="max-w-5xl mx-auto space-y-8">
                                    {/* Action Buttons for Service/Maintenance */}
                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 border-dashed flex flex-wrap items-center justify-between gap-6">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-700">Service & Maintenance Control</span>
                                            <p className="text-xs text-slate-400">Update the current operational status of the vehicle.</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => updateAssetStatus('On Service')}
                                                disabled={asset.status === 'On Service'}
                                                className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${asset.status === 'On Service'
                                                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-100'
                                                    : 'bg-white text-orange-600 border border-orange-200 hover:bg-orange-50'
                                                    }`}
                                            >
                                                Put On Service
                                            </button>
                                            <button
                                                onClick={() => updateAssetStatus('Maintenance')}
                                                disabled={asset.status === 'Maintenance'}
                                                className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${asset.status === 'Maintenance'
                                                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-100'
                                                    : 'bg-white text-amber-600 border border-amber-200 hover:bg-amber-50'
                                                    }`}
                                            >
                                                Maintenance
                                            </button>
                                            <button
                                                onClick={() => updateAssetStatus('Unassigned')}
                                                disabled={asset.status === 'Unassigned'}
                                                className={`px-6 py-2.5 rounded-xl text-xs font-bold border transition-all ${asset.status === 'Unassigned'
                                                    ? 'bg-slate-700 text-white shadow-lg'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                    }`}
                                            >
                                                Mark Available
                                            </button>
                                        </div>
                                    </div>

                                    {/* Maintenance History Section */}
                                    <div className="mt-10">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex flex-col">
                                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Maintenance & Service History</h4>
                                                <p className="text-[10px] text-slate-400 font-medium">Log of all repairs, oil changes, and mechanical works.</p>
                                            </div>
                                            <button
                                                onClick={() => setShowServiceModal(true)}
                                                className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-gray-100"
                                            >
                                                <PlusCircle size={14} /> Add Service Record
                                            </button>
                                        </div>

                                        {asset.services && asset.services.length > 0 ? (
                                            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-50/50">
                                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Type</th>
                                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Issue</th>
                                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Run (KM)</th>
                                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Value & Payee</th>
                                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {asset.services.map((service, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                                                <td className="px-6 py-5">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-black text-slate-700">{formatDate(service.date)}</span>
                                                                        <span className={`text-[9px] font-bold uppercase mt-0.5 ${service.serviceType === 'Oil Service' ? 'text-blue-500' : 'text-slate-400'}`}>
                                                                            {service.serviceType}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-5">
                                                                    <div className="flex flex-col max-w-xs">
                                                                        <span className="text-xs font-bold text-slate-600 line-clamp-1">{service.description}</span>
                                                                        {service.remark && <span className="text-[10px] text-slate-400 italic">"{service.remark}"</span>}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-5">
                                                                    <span className="text-xs font-black text-slate-700 font-mono">
                                                                        {service.currentKm ? `${service.currentKm.toLocaleString()} KM` : '-'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-5">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-black text-emerald-600">AED {service.value?.toLocaleString()}</span>
                                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Paid by: {service.paidBy}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-5">
                                                                    {service.invoice && (
                                                                        <a
                                                                            href={service.invoice}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                                        >
                                                                            <Download size={14} />
                                                                        </a>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="bg-slate-50/50 rounded-[32px] border-2 border-dashed border-slate-100 py-16 flex flex-col items-center justify-center text-center px-6">
                                                <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center text-slate-200 mb-6 shadow-sm">
                                                    <Settings size={32} />
                                                </div>
                                                <h5 className="text-sm font-black text-slate-400 uppercase tracking-[.25em] mb-2">No Service History</h5>
                                                <p className="text-[10px] text-slate-300 font-medium max-w-sm">No maintenance or repair records found for this vehicle. Click "Add Service Record" to start logging.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'transfer' && (
                                <div className="max-w-4xl mx-auto space-y-6">
                                    {assetHistory.length === 0 ? (
                                        <div className="bg-slate-50/50 rounded-[32px] border-2 border-dashed border-slate-100 py-20 flex flex-col items-center justify-center text-center px-6 mt-10">
                                            <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center text-slate-200 mb-6 shadow-sm">
                                                <History size={32} />
                                            </div>
                                            <h5 className="text-sm font-black text-slate-400 uppercase tracking-[.25em] mb-2">No Transfer History</h5>
                                            <p className="text-[10px] text-slate-300 font-medium max-w-sm">There are no records of previous assignments or transfers for this vehicle.</p>
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
                                                                        entry.action === 'Accepted' ? 'bg-emerald-50 text-emerald-600' :
                                                                            entry.action === 'Rejected' ? 'bg-rose-50 text-rose-600' :
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
                                                        {(entry.comments || entry.file) && (
                                                            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                                                                {entry.comments && (
                                                                    <p className="text-xs italic text-slate-500 flex gap-2">
                                                                        <AlertTriangle size={14} className="shrink-0" />
                                                                        "{entry.comments}"
                                                                    </p>
                                                                )}
                                                                {entry.file && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedFile(entry.file);
                                                                            setShowFileModal(true);
                                                                        }}
                                                                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all shadow-sm"
                                                                    >
                                                                        <Eye size={12} /> View Attachment
                                                                    </button>
                                                                )}
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
                                        <div className="bg-slate-50/50 rounded-[32px] border-2 border-dashed border-slate-100 py-20 flex flex-col items-center justify-center text-center px-6 mt-10">
                                            <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center text-slate-200 mb-6 shadow-sm">
                                                <Receipt size={32} />
                                            </div>
                                            <h5 className="text-sm font-black text-slate-400 uppercase tracking-[.25em] mb-2">No Fines Recorded</h5>
                                            <p className="text-[10px] text-slate-300 font-medium max-w-sm">This vehicle has no registered fines or traffic violations in the system.</p>
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
                onUpdate={refreshData}
            />

            <AssignAssetModal
                isOpen={showAssignModal}
                onClose={() => setShowAssignModal(false)}
                asset={asset}
                onUpdate={refreshData}
            />

            <HandoverFormModal
                isOpen={showHandoverModal}
                onClose={() => setShowHandoverModal(false)}
                asset={asset}
                employee={asset?.assignedTo}
            />

            <VehicleDocumentModal
                isOpen={showDocModal}
                onClose={() => { setShowDocModal(false); setSelectedDoc(null); setIsRenewMode(false); }}
                onSuccess={refreshData}
                assetId={assetId}
                docType={selectedDocType}
                existingDoc={selectedDoc}
                isRenew={isRenewMode}
            />

            <VehicleServiceModal
                isOpen={showServiceModal}
                onClose={() => setShowServiceModal(false)}
                onSuccess={refreshData}
                assetId={assetId}
            />

            {/* Response Modal */}
            {showResponseModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[32px] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                                {responseAction === 'AcceptWithComments' ? 'Accept with Comments' : 'Reject Assignment'}
                            </h2>
                        </div>

                        <p className="text-xs font-bold text-slate-400 mb-6 uppercase tracking-widest leading-relaxed">
                            {responseAction === 'AcceptWithComments'
                                ? 'Please add any remarks regarding the handover condition.'
                                : 'Please provide a clear reason for rejecting the transfer.'}
                        </p>

                        <div className="space-y-6">
                            <textarea
                                className="w-full p-6 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-blue-500 min-h-[120px] text-sm font-medium transition-all group-hover:border-slate-200"
                                placeholder="Write your comments here..."
                                value={responseComment}
                                onChange={(e) => setResponseComment(e.target.value)}
                            />

                            {responseAction === 'AcceptWithComments' && (
                                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                    <label className="block text-[10px] font-black text-slate-500 mb-3 uppercase tracking-[0.2em]">
                                        Handover Document / Photo
                                    </label>
                                    <input
                                        type="file"
                                        onChange={handleFileUpload}
                                        className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition-all cursor-pointer"
                                    />
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    onClick={() => setShowResponseModal(false)}
                                    className="px-8 py-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        const actionText = responseAction === 'AcceptWithComments' ? 'Accept' : 'Reject';
                                        setConfirmDialog({
                                            isOpen: true,
                                            title: `${actionText} vehicle assignment?`,
                                            description: `Are you sure you want to ${actionText.toLowerCase()} this vehicle assignment with the provided comments?`,
                                            onConfirm: handleResponse
                                        });
                                    }}
                                    className={`px-10 py-4 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl transition-all active:scale-95 ${responseAction === 'AcceptWithComments'
                                        ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
                                        : 'bg-red-600 hover:bg-red-700 shadow-red-100'
                                        }`}
                                >
                                    Confirm Action
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* File Preview Modal */}
            {showFileModal && selectedFile && (
                <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
                        <div className="px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xs font-black text-slate-800 flex items-center gap-3 uppercase tracking-[0.2em]">
                                <FileText size={18} className="text-blue-600" />
                                Attachment Preview
                            </h3>
                            <button
                                onClick={() => setShowFileModal(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 transition-all shadow-sm"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-12 bg-slate-50 flex items-center justify-center">
                            {selectedFile.match(/\.(jpeg|jpg|gif|png|webp|bmp|svg)(\?.*)?$/i) || selectedFile.startsWith('data:image') ? (
                                <img
                                    src={selectedFile}
                                    alt="Attachment"
                                    className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl"
                                />
                            ) : selectedFile.match(/\.pdf(\?.*)?$/i) ? (
                                <iframe
                                    src={selectedFile}
                                    className="w-full h-full min-h-[600px] border-none rounded-3xl bg-white shadow-xl"
                                    title="PDF Preview"
                                />
                            ) : (
                                <div className="text-center p-20">
                                    <div className="w-24 h-24 bg-white border border-slate-100 shadow-sm rounded-3xl flex items-center justify-center mx-auto mb-8 text-slate-200">
                                        <FileText size={48} />
                                    </div>
                                    <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-10">File preview not available for this format.</p>
                                    <a
                                        href={selectedFile}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-12 py-5 bg-blue-600 text-white rounded-[20px] text-[10px] font-black uppercase tracking-[0.3em] hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 inline-flex items-center gap-4"
                                    >
                                        Download Externally <Download size={16} />
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <AlertDialog open={confirmDialog.isOpen} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, isOpen: open }))}>
                <AlertDialogContent className="rounded-[32px] p-8 border-none shadow-2xl z-[200] max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900">
                            {confirmDialog.title}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium text-slate-500 leading-relaxed pt-2">
                            {confirmDialog.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-6 gap-3">
                        <AlertDialogCancel className="rounded-2xl border-none bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold uppercase text-[10px] tracking-widest h-12 px-6">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDialog.onConfirm}
                            className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-[0.2em] h-12 px-8 shadow-xl shadow-blue-100"
                        >
                            Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!docToDelete} onOpenChange={(open) => { if (!open) setDocToDelete(null); }}>
                <AlertDialogContent className="rounded-[32px] p-8 border-none shadow-2xl max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {docToDelete?.type} Document?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove the <strong>{docToDelete?.type}</strong> document from this vehicle. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteDoc}
                            disabled={deleteLoading}
                            className="bg-rose-500 hover:bg-rose-600 text-white"
                        >
                            {deleteLoading ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
