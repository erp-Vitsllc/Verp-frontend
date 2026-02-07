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
    History
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AccessoriesModal from '../../components/AccessoriesModal';
import AssignAssetModal from '../../components/AssignAssetModal';
import HandoverFormModal from '../../components/HandoverFormModal';
import HandoverFormView from '../../components/HandoverFormView';

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
    const [assetHistory, setAssetHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('document'); // 'document' or 'negotiation'

    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            setCurrentUserEmployeeId(user.employeeObjectId);

            // Fetch full user profile to check signature status accurately
            const fetchUserProfile = async () => {
                try {
                    const res = await axiosInstance.get('/employee/me'); // Assuming this endpoint exists or similar
                    setCurrentUser(res.data);
                } catch (err) {
                    console.error("Failed to fetch user profile", err);
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

    const handleResponse = async () => {
        try {
            await axiosInstance.put(`/AssetItem/${assetId}/respond`, {
                action: responseAction,
                comments: responseComment,
                file: responseFile // Send base64 file
            });
            toast({
                title: "Success",
                description: `Asset assignment ${responseAction === 'Accept' ? 'accepted' : 'rejected'} successfully.`
            });
            setShowResponseModal(false);
            setResponseComment('');
            setResponseFile(null); // Reset file
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 font-sans items-stretch">
                        {/* Asset Card */}
                        <div className="lg:col-span-1 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-200/50 group relative overflow-hidden flex flex-col justify-center">
                            <div className="flex flex-col xl:flex-row gap-6 items-center">
                                {/* Column 1: Profile Section */}
                                <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-3 md:w-1/3 min-w-[130px]">
                                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 group-hover:bg-white transition-colors duration-300 shadow-sm relative w-32 h-32 overflow-hidden ring-4 ring-slate-50/50">
                                        {(asset.photo || asset.imagePreview || asset.categoryId?.imagePreview) && !imageError ? (
                                            <Image
                                                src={asset.photo || asset.imagePreview || asset.categoryId?.imagePreview}
                                                alt={asset.name}
                                                fill
                                                className="object-cover"
                                                unoptimized
                                                onError={() => setImageError(true)}
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center text-white text-3xl font-black">
                                                {getInitials(asset.name)}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        <h1 className="text-2xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                                            {asset.name}
                                        </h1>
                                        <p className="text-sm text-gray-500">
                                            {asset.assetId}
                                        </p>
                                    </div>
                                </div>

                                {/* Column 2: Information Stat Cards */}
                                <div className="flex-1 flex flex-col gap-y-2 pl-8 md:border-l border-slate-100/50">
                                    {/* Asset Value Box */}
                                    <div className="flex items-center justify-between px-5 py-2.5 bg-blue-50/40 border border-blue-100 rounded-xl group/item transition-all hover:bg-blue-50 hover:shadow-sm">
                                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                                            Asset Value
                                        </span>
                                        <span className="text-base font-black text-blue-800 transition-transform group-hover/item:-translate-x-1">
                                            AED {new Intl.NumberFormat().format(asset.assetValue || 0)}
                                        </span>
                                    </div>

                                    {/* Assigned To Box */}
                                    <div className="flex items-center justify-between px-5 py-2.5 bg-indigo-50/40 border border-indigo-100 rounded-xl group/item transition-all hover:bg-indigo-50 hover:shadow-sm">
                                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                                            Assigned To
                                        </span>
                                        <span className={`text-[13px] font-black transition-transform group-hover/item:-translate-x-1 ${asset.assignedTo ? 'text-indigo-900' : 'text-indigo-400 italic'}`}>
                                            {asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : "-"}
                                        </span>
                                    </div>

                                    {/* Warranty Box */}
                                    <div className={`flex items-center justify-between px-5 py-2.5 border rounded-xl group/item transition-all hover:shadow-sm ${asset.warrantyYears > 0 ? 'bg-emerald-50/40 border-emerald-100' : 'bg-rose-50/40 border-rose-100'}`}>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${asset.warrantyYears > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            Warranty
                                        </span>
                                        <div className="flex items-center gap-2 font-black text-[13px] transition-transform group-hover/item:-translate-x-1">
                                            {asset.warrantyYears > 0 ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                                    <span className="text-emerald-700">YES</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-rose-700">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span>
                                                    <span>NO</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Category Box */}
                                    <div className="flex items-center justify-between px-5 py-2.5 bg-amber-50/40 border border-amber-100 rounded-xl group/item transition-all hover:bg-amber-50 hover:shadow-sm">
                                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                                            Category
                                        </span>
                                        <span className="text-[13px] font-black text-amber-900 transition-transform group-hover/item:-translate-x-1">
                                            {asset.categoryId?.name || 'ASSET CATEGORY'}
                                        </span>
                                    </div>

                                    {/* Type Box */}
                                    <div className="flex items-center justify-between px-5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl group/item transition-all hover:bg-slate-100 hover:shadow-sm">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            Type
                                        </span>
                                        <span className="text-[13px] font-black text-blue-600 transition-transform group-hover/item:-translate-x-1">
                                            {asset.typeId?.name || asset.type || 'STANDARD'}
                                        </span>
                                    </div>

                                    {/* Acceptance Status Badge */}
                                    {asset.assignedTo && (
                                        <div className={`mt-2 flex items-center justify-between px-5 py-2.5 border rounded-xl ${asset.acceptanceStatus === 'Pending' ? 'bg-yellow-50/60 border-yellow-200' :
                                            asset.acceptanceStatus === 'Accepted' ? 'bg-emerald-50/60 border-emerald-200' :
                                                asset.acceptanceStatus === 'Rejected' ? 'bg-red-50/60 border-red-200' :
                                                    'bg-slate-50/60 border-slate-200'
                                            }`}>
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${asset.acceptanceStatus === 'Pending' ? 'text-yellow-700' :
                                                asset.acceptanceStatus === 'Accepted' ? 'text-emerald-700' :
                                                    asset.acceptanceStatus === 'Rejected' ? 'text-red-700' :
                                                        'text-slate-500'
                                                }`}>
                                                Status
                                            </span>
                                            <span className={`text-[13px] font-black transition-transform ${asset.acceptanceStatus === 'Pending' ? 'text-yellow-800' :
                                                asset.acceptanceStatus === 'Accepted' ? 'text-emerald-800' :
                                                    asset.acceptanceStatus === 'Rejected' ? 'text-red-800' :
                                                        'text-slate-700'
                                                }`}>
                                                {asset.acceptanceStatus || 'Assigned'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Accessories Inventory */}
                        <div className="lg:col-span-1 flex flex-col">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-200/50 overflow-hidden font-sans flex flex-col h-full uppercase tracking-widest">
                                <div className="px-8 py-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3 text-slate-900">
                                        <div className="p-2 bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-100">
                                            <Package size={18} strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-900">Accessories Inventory</h3>
                                            <p className="text-[11px] font-medium text-gray-500">{asset.accessories?.length || 0} ITEMS ATTACHED</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowAccessoriesModal(true)}
                                        className="px-5 py-2 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all active:scale-95 shadow-sm"
                                    >
                                        Manage
                                    </button>
                                </div>
                                <div className="p-6 flex-1 overflow-y-auto max-h-[300px] scrollbar-hide bg-slate-50/10">
                                    {!asset.accessories || asset.accessories.length === 0 ? (
                                        <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                                            <Package size={48} strokeWidth={1} className="mb-4 opacity-20" />
                                            <span className="text-[9px] font-black uppercase tracking-[0.2em]">No accessories found</span>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {asset.accessories.slice(0, 4).map((acc, index) => (
                                                <div key={index} className="flex flex-col p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group relative">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 shadow-inner transition-all">
                                                            <Package size={20} strokeWidth={1.5} />
                                                        </div>
                                                        {acc.attachment && (
                                                            <a href={acc.attachment} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-300 hover:text-blue-600 transition-colors">
                                                                <ExternalLink size={14} />
                                                            </a>
                                                        )}
                                                    </div>
                                                    <span className="text-[11px] font-black text-slate-800 truncate mb-1 uppercase tracking-tight" title={acc.name}>{acc.name}</span>
                                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                                                        <span className="text-[10px] font-black text-emerald-600 tracking-wider">AED {new Intl.NumberFormat().format(acc.amount || 0)}</span>
                                                        <span className="text-[8px] font-mono text-slate-300 font-bold uppercase">{acc.accessoryId}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
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
                                        <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                                            <div />
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

                                                        {/* Direct Accept - Finalizes if Assigner or Assignee depending on flow but usually Final Accept means Done regardless who clicks it if they have authority.
                                                            Wait, if Assigner clicks Accept after Assignee comment, it should finalize.
                                                            If Assignee clicks Accept, it should finalize.
                                                        */}
                                                        <button
                                                            onClick={() => {
                                                                if (!checkSignature()) return;
                                                                // Direct accept logic
                                                                axiosInstance.put(`/AssetItem/${assetId}/respond`, {
                                                                    action: 'Accept',
                                                                    comments: ''
                                                                }).then(() => {
                                                                    toast({ title: "Success", description: "Asset accepted successfully." });
                                                                    fetchAssetDetails();
                                                                }).catch(e => {
                                                                    toast({ variant: "destructive", title: "Error", description: "Failed to accept asset." });
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

                                                {/* Asset History Toggle */}
                                                <button
                                                    onClick={() => {
                                                        if (activeTab !== 'negotiation') fetchAssetHistory();
                                                        setActiveTab(activeTab === 'negotiation' ? 'document' : 'negotiation');
                                                    }}
                                                    className={`px-6 py-2.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-2 ${activeTab === 'negotiation'
                                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                        }`}
                                                >
                                                    <FileText size={16} /> Asset History
                                                </button>

                                                <button
                                                    onClick={() => setShowHandoverModal(true)}
                                                    className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[11px] font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
                                                >
                                                    <Printer size={16} /> Print Document
                                                </button>
                                                <button
                                                    onClick={() => setShowAssignModal(true)}
                                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[11px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                                                >
                                                    Edit Assignment
                                                </button>
                                            </div>
                                        </div>

                                        {/* Negotiation History & Handover Form */}
                                        <div className="flex-1 p-8 bg-slate-100/30 overflow-y-auto max-h-[800px] scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">

                                            {/* Negotiation History Section - Conditionally Rendered */}
                                            {/* Asset History Section - Conditionally Rendered */}
                                            {activeTab === 'negotiation' ? (
                                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px] flex flex-col">
                                                    <div className="p-4 border-b border-slate-100">
                                                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                            <FileText size={16} className="text-blue-600" /> Asset Lifecycle & History
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
                                                                        <div className="flex-1 pb-2">
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
                                                                                <div className="text-sm text-slate-700 leading-relaxed">
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
                    {showFileModal && selectedFile && (
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
                    )}

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
                    {showResponseModal && (
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
                    )}

                    {/* History Modal */}
                    {showHistoryModal && (
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
                    )}
                </div>
            </div >
        </div >
    );
}
