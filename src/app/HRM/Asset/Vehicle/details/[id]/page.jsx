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
    Wrench,
    RefreshCw,
    Plus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AccessoriesModal from '../../../components/AccessoriesModal';
import AssignAssetModal from '../../../components/AssignAssetModal';
import HandoverFormModal from '../../../components/HandoverFormModal';
import HandoverFormView from '../../../components/HandoverFormView';
import VehicleDocumentModal from '../../components/VehicleDocumentModal';
import VehicleServiceModal from '../../components/VehicleServiceModal';
import VehicleRegistrationModal from '../../components/VehicleRegistrationModal';
import VehicleInsuranceModal from '../../components/VehicleInsuranceModal';
import VehicleWarrantyModal from '../../components/VehicleWarrantyModal';
import VehiclePermitModal from '../../components/VehiclePermitModal';
import AddVehicleFineModal from '@/app/HRM/Fine/components/AddVehicleFineModal';
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

const getAssetApproverDisplayName = (asset) => {
    if (!asset) return '';
    const ar = asset.actionRequiredBy;
    if (ar && typeof ar === 'object') {
        const n = `${ar.firstName || ''} ${ar.lastName || ''}`.trim();
        if (n) return n;
        if (ar.employeeId) return String(ar.employeeId);
    }
    const ac = asset.assetController;
    if (ac && typeof ac === 'object') {
        const n = `${ac.firstName || ''} ${ac.lastName || ''}`.trim();
        if (n) return n;
        if (ac.employeeId) return String(ac.employeeId);
    }
    return '';
};

const clientMatchesCreationApprover = (asset, currentUserEmployeeId, currentUser) => {
    const normEmp = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '');
    const eid = currentUserEmployeeId?.toString();
    const matchesDeptAssetController = () => {
        const acId = asset?.assetControllerId?.toString();
        if (acId && eid && acId === eid && !acId.startsWith('flowchart_')) return true;
        const acEmp = asset?.assetController?.employeeId;
        const myEmp = currentUser?.employeeId;
        return !!(acEmp && myEmp && normEmp(acEmp) === normEmp(myEmp));
    };
    if (!asset?.actionRequiredBy) {
        if (asset?.status === 'Draft' && matchesDeptAssetController()) return true;
        return false;
    }
    const arId = asset.actionRequiredBy?._id?.toString() || asset.actionRequiredBy?.toString();
    if (arId && eid && arId === eid) return true;
    const arEmp = asset.actionRequiredBy?.employeeId;
    const myEmp = currentUser?.employeeId;
    if (arEmp && myEmp && normEmp(arEmp) === normEmp(myEmp)) return true;
    const acId = asset.assetControllerId?.toString();
    if (acId && eid && acId === eid && !acId.startsWith('flowchart_')) return true;
    return false;
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
    const [activeTab, setActiveTab] = useState('basic'); // basic | permit | petrolSalik | service | fine | handover | history | document
    // Registration / Insurance / Warranty are shown as cards (employee profile style).
    const [assetHistory, setAssetHistory] = useState([]);
    const [fines, setFines] = useState([]);
    const [loadingFines, setLoadingFines] = useState(false);
    const [showResponseModal, setShowResponseModal] = useState(false);
    const [responseAction, setResponseAction] = useState(null);
    const [responseComment, setResponseComment] = useState('');
    const [responseFile, setResponseFile] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [showFileModal, setShowFileModal] = useState(false);
    const [hasAssetController, setHasAssetController] = useState(true);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [showRegistrationModal, setShowRegistrationModal] = useState(false);
    const [isRegistrationRenew, setIsRegistrationRenew] = useState(false);
    const [showInsuranceModal, setShowInsuranceModal] = useState(false);
    const [isInsuranceRenew, setIsInsuranceRenew] = useState(false);
    const [showWarrantyModal, setShowWarrantyModal] = useState(false);
    const [isWarrantyRenew, setIsWarrantyRenew] = useState(false);
    const [showPermitModal, setShowPermitModal] = useState(false);
    const [handoverInnerTab, setHandoverInnerTab] = useState('document');
    const [showVehicleFineModal, setShowVehicleFineModal] = useState(false);
    const [documentInnerTab, setDocumentInnerTab] = useState('live');
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        description: '',
        onConfirm: () => { }
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            setCurrentUserEmployeeId(user.employeeObjectId || user._id);
            setCurrentUserId(user._id || user.id);

            const fetchUserDataAndCheckController = async () => {
                try {
                    const [userRes, companyRes] = await Promise.all([
                        axiosInstance.get('/Employee/me'),
                        axiosInstance.get('/company')
                    ]);

                    if (userRes && userRes.data) {
                        setCurrentUser(userRes.data);
                        const actualId = userRes.data._id || userRes.data.id;
                        if (actualId) setCurrentUserEmployeeId(actualId);

                        const companies = companyRes.data.companies || [];

                        const mainCompany = companies.find(c => c.companyId === 'EST-001') || companies[0];
                        const controllerFound = mainCompany?.responsibilities?.some(r =>
                            r.category?.toLowerCase() === 'assetcontroller' && r.status === 'Active'
                        );
                        setHasAssetController(!!controllerFound);
                    }
                } catch (err) {
                    console.error("Failed to fetch user profile or companies:", err);
                    setHasAssetController(false);
                }
            };
            fetchUserDataAndCheckController();
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

    const handleAssetCreationResponse = async (action) => {
        try {
            await axiosInstance.put(`/AssetItem/${assetId}/approve-creation`, { action });
            toast({
                title: action === 'Approve' ? 'Asset Approved' : 'Asset Rejected',
                description: action === 'Approve' ? 'The asset is now active and unassigned.' : 'The asset creation has been rejected.'
            });
            fetchAssetDetails();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.response?.data?.message || 'Failed to process request.'
            });
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
        if (activeTab === 'history' || activeTab === 'handover') fetchAssetHistory();
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

    const latestHandoverDocument = useMemo(() => {
        if (!assetHistory || assetHistory.length === 0) return null;

        const sortedHistory = [...assetHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
        const latestHandover = sortedHistory.find(
            (h) =>
                (h.action === 'Assigned' || h.action === 'Returned' || h.action === 'Unassigned') &&
                h.details &&
                h.details.assetId
        );

        return latestHandover || null;
    }, [assetHistory]);

    const assignedEmployeeForFine = useMemo(() => {
        const assignee = asset?.assignedTo;
        if (assignee && typeof assignee === 'object' && assignee.employeeId) {
            return assignee;
        }
        return null;
    }, [asset]);

    const vehicleFineInitialData = useMemo(() => ({
        vehicleId: asset?._id || asset?.id || '',
        employeeId: assignedEmployeeForFine?.employeeId || '',
        assignedEmployees: assignedEmployeeForFine?.employeeId
            ? [{ employeeId: assignedEmployeeForFine.employeeId }]
            : [],
    }), [asset, assignedEmployeeForFine]);

    const fineModalVehicles = useMemo(() => (
        asset
            ? [{
                _id: asset._id || asset.id,
                name: asset.assetName || asset.name || asset.assetId || 'Vehicle',
                plateNumber: asset.plateNumber || asset.vehicleNumber || '',
            }]
            : []
    ), [asset]);

    const fineModalEmployees = useMemo(() => (
        assignedEmployeeForFine
            ? [{
                employeeId: assignedEmployeeForFine.employeeId,
                firstName: assignedEmployeeForFine.firstName || '',
                lastName: assignedEmployeeForFine.lastName || '',
                company: assignedEmployeeForFine.company || null,
            }]
            : []
    ), [assignedEmployeeForFine]);

    const categorizedVehicleDocuments = useMemo(() => {
        const docs = asset?.documents || [];
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const isOld = (doc) => {
            const status = String(doc?.status || doc?.documentStatus || '').toLowerCase();
            const hasOldStatus = ['expired', 'old', 'renewed', 'archived', 'inactive'].includes(status);
            const explicitRenewed = !!(doc?.isRenewed || doc?.renewedFrom || doc?.renewedAt);
            const expired = doc?.expiryDate ? new Date(doc.expiryDate) < now : false;
            return hasOldStatus || explicitRenewed || expired;
        };

        return {
            live: docs.filter((d) => !isOld(d)),
            old: docs.filter((d) => isOld(d)),
        };
    }, [asset]);

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

    const registrationDoc = asset?.documents?.find(d => (d.type || '').toLowerCase() === 'registration') || null;
    const registrationAttachments = (asset?.documents || []).filter(
        (d) => (d.type || '').toLowerCase() === 'registration attachment'
    );
    let registrationMeta = { fee: null, notes: [] };
    if (registrationDoc?.description) {
        try {
            const parsed = JSON.parse(registrationDoc.description);
            registrationMeta = {
                fee: parsed?.fee ?? null,
                notes: Array.isArray(parsed?.notes) ? parsed.notes.filter((n) => n && n.description) : [],
            };
        } catch {
            registrationMeta = { fee: null, notes: [] };
        }
    }

    const insuranceDoc = asset?.documents?.find(d => (d.type || '').toLowerCase() === 'insurance') || null;
    let insuranceMeta = { policy: '' };
    if (insuranceDoc?.description) {
        try {
            const parsed = JSON.parse(insuranceDoc.description);
            insuranceMeta = { policy: parsed?.policy != null ? String(parsed.policy) : '' };
        } catch {
            insuranceMeta = { policy: '' };
        }
    }

    const warrantyDoc = asset?.documents?.find(d => (d.type || '').toLowerCase() === 'warranty') || null;
    let warrantyMeta = { km: '' };
    if (warrantyDoc?.description) {
        try {
            const parsed = JSON.parse(warrantyDoc.description);
            warrantyMeta = { km: parsed?.km != null ? String(parsed.km) : '' };
        } catch {
            warrantyMeta = { km: '' };
        }
    }

    const hasRegistrationCardData = Boolean(
        registrationDoc?.issueDate ||
        registrationDoc?.expiryDate ||
        registrationDoc?.attachment ||
        registrationMeta?.fee != null ||
        (registrationAttachments && registrationAttachments.length > 0)
    );

    const hasInsuranceCardData = Boolean(
        insuranceDoc?.issueDate ||
        insuranceDoc?.expiryDate ||
        insuranceDoc?.attachment ||
        (insuranceMeta?.policy && String(insuranceMeta.policy).trim())
    );

    const hasWarrantyCardData = Boolean(
        warrantyDoc?.issueDate ||
        warrantyDoc?.expiryDate ||
        warrantyDoc?.attachment ||
        (warrantyMeta?.km && String(warrantyMeta.km).trim())
    );

    const permitDocs = (asset?.documents || []).filter((d) => (d.type || '').toLowerCase() === 'permit');
    const permitCards = permitDocs.map((d) => {
        let meta = { permitType: '', unlimited: false };
        if (d?.description) {
            try {
                const parsed = JSON.parse(d.description);
                meta = {
                    permitType: parsed?.permitType != null ? String(parsed.permitType) : '',
                    unlimited: !!parsed?.unlimited,
                };
            } catch {
                meta = { permitType: '', unlimited: false };
            }
        }
        return { doc: d, meta };
    });

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

                    {/* Missing Asset Controller Warning */}
                    {!hasAssetController && (
                        <div className="mb-6 animate-in slide-in-from-top-4 duration-500">
                            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm flex items-start gap-4 ring-1 ring-amber-500/10">
                                <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
                                    <Shield size={20} className="animate-pulse" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-amber-900 font-bold text-sm">Action Required: No Asset Controller Identified</h3>
                                    <p className="text-amber-800/80 text-xs mt-1 leading-relaxed">
                                        The organization flowchart does not designate an <strong>Asset Controller</strong>.
                                        All management operations (Assign, Documents, Fines) are disabled until a controller is assigned in
                                        <span className="cursor-pointer hover:underline text-amber-600 font-bold ml-1" onClick={() => router.push('/Settings/FlowChart')}>
                                            Settings &gt; Flowchart
                                        </span>.
                                    </p>
                                </div>
                                <button
                                    onClick={() => router.push('/Settings/FlowChart')}
                                    className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 whitespace-nowrap"
                                >
                                    Configure Now
                                </button>
                            </div>
                        </div>
                    )}
                    {/* Header + creation approval (same API as tool assets) */}
                    <div className="flex flex-col gap-4 mb-8">
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => router.back()}
                                className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm text-gray-600 hover:bg-gray-50 transition-all font-bold flex items-center gap-2"
                            >
                                <ArrowLeft size={20} />
                                <span className="text-sm">Back</span>
                            </button>
                        </div>
                        {asset && (() => {
                            const isAssignmentAck =
                                asset.acceptanceStatus === 'Pending' &&
                                !asset.pendingAction &&
                                (asset.status === 'Pending' || asset.status === 'Assigned') &&
                                asset.assignedTo;
                            const awaitingCreation =
                                asset.status === 'Draft' ||
                                (asset.actionRequiredBy != null &&
                                    asset.status === 'Pending' &&
                                    !isAssignmentAck);
                            if (!awaitingCreation) return null;

                            const approverName = getAssetApproverDisplayName(asset);
                            const isAdmin = currentUser?.isAdmin || currentUser?.role === 'Admin' || currentUser?.role === 'ROOT';
                            const serverAllows = asset.canApproveAssetCreation === true || asset.canApproveAssetCreation === 'true';
                            const clientDesignated = clientMatchesCreationApprover(asset, currentUserEmployeeId, currentUser);
                            const showActions = serverAllows || isAdmin || clientDesignated;

                            if (showActions) {
                                return (
                                    <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm">
                                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                            <Plus size={20} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Asset Creation Approval</p>
                                            <p className="text-[13px] font-bold text-amber-900 leading-snug">
                                                {asset.status === 'Draft'
                                                    ? `This asset is in Draft. Approval required${approverName ? ` — ${approverName}` : ''}.`
                                                    : `Awaiting creation approval. ${approverName ? approverName : 'Asset Controller'}.`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleAssetCreationResponse('Approve')}
                                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleAssetCreationResponse('Reject')}
                                                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div className="flex items-center gap-4 px-6 py-4 bg-amber-50/50 border border-amber-100 rounded-2xl">
                                    <RefreshCw size={18} className="text-amber-600 shrink-0" />
                                    <div>
                                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Pending Approval</p>
                                        <p className="text-[13px] font-bold text-amber-900">
                                            Awaiting creation approval{approverName ? ` — ${approverName}` : ''}…
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Payments-style summary cards (intentionally blank) */}
                        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-sm min-h-[220px]" />

                        {/* Card 2: Vehicle Summary Expairies */}
                        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-sm min-h-[220px]" />

                    </div>

                    {/* Bottom Section: Sub Tabs (Employee Profile Style) */}
                    <div className="mt-10 space-y-8">
                        {/* Tab Headers */}
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between border-b border-slate-200 px-2 pb-2">
                            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm font-semibold">
                                {[
                                    { id: 'basic', label: 'Basic Details' },
                                    { id: 'permit', label: 'Permit' },
                                    { id: 'petrolSalik', label: 'Petrol & Salik' },
                                    { id: 'service', label: 'Service' },
                                    { id: 'fine', label: 'Fine' },
                                    { id: 'handover', label: 'Handover' },
                                    { id: 'history', label: 'History' },
                                    { id: 'document', label: 'Document' },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`relative px-1.5 py-2 whitespace-nowrap transition-colors ${activeTab === tab.id
                                            ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:bottom-0 after:w-full after:h-0.5 after:bg-blue-500'
                                            : 'text-gray-400 hover:text-gray-700'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 pb-4">
                                {(activeTab === 'basic' || activeTab === 'handover') && asset.assignedTo && (
                                    <button
                                        type="button"
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

                            </div>
                        </div>

                        {/* Tab Content */}
                        <div className="min-h-[600px]">
                            {activeTab === 'basic' && (
                                <div className="w-full max-w-none space-y-6">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                        <div className="w-full lg:flex-1 min-w-0">
                                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden px-2 py-0">
                                        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
                                            <h3 className="text-base font-bold text-slate-800">Basic Details</h3>
                                            <button
                                                type="button"
                                                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                                                title="Edit"
                                                onClick={() => {
                                                    toast({ title: 'Edit', description: 'Edit UI not configured here yet.' });
                                                }}
                                            >
                                                <PencilLine size={18} />
                                            </button>
                                        </div>

                                        <div className="px-5 pb-4">
                                            {[
                                                { label: 'Asset ID', value: asset.assetId },
                                                { label: 'Name', value: asset.name },
                                                { label: 'Vehicle Code', value: asset.vehicleCode },
                                                { label: 'Plate Number', value: asset.plateNumber },
                                                { label: 'Model Year', value: asset.modelYear },
                                                { label: 'Current KM', value: asset.currentKilometer ? `${Number(asset.currentKilometer).toLocaleString()} KM` : null },
                                                { label: 'Status', value: asset.status },
                                                { label: 'Type', value: asset.typeId?.name || asset.type },
                                                { label: 'Category', value: asset.categoryId?.name || asset.category },
                                                { label: 'Asset Value', value: asset.assetValue ? `AED ${Number(asset.assetValue).toLocaleString()}` : null },
                                                { label: 'Purchase Date', value: asset.purchaseDate ? formatDate(asset.purchaseDate) : null },
                                                { label: 'Invoice Number', value: asset.invoiceNumber || null },
                                                {
                                                    label: 'Invoice Attachment',
                                                    value: asset.invoiceFile ? 'Available' : null,
                                                    href: asset.invoiceFile || null,
                                                },
                                            ]
                                                .filter((row) => {
                                                    const hasHref = !!row.href;
                                                    const hasValue =
                                                        row.value !== null &&
                                                        row.value !== undefined &&
                                                        String(row.value).trim() !== '';
                                                    return hasHref || hasValue;
                                                })
                                                .map((row, idx, arr) => (
                                                <div
                                                    key={row.label}
                                                    className={`flex items-center justify-between py-3 ${idx !== arr.length - 1 ? 'border-b border-slate-100' : ''}`}
                                                >
                                                    <span className="text-[13px] text-slate-500">{row.label}</span>
                                                    <span className="text-[13px] font-semibold text-slate-700 max-w-[60%] text-right break-words">
                                                        {row.href ? (
                                                            <a
                                                                href={row.href}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1"
                                                            >
                                                                <Eye size={14} /> View
                                                            </a>
                                                        ) : (
                                                            row.value || <span className="text-slate-300 font-semibold">—</span>
                                                        )}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Employee profile style: show cards (not under buttons) */}
                                        </div>

                                        <div className="w-full lg:flex-1 min-w-0">
                                            {/* Registration card */}
                                            {hasRegistrationCardData && (
                                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
                                                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                    <h3 className="text-xl font-semibold text-gray-800">Registration</h3>
                                                    <div className="flex items-center gap-3">
                                                        {!!registrationDoc?.attachment && (
                                                            <button
                                                                type="button"
                                                                onClick={() => { setSelectedFile(registrationDoc.attachment); setShowFileModal(true); }}
                                                                className="text-emerald-600 hover:text-emerald-700 transition-colors"
                                                                title="View registration card"
                                                            >
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                    <polyline points="7 10 12 15 17 10"></polyline>
                                                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                                                </svg>
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => { setIsRegistrationRenew(true); setShowRegistrationModal(true); }}
                                                            className="text-orange-600 hover:text-orange-700 transition-colors"
                                                            title="Renew (new registration)"
                                                        >
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
                                                                <path d="M21 3v5h-5"></path>
                                                            </svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setIsRegistrationRenew(false); setShowRegistrationModal(true); }}
                                                            className="text-blue-600 hover:text-blue-700 transition-colors"
                                                            title="Edit"
                                                        >
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div>
                                                    {[
                                                        { label: 'Registration date', value: registrationDoc?.issueDate ? formatDate(registrationDoc.issueDate) : null },
                                                        {
                                                            label: 'Expiry date',
                                                            value: (registrationDoc?.expiryDate || asset?.registrationExpiryDate)
                                                                ? formatDate(registrationDoc?.expiryDate || asset?.registrationExpiryDate)
                                                                : null
                                                        },
                                                        {
                                                            label: 'Registration fee',
                                                            value: registrationMeta.fee != null ? `AED ${Number(registrationMeta.fee).toLocaleString()}` : null
                                                        },
                                                    ].map((row, index, arr) => (
                                                        <div
                                                            key={row.label}
                                                            className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                        >
                                                            <span className="text-gray-500">{row.label}</span>
                                                            <span className="text-gray-500">{row.value || '—'}</span>
                                                        </div>
                                                    ))}

                                                    {/* Extra attachment rows (description + download) */}
                                                    {registrationAttachments.length > 0 && (
                                                        <div className="px-6 py-4 border-t border-gray-100">
                                                            <p className="text-xs font-semibold text-gray-500 mb-2">Attachments</p>
                                                            <div className="space-y-2">
                                                                {registrationAttachments.map((doc) => (
                                                                    <div key={doc._id} className="flex items-center justify-between gap-3">
                                                                        <span className="text-sm text-gray-600 flex-1 min-w-0 truncate">
                                                                            {doc.description || 'Attachment'}
                                                                        </span>
                                                                        {doc.attachment ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => { setSelectedFile(doc.attachment); setShowFileModal(true); }}
                                                                                className="text-emerald-600 hover:text-emerald-700 transition-colors"
                                                                                title="View attachment"
                                                                            >
                                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                                    <polyline points="7 10 12 15 17 10"></polyline>
                                                                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                                                                </svg>
                                                                            </button>
                                                                        ) : (
                                                                            <span className="text-gray-300">—</span>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            )}

                                        </div>

                                        {/* Insurance card */}
                                        {hasInsuranceCardData && (
                                        <div className="w-full min-w-0">
                                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
                                                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                    <h3 className="text-xl font-semibold text-gray-800">Insurance</h3>
                                                    <div className="flex items-center gap-3">
                                                        {!!insuranceDoc?.attachment && (
                                                            <button
                                                                type="button"
                                                                onClick={() => { setSelectedFile(insuranceDoc.attachment); setShowFileModal(true); }}
                                                                className="text-emerald-600 hover:text-emerald-700 transition-colors"
                                                                title="Download / View invoice"
                                                            >
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                    <polyline points="7 10 12 15 17 10"></polyline>
                                                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                                                </svg>
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => { setIsInsuranceRenew(true); setShowInsuranceModal(true); }}
                                                            className="text-orange-600 hover:text-orange-700 transition-colors"
                                                            title="Renew Insurance (empty)"
                                                        >
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
                                                                <path d="M21 3v5h-5"></path>
                                                            </svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setIsInsuranceRenew(false); setShowInsuranceModal(true); }}
                                                            className="text-blue-600 hover:text-blue-700 transition-colors"
                                                            title="Edit Insurance"
                                                        >
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div>
                                                    {[
                                                        { label: 'Start date', value: insuranceDoc?.issueDate ? formatDate(insuranceDoc.issueDate) : null },
                                                        { label: 'Expiry date', value: insuranceDoc?.expiryDate ? formatDate(insuranceDoc.expiryDate) : null },
                                                        { label: 'Insurance policy', value: insuranceMeta?.policy ? insuranceMeta.policy : null },
                                                        { label: 'Invoice', value: insuranceDoc?.attachment ? 'Available' : null },
                                                    ].map((row, index, arr) => (
                                                        <div
                                                            key={row.label}
                                                            className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                        >
                                                            <span className="text-gray-500">{row.label}</span>
                                                            <span className="text-gray-500">{row.value || '—'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        )}

                                        {/* Warranty card */}
                                        {hasWarrantyCardData && (
                                        <div className="w-full min-w-0">
                                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
                                                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                    <h3 className="text-xl font-semibold text-gray-800">Warranty</h3>
                                                    <div className="flex items-center gap-3">
                                                        {!!warrantyDoc?.attachment && (
                                                            <button
                                                                type="button"
                                                                onClick={() => { setSelectedFile(warrantyDoc.attachment); setShowFileModal(true); }}
                                                                className="text-emerald-600 hover:text-emerald-700 transition-colors"
                                                                title="Download / View certificate"
                                                            >
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                    <polyline points="7 10 12 15 17 10"></polyline>
                                                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                                                </svg>
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => { setIsWarrantyRenew(true); setShowWarrantyModal(true); }}
                                                            className="text-orange-600 hover:text-orange-700 transition-colors"
                                                            title="Renew Warranty (empty)"
                                                        >
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
                                                                <path d="M21 3v5h-5"></path>
                                                            </svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setIsWarrantyRenew(false); setShowWarrantyModal(true); }}
                                                            className="text-blue-600 hover:text-blue-700 transition-colors"
                                                            title="Edit Warranty"
                                                        >
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div>
                                                    {[
                                                        { label: 'Start date', value: warrantyDoc?.issueDate ? formatDate(warrantyDoc.issueDate) : null },
                                                        { label: 'KM', value: warrantyMeta?.km ? `${warrantyMeta.km} KM` : null },
                                                        { label: 'End date', value: warrantyDoc?.expiryDate ? formatDate(warrantyDoc.expiryDate) : null },
                                                        { label: 'Certificate', value: warrantyDoc?.attachment ? 'Available' : null },
                                                    ].map((row, index, arr) => (
                                                        <div
                                                            key={row.label}
                                                            className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                        >
                                                            <span className="text-gray-500">{row.label}</span>
                                                            <span className="text-gray-500">{row.value || '—'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        )}
                                    </div>

                                    {/* Green action buttons under the cards */}
                                    <div className="flex flex-wrap gap-3">
                                        {!hasRegistrationCardData && (
                                            <button
                                                type="button"
                                                onClick={() => { setIsRegistrationRenew(false); setShowRegistrationModal(true); }}
                                                className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-sm flex items-center gap-2"
                                            >
                                                Registration
                                            </button>
                                        )}
                                        {!hasInsuranceCardData && (
                                            <button
                                                type="button"
                                                onClick={() => { setIsInsuranceRenew(false); setShowInsuranceModal(true); }}
                                                className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-sm flex items-center gap-2"
                                            >
                                                Insurance
                                            </button>
                                        )}
                                        {!hasWarrantyCardData && (
                                            <button
                                                type="button"
                                                onClick={() => { setIsWarrantyRenew(false); setShowWarrantyModal(true); }}
                                                className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-sm flex items-center gap-2"
                                            >
                                                Warranty
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'permit' && (
                                <div className="max-w-6xl mx-auto px-2 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Permit</h3>
                                        <button
                                            type="button"
                                            onClick={() => setShowPermitModal(true)}
                                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                                        >
                                            <PlusCircle size={14} /> Add Permit
                                        </button>
                                    </div>

                                    {permitCards.length === 0 ? (
                                        <div className="bg-slate-50/50 rounded-[32px] border-2 border-dashed border-slate-100 py-16 flex flex-col items-center justify-center text-center px-6">
                                            <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center text-slate-200 mb-6 shadow-sm">
                                                <PenTool size={32} />
                                            </div>
                                            <h5 className="text-sm font-black text-slate-400 uppercase tracking-[.25em] mb-2">No Permits</h5>
                                            <p className="text-[10px] text-slate-300 font-medium max-w-sm">Click “Add Permit” to create the first permit record.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {permitCards.map(({ doc, meta }, idx) => (
                                                <div key={doc._id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                                        <h4 className="text-lg font-semibold text-gray-800">Permit {idx + 1}</h4>
                                                    </div>
                                                    <div>
                                                        {[
                                                            { label: 'Permit type', value: meta.permitType || null },
                                                            { label: 'Start date', value: doc.issueDate ? formatDate(doc.issueDate) : null },
                                                            {
                                                                label: 'End date',
                                                                value: meta.unlimited ? 'Unlimited' : (doc.expiryDate ? formatDate(doc.expiryDate) : null),
                                                            },
                                                        ].map((row, rowIndex, arr) => (
                                                            <div
                                                                key={row.label}
                                                                className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${rowIndex !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                            >
                                                                <span className="text-gray-500">{row.label}</span>
                                                                <span className="text-gray-500">{row.value || '—'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'petrolSalik' && (
                                <div className="max-w-4xl mx-auto px-2 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-sm">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Odometer (reference)</div>
                                            <div className="mt-2 text-lg font-black text-slate-800">
                                                {asset.currentKilometer != null && asset.currentKilometer !== ''
                                                    ? `${Number(asset.currentKilometer).toLocaleString()} KM`
                                                    : <span className="text-slate-300">—</span>}
                                            </div>
                                        </div>
                                        <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col justify-center">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Petrol & Salik</div>
                                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                                Fuel allowances and Salik / toll tracking are not wired to this screen yet. Use Service or Document tabs for related records in the meantime.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'fine' && (
                                <div className="max-w-6xl mx-auto px-2">
                                    <div className="flex justify-end mb-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowVehicleFineModal(true)}
                                            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                                        >
                                            <Plus size={14} />
                                            Add Fine
                                        </button>
                                    </div>
                                    {loadingFines ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Loading fines...</p>
                                        </div>
                                    ) : fines.length === 0 ? (
                                        <div className="bg-slate-50/50 rounded-[32px] border-2 border-dashed border-slate-100 py-20 flex flex-col items-center justify-center text-center px-6 mt-2">
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
                                                        <tr
                                                            key={fine._id}
                                                            className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                                            onClick={() => router.push(`/HRM/Fine/details/${fine._id}`)}
                                                        >
                                                            <td className="px-6 py-4 text-sm font-bold text-blue-600">{fine.fineId || '—'}</td>
                                                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{fine.fineType || '—'}</td>
                                                            <td className="px-6 py-4 text-sm text-slate-600">{fine.assignedEmployees?.[0]?.employeeName || fine.employeeName || '—'}</td>
                                                            <td className="px-6 py-4 text-sm font-black text-rose-600">AED {Number(fine.fineAmount || 0).toLocaleString()}</td>
                                                            <td className="px-6 py-4 text-sm text-slate-600">{fine.awardedDate ? new Date(fine.awardedDate).toLocaleDateString() : '—'}</td>
                                                            <td className="px-6 py-4">
                                                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                                                                    {fine.fineStatus || '—'}
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

                            {activeTab === 'handover' && (
                                <div className="max-w-6xl mx-auto px-2 space-y-5">
                                    <div className="flex flex-wrap items-center gap-3 p-2 bg-slate-100/60 rounded-2xl border border-slate-100">
                                        {[
                                            { id: 'document', label: 'Document' },
                                            { id: 'accessories', label: 'Accessories' },
                                            { id: 'images', label: 'Images' },
                                        ].map((t) => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setHandoverInnerTab(t.id)}
                                                className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${handoverInnerTab === t.id
                                                    ? 'bg-white text-blue-600 border border-slate-200 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>

                                    {handoverInnerTab === 'document' && (
                                        <div className="flex justify-center p-4 bg-slate-100/30 rounded-2xl border border-slate-100 min-h-[400px]">
                                            {(asset.assignedTo ||
                                                (String(asset.assignedToType || '').toLowerCase() === 'company' && asset.assignedCompany) ||
                                                asset.status === 'Service') ? (
                                                <HandoverFormView asset={asset} isPrint={false} />
                                            ) : (asset.status === 'Draft' ||
                                                (!asset.assignedTo &&
                                                    !(String(asset.assignedToType || '').toLowerCase() === 'company' && asset.assignedCompany))) &&
                                              latestHandoverDocument ? (
                                                <div className="w-full flex flex-col items-center">
                                                    <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                                                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest text-center">
                                                            Latest Handover Document ({new Date(latestHandoverDocument.date).toLocaleDateString()})
                                                        </p>
                                                    </div>
                                                    <HandoverFormView
                                                        asset={latestHandoverDocument.details}
                                                        isPrint={false}
                                                        overrideDate={latestHandoverDocument.date}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 bg-white border border-slate-100 rounded-xl">
                                                    <FileText size={48} className="mb-4 opacity-20" />
                                                    <h3 className="text-[12px] font-bold uppercase tracking-widest text-slate-500">Document unavailable</h3>
                                                    <p className="text-[11px] font-medium mt-2 text-center max-w-sm">
                                                        No handover document found in asset history.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {handoverInnerTab === 'accessories' && (
                                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Accessories</h4>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAccessoriesModal(true)}
                                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest"
                                                >
                                                    Add Accessory
                                                </button>
                                            </div>
                                            <div className="p-5 space-y-3">
                                                {(asset.accessories || []).length === 0 ? (
                                                    <p className="text-sm text-slate-400">No accessories found.</p>
                                                ) : (
                                                    asset.accessories.map((acc, idx) => (
                                                        <div key={acc._id || idx} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/40">
                                                            <span className="text-sm font-semibold text-slate-700">{acc.name || 'Accessory'}</span>
                                                            <span className="text-xs text-slate-500">{acc.status || 'Attached'}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {handoverInnerTab === 'images' && (
                                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                            <div className="p-5 border-b border-slate-100">
                                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Images</h4>
                                            </div>
                                            <div className="p-5">
                                                {(() => {
                                                    const allImages = [
                                                        ...(asset.assetPhoto ? [{ _id: '__main__', url: asset.assetPhoto }] : []),
                                                        ...(asset.images || []),
                                                    ];
                                                    if (!allImages.length) return <p className="text-sm text-slate-400">No images uploaded.</p>;
                                                    return (
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                            {allImages.map((img) => (
                                                                <img
                                                                    key={img._id}
                                                                    src={img.url}
                                                                    alt="Asset"
                                                                    className="w-full h-28 object-cover rounded-xl border border-slate-100 cursor-pointer"
                                                                    onClick={() => window.open(img.url, '_blank')}
                                                                />
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'document' && (
                                <div className="max-w-full mx-auto space-y-6 px-2">
                                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
                                        <div className="flex flex-col gap-6">
                                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                                <h3 className="text-xl font-semibold text-gray-800">Documents</h3>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                    onClick={() => { setSelectedDocType('Mulkia'); setSelectedDoc(null); setShowDocModal(true); }}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                                                >
                                                    <Plus size={16} /> Add Memo & Document
                                                </button>
                                                <button
                                                    onClick={() => { setSelectedDocType('Insurance'); setSelectedDoc(null); setShowDocModal(true); }}
                                                    className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                                                >
                                                    <Plus size={16} /> MOA
                                                </button>
                                                <button
                                                    onClick={() => { setSelectedDocType('Other'); setSelectedDoc(null); setShowDocModal(true); }}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                                                >
                                                    <Plus size={16} /> Document (Expiry)
                                                </button>
                                                <button
                                                    onClick={() => { setSelectedDocType('Other'); setSelectedDoc(null); setShowDocModal(true); }}
                                                    className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                                                >
                                                    <Plus size={16} /> Document (No Expiry)
                                                </button>
                                            </div>
                                        </div>

                                            <div className="flex items-center gap-6 border-b border-gray-100">
                                                <button
                                                    type="button"
                                                    onClick={() => setDocumentInnerTab('live')}
                                                    className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all relative ${documentInnerTab === 'live'
                                                        ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                                                        : 'text-gray-400 hover:text-gray-600'
                                                        }`}
                                                >
                                                    Live Documents
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDocumentInnerTab('old')}
                                                    className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all relative ${documentInnerTab === 'old'
                                                        ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                                                        : 'text-gray-400 hover:text-gray-600'
                                                        }`}
                                                >
                                                    Old Documents
                                                </button>
                                            </div>
                                        </div>

                                        {(() => {
                                            const rows = documentInnerTab === 'old'
                                                ? categorizedVehicleDocuments.old
                                                : categorizedVehicleDocuments.live;

                                            if (!rows.length) {
                                                return (
                                                    <div className="py-16 flex flex-col items-center justify-center text-center px-6">
                                                        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200 mb-4">
                                                            <FileText size={28} />
                                                        </div>
                                                        <p className="text-sm font-bold text-slate-400">No documents in this category</p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="mt-4">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
                                                        <h4 className="text-lg font-bold text-gray-800">Basic Details</h4>
                                                    </div>
                                                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                    <table className="w-full min-w-[980px]">
                                                        <thead className="bg-gray-50/50 border-b border-gray-100">
                                                            <tr>
                                                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Document Type</th>
                                                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Start/Issue Date</th>
                                                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Expiry Date</th>
                                                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Value</th>
                                                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Attachment</th>
                                                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {rows.map((doc, idx) => (
                                                                <tr key={doc._id || idx} className="hover:bg-blue-50/30 transition-colors group">
                                                                    <td className="px-6 py-4 text-sm font-semibold text-gray-700">{doc.type || 'Document'}</td>
                                                                    <td className="px-6 py-4 text-sm text-gray-600">{doc.issueDate ? formatDate(doc.issueDate) : '-'}</td>
                                                                    <td className="px-6 py-4 text-sm text-gray-600">{doc.expiryDate ? formatDate(doc.expiryDate) : '-'}</td>
                                                                    <td className="px-6 py-4 text-sm text-gray-600">{doc.value ?? '-'}</td>
                                                                    <td className="px-6 py-4 text-sm">
                                                                        {doc.attachment ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => { setSelectedFile(doc.attachment); setShowFileModal(true); }}
                                                                                className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
                                                                            >
                                                                                <Download size={14} /> View
                                                                            </button>
                                                                        ) : (
                                                                            <span className="text-slate-300">-</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        <div className="flex items-center gap-3">
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
                                                                            <button
                                                                                className="text-rose-400 hover:text-rose-500 transition-colors"
                                                                                title="Delete"
                                                                                onClick={() => setDocToDelete(doc)}
                                                                            >
                                                                                <XCircle size={16} />
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'service' && (
                                <div className="max-w-5xl mx-auto">
                                    <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                        <div className="flex flex-wrap gap-3">
                                            {['Oil Service', 'Tire Change', 'Mechanical Work', 'Body Work', 'Accidental Repair'].map((label) => (
                                                <button
                                                    key={label}
                                                    type="button"
                                                    onClick={() => setShowServiceModal(true)}
                                                    className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-sm"
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'history' && (
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

            <VehicleRegistrationModal
                isOpen={showRegistrationModal}
                onClose={() => { setShowRegistrationModal(false); setIsRegistrationRenew(false); }}
                onSuccess={refreshData}
                assetId={assetId}
                existingDoc={registrationDoc}
                existingAttachmentRows={registrationAttachments}
                isRenew={isRegistrationRenew}
            />

            <VehicleInsuranceModal
                isOpen={showInsuranceModal}
                onClose={() => { setShowInsuranceModal(false); setIsInsuranceRenew(false); }}
                onSuccess={refreshData}
                assetId={assetId}
                existingDoc={insuranceDoc}
                isRenew={isInsuranceRenew}
            />

            <VehicleWarrantyModal
                isOpen={showWarrantyModal}
                onClose={() => { setShowWarrantyModal(false); setIsWarrantyRenew(false); }}
                onSuccess={refreshData}
                assetId={assetId}
                existingDoc={warrantyDoc}
                isRenew={isWarrantyRenew}
            />

            <VehiclePermitModal
                isOpen={showPermitModal}
                onClose={() => setShowPermitModal(false)}
                onSuccess={refreshData}
                assetId={assetId}
            />

            <AddVehicleFineModal
                isOpen={showVehicleFineModal}
                onClose={() => setShowVehicleFineModal(false)}
                onSuccess={() => {
                    fetchFines();
                    setShowVehicleFineModal(false);
                }}
                employees={fineModalEmployees}
                vehicles={fineModalVehicles}
                initialData={vehicleFineInitialData}
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
