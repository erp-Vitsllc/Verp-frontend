'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
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
    Plus,
    Bell
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AccessoriesModal from '../../../components/AccessoriesModal';
import AssignAssetModal from '../../../components/AssignAssetModal';
import HandoverFormModal from '../../../components/HandoverFormModal';
import HandoverFormView from '../../../components/HandoverFormView';
import VehicleDocumentModal from '../../components/VehicleDocumentModal';
import VehicleServiceModal from '../../components/VehicleServiceModal';
import AddVehicleModal from '../../components/AddVehicleModal';
import VehicleServiceDetailModal from '../../components/VehicleServiceDetailModal';
import {
    parseVehicleServiceRemark,
    formatNextChangeMonthDisplay,
    VEHICLE_SERVICE_TYPES,
} from '../../components/vehicleServiceUtils';
import VehicleRegistrationModal from '../../components/VehicleRegistrationModal';
import VehicleInsuranceModal from '../../components/VehicleInsuranceModal';
import VehicleWarrantyModal from '../../components/VehicleWarrantyModal';
import VehiclePermitModal from '../../components/VehiclePermitModal';
import VehicleAssetHistoryTab from '../../components/VehicleAssetHistoryTab';
import VehicleServiceWorkflowCards from '../../components/VehicleServiceWorkflowCards';
import { vehicleAssetStatusBadgeClass } from '../../components/vehicleAssetStatusUi';
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

/** Service records with date before this window appear under Old Documents on the Documents tab. */
const SERVICE_RECORD_OLD_THRESHOLD_DAYS = 365;

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

/**
 * Which `services[]` rows drive the Service tab cards / document service tables for "current" display.
 * The workflow line stays in Mongo for audit; we only change whether it counts as the latest card row.
 *
 * - HR / Accounts (pending_hr, pending_accounts): hide workflow line → Add … button stays (approval not on card yet).
 * - After Accounts (pending_admin, pending_management): show workflow line → card appears, Add hidden; vehicle often On Service.
 * - Management done (complete) or rejected: hide workflow line again → status restored, card gone, Add returns.
 */
function servicesForWorkflowCardDisplay(asset) {
    const wf = asset?.activeServiceWorkflow;
    const list = asset?.services || [];
    if (!wf?.serviceRecordId) return list;
    const rid = String(wf.serviceRecordId);
    const st = wf.stage;

    const hideWorkflowLineFromCard =
        st === 'complete' ||
        st === 'rejected' ||
        st === 'pending_hr' ||
        st === 'pending_accounts';

    if (!hideWorkflowLineFromCard) return list;
    return list.filter((s) => String(s._id) !== rid);
}

export default function VehicleDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
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
    const [selectedServiceType, setSelectedServiceType] = useState('');
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
    const [serviceDetailModal, setServiceDetailModal] = useState({
        open: false,
        srv: null,
        type: '',
        previous: null,
    });
    const [documentInnerTab, setDocumentInnerTab] = useState('live');
    const [docTabRegistrationOverride, setDocTabRegistrationOverride] = useState(null);
    const [docTabInsuranceDoc, setDocTabInsuranceDoc] = useState(null);
    const [docTabWarrantyDoc, setDocTabWarrantyDoc] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        description: '',
        onConfirm: () => { }
    });
    const [editVehicleModalOpen, setEditVehicleModalOpen] = useState(false);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'service') setActiveTab('service');
    }, [searchParams]);

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

    const handleSubmitDraftForApproval = async () => {
        try {
            await axiosInstance.put(`/AssetItem/${assetId}/submit-creation`);
            toast({
                title: 'Submitted',
                description: 'The Asset Controller has been notified (email, dashboard, and inbox).'
            });
            fetchAssetDetails();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.response?.data?.message || 'Failed to submit for approval.'
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

    const serviceHistoryIndex = useMemo(() => {
        const svcList = servicesForWorkflowCardDisplay(asset);
        const latestByType = {};
        [...svcList]
            .slice()
            .reverse()
            .forEach((srv) => {
                const t = srv?.serviceType;
                if (!t || latestByType[t]) return;
                latestByType[t] = srv;
            });
        const previousByType = {};
        [...svcList]
            .slice()
            .reverse()
            .forEach((srv) => {
                const t = srv?.serviceType;
                if (!t) return;
                if (!latestByType[t]) return;
                if (String(latestByType[t]?._id || '') === String(srv?._id || '')) return;
                if (!previousByType[t]) previousByType[t] = srv;
            });
        const existingCards = VEHICLE_SERVICE_TYPES.filter((t) => latestByType[t]).map((t) => ({
            type: t,
            srv: latestByType[t],
        }));
        const missingButtons = VEHICLE_SERVICE_TYPES.filter((t) => !latestByType[t]);
        return { latestByType, previousByType, existingCards, missingButtons };
    }, [asset?.services, asset?.activeServiceWorkflow]);

    const assignedEmployeeForFine = useMemo(() => {
        const assignee = asset?.assignedTo;
        if (assignee && typeof assignee === 'object' && assignee.employeeId) {
            return assignee;
        }
        return null;
    }, [asset]);

    const isCreatorUser = useMemo(() => {
        if (!asset || !currentUserId) return false;
        const cb = asset.createdBy?._id?.toString() || asset.createdBy?.toString();
        return cb === currentUserId;
    }, [asset, currentUserId]);

    const creatorCannotEditSubmittedAsset = useMemo(() => {
        if (!asset || !currentUserId) return false;
        if (currentUser?.isAdmin || currentUser?.role === 'Admin' || currentUser?.role === 'ROOT') return false;
        if (String(asset.status || '').toLowerCase().trim() !== 'submitted for approval') return false;
        return isCreatorUser;
    }, [asset, currentUserId, currentUser, isCreatorUser]);

    useEffect(() => {
        if (creatorCannotEditSubmittedAsset && editVehicleModalOpen) setEditVehicleModalOpen(false);
    }, [creatorCannotEditSubmittedAsset, editVehicleModalOpen]);

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

    const isVehicleDocumentOld = (doc) => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const status = String(doc?.status || doc?.documentStatus || '').toLowerCase();
        const hasOldStatus = ['expired', 'old', 'renewed', 'archived', 'inactive'].includes(status);
        const explicitRenewed = !!(doc?.isRenewed || doc?.renewedFrom || doc?.renewedAt);
        const expired = doc?.expiryDate ? new Date(doc.expiryDate) < now : false;
        return hasOldStatus || explicitRenewed || expired;
    };

    const vehicleDocumentLifecycleBuckets = useMemo(() => {
        const docs = asset?.documents || [];
        const normType = (t) => String(t || '').toLowerCase().trim();

        const bucketize = (list) => {
            const basic = [];
            const registration = [];
            const insurance = [];
            const warranty = [];
            const permit = [];
            for (const d of list) {
                const t = normType(d.type);
                if (t === 'registration' || t === 'registration attachment') registration.push(d);
                else if (t === 'insurance') insurance.push(d);
                else if (t === 'warranty') warranty.push(d);
                else if (t === 'permit') permit.push(d);
                else basic.push(d);
            }
            const regSort = (a, b) => {
                const ta = a.issueDate ? new Date(a.issueDate).getTime() : 0;
                const tb = b.issueDate ? new Date(b.issueDate).getTime() : 0;
                if (tb !== ta) return tb - ta;
                const ma = normType(a.type) === 'registration' ? 0 : 1;
                const mb = normType(b.type) === 'registration' ? 0 : 1;
                return ma - mb;
            };
            registration.sort(regSort);
            insurance.sort((a, b) => {
                const ta = a.issueDate ? new Date(a.issueDate).getTime() : 0;
                const tb = b.issueDate ? new Date(b.issueDate).getTime() : 0;
                return tb - ta;
            });
            warranty.sort((a, b) => {
                const ta = a.issueDate ? new Date(a.issueDate).getTime() : 0;
                const tb = b.issueDate ? new Date(b.issueDate).getTime() : 0;
                return tb - ta;
            });
            permit.sort((a, b) => {
                const ta = a.issueDate ? new Date(a.issueDate).getTime() : 0;
                const tb = b.issueDate ? new Date(b.issueDate).getTime() : 0;
                return tb - ta;
            });
            basic.sort((a, b) => {
                const ta = a.issueDate ? new Date(a.issueDate).getTime() : 0;
                const tb = b.issueDate ? new Date(b.issueDate).getTime() : 0;
                return tb - ta;
            });
            return { basic, registration, insurance, warranty, permit };
        };

        const live = docs.filter((d) => !isVehicleDocumentOld(d));
        const old = docs.filter((d) => isVehicleDocumentOld(d));

        const isServiceRecordOld = (srv) => {
            if (!srv?.date) return false;
            const d = new Date(srv.date);
            d.setHours(0, 0, 0, 0);
            const cutoff = new Date();
            cutoff.setHours(0, 0, 0, 0);
            cutoff.setDate(cutoff.getDate() - SERVICE_RECORD_OLD_THRESHOLD_DAYS);
            return d < cutoff;
        };

        const groupServicesByType = (list) => {
            const out = {};
            for (const t of VEHICLE_SERVICE_TYPES) out[t] = [];
            for (const s of list || []) {
                if (out[s.serviceType]) out[s.serviceType].push(s);
            }
            for (const t of VEHICLE_SERVICE_TYPES) {
                out[t].sort((a, b) => {
                    const da = a.date ? new Date(a.date).getTime() : 0;
                    const db = b.date ? new Date(b.date).getTime() : 0;
                    return db - da;
                });
            }
            return out;
        };

        const allServices = servicesForWorkflowCardDisplay(asset);
        const liveServices = allServices.filter((s) => !isServiceRecordOld(s));
        const oldServices = allServices.filter((s) => isServiceRecordOld(s));

        return {
            live: { ...bucketize(live), servicesByType: groupServicesByType(liveServices) },
            old: { ...bucketize(old), servicesByType: groupServicesByType(oldServices) },
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

    const formatTableDate = (date) => (date ? formatDate(date) : '-');

    const parseVehicleDocDescription = (doc) => {
        if (!doc?.description) return {};
        try {
            return JSON.parse(doc.description);
        } catch {
            return {};
        }
    };

    const normDocType = (t) => String(t || '').toLowerCase().trim();

    const registrationAttachmentsForDoc = (mainDoc, list) => {
        if (!mainDoc || normDocType(mainDoc.type) !== 'registration') return [];
        return (list || []).filter((d) => {
            if (normDocType(d.type) !== 'registration attachment') return false;
            const sameIssue = String(d.issueDate || '') === String(mainDoc.issueDate || '');
            const sameExpiry = String(d.expiryDate || '') === String(mainDoc.expiryDate || '');
            return sameIssue && sameExpiry;
        });
    };

    const clearDocTabModalContext = () => {
        setDocTabRegistrationOverride(null);
        setDocTabInsuranceDoc(null);
        setDocTabWarrantyDoc(null);
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
                    {/* Header + creation approval (aligned with main asset detail page) */}
                    <div className="flex flex-col gap-4 mb-8">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => router.back()}
                                    className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm text-gray-600 hover:bg-gray-50 transition-all font-bold flex items-center gap-2"
                                >
                                    <ArrowLeft size={20} />
                                    <span className="text-sm">Back</span>
                                </button>
                                {asset &&
                                isCreatorUser &&
                                ((asset.status === 'Draft' && !asset.actionRequiredBy) || asset.status === 'Rejected') ? (
                                    <button
                                        type="button"
                                        onClick={() => setEditVehicleModalOpen(true)}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-bold shadow-sm hover:bg-slate-50"
                                    >
                                        <PencilLine size={16} />
                                        Edit vehicle
                                    </button>
                                ) : null}
                            </div>
                            {asset?.activeServiceWorkflow?.stage &&
                                !['complete', 'rejected'].includes(asset.activeServiceWorkflow.stage) && (
                                    <div
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold"
                                        title="Service workflow in progress — HR, Accounts, and Management may have inbox items."
                                    >
                                        <Bell size={18} className="text-amber-600 shrink-0" />
                                        Service workflow active
                                    </div>
                                )}
                        </div>
                        {asset && (() => {
                            const isCreatorForBanner =
                                asset?.createdBy?._id?.toString() === currentUserId ||
                                asset?.createdBy?.toString() === currentUserId;
                            const isAssignmentAcknowledgmentCase =
                                asset?.acceptanceStatus === 'Pending' &&
                                !asset?.pendingAction &&
                                (asset?.status === 'Pending' || asset?.status === 'Assigned') &&
                                (asset?.assignedTo || asset?.assignedCompany);

                            const isSaveOnlyDraft = asset?.status === 'Draft' && !asset?.actionRequiredBy;
                            const isAwaitingCreationApprovalUi =
                                asset?.status === 'Submitted for Approval' ||
                                (!isSaveOnlyDraft &&
                                    asset?.status === 'Draft' &&
                                    asset?.actionRequiredBy) ||
                                (asset?.actionRequiredBy != null &&
                                    asset?.status === 'Pending' &&
                                    !isAssignmentAcknowledgmentCase &&
                                    !asset?.pendingAction);

                            if (isSaveOnlyDraft && isCreatorForBanner) {
                                return (
                                    <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
                                        <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                                            <Plus size={20} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Draft</p>
                                            <p className="text-[13px] font-bold text-slate-900 leading-snug">
                                                Saved as draft — not sent to Asset Controller yet. Use <strong>Submit for approval</strong> when
                                                ready (notifies AC: email, dashboard, inbox).
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleSubmitDraftForApproval()}
                                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shrink-0"
                                        >
                                            Submit for approval
                                        </button>
                                    </div>
                                );
                            }

                            if (asset?.status === 'Rejected' && isCreatorForBanner) {
                                return (
                                    <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-rose-50 border border-rose-200 rounded-2xl shadow-sm">
                                        <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                                            <AlertCircle size={20} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-black text-rose-600 uppercase tracking-widest leading-none mb-1">Creation rejected</p>
                                            <p className="text-[13px] font-bold text-rose-950 leading-snug">
                                                Update the vehicle if needed, then submit again for Asset Controller review.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleSubmitDraftForApproval()}
                                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shrink-0"
                                        >
                                            Resubmit for approval
                                        </button>
                                    </div>
                                );
                            }

                            if (!isAwaitingCreationApprovalUi) return null;

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
                                                {asset?.status === 'Submitted for Approval'
                                                    ? `Submitted for approval — awaiting Asset Controller${approverName ? ` (${approverName})` : ''}.`
                                                    : asset?.status === 'Draft'
                                                      ? `Draft pending review${approverName ? ` — ${approverName}` : ''}.`
                                                      : `Awaiting creation approval${approverName ? ` — ${approverName}` : ''}.`}
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
                                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Pending approval</p>
                                        <p className="text-[13px] font-bold text-amber-900">
                                            Awaiting Asset Controller{approverName ? ` — ${approverName}` : ''}…
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {asset && (
                            <VehicleServiceWorkflowCards asset={asset} assetId={assetId} onUpdated={() => fetchAssetDetails()} />
                        )}
                    </div>

                    {/* Bottom Section: Sub Tabs (Employee Profile Style) */}
                    <div className="mt-10 space-y-8">
                        {/* Tab Headers */}
                        <div className="space-y-3">
                            <div className="bg-white border border-slate-200 rounded-2xl px-4">
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[12px] font-semibold">
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
                                        className={`relative px-1 py-3 whitespace-nowrap transition-colors border-b-2 ${activeTab === tab.id
                                            ? 'text-blue-600 border-blue-500'
                                            : 'text-slate-500 border-transparent hover:text-slate-700'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-start gap-2">
                                {(activeTab === 'basic' || activeTab === 'handover') && asset.assignedTo && (
                                    <button
                                        type="button"
                                        onClick={() => setShowHandoverModal(true)}
                                        className="px-4 py-2 bg-[#13c5c0] text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-[#0fb2ad] transition-all flex items-center gap-2"
                                    >
                                        <Printer size={14} /> Print
                                    </button>
                                )}

                                {/* Acceptance Buttons */}
                                {(currentUserEmployeeId && asset.actionRequiredBy === currentUserEmployeeId && asset.acceptanceStatus === 'Pending') && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={() => openResponseModal('Reject')}
                                            className="px-4 py-2 bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-red-600 transition-all"
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
                                            className="px-4 py-2 bg-[#13c5c0] text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-[#0fb2ad] transition-all"
                                        >
                                            Accept
                                        </button>
                                        <button
                                            onClick={() => openResponseModal('AcceptWithComments')}
                                            className="px-4 py-2 bg-[#13c5c0] text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-[#0fb2ad] transition-all"
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
                                                        { label: 'Status', vehicleStatus: true },
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
                                                            if (row.vehicleStatus) return true;
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
                                                                {row.vehicleStatus ? (
                                                                    <span className="text-[13px] font-semibold text-slate-700 max-w-[60%] text-right">
                                                                        <span
                                                                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${vehicleAssetStatusBadgeClass(asset.status)}`}
                                                                        >
                                                                            {asset.status || '—'}
                                                                        </span>
                                                                    </span>
                                                                ) : (
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
                                                                )}
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
                                                                onClick={() => { clearDocTabModalContext(); setIsRegistrationRenew(true); setShowRegistrationModal(true); }}
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
                                                                onClick={() => { clearDocTabModalContext(); setIsRegistrationRenew(false); setShowRegistrationModal(true); }}
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
                                                                onClick={() => { clearDocTabModalContext(); setIsInsuranceRenew(true); setShowInsuranceModal(true); }}
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
                                                                onClick={() => { clearDocTabModalContext(); setIsInsuranceRenew(false); setShowInsuranceModal(true); }}
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
                                                                onClick={() => { clearDocTabModalContext(); setIsWarrantyRenew(true); setShowWarrantyModal(true); }}
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
                                                                onClick={() => { clearDocTabModalContext(); setIsWarrantyRenew(false); setShowWarrantyModal(true); }}
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
                                                onClick={() => { clearDocTabModalContext(); setIsRegistrationRenew(false); setShowRegistrationModal(true); }}
                                                className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-sm flex items-center gap-2"
                                            >
                                                Registration
                                            </button>
                                        )}
                                        {!hasInsuranceCardData && (
                                            <button
                                                type="button"
                                                onClick={() => { clearDocTabModalContext(); setIsInsuranceRenew(false); setShowInsuranceModal(true); }}
                                                className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-sm flex items-center gap-2"
                                            >
                                                Insurance
                                            </button>
                                        )}
                                        {!hasWarrantyCardData && (
                                            <button
                                                type="button"
                                                onClick={() => { clearDocTabModalContext(); setIsWarrantyRenew(false); setShowWarrantyModal(true); }}
                                                className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-sm flex items-center gap-2"
                                            >
                                                Warranty
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'permit' && (
                                <div className="w-full px-2 space-y-6">
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
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 justify-items-stretch">
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
                                            const bucket = documentInnerTab === 'old'
                                                ? vehicleDocumentLifecycleBuckets.old
                                                : vehicleDocumentLifecycleBuckets.live;

                                            const servicesByType = bucket.servicesByType || {};
                                            const hasServiceRowsForView = VEHICLE_SERVICE_TYPES.some(
                                                (t) => (servicesByType[t] || []).length > 0
                                            );

                                            const hasAny =
                                                bucket.basic.length > 0 ||
                                                bucket.registration.length > 0 ||
                                                bucket.insurance.length > 0 ||
                                                bucket.warranty.length > 0 ||
                                                bucket.permit.length > 0 ||
                                                hasServiceRowsForView ||
                                                !!asset?.invoiceFile;

                                            if (!hasAny) {
                                                return (
                                                    <div className="py-16 flex flex-col items-center justify-center text-center px-6">
                                                        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200 mb-4">
                                                            <FileText size={28} />
                                                        </div>
                                                        <p className="text-sm font-bold text-slate-400">No documents in this view</p>
                                                    </div>
                                                );
                                            }

                                            const make = asset?.typeId?.name || asset?.type || '-';
                                            const model = asset?.modelYear || '-';
                                            const aid = asset?.assetId || '-';
                                            const plate = asset?.plateNumber || '-';

                                            const attachmentBtn = (url, label) =>
                                                url ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => { setSelectedFile(url); setShowFileModal(true); }}
                                                        className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
                                                    >
                                                        <Download size={14} /> {label || 'View'}
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                );

                                            const sectionTitle = (label) => (
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="h-4 w-1 bg-blue-500 rounded-full" />
                                                    <h4 className="text-lg font-bold text-gray-800">{label}</h4>
                                                </div>
                                            );

                                            const basicRows = [];
                                            if (asset?.invoiceFile) {
                                                basicRows.push({ key: 'inv', doc: null, att: asset.invoiceFile, label: 'Invoice' });
                                            }
                                            bucket.basic.forEach((doc, i) => {
                                                basicRows.push({
                                                    key: doc._id || `b-${i}`,
                                                    doc,
                                                    att: doc.attachment,
                                                    label: doc.type || 'Document',
                                                });
                                            });
                                            if (basicRows.length === 0) {
                                                basicRows.push({ key: 'blank', doc: null, att: null, label: null });
                                            }

                                            const openRegistrationEdit = (doc) => {
                                                if (normDocType(doc.type) === 'registration') {
                                                    setDocTabRegistrationOverride({
                                                        existingDoc: doc,
                                                        existingAttachmentRows: registrationAttachmentsForDoc(doc, bucket.registration),
                                                    });
                                                    setIsRegistrationRenew(false);
                                                    setShowRegistrationModal(true);
                                                } else {
                                                    setSelectedDocType(doc.type);
                                                    setSelectedDoc(doc);
                                                    setIsRenewMode(false);
                                                    setShowDocModal(true);
                                                }
                                            };

                                            const registrationProcessDate = (doc) => {
                                                const p = parseVehicleDocDescription(doc);
                                                if (p.processDate) return formatTableDate(p.processDate);
                                                return '-';
                                            };

                                            const previousServiceSameType = (srv) => {
                                                const all = asset?.services || [];
                                                const same = all.filter((s) => s.serviceType === srv.serviceType);
                                                same.sort((a, b) => {
                                                    const da = a.date ? new Date(a.date).getTime() : 0;
                                                    const db = b.date ? new Date(b.date).getTime() : 0;
                                                    return da - db;
                                                });
                                                const i = same.findIndex((s) => String(s._id || '') === String(srv._id || ''));
                                                if (i <= 0) return null;
                                                return same[i - 1];
                                            };

                                            const openServiceDetailFromDocTab = (srv) => {
                                                setServiceDetailModal({
                                                    open: true,
                                                    srv,
                                                    type: srv.serviceType,
                                                    previous: previousServiceSameType(srv),
                                                });
                                            };

                                            const serviceFileCell = (srv) => (
                                                <div className="flex flex-wrap gap-2">
                                                    {srv.attachment ? attachmentBtn(srv.attachment, 'Attachment') : null}
                                                    {srv.invoice ? attachmentBtn(srv.invoice, 'Invoice') : null}
                                                    {!srv.attachment && !srv.invoice ? <span className="text-slate-300">-</span> : null}
                                                </div>
                                            );

                                            const formatServiceAmount = (srv, meta) => {
                                                if (meta?.amountMode === 'warranty') return 'Warranty';
                                                if (srv.value != null && Number(srv.value) === 0) return 'AED 0';
                                                if (srv.value != null && Number(srv.value) !== 0) {
                                                    return `AED ${Number(srv.value).toLocaleString()}`;
                                                }
                                                return '-';
                                            };

                                            const liablePersonDisplay = (meta) => {
                                                if (!meta?.liablePersonId) return '-';
                                                const id = String(meta.liablePersonId);
                                                const assignee = asset?.assignedTo;
                                                if (assignee && typeof assignee === 'object' && String(assignee._id || '') === id) {
                                                    const n = `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim();
                                                    return n || assignee.employeeId || id;
                                                }
                                                return id;
                                            };

                                            const serviceByMechanicalBody = (srv, meta) => {
                                                if (meta?.liableOn === 'company') return 'Company';
                                                if (meta?.liableOn === 'person') return liablePersonDisplay(meta);
                                                return srv.paidBy || '-';
                                            };

                                            const docTabServiceActions = (srv) => (
                                                <button
                                                    type="button"
                                                    onClick={() => openServiceDetailFromDocTab(srv)}
                                                    className="text-slate-500 hover:text-slate-800 transition-colors"
                                                    title="View details"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            );

                                            return (
                                                <div className="mt-6 space-y-10">
                                                    <div>
                                                        {sectionTitle('Basic details')}
                                                        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                            <table className="w-full min-w-[920px]">
                                                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                                                    <tr>
                                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Asset ID</th>
                                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Plate No.</th>
                                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Model</th>
                                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Make</th>
                                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Attachment</th>
                                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Actions</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-50">
                                                                    {basicRows.map((r) => (
                                                                        <tr key={r.key} className="hover:bg-blue-50/30 transition-colors">
                                                                            <td className="px-6 py-4 text-sm font-semibold text-gray-700">{aid}</td>
                                                                            <td className="px-6 py-4 text-sm text-gray-600">{plate}</td>
                                                                            <td className="px-6 py-4 text-sm text-gray-600">{model}</td>
                                                                            <td className="px-6 py-4 text-sm text-gray-600">{make}</td>
                                                                            <td className="px-6 py-4 text-sm">{attachmentBtn(r.att, r.label)}</td>
                                                                            <td className="px-6 py-4">
                                                                                {r.doc ? (
                                                                                    <div className="flex items-center gap-3">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setSelectedDocType(r.doc.type);
                                                                                                setSelectedDoc(r.doc);
                                                                                                setIsRenewMode(false);
                                                                                                setShowDocModal(true);
                                                                                            }}
                                                                                            className="text-blue-500 hover:text-blue-600 transition-colors"
                                                                                            title="Edit"
                                                                                        >
                                                                                            <PencilLine size={16} />
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => { setSelectedDocType(r.doc.type); setSelectedDoc(r.doc); setIsRenewMode(true); setShowDocModal(true); }}
                                                                                            className="text-teal-500 hover:text-teal-600 transition-colors"
                                                                                            title="Renew"
                                                                                        >
                                                                                            <RefreshCw size={16} />
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            className="text-rose-400 hover:text-rose-500 transition-colors"
                                                                                            title="Delete"
                                                                                            onClick={() => setDocToDelete(r.doc)}
                                                                                        >
                                                                                            <XCircle size={16} />
                                                                                        </button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-slate-300">-</span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>

                                                    {bucket.registration.length > 0 && (
                                                        <div>
                                                            {sectionTitle('Registration')}
                                                            <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                                <table className="w-full min-w-[1020px]">
                                                                    <thead className="bg-gray-50/50 border-b border-gray-100">
                                                                        <tr>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Record</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Registration date</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Expiry</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Process date</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Attachment</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-50">
                                                                        {bucket.registration.map((doc, idx) => (
                                                                            <tr key={doc._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                                <td className="px-6 py-4 text-sm font-semibold text-gray-700">
                                                                                    {normDocType(doc.type) === 'registration attachment' ? 'Supporting' : 'Registration card'}
                                                                                </td>
                                                                                <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.issueDate)}</td>
                                                                                <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.expiryDate)}</td>
                                                                                <td className="px-6 py-4 text-sm text-gray-600">{registrationProcessDate(doc)}</td>
                                                                                <td className="px-6 py-4 text-sm">{attachmentBtn(doc.attachment, 'View')}</td>
                                                                                <td className="px-6 py-4">
                                                                                    <div className="flex items-center gap-3">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => { openRegistrationEdit(doc); }}
                                                                                            className="text-blue-500 hover:text-blue-600 transition-colors"
                                                                                            title="Edit"
                                                                                        >
                                                                                            <PencilLine size={16} />
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                if (normDocType(doc.type) === 'registration') {
                                                                                                    setDocTabRegistrationOverride(null);
                                                                                                    setIsRegistrationRenew(true);
                                                                                                    setShowRegistrationModal(true);
                                                                                                } else {
                                                                                                    setSelectedDocType(doc.type);
                                                                                                    setSelectedDoc(doc);
                                                                                                    setIsRenewMode(true);
                                                                                                    setShowDocModal(true);
                                                                                                }
                                                                                            }}
                                                                                            className="text-teal-500 hover:text-teal-600 transition-colors"
                                                                                            title="Renew"
                                                                                        >
                                                                                            <RefreshCw size={16} />
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
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
                                                    )}

                                                    {bucket.insurance.length > 0 && (
                                                        <div>
                                                            {sectionTitle('Insurance')}
                                                            <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                                <table className="w-full min-w-[1080px]">
                                                                    <thead className="bg-gray-50/50 border-b border-gray-100">
                                                                        <tr>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Insurance date</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Expiry</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Policy number</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Insurance company</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Attachment</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-50">
                                                                        {bucket.insurance.map((doc, idx) => {
                                                                            const meta = parseVehicleDocDescription(doc);
                                                                            const policy = meta.policy != null && String(meta.policy).trim() !== '' ? String(meta.policy) : '-';
                                                                            const company = doc.issueAuthority ? String(doc.issueAuthority) : '-';
                                                                            return (
                                                                                <tr key={doc._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.issueDate)}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.expiryDate)}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{policy}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{company}</td>
                                                                                    <td className="px-6 py-4 text-sm">{attachmentBtn(doc.attachment, 'View')}</td>
                                                                                    <td className="px-6 py-4">
                                                                                        <div className="flex items-center gap-3">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setDocTabInsuranceDoc(doc);
                                                                                                    setIsInsuranceRenew(false);
                                                                                                    setShowInsuranceModal(true);
                                                                                                }}
                                                                                                className="text-blue-500 hover:text-blue-600 transition-colors"
                                                                                                title="Edit"
                                                                                            >
                                                                                                <PencilLine size={16} />
                                                                                            </button>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setDocTabInsuranceDoc(null);
                                                                                                    setIsInsuranceRenew(true);
                                                                                                    setShowInsuranceModal(true);
                                                                                                }}
                                                                                                className="text-teal-500 hover:text-teal-600 transition-colors"
                                                                                                title="Renew"
                                                                                            >
                                                                                                <RefreshCw size={16} />
                                                                                            </button>
                                                                                            <button
                                                                                                type="button"
                                                                                                className="text-rose-400 hover:text-rose-500 transition-colors"
                                                                                                title="Delete"
                                                                                                onClick={() => setDocToDelete(doc)}
                                                                                            >
                                                                                                <XCircle size={16} />
                                                                                            </button>
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {bucket.warranty.length > 0 && (
                                                        <div>
                                                            {sectionTitle('Warranty')}
                                                            <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                                <table className="w-full min-w-[1120px]">
                                                                    <thead className="bg-gray-50/50 border-b border-gray-100">
                                                                        <tr>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Warranty start</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">End date</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Purchase date</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Amount</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">KM</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Attachment</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-50">
                                                                        {bucket.warranty.map((doc, idx) => {
                                                                            const meta = parseVehicleDocDescription(doc);
                                                                            const km =
                                                                                meta.km != null && String(meta.km).trim() !== ''
                                                                                    ? `${Number(meta.km).toLocaleString()} KM`
                                                                                    : '-';
                                                                            const isPrimaryLive =
                                                                                documentInnerTab === 'live' &&
                                                                                warrantyDoc &&
                                                                                String(warrantyDoc._id || '') === String(doc._id || '');
                                                                            const purchaseRaw = meta.purchaseDate || (isPrimaryLive ? asset?.purchaseDate : null);
                                                                            const purchaseDisp = purchaseRaw ? formatTableDate(purchaseRaw) : '-';
                                                                            let amountDisp = '-';
                                                                            if (meta.amount != null && meta.amount !== '') {
                                                                                amountDisp = `AED ${Number(meta.amount).toLocaleString()}`;
                                                                            } else if (isPrimaryLive && asset?.assetValue != null) {
                                                                                amountDisp = `AED ${Number(asset.assetValue).toLocaleString()}`;
                                                                            }
                                                                            return (
                                                                                <tr key={doc._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.issueDate)}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.expiryDate)}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{purchaseDisp}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{amountDisp}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{km}</td>
                                                                                    <td className="px-6 py-4 text-sm">{attachmentBtn(doc.attachment, 'View')}</td>
                                                                                    <td className="px-6 py-4">
                                                                                        <div className="flex items-center gap-3">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setDocTabWarrantyDoc(doc);
                                                                                                    setIsWarrantyRenew(false);
                                                                                                    setShowWarrantyModal(true);
                                                                                                }}
                                                                                                className="text-blue-500 hover:text-blue-600 transition-colors"
                                                                                                title="Edit"
                                                                                            >
                                                                                                <PencilLine size={16} />
                                                                                            </button>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setDocTabWarrantyDoc(null);
                                                                                                    setIsWarrantyRenew(true);
                                                                                                    setShowWarrantyModal(true);
                                                                                                }}
                                                                                                className="text-teal-500 hover:text-teal-600 transition-colors"
                                                                                                title="Renew"
                                                                                            >
                                                                                                <RefreshCw size={16} />
                                                                                            </button>
                                                                                            <button
                                                                                                type="button"
                                                                                                className="text-rose-400 hover:text-rose-500 transition-colors"
                                                                                                title="Delete"
                                                                                                onClick={() => setDocToDelete(doc)}
                                                                                            >
                                                                                                <XCircle size={16} />
                                                                                            </button>
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {bucket.permit.length > 0 && (
                                                        <div>
                                                            {sectionTitle('Permit')}
                                                            <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                                <table className="w-full min-w-[900px]">
                                                                    <thead className="bg-gray-50/50 border-b border-gray-100">
                                                                        <tr>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Permit type</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Start</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">End</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Attachment</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-50">
                                                                        {bucket.permit.map((doc, idx) => {
                                                                            const meta = parseVehicleDocDescription(doc);
                                                                            const pType = meta.permitType ? String(meta.permitType) : '-';
                                                                            const endDisp = meta.unlimited && !doc.expiryDate ? 'Unlimited' : formatTableDate(doc.expiryDate);
                                                                            return (
                                                                                <tr key={doc._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                                    <td className="px-6 py-4 text-sm font-semibold text-gray-700">{pType}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.issueDate)}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{endDisp}</td>
                                                                                    <td className="px-6 py-4 text-sm">{attachmentBtn(doc.attachment, 'View')}</td>
                                                                                    <td className="px-6 py-4">
                                                                                        <div className="flex items-center gap-3">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setSelectedDocType(doc.type);
                                                                                                    setSelectedDoc(doc);
                                                                                                    setIsRenewMode(false);
                                                                                                    setShowDocModal(true);
                                                                                                }}
                                                                                                className="text-blue-500 hover:text-blue-600 transition-colors"
                                                                                                title="Edit"
                                                                                            >
                                                                                                <PencilLine size={16} />
                                                                                            </button>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setSelectedDocType(doc.type);
                                                                                                    setSelectedDoc(doc);
                                                                                                    setIsRenewMode(true);
                                                                                                    setShowDocModal(true);
                                                                                                }}
                                                                                                className="text-teal-500 hover:text-teal-600 transition-colors"
                                                                                                title="Renew"
                                                                                            >
                                                                                                <RefreshCw size={16} />
                                                                                            </button>
                                                                                            <button
                                                                                                type="button"
                                                                                                className="text-rose-400 hover:text-rose-500 transition-colors"
                                                                                                title="Delete"
                                                                                                onClick={() => setDocToDelete(doc)}
                                                                                            >
                                                                                                <XCircle size={16} />
                                                                                            </button>
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {VEHICLE_SERVICE_TYPES.map((svcType) => {
                                                        const svcRows = servicesByType[svcType] || [];
                                                        if (!svcRows.length) return null;

                                                        if (svcType === 'Oil Service') {
                                                            return (
                                                                <div key={svcType}>
                                                                    {sectionTitle('Oil service')}
                                                                    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                                        <table className="w-full min-w-[1100px]">
                                                                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                                                                <tr>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Oil type</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Change date</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Change KM</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Next date</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Next KM</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Amount</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Serviced by</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Attachment</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Actions</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-50">
                                                                                {svcRows.map((srv, idx) => {
                                                                                    const meta = parseVehicleServiceRemark(srv);
                                                                                    const changeKm = meta?.currentKm ?? srv.currentKm;
                                                                                    const nextKmDisp =
                                                                                        meta &&
                                                                                        meta.nextChangeKm !== undefined &&
                                                                                        meta.nextChangeKm !== null &&
                                                                                        String(meta.nextChangeKm).trim() !== ''
                                                                                            ? `${Number(meta.nextChangeKm).toLocaleString()} KM`
                                                                                            : '-';
                                                                                    return (
                                                                                        <tr key={srv._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                                            <td className="px-6 py-4 text-sm text-gray-700">{meta?.oilServiceTypeText || '-'}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(srv.date)}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                                                                {changeKm != null && changeKm !== '' ? `${Number(changeKm).toLocaleString()} KM` : '-'}
                                                                                            </td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                                                                {meta?.nextChangeMonth ? formatNextChangeMonthDisplay(meta.nextChangeMonth) : '-'}
                                                                                            </td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{nextKmDisp}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{formatServiceAmount(srv, meta)}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">-</td>
                                                                                            <td className="px-6 py-4 text-sm">{serviceFileCell(srv)}</td>
                                                                                            <td className="px-6 py-4">{docTabServiceActions(srv)}</td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        if (svcType === 'Tire Change') {
                                                            return (
                                                                <div key={svcType}>
                                                                    {sectionTitle('Tire change')}
                                                                    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                                        <table className="w-full min-w-[920px]">
                                                                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                                                                <tr>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Change date</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Next KM</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Amount</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Service by</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Attachment</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Actions</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-50">
                                                                                {svcRows.map((srv, idx) => {
                                                                                    const meta = parseVehicleServiceRemark(srv);
                                                                                    const nextKmDisp =
                                                                                        meta &&
                                                                                        meta.nextChangeKm !== undefined &&
                                                                                        meta.nextChangeKm !== null &&
                                                                                        String(meta.nextChangeKm).trim() !== ''
                                                                                            ? `${Number(meta.nextChangeKm).toLocaleString()} KM`
                                                                                            : '-';
                                                                                    return (
                                                                                        <tr key={srv._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(srv.date)}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{nextKmDisp}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{formatServiceAmount(srv, meta)}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">-</td>
                                                                                            <td className="px-6 py-4 text-sm">{serviceFileCell(srv)}</td>
                                                                                            <td className="px-6 py-4">{docTabServiceActions(srv)}</td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        if (svcType === 'Mechanical Work') {
                                                            return (
                                                                <div key={svcType}>
                                                                    {sectionTitle('Mechanical work')}
                                                                    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                                        <table className="w-full min-w-[1020px]">
                                                                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                                                                <tr>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Service date</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Reason</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Amount</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Service by</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Paid by</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Attachment</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Actions</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-50">
                                                                                {svcRows.map((srv, idx) => {
                                                                                    const meta = parseVehicleServiceRemark(srv);
                                                                                    return (
                                                                                        <tr key={srv._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(srv.date)}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] break-words">{srv.description || '-'}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{formatServiceAmount(srv, meta)}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{serviceByMechanicalBody(srv, meta)}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{srv.paidBy || '-'}</td>
                                                                                            <td className="px-6 py-4 text-sm">{serviceFileCell(srv)}</td>
                                                                                            <td className="px-6 py-4">{docTabServiceActions(srv)}</td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        if (svcType === 'Body Work') {
                                                            return (
                                                                <div key={svcType}>
                                                                    {sectionTitle('Body work')}
                                                                    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                                        <table className="w-full min-w-[1020px]">
                                                                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                                                                <tr>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Service date</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Reason</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Amount</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Service by</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Paid by</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Attachment</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Actions</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-50">
                                                                                {svcRows.map((srv, idx) => {
                                                                                    const meta = parseVehicleServiceRemark(srv);
                                                                                    return (
                                                                                        <tr key={srv._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(srv.date)}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] break-words">{srv.description || '-'}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{formatServiceAmount(srv, meta)}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{serviceByMechanicalBody(srv, meta)}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{srv.paidBy || '-'}</td>
                                                                                            <td className="px-6 py-4 text-sm">{serviceFileCell(srv)}</td>
                                                                                            <td className="px-6 py-4">{docTabServiceActions(srv)}</td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        if (svcType === 'Accident Repair') {
                                                            return (
                                                                <div key={svcType}>
                                                                    {sectionTitle('Accident repair')}
                                                                    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                                        <table className="w-full min-w-[1180px]">
                                                                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                                                                <tr>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Accident date</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Accident by</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Duration of service</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Amount</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Paid by</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Service by</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Attachment</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Actions</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-50">
                                                                                {svcRows.map((srv, idx) => {
                                                                                    const meta = parseVehicleServiceRemark(srv);
                                                                                    const accidentDateDisp = meta?.accidentDate
                                                                                        ? formatTableDate(meta.accidentDate)
                                                                                        : formatTableDate(srv.date);
                                                                                    return (
                                                                                        <tr key={srv._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{accidentDateDisp}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{meta?.accidentOwner || '-'}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{srv.serviceDuration || '-'}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{formatServiceAmount(srv, meta)}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{srv.paidBy || '-'}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">-</td>
                                                                                            <td className="px-6 py-4 text-sm">{serviceFileCell(srv)}</td>
                                                                                            <td className="px-6 py-4">{docTabServiceActions(srv)}</td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        if (svcType === 'Car Wash') {
                                                            return (
                                                                <div key={svcType}>
                                                                    {sectionTitle('Car wash')}
                                                                    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                                        <table className="w-full min-w-[900px]">
                                                                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                                                                <tr>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Date</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Amount</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Service by</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Paid by</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Attachment</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Actions</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-50">
                                                                                {svcRows.map((srv, idx) => {
                                                                                    const meta = parseVehicleServiceRemark(srv);
                                                                                    return (
                                                                                        <tr key={srv._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(srv.date)}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{formatServiceAmount(srv, meta)}</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">-</td>
                                                                                            <td className="px-6 py-4 text-sm text-gray-600">{srv.paidBy || '-'}</td>
                                                                                            <td className="px-6 py-4 text-sm">{serviceFileCell(srv)}</td>
                                                                                            <td className="px-6 py-4">{docTabServiceActions(srv)}</td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        return null;
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'service' && (
                                <div className="w-full">
                                    {(() => {
                                        const { previousByType, existingCards, missingButtons } = serviceHistoryIndex;

                                        return (
                                            <div className="space-y-6">
                                                {existingCards.length > 0 && (
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                        {existingCards.map(({ type, srv }, idx) => {
                                                            const meta = parseVehicleServiceRemark(srv);
                                                            const nextKm =
                                                                meta &&
                                                                meta.nextChangeKm !== undefined &&
                                                                meta.nextChangeKm !== null &&
                                                                String(meta.nextChangeKm).trim() !== ''
                                                                    ? `${meta.nextChangeKm} KM`
                                                                    : null;
                                                            const nextMonth = meta?.nextChangeMonth
                                                                ? formatNextChangeMonthDisplay(meta.nextChangeMonth)
                                                                : null;

                                                            return (
                                                                <div
                                                                    key={`${srv._id || idx}`}
                                                                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                                                                >
                                                                    <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
                                                                        <h3 className="text-base font-semibold text-slate-800">{type}</h3>
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setServiceDetailModal({
                                                                                        open: true,
                                                                                        srv,
                                                                                        type,
                                                                                        previous: previousByType[type] || null,
                                                                                    });
                                                                                }}
                                                                                className="text-slate-500 hover:text-slate-800 transition-colors"
                                                                                title="View full details"
                                                                            >
                                                                                <Eye size={14} />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    const fileToOpen = srv.invoice || srv.attachment;
                                                                                    if (!fileToOpen) {
                                                                                        toast({
                                                                                            variant: 'destructive',
                                                                                            title: 'No file',
                                                                                            description: 'No download file available for this service card.',
                                                                                        });
                                                                                        return;
                                                                                    }
                                                                                    setSelectedFile(fileToOpen);
                                                                                    setShowFileModal(true);
                                                                                }}
                                                                                className="text-emerald-500 hover:text-emerald-600 transition-colors"
                                                                                title="Download"
                                                                            >
                                                                                <Download size={14} />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setSelectedServiceType(type);
                                                                                    setShowServiceModal(true);
                                                                                }}
                                                                                className="text-blue-500 hover:text-blue-600 transition-colors"
                                                                                title="Edit"
                                                                            >
                                                                                <PencilLine size={14} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="px-5 py-3">
                                                                        {[
                                                                            {
                                                                                label: 'Service date',
                                                                                value: srv.date
                                                                                    ? new Date(srv.date).toLocaleDateString()
                                                                                    : '-',
                                                                            },
                                                                            ...(type !== 'Body Work'
                                                                                ? [
                                                                                      {
                                                                                          label: 'Previous service date',
                                                                                          value: previousByType[type]?.date
                                                                                              ? new Date(
                                                                                                    previousByType[type].date
                                                                                                ).toLocaleDateString()
                                                                                              : '-',
                                                                                      },
                                                                                  ]
                                                                                : []),
                                                                            {
                                                                                label: 'Amount',
                                                                                value: `AED ${Number(srv.value || 0).toLocaleString()}`,
                                                                            },
                                                                            ...(type === 'Oil Service' ||
                                                                            type === 'Tire Change' ||
                                                                            type === 'Car Wash'
                                                                                ? [
                                                                                      {
                                                                                          label: 'Next change KM',
                                                                                          value: nextKm || '-',
                                                                                      },
                                                                                      {
                                                                                          label: 'Next change month',
                                                                                          value: nextMonth || '-',
                                                                                      },
                                                                                  ]
                                                                                : []),
                                                                            {
                                                                                label: 'Current KM',
                                                                                value: srv.currentKm ? `${srv.currentKm} KM` : '-',
                                                                            },
                                                                            {
                                                                                label: 'Description',
                                                                                value: srv.description || '-',
                                                                            },
                                                                            {
                                                                                label: 'Attachments',
                                                                                value: srv.attachment ? 'Available' : '-',
                                                                            },
                                                                            {
                                                                                label: 'Invoice',
                                                                                value: srv.invoice ? 'Available' : '-',
                                                                            },
                                                                        ].map((row) => (
                                                                            <div
                                                                                key={row.label}
                                                                                className="flex items-center justify-between py-3 border-b border-slate-100 last:border-b-0"
                                                                            >
                                                                                <span className="text-sm text-slate-500">{row.label}</span>
                                                                                <span className="text-sm font-medium text-slate-700 text-right max-w-[55%] truncate">
                                                                                    {row.value}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {missingButtons.length > 0 && (
                                                    <div className="p-6 rounded-2xl border border-slate-100 shadow-sm">
                                                        <div className="flex flex-wrap justify-start gap-2">
                                                            {missingButtons.map((label) => (
                                                                <button
                                                                    key={label}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedServiceType(label);
                                                                        setShowServiceModal(true);
                                                                    }}
                                                                    className="px-4 py-2 rounded-lg bg-[#13c5c0] hover:bg-[#0fb2ad] text-white text-[11px] font-bold"
                                                                >
                                                                    Add {label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {activeTab === 'history' && (
                                <VehicleAssetHistoryTab
                                    assetHistory={assetHistory}
                                    onViewFile={(fileUrl) => {
                                        setSelectedFile(fileUrl);
                                        setShowFileModal(true);
                                    }}
                                />
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

            <AddVehicleModal
                isOpen={editVehicleModalOpen}
                editAssetId={assetId}
                onClose={() => setEditVehicleModalOpen(false)}
                onSuccess={() => {
                    fetchAssetDetails();
                    setEditVehicleModalOpen(false);
                }}
            />

            <VehicleServiceModal
                isOpen={showServiceModal}
                onClose={() => {
                    setShowServiceModal(false);
                    setSelectedServiceType('');
                }}
                onSuccess={refreshData}
                assetId={assetId}
                presetServiceType={selectedServiceType}
                assignedEmployee={asset?.assignedTo && typeof asset.assignedTo === 'object' ? asset.assignedTo : null}
                lastCompletedServiceDate={
                    selectedServiceType && serviceHistoryIndex.latestByType[selectedServiceType]?.date
                        ? serviceHistoryIndex.latestByType[selectedServiceType].date
                        : null
                }
            />

            <VehicleServiceDetailModal
                isOpen={serviceDetailModal.open}
                onClose={() =>
                    setServiceDetailModal({ open: false, srv: null, type: '', previous: null })
                }
                serviceRecord={serviceDetailModal.srv}
                serviceTypeLabel={serviceDetailModal.type}
                previousRecord={serviceDetailModal.previous}
                onOpenFile={(url) => {
                    if (!url) return;
                    setSelectedFile(url);
                    setShowFileModal(true);
                }}
            />

            <VehicleRegistrationModal
                isOpen={showRegistrationModal}
                onClose={() => { setShowRegistrationModal(false); setIsRegistrationRenew(false); setDocTabRegistrationOverride(null); }}
                onSuccess={refreshData}
                assetId={assetId}
                existingDoc={docTabRegistrationOverride?.existingDoc ?? registrationDoc}
                existingAttachmentRows={docTabRegistrationOverride?.existingAttachmentRows ?? registrationAttachments}
                isRenew={isRegistrationRenew}
            />

            <VehicleInsuranceModal
                isOpen={showInsuranceModal}
                onClose={() => { setShowInsuranceModal(false); setIsInsuranceRenew(false); setDocTabInsuranceDoc(null); }}
                onSuccess={refreshData}
                assetId={assetId}
                existingDoc={docTabInsuranceDoc ?? insuranceDoc}
                isRenew={isInsuranceRenew}
            />

            <VehicleWarrantyModal
                isOpen={showWarrantyModal}
                onClose={() => { setShowWarrantyModal(false); setIsWarrantyRenew(false); setDocTabWarrantyDoc(null); }}
                onSuccess={refreshData}
                assetId={assetId}
                existingDoc={docTabWarrantyDoc ?? warrantyDoc}
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
