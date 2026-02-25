'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import {
    ArrowLeft,
    Package,
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
    Camera,
    Image as ImageIcon,
    X,
    ArrowRightLeft,
    Ban
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AccessoriesModal from '../../components/AccessoriesModal';
import TransferAccessoryModal from '../../components/TransferAccessoryModal';
import AssignAssetModal from '../../components/AssignAssetModal';
import HandoverFormModal from '../../components/HandoverFormModal';
import HandoverFormView from '../../components/HandoverFormView';
import AddLossDamageModal from '@/app/HRM/Fine/components/AddLossDamageModal';
import SendToServiceModal from '../../components/SendToServiceModal';
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

// Helper for initials
const getInitials = (name) => {
    if (!name) return 'AS';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
};

export default function AssetDetailsPage() {
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
    const [responseComment, setResponseComment] = useState('');
    const [showResponseModal, setShowResponseModal] = useState(false);
    const [responseAction, setResponseAction] = useState(null);
    const formRef = useRef();

    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showDamageModal, setShowDamageModal] = useState(false);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', description: '' });
    const [confirmAction, setConfirmAction] = useState(null);
    const [showHistoryDetailModal, setShowHistoryDetailModal] = useState(false);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
    const [assetHistory, setAssetHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('document'); // 'document', 'history', 'accessories', 'images'

    const [currentUser, setCurrentUser] = useState(null);
    const [transferModal, setTransferModal] = useState({ isOpen: false, accessory: null });
    const [damageInitialData, setDamageInitialData] = useState(null);
    const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
    const [imageDeleteConfirm, setImageDeleteConfirm] = useState({ isOpen: false, imageId: null });
    const [imageUploadModal, setImageUploadModal] = useState({ isOpen: false, file: null, base64: null, caption: '', date: new Date().toISOString().split('T')[0] });

    const handleReturnAsset = async () => {
        try {
            await axiosInstance.put(`/AssetItem/${assetId}/return`);
            toast({ title: "Success", description: "Asset returned successfully." });
            setReturnConfirmOpen(false);
            fetchAssetDetails();
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "Failed to return asset." });
        }
    };

    const handleDeleteImage = async () => {
        const { imageId } = imageDeleteConfirm;
        try {
            await axiosInstance.delete(`/AssetItem/${assetId}/images/${imageId}`);
            toast({ title: 'Deleted', description: 'Image removed.' });
            setImageDeleteConfirm({ isOpen: false, imageId: null });
            fetchAssetDetails();
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete image.' });
        }
    };

    const handleUploadImage = async () => {
        const { base64, file, caption, date } = imageUploadModal;
        try {
            await axiosInstance.post(`/AssetItem/${assetId}/images`, {
                imageData: base64,
                imageName: file.name,
                imageMime: file.type,
                caption,
                date: date || new Date().toISOString()
            });
            toast({ title: 'Success', description: 'Image uploaded.' });
            setImageUploadModal({ isOpen: false, file: null, base64: null, caption: '', date: '' });
            fetchAssetDetails();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to upload image.' });
        }
    };



    useEffect(() => {
        if (typeof window !== 'undefined') {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            setCurrentUserEmployeeId(user.employeeObjectId);

            // Fetch full user profile to check signature status accurately
            const fetchUserProfile = async () => {
                try {
                    const res = await axiosInstance.get('/Employee/me'); // Corrected endpoint casing
                    if (res && res.data) {
                        setCurrentUser(res.data);
                    }
                } catch (err) {
                    console.error("Failed to fetch user profile:", err.response?.data || err.message);
                    // Fallback to local storage if API fails, though signature might be missing
                    setCurrentUser(user);
                }
            };
            fetchUserProfile();
        }
    }, []);

    const fetchAssetHistory = async () => {
        try {
            const response = await axiosInstance.get(`/AssetItem/${assetId}/history`);
            setAssetHistory(response.data);
        } catch (error) {
            console.error('Error fetching asset history:', error);
            toast({ variant: "destructive", title: "Error", description: "Failed to fetch history." });
        }
    };

    const [responseFile, setResponseFile] = useState(null);
    const [showFileModal, setShowFileModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);

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

    const handleResponse = () => {
        setConfirmDialog({
            isOpen: true,
            type: 'response',
            title: 'Confirm Response',
            description: `Are you sure you want to ${responseAction === 'AcceptWithComments' || responseAction === 'Accept' ? 'accept' : 'reject'} this asset assignment?`
        });
    };

    const finalizeResponse = async () => {
        try {
            await axiosInstance.put(`/AssetItem/${assetId}/respond`, {
                action: responseAction,
                comments: responseComment,
                file: responseFile
            });
            toast({
                title: "Success",
                description: `Asset assignment ${responseAction === 'Accept' || responseAction === 'AcceptWithComments' ? 'accepted' : 'rejected'} successfully.`
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
        } finally {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
    };

    const finalizeDirectAccept = async () => {
        try {
            await axiosInstance.put(`/AssetItem/${assetId}/respond`, {
                action: 'Accept',
                comments: ''
            });
            toast({ title: "Success", description: "Asset accepted successfully." });
            fetchAssetDetails();
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "Failed to accept asset." });
        } finally {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
    };

    const executeConfirmAction = () => {
        if (confirmDialog.type === 'response') finalizeResponse();
        else if (confirmDialog.type === 'direct_accept') finalizeDirectAccept();
    };

    const openResponseModal = (action) => {
        if (action === 'AcceptWithComments' && !checkSignature()) return; // Check for AcceptWithComments too
        setResponseAction(action);
        setShowResponseModal(true);
    };

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
                description: "Failed to fetch asset details"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (assetId) {
            fetchAssetDetails();
        }
    }, [assetId]);

    // Calculate warranty progress
    const warrantyProgress = useMemo(() => {
        if (!asset?.purchaseDate || !asset?.warrantyYears) return 0;
        const purchaseDate = new Date(asset.purchaseDate);
        const expiryDate = new Date(purchaseDate);
        expiryDate.setFullYear(purchaseDate.getFullYear() + asset.warrantyYears);

        const today = new Date();
        const totalDuration = expiryDate.getTime() - purchaseDate.getTime();
        const elapsed = today.getTime() - purchaseDate.getTime();

        const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
        return Math.round(100 - progress); // Show remaining percentage
    }, [asset]);

    if (loading) {
        return (
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-gray-500 font-semibold">Loading asset details...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!asset) {
        return (
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-8">
                        <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-100">
                            <AlertCircle className="mx-auto text-gray-300 mb-4" size={56} />
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Asset Not Found</h2>
                            <p className="text-gray-500 mb-8 max-w-md mx-auto">The asset you are looking for does not exist or has been removed from the management system.</p>
                            <button
                                onClick={() => router.back()}
                                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all flex items-center gap-2 mx-auto shadow-lg shadow-blue-200"
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

    const statusItems = [
        { type: 'value', text: `Valued at AED ${asset.assetValue || 0}`, color: 'bg-emerald-400' },
        { type: 'accessories', text: `${asset.accessories?.length || 0} Accessories Attached`, color: 'bg-emerald-400' },
        { type: 'warranty', text: asset.warrantyYears > 0 ? 'Warranty Coverage Active' : 'No Warranty Coverage', color: 'bg-emerald-400' }
    ];

    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                <Navbar />
                <div className="p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.back()}
                                className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm text-gray-600 hover:bg-gray-50 transition-all font-bold flex items-center gap-2"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                        </div>
                    </div>

                    {/* Row 1: Asset Identity & Accessories Inventory */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
                        {/* Main Asset Info & Stats */}
                        <div className="lg:col-span-6 flex flex-col items-stretch">
                            <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-300/50 overflow-hidden font-sans flex flex-col h-full">
                                {/* Column 1: Asset Image & Stats */}
                                <div className="flex-1 p-6 flex flex-col sm:flex-row items-center gap-6 border-b border-slate-50">
                                    <div className="relative group shrink-0">
                                        <div className="w-32 h-32 rounded-[32px] bg-slate-50 flex items-center justify-center text-slate-200 border border-slate-100 shadow-inner overflow-hidden relative group-hover:scale-105 transition-all duration-500">
                                            {asset.assetPhoto ? (
                                                <Image
                                                    src={asset.assetPhoto}
                                                    alt={asset.name}
                                                    fill
                                                    className="object-cover group-hover:scale-110 transition-transform duration-700"
                                                />
                                            ) : (
                                                <Package size={50} strokeWidth={1} />
                                            )}
                                            <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-colors duration-500" />
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-slate-50">
                                            <ShieldCheck className="text-blue-600" size={20} />
                                        </div>
                                    </div>

                                    <div className="flex-1 text-center sm:text-left">
                                        <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                                            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[8px] font-black uppercase tracking-[0.2em] border border-blue-100 shadow-sm">
                                                {asset.assetId || 'AS-000'}
                                            </span>
                                        </div>
                                        <h1 className="text-2xl font-black text-slate-900 mb-1 tracking-tight uppercase">
                                            {asset.name}
                                        </h1>
                                        <div className={`inline-flex items-center px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border shadow-sm ${asset.status === 'Assigned' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                            asset.status === 'Unassigned' ? 'bg-emerald-50 text-emerald-900 border-emerald-100' :
                                                asset.status === 'Pending' ? 'bg-amber-50 text-amber-900 border-amber-100' :
                                                    asset.status === 'Returned' ? 'bg-blue-50 text-blue-900 border-blue-100' :
                                                        asset.status === 'Maintenance' ? 'bg-amber-50 text-amber-900 border-amber-100' :
                                                            'bg-rose-50 text-rose-700 border-rose-100'
                                            }`}>
                                            <span className={`w-1 h-1 rounded-full mr-1.5 ${asset.status === 'Assigned' ? 'bg-indigo-500' :
                                                asset.status === 'Unassigned' ? 'bg-emerald-500' :
                                                    asset.status === 'Pending' ? 'bg-amber-500' :
                                                        asset.status === 'Returned' ? 'bg-blue-500' :
                                                            asset.status === 'Maintenance' ? 'bg-amber-600' :
                                                                'bg-rose-500'
                                                }`}></span>
                                            {asset.status || 'STATUS'}
                                        </div>
                                    </div>
                                </div>

                                {/* Column 2: Information Stat Cards Grid */}
                                <div className="grid grid-cols-2 gap-2 p-6 bg-slate-50/30">
                                    <div className="flex flex-col px-4 py-2 bg-white border border-slate-100 rounded-xl group/item transition-all hover:shadow-md">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Value</span>
                                        <span className="text-xs font-black text-blue-800">
                                            AED {new Intl.NumberFormat().format(asset.assetValue || 0)}
                                        </span>
                                    </div>

                                    <div className="flex flex-col px-4 py-2 bg-white border border-slate-100 rounded-xl group/item transition-all hover:shadow-md">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Assignee</span>
                                        <span className={`text-[9px] font-black truncate ${asset.assignedTo ? 'text-indigo-900' : 'text-indigo-400 italic'}`}>
                                            {asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : "N/A"}
                                        </span>
                                    </div>

                                    <div className={`flex flex-col px-4 py-2 border rounded-xl group/item transition-all hover:shadow-md bg-white ${asset.warrantyYears > 0 ? 'border-emerald-100' : 'border-rose-100'}`}>
                                        <span className={`text-[7px] font-black uppercase tracking-widest mb-0.5 ${asset.warrantyYears > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Warranty</span>
                                        <span className={`text-[9px] font-black ${asset.warrantyYears > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                            {asset.warrantyYears > 0 ? `${asset.warrantyYears}Y` : "EXPIRED"}
                                        </span>
                                    </div>

                                    <div className="flex flex-col px-4 py-2 bg-white border border-slate-100 rounded-xl group/item transition-all hover:shadow-md">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Category</span>
                                        <span className="text-[9px] font-black text-slate-900 truncate uppercase">
                                            {asset.categoryId?.name || 'GENERIC'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Card 2: Current Assignee Details */}
                        <div className="lg:col-span-6 flex flex-col items-stretch">
                            <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-300/50 overflow-hidden font-sans flex flex-col h-full bg-slate-50/10">
                                {asset.assignedTo ? (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-3xl font-black mb-4 shadow-xl shadow-indigo-100 border-4 border-white animate-in fade-in zoom-in duration-500">
                                            {getInitials(`${asset.assignedTo.firstName} ${asset.assignedTo.lastName}`)}
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Current Holder</p>
                                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                                                {asset.assignedTo.firstName} {asset.assignedTo.lastName}
                                            </h2>
                                            <p className="text-sm font-bold text-blue-600/70 uppercase tracking-widest">
                                                {asset.assignedTo.designation || 'EMPLOYEE'}
                                            </p>
                                        </div>
                                        <div className="mt-6 flex items-center gap-3">
                                            <div className="px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                                                {asset.assignedTo.employeeId || 'ID NOT SET'}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center p-10 opacity-40">
                                        <div className="w-24 h-24 rounded-full border-4 border-dashed border-slate-300 flex items-center justify-center bg-slate-100/50">
                                            <UserPlus size={40} className="text-slate-400" />
                                        </div>
                                        <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Ready for assignment</p>
                                        <button
                                            onClick={() => setShowAssignModal(true)}
                                            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                                        >
                                            Assign Now
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Handover Document / Assignment Actions */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
                        {/* Handover or Quick Actions Card - Expanded to Full Width */}
                        <div className="lg:col-span-12 flex flex-col">
                            {
                                asset.assignedTo ? (
                                    <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col h-full font-sans">
                                        <div className="px-8 py-4 border-b border-slate-50 bg-slate-50/50">
                                            <div className="flex flex-wrap items-center justify-between gap-4">
                                                {/* Tab Navigation */}
                                                <div className="flex items-center gap-1 p-1 bg-slate-100/50 rounded-2xl border border-slate-100">
                                                    {[
                                                        { id: 'document', label: 'Document', icon: FileText },
                                                        { id: 'history', label: 'History', icon: History },
                                                        { id: 'accessories', label: 'Accessories', icon: Package },
                                                        { id: 'images', label: 'Images', icon: ImageIcon },
                                                        ...(asset.status !== 'Returned' ? [{ id: 'edit', label: 'Manage Asset', icon: PencilLine }] : [])
                                                    ].map((tab) => (
                                                        <button
                                                            key={tab.id}
                                                            onClick={() => {
                                                                if (tab.id === 'history' && activeTab !== 'history') fetchAssetHistory();
                                                                setActiveTab(tab.id);
                                                            }}
                                                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-bold transition-all ${activeTab === tab.id
                                                                ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
                                                                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                                                                }`}
                                                        >
                                                            <tab.icon size={14} />
                                                            {tab.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {/* Acceptance Buttons - Check actionRequiredBy */}
                                                    {(currentUserEmployeeId && asset.actionRequiredBy === currentUserEmployeeId && asset.acceptanceStatus === 'Pending') && (
                                                        <>
                                                            <button
                                                                onClick={() => openResponseModal('Reject')}
                                                                className="px-6 py-2.5 bg-red-100 text-red-600 rounded-xl text-[11px] font-bold hover:bg-red-200 transition-all flex items-center gap-2"
                                                            >
                                                                Reject / Cancel
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    if (!checkSignature()) return;
                                                                    setConfirmDialog({
                                                                        isOpen: true,
                                                                        type: 'direct_accept',
                                                                        title: 'Accept Assignment',
                                                                        description: 'Are you sure you want to accept this asset assignment? By accepting, you acknowledge receipt and responsibility for this asset.'
                                                                    });
                                                                }}
                                                                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-[11px] font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200"
                                                            >
                                                                Accept
                                                            </button>

                                                            <button
                                                                onClick={() => openResponseModal('AcceptWithComments')}
                                                                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[11px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                                                            >
                                                                {asset.negotiationHistory && asset.negotiationHistory.length > 0 ? "Reply / Accept with Comments" : "Accept with Comments"}
                                                            </button>
                                                        </>
                                                    )}

                                                    <button
                                                        onClick={() => setShowHandoverModal(true)}
                                                        className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[11px] font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
                                                    >
                                                        <Printer size={16} /> Print
                                                    </button>

                                                    {/* Return/Reassign Actions - Only for Assigner or Admin */}
                                                    {(currentUser?.role === 'Admin' || currentUser?.role === 'ROOT' || asset.assignedBy?._id === currentUserEmployeeId) && (
                                                        <>
                                                            {asset.status === 'Assigned' && (
                                                                <button
                                                                    onClick={() => setReturnConfirmOpen(true)}
                                                                    className="px-6 py-2.5 bg-rose-600 text-white rounded-xl text-[11px] font-bold hover:bg-rose-700 transition-all shadow-md shadow-rose-200"
                                                                >
                                                                    Return Asset
                                                                </button>
                                                            )}
                                                            {asset.status === 'Returned' && (
                                                                <button
                                                                    onClick={() => setShowAssignModal(true)}
                                                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[11px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                                                                >
                                                                    Reassign
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Negotiation History & Handover Form */}
                                        <div className="flex-1 p-8 bg-slate-100/30 overflow-y-auto max-h-[800px] scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                            {activeTab === 'history' ? (
                                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px] flex flex-col uppercase tracking-widest font-black">
                                                    <div className="p-4 border-b border-slate-100">
                                                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                            <History size={16} className="text-blue-600" /> Asset Lifecycle & History
                                                        </h3>
                                                    </div>
                                                    <div className="flex-1 p-6 space-y-6">
                                                        {assetHistory && assetHistory.length > 0 ? (
                                                            assetHistory.map((entry, idx) => {
                                                                const isMe = entry.performedBy?._id === currentUserEmployeeId;
                                                                const isComment = entry.action === 'Comment' || entry.action === 'AcceptWithComments';

                                                                return (
                                                                    <div key={idx} className="flex gap-4 group">
                                                                        <div className="flex flex-col items-center">
                                                                            <div className={`w-3 h-3 rounded-full mt-1.5 shadow-sm transition-colors ${entry.action === 'Assigned' ? 'bg-blue-500 shadow-blue-200' :
                                                                                entry.action === 'Accepted' ? 'bg-emerald-500 shadow-emerald-200' :
                                                                                    entry.action === 'Rejected' ? 'bg-red-500 shadow-red-200' :
                                                                                        isComment ? 'bg-yellow-500 shadow-yellow-200' :
                                                                                            'bg-gray-400'
                                                                                }`} />
                                                                            {idx !== assetHistory.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 my-1 group-hover:bg-gray-200 transition-colors" />}
                                                                        </div>
                                                                        <div className="flex-1 pb-2 font-sans tracking-normal font-normal">
                                                                            <div className={`p-4 rounded-xl border transition-all ${isMe ? 'bg-blue-50/50 border-blue-100' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                                                                                <div className="flex justify-between items-start mb-1">
                                                                                    <span className={`text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded ${entry.action === 'Assigned' ? 'text-blue-600 bg-blue-100' :
                                                                                        entry.action === 'Accepted' ? 'text-emerald-600 bg-emerald-100' :
                                                                                            entry.action === 'Rejected' ? 'text-red-600 bg-red-100' :
                                                                                                'text-yellow-700 bg-yellow-100'
                                                                                        }`}>
                                                                                        {entry.action === 'Comment' ? 'Commented' : entry.action}
                                                                                    </span>
                                                                                    <span className="text-[10px] font-mono text-slate-400">
                                                                                        {new Date(entry.date).toLocaleString()}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="text-sm text-slate-700 leading-relaxed uppercase font-black tracking-widest text-[10px]">
                                                                                    {entry.action === 'Assigned' && (
                                                                                        <p>
                                                                                            <span className="font-bold">{entry.performedBy?.firstName} {entry.performedBy?.lastName}</span> assigned this asset to <span className="font-bold text-blue-600">{entry.assignedTo?.firstName} {entry.assignedTo?.lastName}</span>
                                                                                        </p>
                                                                                    )}
                                                                                    {entry.action === 'Accepted' && (
                                                                                        <p>
                                                                                            <span className="font-bold">{entry.performedBy?.firstName} {entry.performedBy?.lastName}</span> accepted the asset.
                                                                                        </p>
                                                                                    )}
                                                                                    {entry.action === 'Rejected' && (
                                                                                        <p>
                                                                                            <span className="font-bold">{entry.performedBy?.firstName} {entry.performedBy?.lastName}</span> rejected the asset assignment.
                                                                                        </p>
                                                                                    )}
                                                                                    {isComment && (
                                                                                        <div>
                                                                                            <p className="mb-2">
                                                                                                <span className="font-bold">{entry.performedBy?.firstName} {entry.performedBy?.lastName}</span>: "{entry.comments || entry.message}"
                                                                                            </p>
                                                                                            {entry.file && (
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        setSelectedFile(entry.file);
                                                                                                        setShowFileModal(true);
                                                                                                    }}
                                                                                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
                                                                                                >
                                                                                                    <FileText size={12} /> View Attachment
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                {!isComment && entry.comments && (
                                                                                    <div className="mt-2 text-xs text-slate-500 italic bg-white/50 p-2 rounded border border-slate-100">
                                                                                        "{entry.comments}"
                                                                                    </div>
                                                                                )}

                                                                                {entry.details && (
                                                                                    <div className="mt-3 flex items-center justify-end">
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                setSelectedHistoryItem(entry);
                                                                                                setShowHistoryDetailModal(true);
                                                                                            }}
                                                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 transition-all shadow-sm shadow-blue-100 uppercase tracking-wider"
                                                                                        >
                                                                                            <FileText size={12} />
                                                                                            View Form & Details
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        ) : (
                                                            <div className="text-center py-20 text-slate-400">
                                                                <History size={48} className="mx-auto mb-4 opacity-20" />
                                                                <p className="text-sm uppercase font-bold tracking-widest">No history records found</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : activeTab === 'accessories' ? (
                                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px] flex flex-col uppercase tracking-widest font-black">
                                                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                                                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                            <Package size={16} className="text-blue-600" /> Attached Accessories
                                                        </h3>
                                                        <button
                                                            onClick={() => setShowAccessoriesModal(true)}
                                                            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                        >
                                                            Manage Accessories
                                                        </button>
                                                    </div>
                                                    <div className="p-8">
                                                        {!asset.accessories || asset.accessories.length === 0 ? (
                                                            <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                                                                <Package size={48} strokeWidth={1} className="mb-4 opacity-20" />
                                                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">No accessories found</span>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                {asset.accessories.map((acc, index) => (
                                                                    <div key={index} className="flex items-center justify-between p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group">
                                                                        <div className="flex items-center gap-6">
                                                                            <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 shadow-sm transition-all shrink-0">
                                                                                <Package size={28} strokeWidth={1.5} />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-[14px] font-black text-slate-800 uppercase tracking-tight" title={acc.name}>{acc.name}</span>
                                                                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${acc.status === 'Attached' ? 'bg-emerald-50 text-emerald-600' :
                                                                                        acc.status === 'Transfered' ? 'bg-amber-50 text-amber-600' :
                                                                                            'bg-rose-50 text-rose-600'
                                                                                        }`}>
                                                                                        {acc.status || 'Attached'}
                                                                                    </span>
                                                                                </div>
                                                                                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase mt-1">{acc.accessoryId}</span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center gap-12">
                                                                            <div className="text-right">
                                                                                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Value</span>
                                                                                <span className="text-[14px] font-black text-emerald-600 tracking-wider">AED {new Intl.NumberFormat().format(acc.amount || 0)}</span>
                                                                            </div>

                                                                            {acc.status === 'Attached' && (
                                                                                <div className="flex items-center gap-2">
                                                                                    <button
                                                                                        onClick={() => setTransferModal({ isOpen: true, accessory: acc })}
                                                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-[9px] font-black hover:bg-blue-600 hover:text-white transition-all uppercase tracking-tighter shadow-sm border border-blue-100/50"
                                                                                    >
                                                                                        <ArrowRightLeft size={12} /> Transfer
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setDamageInitialData({
                                                                                                assetId: asset?.assetId,
                                                                                                assetName: asset?.name,
                                                                                                employeeId: asset?.assignedTo?.employeeId || '',
                                                                                                employeeName: asset?.assignedTo
                                                                                                    ? `${asset.assignedTo.firstName || ''} ${asset.assignedTo.lastName || ''}`.trim()
                                                                                                    : '',
                                                                                                description: `Loss/Damage of accessory: ${acc.name} (${acc.accessoryId})`
                                                                                            });
                                                                                            setShowDamageModal(true);
                                                                                        }}
                                                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-500 text-[9px] font-black hover:bg-red-50 hover:text-red-500 transition-all uppercase tracking-tighter shadow-sm border border-slate-100"
                                                                                        title="Mark as Loss and Damage or EOL"
                                                                                    >
                                                                                        <AlertCircle size={13} /> Loss and Damage / EOL
                                                                                    </button>
                                                                                </div>
                                                                            )}

                                                                            {acc.attachment && (
                                                                                <a
                                                                                    href={acc.attachment}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="w-12 h-12 flex items-center justify-center text-slate-300 hover:text-blue-600 bg-slate-50 hover:bg-white rounded-xl shadow-sm border border-slate-100 transition-all"
                                                                                >
                                                                                    <ExternalLink size={18} />
                                                                                </a>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : activeTab === 'images' ? (
                                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px] flex flex-col">
                                                    {/* Header */}
                                                    <div className="flex items-center justify-between p-5 border-b border-slate-100">
                                                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                            <Camera size={16} className="text-blue-600" />
                                                            Asset Images
                                                            <span className="ml-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold">
                                                                {(asset.images?.length || 0) + (asset.assetPhoto ? 1 : 0)}
                                                            </span>
                                                        </h3>
                                                        {/* Upload button */}
                                                        <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer transition-all shadow-sm">
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                                            Add Image
                                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (!file) return;
                                                                const reader = new FileReader();
                                                                reader.onloadend = () => {
                                                                    const base64 = reader.result.split(',')[1];
                                                                    setImageUploadModal({
                                                                        isOpen: true,
                                                                        file,
                                                                        base64,
                                                                        caption: '',
                                                                        date: new Date().toISOString().split('T')[0]
                                                                    });
                                                                };
                                                                reader.readAsDataURL(file);
                                                                e.target.value = '';
                                                            }} />
                                                        </label>
                                                    </div>

                                                    {/* Gallery grid */}
                                                    <div className="p-5 flex-1">
                                                        {(() => {
                                                            const allImages = [
                                                                ...(asset.assetPhoto ? [{ _id: '__main__', url: asset.assetPhoto, caption: 'Main photo', date: asset.createdAt }] : []),
                                                                ...(asset.images || [])
                                                            ];
                                                            if (allImages.length === 0) {
                                                                return (
                                                                    <div className="py-24 flex flex-col items-center justify-center text-slate-300">
                                                                        <Camera size={56} strokeWidth={1} className="mb-4 opacity-30" />
                                                                        <span className="text-[12px] font-bold uppercase tracking-widest">No images yet</span>
                                                                        <p className="text-[10px] text-slate-400 mt-1 font-normal">Click "Add Image" to upload the first photo</p>
                                                                    </div>
                                                                );
                                                            }
                                                            return (
                                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                                                    {allImages.map((img) => (
                                                                        <div key={img._id} className="group relative rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50 aspect-square">
                                                                            <img
                                                                                src={img.url}
                                                                                alt={img.caption || 'Asset image'}
                                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                                                                                onClick={() => window.open(img.url, '_blank')}
                                                                            />
                                                                            {/* Overlay */}
                                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                                                            {/* Info bar */}
                                                                            <div className="absolute bottom-0 left-0 right-0 p-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                {img.caption && (
                                                                                    <p className="text-white text-[10px] font-semibold truncate leading-tight">{img.caption}</p>
                                                                                )}
                                                                                <p className="text-white/70 text-[9px] font-normal">
                                                                                    {img.date ? new Date(img.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                                                                                </p>
                                                                            </div>
                                                                            {/* Delete (not for main) */}
                                                                            {img._id !== '__main__' && (
                                                                                <button
                                                                                    onClick={() => setImageDeleteConfirm({ isOpen: true, imageId: img._id })}
                                                                                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                                                                >
                                                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            ) : activeTab === 'edit' ? (
                                                /* Manage Asset Panel */
                                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px] flex flex-col">
                                                    <div className="p-5 border-b border-slate-100">
                                                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                            <PencilLine size={16} className="text-blue-600" />
                                                            <span>Manage Asset</span>
                                                        </h3>
                                                        <p className="text-[11px] text-slate-400 mt-1 font-normal tracking-normal">Current status: <span className="font-bold text-slate-600">{asset.status}</span></p>
                                                    </div>
                                                    <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">

                                                        {/* Assign */}
                                                        <button
                                                            onClick={() => setShowAssignModal(true)}
                                                            disabled={['Assigned', 'Pending'].includes(asset.status)}
                                                            className="flex flex-col items-start p-4 rounded-2xl border-2 border-blue-100 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-left group"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform">
                                                                <UserPlus size={15} />
                                                            </div>
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">Assign</span>
                                                            <span className="text-[9px] text-blue-500 mt-0.5 font-normal tracking-normal normal-case leading-snug">Assign to an employee</span>
                                                        </button>

                                                        {/* Unassign */}
                                                        <button
                                                            onClick={() => {
                                                                setConfirmDialog({ isOpen: true, title: 'Unassign Asset', description: 'Are you sure you want to unassign this asset? The current assignee will be removed.' });
                                                                setConfirmAction(() => async () => {
                                                                    try {
                                                                        await axiosInstance.put(`/AssetItem/${assetId}/status`, { status: 'Unassigned', note: 'Manually unassigned' });
                                                                        toast({ title: 'Success', description: 'Asset unassigned successfully.' });
                                                                        fetchAssetDetails();
                                                                    } catch (err) {
                                                                        toast({ variant: 'destructive', title: 'Error', description: err?.response?.data?.message || 'Failed to unassign asset.' });
                                                                    }
                                                                });
                                                            }}
                                                            disabled={!['Assigned', 'Pending'].includes(asset.status)}
                                                            className="flex flex-col items-start p-4 rounded-2xl border-2 border-rose-100 bg-rose-50 hover:bg-rose-100 hover:border-rose-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-left group"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform">
                                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
                                                            </div>
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-700">Unassign</span>
                                                            <span className="text-[9px] text-rose-500 mt-0.5 font-normal tracking-normal normal-case leading-snug">Remove current assignee</span>
                                                        </button>

                                                        {/* Transfer */}
                                                        <button
                                                            onClick={() => setShowAssignModal(true)}
                                                            disabled={!['Assigned'].includes(asset.status)}
                                                            className="flex flex-col items-start p-4 rounded-2xl border-2 border-indigo-100 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-left group"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform">
                                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
                                                            </div>
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Transfer</span>
                                                            <span className="text-[9px] text-indigo-500 mt-0.5 font-normal tracking-normal normal-case leading-snug">Reassign to another employee</span>
                                                        </button>

                                                        {/* Loss & Damage */}
                                                        <button
                                                            onClick={() => setShowDamageModal(true)}
                                                            className="flex flex-col items-start p-4 rounded-2xl border-2 border-amber-100 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 transition-all text-left group"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform">
                                                                <AlertCircle size={15} />
                                                            </div>
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Loss &amp; Damage</span>
                                                            <span className="text-[9px] text-amber-600 mt-0.5 font-normal tracking-normal normal-case leading-snug">Report a loss or damage fine</span>
                                                        </button>

                                                        {/* Service / Live */}
                                                        <button
                                                            onClick={() => {
                                                                if (asset.status === 'Service') {
                                                                    // Mark as Live — use simple confirm dialog
                                                                    setConfirmDialog({
                                                                        isOpen: true,
                                                                        title: 'Mark as Live',
                                                                        description: 'Mark this asset as live? It will become available (Unassigned) again.'
                                                                    });
                                                                    setConfirmAction(() => async () => {
                                                                        try {
                                                                            await axiosInstance.put(`/AssetItem/${assetId}/status`, { status: 'Live' });
                                                                            toast({ title: 'Success', description: 'Asset restored to live.' });
                                                                            fetchAssetDetails();
                                                                        } catch (err) {
                                                                            toast({ variant: 'destructive', title: 'Error', description: err?.response?.data?.message || 'Failed to update status.' });
                                                                        }
                                                                    });
                                                                } else {
                                                                    // Send to Service — open rich modal
                                                                    setShowServiceModal(true);
                                                                }
                                                            }}
                                                            disabled={asset.status === 'Pending'}
                                                            className="flex flex-col items-start p-4 rounded-2xl border-2 border-teal-100 bg-teal-50 hover:bg-teal-100 hover:border-teal-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-left group"
                                                        >
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform ${asset.status === 'Service' ? 'bg-teal-600' : 'bg-slate-500'}`}>
                                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M4.93 4.93a10 10 0 0 0 0 14.14" /></svg>
                                                            </div>
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-teal-700">
                                                                {asset.status === 'Service' ? 'Mark as Live' : 'Send to Service'}
                                                            </span>
                                                            <span className="text-[9px] text-teal-600 mt-0.5 font-normal tracking-normal normal-case leading-snug">
                                                                {asset.status === 'Service' ? 'Restore to available' : 'Set as under maintenance'}
                                                            </span>
                                                        </button>

                                                    </div>
                                                </div>
                                            ) : (
                                                /* Handover Form View - Default */
                                                <div className="flex justify-center p-4">
                                                    <HandoverFormView asset={asset} isPrint={false} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col h-full font-sans uppercase tracking-widest">
                                        <div className="p-16 flex-1 flex flex-col items-center justify-center text-center">
                                            <div className="w-32 h-32 rounded-[48px] bg-slate-50 flex items-center justify-center text-slate-200 mb-10 border border-slate-100 animate-pulse">
                                                <UserPlus size={64} strokeWidth={1} />
                                            </div>
                                            <button
                                                onClick={() => setShowAssignModal(true)}
                                                className="px-16 py-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-[24px] text-[12px] font-black uppercase tracking-[0.4em] shadow-2xl shadow-blue-200 hover:scale-[1.05] transition-all active:scale-95"
                                            >
                                                Assign to Employee
                                            </button>
                                        </div>
                                    </div>
                                )
                            }
                        </div>
                    </div>

                    {/* File Preview Modal */}
                    {
                        showFileModal && selectedFile && (
                            <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                            <FileText size={16} className="text-blue-600" /> Attachment Preview
                                        </h3>
                                        <button
                                            onClick={() => setShowFileModal(false)}
                                            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 text-slate-500 transition-colors"
                                        >
                                            x
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-auto p-8 bg-slate-100 flex items-center justify-center">
                                        {selectedFile.match(/\.(jpeg|jpg|gif|png|webp|bmp|svg)(\?.*)?$/i) || selectedFile.startsWith('data:image') ? (
                                            <img
                                                src={selectedFile}
                                                alt="Attachment"
                                                className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                                            />
                                        ) : selectedFile.match(/\.pdf(\?.*)?$/i) ? (
                                            <iframe
                                                src={selectedFile}
                                                className="w-full h-full min-h-[500px] border-none rounded-lg"
                                                title="PDF Preview"
                                            />
                                        ) : (
                                            <div className="text-center">
                                                <div className="w-20 h-20 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
                                                    <FileText size={40} />
                                                </div>
                                                <p className="text-sm text-slate-500 font-bold mb-4">File preview not available.</p>
                                                <a
                                                    href={selectedFile}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                                                >
                                                    Download / View Externally <ArrowRight size={12} />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    }

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

                    {/* Response Modal */}
                    {
                        showResponseModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                                <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
                                    <h2 className="text-xl font-bold mb-4">
                                        {responseAction === 'AcceptWithComments'
                                            ? (asset.negotiationHistory && asset.negotiationHistory.length > 0 ? "Reply / Accept with Comments" : "Accept with Comments")
                                            : 'Reject / Cancel Assignment'}
                                    </h2>
                                    <p className="text-sm text-gray-500 mb-4">
                                        {responseAction === 'AcceptWithComments'
                                            ? 'Please add any comments regarding the acceptance of this asset.'
                                            : 'Please provide a reason for rejecting this asset assignment.'}
                                    </p>
                                    <textarea
                                        className="mb-4 w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] text-sm"
                                        placeholder="Enter comments here..."
                                        value={responseComment}
                                        onChange={(e) => setResponseComment(e.target.value)}
                                    />
                                    {responseAction === 'AcceptWithComments' && (
                                        <div className="mb-2">
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                                                Attachment (Optional)
                                            </label>
                                            <input
                                                type="file"
                                                onChange={handleFileUpload}
                                                className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                            />
                                        </div>
                                    )}
                                    <div className="flex justify-end gap-3 mt-6">
                                        <button
                                            onClick={() => setShowResponseModal(false)}
                                            className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleResponse}
                                            className={`px-6 py-2 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95 ${responseAction === 'AcceptWithComments'
                                                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                                                : 'bg-red-600 hover:bg-red-700 shadow-red-200'
                                                }`}
                                        >
                                            Confirm
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* History Modal */}
                    {
                        showHistoryModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                                <div className="bg-white rounded-2xl w-full max-w-2xl p-8 shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200">
                                    <div className="flex items-center justify-between mb-6 border-b pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                                <History size={24} />
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-bold text-gray-900">Asset History</h2>
                                                <p className="text-sm text-gray-500">Timeline of assignments and actions</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowHistoryModal(false)}
                                            className="text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                            <ArrowLeft size={24} className="rotate-180" />
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 font-sans">
                                        {!assetHistory || assetHistory.length === 0 ? (
                                            <div className="text-center py-10 text-gray-400">
                                                <History size={48} className="mx-auto mb-3 opacity-20" />
                                                <p className="text-sm font-bold uppercase tracking-wider">No history records found.</p>
                                            </div>
                                        ) : (
                                            assetHistory.map((entry, index) => (
                                                <div key={index} className="flex gap-4 group">
                                                    <div className="flex flex-col items-center">
                                                        <div className={`w-3 h-3 rounded-full mt-1.5 shadow-sm transition-colors ${entry.action === 'Assigned' ? 'bg-blue-500 shadow-blue-200' :
                                                            entry.action === 'Accepted' ? 'bg-emerald-500 shadow-emerald-200' :
                                                                entry.action === 'Rejected' ? 'bg-red-500 shadow-red-200' :
                                                                    'bg-gray-400'
                                                            }`} />
                                                        {index !== assetHistory.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 my-1 group-hover:bg-gray-200 transition-colors" />}
                                                    </div>
                                                    <div className="flex-1 pb-4">
                                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded w-fit ${entry.action === 'Assigned' ? 'bg-blue-100 text-blue-700' :
                                                                        entry.action === 'Accepted' ? 'bg-emerald-100 text-emerald-700' :
                                                                            entry.action === 'Rejected' ? 'bg-red-100 text-red-700' :
                                                                                'bg-gray-100 text-gray-600'
                                                                        }`}>
                                                                        {entry.action}
                                                                    </span>
                                                                    <span className="text-[10px] text-gray-400 font-medium">
                                                                        {new Date(entry.date).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                                {entry.performedBy && (
                                                                    <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-full border border-slate-100 shadow-sm">
                                                                        {entry.performedBy.profilePicture ? (
                                                                            <img src={entry.performedBy.profilePicture} alt="" className="w-5 h-5 rounded-full object-cover border border-slate-200" />
                                                                        ) : (
                                                                            <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold">
                                                                                {getInitials(entry.performedBy.firstName || 'U')}
                                                                            </div>
                                                                        )}
                                                                        <span className="text-[10px] font-bold text-gray-700 pr-1">
                                                                            {entry.performedBy.firstName}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="text-xs text-gray-600 space-y-1 mt-2">
                                                                {entry.assignedTo && entry.action === 'Assigned' && (
                                                                    <p className="flex items-center gap-1">
                                                                        To: <span className="font-bold text-gray-900">{entry.assignedTo.firstName} {entry.assignedTo.lastName}</span>
                                                                    </p>
                                                                )}

                                                                {entry.comments && (
                                                                    <div className="mt-2 bg-white/50 p-2 rounded border border-gray-100/50 italic text-gray-500">
                                                                        "{entry.comments}"
                                                                    </div>
                                                                )}

                                                                {entry.file && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedFile(entry.file);
                                                                            setShowFileModal(true);
                                                                        }}
                                                                        className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-colors border border-slate-200"
                                                                    >
                                                                        <FileText size={12} /> View Attachment
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="mt-4 pt-4 border-t flex justify-end">
                                        <button
                                            onClick={() => setShowHistoryModal(false)}
                                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-xs font-bold uppercase tracking-wide"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </div>
            </div>

            {/* Send to Service Modal */}
            {showServiceModal && (
                <SendToServiceModal
                    isOpen={showServiceModal}
                    assetName={asset?.name}
                    onClose={() => setShowServiceModal(false)}
                    onConfirm={async ({ serviceDuration, description, attachment, invoice }) => {
                        try {
                            await axiosInstance.put(`/AssetItem/${assetId}/status`, {
                                status: 'Service',
                                serviceDuration,
                                description,
                                attachment,
                                invoice,
                            });
                            toast({ title: 'Success', description: 'Asset sent to service.' });
                            setShowServiceModal(false);
                            fetchAssetDetails();
                        } catch (err) {
                            toast({ variant: 'destructive', title: 'Error', description: err?.response?.data?.message || 'Failed to send to service.' });
                        }
                    }}
                />
            )}

            {/* Loss & Damage Modal */}
            {showDamageModal && (
                <AddLossDamageModal
                    isOpen={showDamageModal}
                    onClose={() => setShowDamageModal(false)}
                    onBack={() => setShowDamageModal(false)}
                    onSuccess={() => {
                        setShowDamageModal(false);
                        fetchAssetDetails();
                    }}
                    initialData={damageInitialData || {
                        assetId: asset?.assetId,
                        assetName: asset?.name,
                        employeeId: asset?.assignedTo?.employeeId || '',
                        employeeName: asset?.assignedTo
                            ? `${asset.assignedTo.firstName || ''} ${asset.assignedTo.lastName || ''}`.trim()
                            : ''
                    }}
                    employees={[]}
                />
            )}

            {/* Confirmation Dialog */}
            <AlertDialog
                open={confirmDialog.isOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setConfirmDialog({ isOpen: false, title: '', description: '' });
                        setConfirmAction(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmDialog.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async (e) => {
                                e.preventDefault();
                                setConfirmDialog({ isOpen: false, title: '', description: '' });
                                if (confirmAction) await confirmAction();
                                setConfirmAction(null);
                            }}
                            className={
                                confirmDialog.title === 'Unassign Asset'
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                    : 'bg-slate-800 hover:bg-slate-900 text-white'
                            }
                        >
                            Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {/* History Detail Modal (Historical Form View) */}
            {showHistoryDetailModal && selectedHistoryItem?.details && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-gray-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100/50">
                                    <History size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Historical Record</h2>
                                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                        Snapshot from {new Date(selectedHistoryItem.date).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowHistoryDetailModal(false);
                                    setSelectedHistoryItem(null);
                                }}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form Preview Area */}
                        <div className="flex-1 overflow-y-auto p-12 bg-gray-100/50 scrollbar-hide flex flex-col items-center">
                            {/* Metadata Summary */}
                            <div className="w-full max-w-[210mm] mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status at time</p>
                                    <p className="text-sm font-bold text-blue-600">{selectedHistoryItem.details.status}</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Assignment Type</p>
                                    <p className="text-sm font-bold text-gray-900">{selectedHistoryItem.details.assignmentType || 'N/A'}</p>
                                </div>
                                {selectedHistoryItem.details.assignedDays && (
                                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Duration</p>
                                        <p className="text-sm font-bold text-gray-900">{selectedHistoryItem.details.assignedDays} Days</p>
                                    </div>
                                )}
                                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Action Performed</p>
                                    <p className="text-sm font-bold text-emerald-600">{selectedHistoryItem.action}</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Performed By</p>
                                    <p className="text-sm font-bold text-gray-900 truncate">
                                        {selectedHistoryItem.performedBy?.firstName} {selectedHistoryItem.performedBy?.lastName}
                                    </p>
                                </div>
                            </div>

                            <div className="inline-block shadow-2xl">
                                <HandoverFormView
                                    asset={selectedHistoryItem.details}
                                    employee={selectedHistoryItem.details.assignedTo}
                                    isPrint={false}
                                    overrideDate={selectedHistoryItem.date}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Accessory Transfer Modal */}
            {transferModal.isOpen && (
                <TransferAccessoryModal
                    isOpen={transferModal.isOpen}
                    onClose={() => setTransferModal({ isOpen: false, accessory: null })}
                    accessory={transferModal.accessory}
                    sourceAsset={asset}
                    onTransfer={() => {
                        toast({ title: "Success", description: "Accessory transfered" });
                        fetchAssetDetails();
                        setTransferModal({ isOpen: false, accessory: null });
                    }}
                />
            )}
            {/* Asset Return Confirmation */}
            <AlertDialog
                open={returnConfirmOpen}
                onOpenChange={setReturnConfirmOpen}
            >
                <AlertDialogContent className="bg-white rounded-[24px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold">Return Asset</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-gray-500">
                            Are you sure you want to return this asset? This will move it back to internal inventory.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl border-gray-100 font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleReturnAsset}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-rose-100"
                        >
                            Confirm Return
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Image Delete Confirmation */}
            <AlertDialog
                open={imageDeleteConfirm.isOpen}
                onOpenChange={(open) => !open && setImageDeleteConfirm({ ...imageDeleteConfirm, isOpen: false })}
            >
                <AlertDialogContent className="bg-white rounded-[24px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold">Delete Image</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-gray-500">
                            Are you sure you want to delete this image? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl border-gray-100 font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteImage}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-red-100"
                        >
                            Confirm Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Image Upload Modal (Custom Form) */}
            {imageUploadModal.isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
                        <div className="p-8 border-b border-gray-50">
                            <h2 className="text-2xl font-bold text-gray-900 leading-tight">Image Details</h2>
                            <p className="text-sm text-gray-500 mt-2">Add a caption and date for this image</p>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block ml-1">Caption (Optional)</label>
                                <input
                                    type="text"
                                    value={imageUploadModal.caption}
                                    onChange={(e) => setImageUploadModal({ ...imageUploadModal, caption: e.target.value })}
                                    placeholder="Enter image caption..."
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block ml-1">Date</label>
                                <input
                                    type="date"
                                    value={imageUploadModal.date}
                                    onChange={(e) => setImageUploadModal({ ...imageUploadModal, date: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="p-8 pt-4 flex gap-3">
                            <button
                                onClick={() => setImageUploadModal({ isOpen: false, file: null, base64: null, caption: '', date: '' })}
                                className="flex-1 py-3.5 px-6 border border-gray-100 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-all active:scale-[0.98]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUploadImage}
                                className="flex-1 py-3.5 px-6 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all active:scale-[0.98]"
                            >
                                Upload Image
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
