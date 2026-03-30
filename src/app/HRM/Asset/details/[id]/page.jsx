'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
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
    Ban,
    ChevronDown,
    ChevronUp,
    DollarSign,
    Loader2,
    CheckCircle2,
    Paperclip,
    Plus,
    RotateCw,
    Maximize2,
    Undo2,
    User,
    ArrowUpRight,
    ArrowDownLeft,
    Wrench
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// AccessoriesModal import removed - no longer needed
import TransferAccessoryModal from '../../components/TransferAccessoryModal';
import AssignAssetModal from '../../components/AssignAssetModal';
import TransferAssetModal from '../../components/TransferAssetModal';
import HandoverFormModal from '../../components/HandoverFormModal';
import HandoverFormView from '../../components/HandoverFormView';
import AddLossDamageModal from '@/app/HRM/Fine/components/AddLossDamageModal';
import SendToServiceModal from '../../components/SendToServiceModal';
import MarkAsLiveModal from '../../components/MarkAsLiveModal';
import AddAssetTypeModal from '../../components/AddAssetTypeModal';
import EndOfLifeModal from '../../components/EndOfLifeModal';
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

/** Same checks as backend designated approver — used if canApproveAssetCreation is missing/false */
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

/** Populated actionRequiredBy, else flowchart assetController from API (getAssetItemDetail). */
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

// Helper for initials
const getInitials = (name) => {
    if (!name) return 'AS';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
};

const calculateAge = (date) => {
    if (!date) return '0 Days';
    const start = new Date(date);
    const end = new Date();

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
        months--;
        const lastMonth = new Date(end.getFullYear(), end.getMonth(), 0);
        days += lastMonth.getDate();
    }

    if (months < 0) {
        years--;
        months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(`${years} ${years === 1 ? 'Year' : 'Years'}`);
    if (months > 0) parts.push(`${months} ${months === 1 ? 'Month' : 'Months'}`);
    if (days > 0 || (years === 0 && months === 0)) parts.push(`${days} ${days === 1 ? 'Day' : 'Days'}`);

    return parts.join(' ');
};

const calculateWarrantyStatus = (purchaseDate, years) => {
    if (!purchaseDate || !years) return 'No Warranty info';
    const expiryDate = new Date(purchaseDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + parseInt(years));
    const today = new Date();

    let diffMs = expiryDate - today;
    if (diffMs < 0) return 'Warranty Expired';

    const diffDate = new Date(diffMs);
    const y = diffDate.getUTCFullYear() - 1970;
    const m = diffDate.getUTCMonth();

    return `${y} Year ${m} Month Warranty`;
};

export default function AssetDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const assetId = params.id;
    const { toast } = useToast();

    const authAction = searchParams.get('authAction'); // 'eol' or 'damage'
    const reporteeAction = searchParams.get('reporteeAction'); // 'eol' or 'damage'
    const tabParam = searchParams.get('tab'); // Tab parameter from URL


    const [asset, setAsset] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imageError, setImageError] = useState(false);
    // Remove the accessories modal state and component
    const [showAccessoriesModal, setShowAccessoriesModal] = useState(false);
    const [showAddAccessoryForm, setShowAddAccessoryForm] = useState(false);
    const [newAccessory, setNewAccessory] = useState({ name: '', amount: '', description: '' });
    const [editingAccessory, setEditingAccessory] = useState(null); // For editing existing accessories
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showHandoverModal, setShowHandoverModal] = useState(false);
    const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [responseComment, setResponseComment] = useState('');
    const [showResponseModal, setShowResponseModal] = useState(false);
    const [responseAction, setResponseAction] = useState(null);
    const [hasAssetController, setHasAssetController] = useState(false);
    const [isAssetController, setIsAssetController] = useState(false);
    const [isHR, setIsHR] = useState(false);
    const formRef = useRef();

    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDamageModal, setShowDamageModal] = useState(false);
    const [showMarkAsLiveModal, setShowMarkAsLiveModal] = useState(false);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [showEndOfLifeModal, setShowEndOfLifeModal] = useState(false);
    const [assetActionType, setAssetActionType] = useState('End of Life');
    const [eolTargetAccessory, setEolTargetAccessory] = useState(null); // null = main asset, {_id, name} = accessory
    const [showApprovalDialog, setShowApprovalDialog] = useState(false);
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [approvalComment, setApprovalComment] = useState('');
    const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
    const [finalizeComment, setFinalizeComment] = useState('');
    const [isProcessingFinalize, setIsProcessingFinalize] = useState(false);
    const [isProcessingApproval, setIsProcessingApproval] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', description: '' });
    const [confirmAction, setConfirmAction] = useState(null);
    const [showHistoryDetailModal, setShowHistoryDetailModal] = useState(false);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
    const [isDownloadingHistory, setIsDownloadingHistory] = useState(false);
    const [assetHistory, setAssetHistory] = useState([]);
    const [expandedHistory, setExpandedHistory] = useState({});
    const [activeTab, setActiveTab] = useState('document');

    const [currentUser, setCurrentUser] = useState(null);
    const [transferModal, setTransferModal] = useState({ isOpen: false, accessory: null });
    const [damageInitialData, setDamageInitialData] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
    const [imageDeleteConfirm, setImageDeleteConfirm] = useState({ isOpen: false, imageId: null });
    const [imageUploadModal, setImageUploadModal] = useState({ isOpen: false, file: null, base64: null, caption: '', date: new Date().toISOString().split('T')[0] });
    // Accessory reject dialog — replaces the native browser prompt()
    const [accRejectDialog, setAccRejectDialog] = useState({ isOpen: false, accId: null, accName: '', pendingAction: '', reason: '', loading: false });
    const [accAcceptDialog, setAccAcceptDialog] = useState({ isOpen: false, accId: null, accName: '', pendingAction: '', reason: '', attachment: null, loading: false });

    // Return Asset Modal State (similar to SalaryTab)
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [isReturning, setIsReturning] = useState(false);

    // Delete Asset Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteAsset = async () => {
        setIsDeleting(true);
        try {
            await axiosInstance.delete(`/AssetItem/${assetId}`);
            toast({ title: "Success", description: "Asset deleted successfully." });
            router.push('/HRM/Asset'); // Redirect to asset list
        } catch (err) {
            console.error("Error deleting asset:", err);
            toast({ variant: "destructive", title: "Error", description: err.response?.data?.message || "Failed to delete asset." });
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

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

    // Enhanced Return Asset function (similar to SalaryTab)
    const submitReturnAsset = async () => {
        if (!asset) return;

        setIsReturning(true);
        try {
            const payload = {};
            // Add reassignment logic if needed in the future
            // if (assignmentData.reassignTo) {
            //     payload.reassignTo = assignmentData.reassignTo;
            //     payload.assignmentType = assignmentData.assignmentType;
            // }

            await axiosInstance.put(`/AssetItem/${asset._id}/return`, payload);
            toast({
                title: "Success",
                description: "Asset returned to original issuer successfully."
            });
            setShowReturnModal(false);
            fetchAssetDetails();
        } catch (error) {
            console.error("Error returning asset:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || "Failed to return asset."
            });
        } finally {
            setIsReturning(false);
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
            fetchAssetHistory();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.message || 'Failed to process request.' });
        }
    };

    const handleActionRequest = async ({ reason, attachment, fineData = null, customActionType = null, accessoryId = null }) => {
        try {
            const actionType = customActionType || assetActionType;
            const targetAccId = accessoryId || eolTargetAccessory?._id;

            // For Loss and Damage, don't send fineData in initial request (only description and attachment)
            const requestPayload = {
                actionType,
                reason,
                attachment
            };

            // Only include fineData if it's not Loss and Damage (for other actions like End of Life)
            if (actionType !== 'Loss and Damage' && fineData) {
                requestPayload.fineData = fineData;
            }

            if (targetAccId) {
                // Accessory action
                await axiosInstance.put(
                    `/AssetItem/${assetId}/accessories/${targetAccId}/request-action`,
                    requestPayload
                );
                toast({ title: 'Request Sent', description: `${actionType} request for accessory sent to Asset Controller for approval.` });

            } else {
                // Main asset action
                await axiosInstance.put(`/AssetItem/${assetId}/request-action`, requestPayload);
                toast({ title: 'Request Sent', description: `Request for ${actionType} sent to Asset Controller.` });

            }
            setShowEndOfLifeModal(false);
            setEolTargetAccessory(null);
            fetchAssetDetails();
            fetchAssetHistory();
        } catch (err) {
            console.error('Error requesting action:', err);
            toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.message || 'Failed to send request.' });
            throw err;
        }
    };

    const handleApproveAction = async (approve) => {
        setIsProcessingApproval(true);
        try {
            const pendingAccessory = asset.accessories?.find(acc => acc.pendingAction);
            if (pendingAccessory) {
                // Respond to accessory action
                const response = await axiosInstance.put(`/AssetItem/${assetId}/accessories/${pendingAccessory._id}/respond-action`, {
                    approve,
                    comment: approvalComment
                });

                // Check if approval requires fine data (Loss and Damage without fineData)
                if (approve && response.data?.requiresFineData && response.data?.accessory && response.data?.asset) {
                    const accessoryData = response.data.accessory;
                    const assetData = response.data.asset;
                    // Open Loss and Damage modal with existing data
                    setDamageInitialData({
                        assetId: assetData.assetId,
                        assetName: assetData.name,
                        assetObjectId: assetData._id,
                        isAssetFlow: true,
                        isApprovalFlow: true,
                        isAccessoryFlow: true, // Flag for accessory
                        accessoryId: accessoryData.accessoryId,
                        accessoryName: accessoryData.name,
                        accessoryObjectId: accessoryData._id,
                        employeeId: assetData.assignedTo?.employeeId || '',
                        employeeName: assetData.assignedTo
                            ? `${assetData.assignedTo.firstName || ''} ${assetData.assignedTo.lastName || ''}`.trim()
                            : '',
                        assignedToType: assetData.assignedToType || (assetData.assignedCompany ? 'Company' : 'Employee'),
                        company: assetData.assignedCompany?._id || assetData.assignedCompany || null,
                        description: accessoryData.pendingActionDetails?.reason || '',
                        attachment: accessoryData.pendingActionDetails?.attachment || null,
                        fineAmount: accessoryData.amount ? String(accessoryData.amount) : '',
                        responsibleFor: assetData.assignedToType === 'Company' ? 'Company' : 'Employee'
                    });
                    setShowApprovalDialog(false);
                    setApprovalComment('');
                    setShowDamageModal(true);
                    setIsProcessingApproval(false);
                    return; // Don't refresh yet, wait for modal submission
                }
            } else {
                // Original asset action
                const response = await axiosInstance.put(`/AssetItem/${assetId}/approve-action`, {
                    approve,
                    comment: approvalComment
                });

                // Check if approval requires fine data (Loss and Damage without fineData)
                if (approve && response.data?.requiresFineData && response.data?.asset) {
                    const assetData = response.data.asset;
                    // Open Loss and Damage modal with existing data
                    setDamageInitialData({
                        assetId: assetData.assetId,
                        assetName: assetData.name,
                        assetObjectId: assetData._id,
                        isAssetFlow: true,
                        isApprovalFlow: true, // Flag to indicate this is from approval
                        employeeId: assetData.assignedTo?.employeeId || '',
                        employeeName: assetData.assignedTo
                            ? `${assetData.assignedTo.firstName || ''} ${assetData.assignedTo.lastName || ''}`.trim()
                            : '',
                        description: assetData.pendingActionDetails?.reason || '',
                        attachment: assetData.pendingActionDetails?.attachment || null,
                        fineAmount: asset?.assetValue ? String(asset.assetValue) : ''
                    });
                    setShowApprovalDialog(false);
                    setApprovalComment('');
                    setShowDamageModal(true);
                    setIsProcessingApproval(false);
                    return; // Don't refresh yet, wait for modal submission
                }
            }
            toast({
                title: approve ? "Approved" : "Rejected",
                description: approve
                    ? (pendingAccessory ? `Action for "${pendingAccessory.name}" approved.` : "Asset status updated. Fine created if applicable.")
                    : "Request rejected. Item returned to previous status."
            });
            setShowApprovalDialog(false);
            setShowRejectDialog(false);
            setApprovalComment('');
            fetchAssetDetails();
            fetchAssetHistory();
            // Clear query params
            router.replace(`/HRM/Asset/details/${assetId}`);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.message || "Failed to process approval." });
        } finally {
            setIsProcessingApproval(false);
        }
    };

    const handleFinalizeAction = async (approve) => {
        setIsProcessingFinalize(true);
        try {
            const pendingAccessory = asset.accessories?.find(acc => acc.pendingAction);
            if (pendingAccessory) {
                // Finalize accessory action
                await axiosInstance.put(`/AssetItem/${assetId}/accessories/${pendingAccessory._id}/finalize-action`, {
                    approve,
                    comment: finalizeComment
                });
            } else {
                // Original asset action
                await axiosInstance.put(`/AssetItem/${assetId}/finalize-action`, {
                    approve,
                    comment: finalizeComment
                });
            }
            toast({
                title: approve ? "Finalized" : "Declined",
                description: approve ? "Item status updated to final state." : "Update declined."
            });
            setShowFinalizeDialog(false);
            setFinalizeComment('');
            fetchAssetDetails();
            fetchAssetHistory();
            router.replace(`/HRM/Asset/details/${assetId}`);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.message || "Failed to process finalization." });
        } finally {
            setIsProcessingFinalize(false);
        }
    };

    useEffect(() => {
        if (authAction && asset && !showApprovalDialog) {
            // For Loss and Damage without fineData, open the Loss and Damage form modal directly
            if (asset.pendingAction === 'Loss and Damage' && !asset.pendingActionDetails?.fineData) {
                const assetData = asset;
                setDamageInitialData({
                    assetId: assetData.assetId,
                    assetName: assetData.name,
                    assetObjectId: assetData._id,
                    isAssetFlow: true,
                    isApprovalFlow: true,
                    employeeId: assetData.assignedTo?.employeeId || '',
                    employeeName: assetData.assignedTo
                        ? `${assetData.assignedTo.firstName || ''} ${assetData.assignedTo.lastName || ''}`.trim()
                        : '',
                    description: assetData.pendingActionDetails?.reason || '',
                    attachment: assetData.pendingActionDetails?.attachment || null,
                    fineAmount: asset?.assetValue ? String(asset.assetValue) : ''
                });
                setShowDamageModal(true);
            } else {
                // For other actions, show the approval dialog
                // Special check for accessory: only show dialog if there's a pending action
                if (authAction === 'accessory') {
                    setActiveTab('accessories');
                    const hasPendingAcc = asset.accessories?.some(acc => acc.pendingAction);
                    if (hasPendingAcc) {
                        setShowApprovalDialog(true);
                    }
                } else {
                    setShowApprovalDialog(true);
                }
            }
        }
    }, [authAction, asset]);

    // Handle tab parameter from URL (e.g., ?tab=accessories)
    useEffect(() => {
        if (tabParam && ['document', 'history', 'accessories', 'images', 'edit'].includes(tabParam)) {
            // Use a small timeout to ensure it runs after other state updates
            setTimeout(() => {
                setActiveTab(tabParam);
            }, 100);

            // Clear the tab parameter from URL after setting it (but keep other params like authAction)
            const newSearchParams = new URLSearchParams(searchParams.toString());
            newSearchParams.delete('tab');
            const newQuery = newSearchParams.toString();
            const newUrl = newQuery ? `/HRM/Asset/details/${assetId}?${newQuery}` : `/HRM/Asset/details/${assetId}`;
            router.replace(newUrl, { scroll: false });
        }
    }, [tabParam, assetId, router, searchParams]);

    useEffect(() => {
        if (reporteeAction && asset && !showFinalizeDialog) {
            setShowFinalizeDialog(true);
        }
    }, [reporteeAction, asset]);

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
            // Try employeeObjectId first (EmployeeBasic linkage), fallback to _id (User record)
            const currentId = user.employeeObjectId || user._id;
            const userId = user._id || user.id;
            setCurrentUserEmployeeId(currentId);
            setCurrentUserId(userId);

            // Fetch full user profile and then check for controller to ensure company context
            const fetchUserDataAndCheckController = async () => {
                try {
                    const [userRes, companyRes] = await Promise.all([
                        axiosInstance.get('/Employee/me'),
                        axiosInstance.get('/company')
                    ]);

                    if (userRes && userRes.data) {
                        setCurrentUser(userRes.data);
                        const actualId = userRes.data._id || userRes.data.id;
                        if (actualId) {
                            setCurrentUserEmployeeId(actualId);
                        }

                        const companies = companyRes.data.companies || [];

                        // Check flowchart responsibilities
                        const checkResponsibility = (cat) => companies.some(company =>
                            company.responsibilities?.some(r => {
                                if ((r.category || '').toLowerCase().replace(/\s+/g, '') !== cat.toLowerCase().replace(/\s+/g, '') || r.status !== 'Active') return false;
                                
                                // Resilient ID matching (case-insensitive and space-agnostic)
                                if (r.employeeId && userRes.data.employeeId) {
                                    const normalize = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '');
                                    if (normalize(r.employeeId) === normalize(userRes.data.employeeId)) return true;
                                }

                                const rEmpObjId = r.employeeObjectId?._id?.toString() || r.employeeObjectId?.toString();
                                const userEmpObjId = actualId?.toString() || userRes.data._id?.toString();
                                return rEmpObjId && userEmpObjId && rEmpObjId === userEmpObjId;
                            })
                        );

                        let hrFound = checkResponsibility('hr');
                        let assetControllerFound = checkResponsibility('assetcontroller');

                        // Align with backend: authorize via Flowchart (same as isUserInFlowchart). Company "responsibilities"
                        // can be out of sync with Flowchart, which breaks Approve/Reject for real controllers.
                        if (userRes.data?.employeeId) {
                            try {
                                const ctrlRes = await axiosInstance.get(
                                    `/AssetItem/unassigned/controller/${encodeURIComponent(userRes.data.employeeId)}`,
                                    { skipToast: true }
                                ).catch(() => null);
                                if (ctrlRes?.status === 200) assetControllerFound = true;
                            } catch {
                                /* non-controller returns 403 — expected */
                            }
                        }

                        setHasAssetController(companies.some(c => c.responsibilities?.some(r => r.category?.toLowerCase() === 'assetcontroller' && r.status === 'Active')));
                        setIsAssetController(!!assetControllerFound);

                        // Fallback: Also check via API endpoint (same as SalaryTab)
                        if (!hrFound && userRes.data.employeeId) {
                            try {
                                const hrCheckRes = await axiosInstance.get(`/AssetItem/company-assets/hr/${userRes.data.employeeId}`);
                                if (hrCheckRes.status === 200 && hrCheckRes.data.isHR) {
                                    hrFound = true;
                                }
                            } catch (hrErr) {
                                console.log('HR check via API failed (non-critical):', hrErr);
                            }
                        }

                        setIsHR(!!hrFound);
                    }
                } catch (err) {
                    console.error("Failed to fetch user profile or companies:", err);
                    // Fallback to basic company-wide check if profile fails
                    try {
                        const compRes = await axiosInstance.get('/company');
                        const companies = compRes.data.companies || [];
                        setHasAssetController(companies.some(c => c.responsibilities?.some(r => r.category?.toLowerCase() === 'assetcontroller' && r.status === 'Active')));
                    } catch (e) { }
                }
            };
            fetchUserDataAndCheckController();
        }
    }, []);

    const fetchAssetHistory = async () => {
        try {
            const response = await axiosInstance.get(`/AssetItem/${assetId}/history`);
            setAssetHistory(response.data);
            // Default first item to expanded
            if (response.data?.length > 0) {
                setExpandedHistory({ 0: true });
            }
        } catch (error) {
            console.error('Error fetching asset history:', error);
            toast({ variant: "destructive", title: "Error", description: "Failed to fetch history." });
        }
    };

    const downloadHistoryPdf = async (historyId) => {
        try {
            setIsDownloadingHistory(true);
            const response = await axiosInstance.get(`/AssetItem/history-handover-pdf/${historyId}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `HandoverForm-${asset?.assetId}-History.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast({ title: "Success", description: "Historical handover form downloaded." });
        } catch (error) {
            console.error('Failed to download historical PDF:', error);
            toast({ variant: "destructive", title: "Error", description: "Failed to download historical form." });
        } finally {
            setIsDownloadingHistory(false);
        }
    };

    const toggleHistory = (idx) => {
        setExpandedHistory(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
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

    const finalizeResponse = async (forcedAction = null) => {
        try {
            const action = forcedAction || responseAction;
            await axiosInstance.put(`/AssetItem/${assetId}/respond`, {
                action,
                comments: responseComment,
                file: responseFile
            });
            toast({
                title: "Success",
                description: `Asset assignment ${action === 'Accept' || action === 'AcceptWithComments' ? 'accepted' : 'rejected'} successfully.`
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

    const handleAddAccessory = async () => {
        if (!newAccessory.name || !newAccessory.amount) {
            toast({ variant: 'destructive', title: 'Error', description: 'Name and amount are required.' });
            return;
        }

        try {
            let updatedAccessories;

            if (editingAccessory) {
                // Edit existing accessory
                updatedAccessories = asset.accessories.map(acc =>
                    acc._id === editingAccessory._id
                        ? { ...acc, name: newAccessory.name, amount: Number(newAccessory.amount) || 0, description: newAccessory.description }
                        : acc
                );
            } else {
                // Add new accessory
                updatedAccessories = [...(asset.accessories || []), {
                    name: newAccessory.name,
                    amount: Number(newAccessory.amount) || 0,
                    description: newAccessory.description,
                    status: 'Attached'
                }];
            }

            const response = await axiosInstance.put(`/AssetType/${asset._id}`, {
                accessories: updatedAccessories
            });

            toast({ title: 'Success', description: editingAccessory ? 'Accessory updated successfully.' : 'Accessory added successfully.' });
            setNewAccessory({ name: '', amount: '', description: '' });
            setEditingAccessory(null);
            setShowAddAccessoryForm(false);
            fetchAssetDetails();
        } catch (error) {
            console.error('Failed to save accessory:', error);
            toast({ variant: 'destructive', title: 'Error', description: error.response?.data?.message || 'Failed to save accessory.' });
        }
    };

    const handleEditAccessory = (accessory) => {
        setEditingAccessory(accessory);
        setNewAccessory({
            name: accessory.name || '',
            amount: accessory.amount != null ? String(accessory.amount) : '',
            description: accessory.description || ''
        });
        setShowAddAccessoryForm(true);
    };

    const fetchAssetDetails = async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get(`/AssetItem/detail/${assetId}`);
            setAsset(response.data);
            // Auto-switch removed to keep document/form visible per user request
            if (response.data.status === 'Service') {
                // setActiveTab('edit');
            }
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

    const fetchEmployees = async () => {
        try {
            const response = await axiosInstance.get('/employee');
            setEmployees(response.data.employees || []);
        } catch (error) {
            console.error('Failed to fetch employees:', error);
        }
    };

    useEffect(() => {
        if (assetId) {
            fetchAssetDetails();
            fetchAssetHistory();
            fetchEmployees();
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

    const userHistoryCount = useMemo(() => {
        if (!assetHistory) return 0;
        // Count unique users who were ever assigned this asset
        const recipients = new Set();
        assetHistory.forEach(h => {
            if (h.assignedTo?._id) recipients.add(h.assignedTo._id.toString());
            // If assignedTo is just a string (ID) in older records
            else if (typeof h.assignedTo === 'string') recipients.add(h.assignedTo);
        });
        return recipients.size || 0;
    }, [assetHistory]);

    const serviceHistoryCount = useMemo(() => {
        if (!assetHistory) return 0;
        // Count each time the asset was sent to service OR received from service
        // Usually 1 Send action = 1 service session.
        return assetHistory.filter(h =>
            h.action?.toLowerCase().includes('service') ||
            h.action?.toLowerCase().includes('maintenance') ||
            h.action?.toLowerCase().includes('repair')
        ).length;
    }, [assetHistory]);

    const assetAge = useMemo(() => {
        if (asset?.assignedTo && assetHistory?.length > 0) {
            // Find when this asset was assigned to this specific user
            const assignmentEvent = [...assetHistory].find(h => h.action === 'Assigned' && (h.assignedTo?._id === asset.assignedTo._id || h.assignedTo === asset.assignedTo._id));
            if (assignmentEvent) return calculateAge(assignmentEvent.date);
        }
        return calculateAge(asset?.purchaseDate || asset?.createdAt);
    }, [asset, assetHistory]);
    const warrantyRemaining = useMemo(() => calculateWarrantyStatus(asset?.purchaseDate, asset?.warrantyYears), [asset?.purchaseDate, asset?.warrantyYears]);

    const assignedSince = useMemo(() => {
        if (!asset?.assignedTo || !assetHistory?.length > 0) return 'N/A';
        const assignmentEvent = [...assetHistory].find(h => h.action === 'Assigned' && (h.assignedTo?._id === asset.assignedTo._id || h.assignedTo === asset.assignedTo._id));
        if (!assignmentEvent) return 'N/A';
        return calculateAge(assignmentEvent.date);
    }, [asset, assetHistory]);

    // Find the latest handover document from asset history for unassigned assets
    const latestHandoverDocument = useMemo(() => {
        if (!assetHistory || assetHistory.length === 0) return null;

        // Find the most recent "Assigned" or "Accepted" action that has details snapshot
        // Sort by date descending to get the latest first
        const sortedHistory = [...assetHistory].sort((a, b) => new Date(b.date) - new Date(a.date));

        const latestHandover = sortedHistory.find(h =>
            (h.action === 'Assigned' || h.action === 'Accepted') &&
            h.details &&
            h.details.assignedTo // Ensure it has assignment data
        );

        return latestHandover || null;
    }, [assetHistory]);

    const groupedHistory = useMemo(() => {
        if (!assetHistory) return [];
        // Sort by date ascending to process the workflow-then-response logic
        const sorted = [...assetHistory].sort((a, b) => new Date(a.date) - new Date(b.date));

        const groups = [];

        sorted.forEach(item => {
            const action = item.action;
            const details = item.details || {};

            // Identify action types
            const isAssigned = action === 'Assigned';
            const isActionReq = details.type?.includes('Action') || ['Transfer', 'On Leave', 'End of Life', 'Out of Service'].includes(action);
            const isServiceSend = ['Service', 'Service Send'].includes(action);
            const isServiceReceive = ['Live', 'Service Receive', 'Restored'].includes(action);
            const isResponse = ['Accepted', 'Rejected', 'Comment', 'AcceptWithComments'].includes(action);
            const isStandalone = ['Created', 'Returned', 'Unassigned', 'On Leave', 'End of Life', 'Out of Service', 'Transfer'].includes(action) && !isResponse;

            // 1. Try to find a group to attach this response/event to
            let targetGroup = null;

            if (isResponse) {
                // Find most recent open Assignment, Action, Service, or Creation group that matches
                const accId = details.accessoryId || details.accessoryObjectId || (details.details?.accessoryId);
                targetGroup = [...groups].reverse().find(g => {
                    if (g.isFinalized) return false;
                    // Match with Assignment, Action, Service, or Creation groups
                    if (g.type !== 'Assignment' && g.type !== 'Action' && g.type !== 'Service' && g.type !== 'Creation') return false;

                    // Match accessory IDs if applicable
                    if (accId) {
                        const gAccId = g.request.details?.accessoryId || g.request.details?.accessoryObjectId;
                        if (gAccId && gAccId !== accId) return false;
                    }
                    return true;
                });
            } else if (isServiceReceive) {
                // Match with most recent open Service session
                targetGroup = [...groups].reverse().find(g => !g.isFinalized && g.type === 'Service');
            }

            if (targetGroup) {
                // Add response to existing group
                targetGroup.responses.push(item);
                if (item.details) targetGroup.latestSnapshotAction = item;
                // Finalize group if it's a final response
                if (action === 'Accepted' || action === 'Rejected' || isServiceReceive) {
                    targetGroup.isFinalized = true;
                }
            } else {
                // 2. Create new group for this action
                let title = action;
                let groupType = 'Standalone';
                let isFinalized = true;

                if (isAssigned) {
                    title = "Assignment Approval Process";
                    groupType = 'Assignment';
                    isFinalized = false; // Waiting for response
                } else if (isActionReq) {
                    const act = details.action || action;
                    if (act === 'Transfer') {
                        title = "Transfer Request";
                        groupType = 'Action';
                        isFinalized = false;
                    } else if (act === 'Loss and Damage') {
                        title = "Loss & Damage Investigation";
                        groupType = 'Action';
                        isFinalized = false;
                    } else if (act === 'End of Life') {
                        title = "End of Life Decommissioning";
                        groupType = 'Action';
                        isFinalized = false;
                    } else if (act === 'On Leave') {
                        title = "Asset On Leave Request";
                        groupType = 'Action';
                        isFinalized = false;
                    } else {
                        title = `${act} Request Flow`;
                        groupType = 'Action';
                        isFinalized = false;
                    }
                } else if (action === 'Created') {
                    title = "Asset Onboarding & Creation";
                    groupType = 'Creation';
                    isFinalized = false; // May have responses
                } else if (action === 'Returned') {
                    title = "Asset Return Sequence";
                    groupType = 'Standalone';
                    isFinalized = true;
                } else if (action === 'Unassigned') {
                    title = "Manager Reclamation";
                    groupType = 'Standalone';
                    isFinalized = true;
                } else if (isServiceSend) {
                    title = "Service/Maintenance Session";
                    groupType = 'Service';
                    isFinalized = false; // Waiting for Service Receive
                } else if (isServiceReceive) {
                    title = "Service Restoration (Live)";
                    groupType = 'Service';
                    isFinalized = true;
                } else if (action === 'On Leave') {
                    title = "Asset On Leave";
                    groupType = 'Action';
                    isFinalized = true;
                } else if (action === 'End of Life') {
                    title = "End of Life";
                    groupType = 'Action';
                    isFinalized = true;
                } else if (action === 'Out of Service') {
                    title = "Out of Service";
                    groupType = 'Action';
                    isFinalized = true;
                } else if (action === 'Transfer') {
                    title = "Asset Transfer";
                    groupType = 'Action';
                    isFinalized = true;
                } else if (action === 'Restored') {
                    title = "Asset Restored";
                    groupType = 'Action';
                    isFinalized = true;
                } else {
                    // Default: Use action name as title
                    title = action;
                    groupType = 'Standalone';
                    isFinalized = true;
                }

                const newGroup = {
                    id: item._id,
                    title: title,
                    type: groupType,
                    request: item,
                    responses: [],
                    isFinalized: isFinalized,
                    latestSnapshotAction: item.details ? item : null
                };
                groups.push(newGroup);
            }
        });

        return groups.reverse();
    }, [assetHistory]);

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
        <div className="flex h-screen w-full max-w-full overflow-hidden" style={{ backgroundColor: '#F2F6F9' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
                <Navbar />
                <div className="flex-1 overflow-y-auto p-8 scroll-smooth">

                    {/* Missing Asset Controller Warning */}
                    {!hasAssetController && (
                        <div className="mb-6 animate-in slide-in-from-top-4 duration-500">
                            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm flex items-start gap-4 ring-1 ring-amber-500/10">
                                <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
                                    <ShieldCheck size={20} className="animate-pulse" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-amber-900 font-bold text-sm">Action Required: No Asset Controller Identified</h3>
                                    <p className="text-amber-800/80 text-xs mt-1 leading-relaxed">
                                        The organization flowchart does not designate an <strong>Asset Controller</strong>.
                                        All management operations (Assign, Service, EOL, edits) are disabled until a controller is assigned in
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
                            {/* Proactive Action Banner — for managers to approve or reportees to acknowledge */}
                            {(() => {
                                if (!asset) return null;

                                // Creation approval: backend allows Draft or Pending (see approve-creation). Do not treat
                                // assignment acknowledgment (Pending + assignee acceptance) as creation approval.
                                const isAssignmentAcknowledgmentCase =
                                    asset?.acceptanceStatus === 'Pending' &&
                                    !asset?.pendingAction &&
                                    (asset?.status === 'Pending' || asset?.status === 'Assigned') &&
                                    asset?.assignedTo;

                                // Draft: always show creation-approval banner (API may omit actionRequiredBy). Pending: needs designated approver.
                                const isAwaitingCreationApprovalUi =
                                    asset?.status === 'Draft' ||
                                    (asset?.actionRequiredBy != null &&
                                        asset?.status === 'Pending' &&
                                        !isAssignmentAcknowledgmentCase &&
                                        // Do not show the creation banner when this is an asset action (Loss & Damage / EOL / Leave)
                                        !asset?.pendingAction);

                                if (isAwaitingCreationApprovalUi) {
                                    const approverName = getAssetApproverDisplayName(asset);

                                    const isAdmin = currentUser?.isAdmin || currentUser?.role === 'Admin' || currentUser?.role === 'ROOT';
                                    const serverAllows =
                                        asset.canApproveAssetCreation === true ||
                                        asset.canApproveAssetCreation === 'true';
                                    const clientDesignated = clientMatchesCreationApprover(
                                        asset,
                                        currentUserEmployeeId,
                                        currentUser
                                    );
                                    // Designated approver (matches actionRequiredBy) or admin — aligned with approve-creation API
                                    const isActionRequired =
                                        serverAllows || isAdmin || clientDesignated;

                                    if (isActionRequired) {
                                        return (
                                            <div className="flex items-center gap-4 px-6 py-3 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm" style={{ animation: 'pulse 2s infinite' }}>
                                                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                                                    <Plus size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Asset Creation Approval</p>
                                                    <p className="text-[13px] font-bold text-amber-900 leading-none">
                                                        {asset?.status === 'Draft'
                                                            ? `This asset is in Draft. Approval required${approverName ? ` — ${approverName}` : ''}.`
                                                            : `This asset is awaiting creation approval. Approval required by ${approverName || 'Asset Controller'}.`}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 ml-4">
                                                    <button
                                                        onClick={() => handleAssetCreationResponse('Approve')}
                                                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-100"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleAssetCreationResponse('Reject')}
                                                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-red-100"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>

                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="flex items-center gap-4 px-6 py-4 bg-amber-50/50 border border-amber-100 rounded-3xl backdrop-blur-sm">
                                            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm border border-amber-200">
                                                <RotateCw size={18} className="animate-spin-slow" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Pending Approval</p>
                                                <p className="text-[13px] font-bold text-amber-900 leading-none">
                                                    Awaiting creation approval{approverName ? ` — ${approverName}` : ''}...
                                                </p>
                                            </div>
                                        </div>
                                    );
                                }

                                if (!currentUserEmployeeId) return null;

                                // Assignment Acknowledgment Banner - Only show for actual assignments, not for other workflows
                                const isActionRequiredByMe = (asset.actionRequiredBy?._id?.toString() || asset.actionRequiredBy?.toString()) === currentUserEmployeeId?.toString();
                                const isAssignmentPending = asset.acceptanceStatus === 'Pending' &&
                                    !asset.pendingAction &&
                                    (asset.status === 'Pending' || asset.status === 'Assigned');

                                // Delegate banner: if assigned employee has NO ERP login access, their primaryReportee can acknowledge
                                const primaryReporteeId =
                                    asset?.assignedTo?.primaryReportee?._id?.toString?.() ||
                                    asset?.assignedTo?.primaryReportee?.toString?.() ||
                                    null;
                                const isPrimaryReporteeAssignmentDelegate = isAssignmentPending &&
                                    asset?.assignedToType === 'Employee' &&
                                    asset?.assignedTo &&
                                    asset?.assignedTo?.enablePortalAccess === false &&
                                    !!primaryReporteeId &&
                                    primaryReporteeId === currentUserEmployeeId?.toString();

                                // For company-assigned assets, HR can approve
                                const isCompanyAsset = asset.assignedToType === 'Company' && asset.assignedCompany;
                                const isHRApprovingCompany = isCompanyAsset && isHR && isActionRequiredByMe && isAssignmentPending;

                                if ((isActionRequiredByMe && isAssignmentPending) || isPrimaryReporteeAssignmentDelegate || isHRApprovingCompany) {
                                    return (
                                        <div className="flex items-center gap-4 px-6 py-3 bg-blue-50 border border-blue-200 rounded-2xl shadow-sm" style={{ animation: 'pulse 2s infinite' }}>
                                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                                                <UserPlus size={20} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none mb-1">Assignment Acknowledgment</p>
                                                <p className="text-[13px] font-bold text-blue-900 leading-none">
                                                    {asset.assignedToType === 'Company' ? `Acknowledgment required for ${asset.assignedCompany?.name || 'Company allocation'}.` : 'Please accept or respond to this asset assignment.'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 ml-4">
                                                <button
                                                    onClick={() => { if (!checkSignature()) return; finalizeDirectAccept(); }}
                                                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-100"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={() => openResponseModal('Reject')}
                                                    className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-rose-100"
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => openResponseModal('AcceptWithComments')}
                                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-blue-100"
                                                >
                                                    Respond
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }

                                // Asset Action Approval Banner (Loss & Damage, End of Life, Leave) - ONLY for assets, not accessories
                                const isAssetActionPending = asset.pendingAction &&
                                    asset.actionRequiredBy?._id?.toString() === currentUserEmployeeId?.toString() &&
                                    // Completely exclude if ANY accessory has pending action
                                    !asset.accessories?.some(acc => acc.pendingAction);

                                // Check if this is a bulk transfer
                                const isBulkTransfer = asset.pendingActionDetails?.isBulk === true;
                                const bulkAssetIds = asset.pendingActionDetails?.bulkAssetIds || [];

                                if (isAssetActionPending) {
                                    return (
                                        <div className="flex flex-col gap-4 px-6 py-4 bg-red-50 border border-red-200 rounded-2xl shadow-sm" style={{ animation: 'pulse 2s infinite' }}>
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                                                    <AlertCircle size={20} />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-none mb-1">
                                                        Asset Action Approval {isBulkTransfer ? '(Bulk Transfer)' : ''}
                                                    </p>
                                                    <p className="text-[13px] font-bold text-red-900 leading-none">
                                                        {asset.pendingAction} request requires your approval.
                                                        {isBulkTransfer && bulkAssetIds.length > 0 && (
                                                            <span className="block text-[11px] font-semibold text-red-700 mt-1">
                                                                This is part of a bulk transfer affecting {bulkAssetIds.length} asset{bulkAssetIds.length > 1 ? 's' : ''}.
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {/* View supporting data / open fine modal (Loss & Damage) */}
                                                    {asset?.pendingAction === 'Loss and Damage' && (
                                                        <button
                                                            onClick={() => {
                                                                const assetData = asset;
                                                                setDamageInitialData({
                                                                    assetId: assetData.assetId,
                                                                    assetName: assetData.name,
                                                                    assetObjectId: assetData._id,
                                                                    isAssetFlow: true,
                                                                    isApprovalFlow: true, // opens modal in approval mode
                                                                    employeeId: assetData.assignedTo?.employeeId || '',
                                                                    employeeName: assetData.assignedTo
                                                                        ? `${assetData.assignedTo.firstName || ''} ${assetData.assignedTo.lastName || ''}`.trim()
                                                                        : '',
                                                                    description: assetData.pendingActionDetails?.reason || '',
                                                                    attachment: assetData.pendingActionDetails?.attachment || null,
                                                                    fineAmount: asset?.assetValue ? String(asset.assetValue) : ''
                                                                });
                                                                setShowDamageModal(true);
                                                            }}
                                                            disabled={isProcessingApproval}
                                                            className="px-6 py-3 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-slate-100"
                                                        >
                                                            View
                                                        </button>
                                                    )}
                                                    {asset?.pendingAction !== 'Loss and Damage' && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    setShowApprovalDialog(true);
                                                                }}
                                                                disabled={isProcessingApproval}
                                                                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-100"
                                                            >
                                                                {isBulkTransfer && bulkAssetIds.length > 1 ? 'Approve All' : 'Approve'}
                                                            </button>
                                                            <button
                                                                onClick={() => setShowRejectDialog(true)}
                                                                disabled={isProcessingApproval}
                                                                className="px-6 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-rose-100"
                                                            >
                                                                {isBulkTransfer && bulkAssetIds.length > 1 ? 'Reject All' : 'Reject'}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Bulk Transfer Assets List */}
                                            {isBulkTransfer && bulkAssetIds.length > 0 && (
                                                <div className="mt-2 pt-3 border-t border-red-200">
                                                    <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-2">
                                                        Assets in this bulk transfer ({bulkAssetIds.length}):
                                                    </p>
                                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                                        {bulkAssetIds.map((bulkAssetId, idx) => {
                                                            const isCurrentAsset = bulkAssetId === asset._id?.toString();
                                                            return (
                                                                <div
                                                                    key={bulkAssetId || idx}
                                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold ${isCurrentAsset
                                                                        ? 'bg-red-100 border border-red-300 text-red-800'
                                                                        : 'bg-white border border-red-100 text-red-700 hover:bg-red-50 cursor-pointer'
                                                                        }`}
                                                                    onClick={() => {
                                                                        if (!isCurrentAsset && bulkAssetId) {
                                                                            router.push(`/HRM/Asset/details/${bulkAssetId}`);
                                                                        }
                                                                    }}
                                                                >
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                                    <span className="flex-1">
                                                                        {isCurrentAsset ? (
                                                                            <span className="font-black">{asset.assetId} (Current Asset)</span>
                                                                        ) : (
                                                                            <span className="hover:underline">
                                                                                Asset ID: {bulkAssetId.toString().substring(0, 8)}... (Click to view)
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                return null;
                            })()}
                        </div>
                    </div>

                    {/* Row 1: Asset Profile & History Stats */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* Left Card: Asset Profile Card */}
                        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 flex flex-col relative group" style={{ minHeight: '280px' }}>
                            <div className="p-6 flex flex-col h-full">
                                <div className="flex flex-row gap-5 flex-1">
                                    {/* Image Section */}
                                    <div className="w-28 h-28 rounded-xl bg-sky-50 border border-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden shadow-sm group-hover:border-blue-100 transition-all">
                                        {asset.assetPhoto ? (
                                            <img
                                                src={asset.assetPhoto}
                                                alt={asset.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="text-blue-300 font-black text-3xl">
                                                {asset.name?.substring(0, 1).toUpperCase()}
                                            </div>
                                        )}
                                    </div>

                                    {/* Main Info */}
                                    <div className="flex-1">
                                        <h1 className="text-lg font-black text-slate-800 leading-tight mb-2 tracking-tight">
                                            {asset.name}
                                        </h1>

                                        {/* Status Badges */}
                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${asset.status === 'Assigned' ? 'bg-[#5CD1FF] text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {asset.status || 'Available'}
                                            </span>
                                            <span className="px-3 py-1 rounded-full bg-[#5CD1FF] text-white text-[9px] font-black uppercase tracking-widest">
                                                {assetAge}
                                            </span>
                                        </div>

                                        <div className="space-y-0.5 mt-2">
                                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">
                                                {asset.categoryId?.name || 'GENERIC CATEGORY'}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                                {asset.description || 'No description provided'}
                                            </p>
                                            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-3">


                                                <span className="text-[12px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded border border-emerald-100/50 shadow-sm">
                                                    Total: {new Intl.NumberFormat().format((asset.assetValue || 0) + (asset.accessories || []).reduce((sum, acc) => sum + (Number(acc.amount) || 0), 0))} AED
                                                </span>
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {warrantyRemaining}
                                            </p>
                                            {(asset.assignedTo || asset.assignedCompany) && (asset.status === 'Assigned' || asset.status === 'Service' || asset.acceptanceStatus === 'Approved') && (
                                                <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                    <User size={12} className="text-blue-500" />
                                                    <span>Assigned To:</span>
                                                    <span className="text-blue-600 font-black">
                                                        {asset.assignedToType === 'Company' ? asset.assignedCompany?.name : `${asset.assignedTo?.firstName || ""} ${asset.assignedTo?.lastName || ""}`}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Asset ID Badge */}
                                        <div className="absolute top-8 right-8 lg:static lg:mt-6">
                                            <p className="text-[14px] font-black text-red-500 tracking-[0.2em] uppercase bg-red-50/50 px-3 py-1 rounded-lg">
                                                {asset.assetId}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Assignee Panel */}
                                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 mt-auto">
                                    <div>
                                        <p className="text-[12px] font-black text-slate-800 uppercase tracking-tighter">
                                            {asset.assignedToType === 'Company' ? (asset.assignedCompany?.name || 'Company Assigned') : ((asset.assignedTo && (asset.status === 'Assigned' || asset.acceptanceStatus === 'Approved')) ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : 'UNASSIGNED')}
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                            {(asset.assignedTo || asset.assignedCompany) && (asset.status === 'Assigned' || asset.acceptanceStatus === 'Approved') ? `Since ${assignedSince}` : 'Available for assignment'}
                                        </p>
                                    </div>

                                    {(asset.status === 'Pending' || asset.status === 'Draft' || asset.acceptanceStatus === 'Pending') && (
                                        <div className="px-4 py-1.5 bg-rose-50 rounded-2xl border border-rose-100 shadow-sm animate-pulse">
                                            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                                                WAITING: {getAssetApproverDisplayName(asset)
                                                    || (asset.status === 'Draft' ? 'Approval' : 'Acknowledgment')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Card: History & Actions */}
                        <div className="rounded-2xl overflow-hidden shadow-sm text-white flex flex-col" style={{ backgroundColor: '#29b6f6', minHeight: '280px' }}>
                            <div className="h-full flex flex-row p-6 gap-6">

                                {/* Left: Info */}
                                <div className="flex flex-col justify-center gap-6" style={{ width: '38%' }}>
                                    <h3 className="text-2xl font-black text-white leading-tight">Asset History</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[13px] font-semibold text-white">Assigned Users</span>
                                            <span className="text-[13px] font-bold text-white">= {userHistoryCount}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[13px] font-semibold text-white">Service History</span>
                                            <span className="text-[13px] font-bold text-white">= {serviceHistoryCount}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Buttons */}
                                <div className="flex-1 flex flex-col gap-3 content-center">
                                    {/* HR Approval Button for Company-Assigned Assets */}
                                    {(() => {
                                        if (!asset || !currentUserEmployeeId) return null;

                                        const isCompanyAsset = asset.assignedToType === 'Company' && asset.assignedCompany;
                                        if (!isCompanyAsset) return null;

                                        const actionRequiredById = asset.actionRequiredBy?._id?.toString() || asset.actionRequiredBy?.toString();
                                        const loggedInEmployeeId = currentUserEmployeeId?.toString();

                                        // Show button if:
                                        // 1. Asset is assigned to company
                                        // 2. User is HR
                                        // 3. actionRequiredBy matches logged-in user
                                        // 4. Either status is Pending OR acceptanceStatus is Pending OR there's a pendingAction
                                        const isPendingAssignment = asset.acceptanceStatus === 'Pending' && !asset.pendingAction;
                                        const isPendingAction = asset.pendingAction && (asset.pendingAction === 'End of Life' || asset.pendingAction === 'Loss and Damage');
                                        const isPendingStatus = asset.status === 'Pending';

                                        // Debug logging (remove in production)
                                        console.log('[HR Approval Button Debug]', {
                                            isHR,
                                            isCompanyAsset,
                                            actionRequiredById,
                                            loggedInEmployeeId,
                                            matches: actionRequiredById === loggedInEmployeeId,
                                            isPendingStatus,
                                            isPendingAssignment,
                                            isPendingAction,
                                            assetStatus: asset.status,
                                            acceptanceStatus: asset.acceptanceStatus,
                                            pendingAction: asset.pendingAction
                                        });

                                        const shouldShowApprovalButton = isHR &&
                                            actionRequiredById &&
                                            loggedInEmployeeId &&
                                            actionRequiredById === loggedInEmployeeId &&
                                            (isPendingStatus || isPendingAssignment || isPendingAction);

                                        if (!shouldShowApprovalButton) return null;

                                        // Check if it's an assignment approval or action approval
                                        const isAssignmentApproval = asset.acceptanceStatus === 'Pending' && !asset.pendingAction;
                                        const isActionApproval = asset.pendingAction && (asset.pendingAction === 'End of Life' || asset.pendingAction === 'Loss and Damage');

                                        return (
                                            <button
                                                onClick={() => {
                                                    if (isAssignmentApproval) {
                                                        // For assignment approvals, open response modal
                                                        if (!checkSignature()) return;
                                                        finalizeDirectAccept();
                                                    } else if (isActionApproval) {
                                                        // For Loss and Damage without fineData, open the Loss and Damage form modal directly
                                                        if (asset.pendingAction === 'Loss and Damage' && !asset.pendingActionDetails?.fineData) {
                                                            const assetData = asset;
                                                            setDamageInitialData({
                                                                assetId: assetData.assetId,
                                                                assetName: assetData.name,
                                                                assetObjectId: assetData._id,
                                                                isAssetFlow: true,
                                                                isApprovalFlow: true,
                                                                employeeId: assetData.assignedTo?.employeeId || '',
                                                                employeeName: assetData.assignedTo
                                                                    ? `${assetData.assignedTo.firstName || ''} ${assetData.assignedTo.lastName || ''}`.trim()
                                                                    : '',
                                                                description: assetData.pendingActionDetails?.reason || '',
                                                                attachment: assetData.pendingActionDetails?.attachment || null,
                                                                fineAmount: asset?.assetValue ? String(asset.assetValue) : ''
                                                            });
                                                            setShowDamageModal(true);
                                                        } else {
                                                            // For other action approvals, navigate to approval dialog
                                                            router.push(`/HRM/Asset/details/${assetId}?authAction=true`);
                                                        }
                                                    }
                                                }}
                                                className="w-full px-4 py-3 bg-amber-500 text-white rounded-xl text-[12px] font-black hover:bg-amber-600 transition-all shadow-md shadow-amber-200 flex items-center justify-center gap-2 uppercase tracking-widest"
                                            >
                                                <CheckCircle2 size={16} />
                                                {isAssignmentApproval ? 'ACCEPT ASSIGNMENT' : 'REVIEW APPROVAL'}
                                            </button>
                                        );
                                    })()}

                                    <div className="grid grid-cols-2 gap-3 content-center">
                                        {[
                                            { label: 'Edit Asset', onClick: () => setShowEditModal(true) },
                                            {
                                                label: asset.status === 'Assigned' ? 'Reassign' : 'Assign',
                                                onClick: () => setShowAssignModal(true),
                                                disabled: asset.status === 'Service'
                                            },
                                            {
                                                label: 'Loss and Damage', onClick: () => {
                                                    const targetEmployee = asset?.assignedTo || asset?.assetController;
                                                    setDamageInitialData({
                                                        assetId: asset?.assetId,
                                                        assetName: asset?.name,
                                                        assetObjectId: asset?._id,
                                                        isAssetFlow: true,
                                                        isInitialRequest: true, // Flag for initial request
                                                        employeeId: targetEmployee?.employeeId || '',
                                                        employeeName: targetEmployee
                                                            ? `${targetEmployee.firstName || ''} ${targetEmployee.lastName || ''}`.trim()
                                                            : '',
                                                        fineAmount: asset?.assetValue ? String(asset.assetValue) : ''
                                                    });
                                                    setShowDamageModal(true);
                                                }
                                            },
                                            {
                                                label: 'End of life', onClick: () => {
                                                    setAssetActionType('End of Life');
                                                    setShowEndOfLifeModal(true);
                                                }
                                            },
                                            {
                                                label: asset.status === 'Service' ? 'Live' : 'Service', onClick: () => {
                                                    if (asset.status === 'Service') {
                                                        setShowMarkAsLiveModal(true);
                                                    } else {
                                                        setShowServiceModal(true);
                                                    }
                                                }
                                            },
                                            { label: 'Transfer Asset', onClick: () => setShowTransferModal(true) },
                                            { label: 'Return Asset', onClick: () => setShowReturnModal(true) },
                                            { label: 'Delete Asset', onClick: () => setShowDeleteModal(true) }
                                        ].filter((action) => {

                                            // Only show Transfer Asset button when status is "Assigned"
                                            if (action.label === 'Transfer Asset') {
                                                return asset?.status === 'Assigned';
                                            }
                                            return true;
                                        }).map((action, i) => {
                                            const isAdmin = currentUser?.isAdmin || currentUser?.role === 'Admin' || currentUser?.role === 'ROOT';
                                            const isAssetController = currentUserEmployeeId?.toString() === asset?.assetControllerId?.toString() ||
                                                currentUserEmployeeId?.toString() === `flowchart_assetcontroller`;
                                            const isAuthorized = isAdmin || isAssetController;

                                            const assignedToRef = asset?.assignedTo?._id ?? asset?.assignedTo;
                                            const isAssignedUser =
                                                !!assignedToRef &&
                                                currentUserEmployeeId?.toString() === assignedToRef.toString();

                                            // Assigner (asset.assignedBy) full permission
                                            const assignedByRef = asset?.assignedBy?._id ?? asset?.assignedBy;
                                            const isAssignerUser =
                                                !!assignedByRef &&
                                                currentUserEmployeeId?.toString() === assignedByRef.toString();

                                            // Delegate: if assignee has NO companyEmail, enable their primaryReportee
                                            const assigneeCompanyEmail = asset?.assignedTo?.companyEmail;
                                            const assigneeHasCompanyEmail = !!(assigneeCompanyEmail && String(assigneeCompanyEmail).trim().length > 0);
                                            const primaryReporteeRef = asset?.assignedTo?.primaryReportee?._id ?? asset?.assignedTo?.primaryReportee;
                                            const isPrimaryReporteeDelegate = !assigneeHasCompanyEmail &&
                                                !!primaryReporteeRef &&
                                                currentUserEmployeeId?.toString() === primaryReporteeRef.toString();

                                            // Check if current user is the creator
                                            const isCreator = asset?.createdBy?._id?.toString() === currentUserId ||
                                                asset?.createdBy?.toString() === currentUserId;

                                            const isOutOfService = asset.status === 'Out of Service';
                                            const isAlreadyPending = asset.status === 'Pending' || asset.status === 'Draft';
                                            const isDraft = asset.status === 'Draft';
                                            const isPending = asset.status === 'Pending';

                                            // Draft always in creation-approval flow; Pending only when a designated approver is set
                                            const isAwaitingCreationApproval =
                                                isDraft ||
                                                (isPending &&
                                                    asset.actionRequiredBy !== null &&
                                                    asset.actionRequiredBy !== undefined);

                                            // Loss & Damage and End of Life: only block if ALREADY pending
                                            const isActionBtn = action.label === 'Loss and Damage' || action.label === 'End of life';
                                            const isEditBtn = action.label === 'Edit Asset';
                                            const isDeleteBtn = action.label === 'Delete Asset';
                                            const isAccessoriesBtn = action.label === 'Accessories';
                                            const isReturnAssetBtn = action.label === 'Return Asset';


                                            // NEW PERMISSION LOGIC:
                                            // If asset is assigned: Assigned user + Asset Controller + Admin can do all operations
                                            // If asset is unassigned: Only Asset Controller + Admin can do all operations
                                            // SPECIAL CASE FOR EDIT BUTTON:
                                            // - If awaiting creation approval (Draft/Pending with actionRequiredBy): Creator + Asset Controller + Admin can edit
                                            // - If NOT awaiting approval: Only Asset Controller + Admin can edit (creator disabled)
                                            const isUnassigned = !asset.assignedTo;

                                            let hasPermission = false;
                                            if (isEditBtn) {
                                                // Edit Asset button special logic
                                                if (isAwaitingCreationApproval) {
                                                    // Awaiting creation approval: Creator + Asset Controller + Admin can edit
                                                    hasPermission = isCreator || isAuthorized || isAssignedUser;
                                                } else {
                                                    // Not awaiting approval: Asset Controller/Admin OR the assigned user can edit
                                                        hasPermission = isAuthorized || isAssignedUser || isAssignerUser || isPrimaryReporteeDelegate;
                                                }
                                            } else if (isDeleteBtn) {
                                                // Delete Asset button permission (same as Edit)
                                                if (isAwaitingCreationApproval) {
                                                    // Awaiting creation approval: Creator + Asset Controller + Admin can delete
                                                    hasPermission = isCreator || isAuthorized || isAssignedUser;
                                                } else {
                                                    // Not awaiting approval: Asset Controller/Admin OR the assigned user can delete
                                                        hasPermission = isAuthorized || isAssignedUser || isAssignerUser || isPrimaryReporteeDelegate;
                                                }
                                            } else if (isReturnAssetBtn) {
                                                // Return: assignee + AC + admin; unassigned pool → AC + admin only
                                                    hasPermission = isUnassigned ? isAuthorized : isAuthorized || isAssignedUser || isAssignerUser || isPrimaryReporteeDelegate;
                                            } else {

                                                // Other buttons: Use standard permission logic
                                                if (isUnassigned) {
                                                    // Unassigned: Only Asset Controller + Admin
                                                    hasPermission = isAuthorized;
                                                } else {
                                                    // Assigned: Assigned user + Asset Controller + Admin
                                                        hasPermission = isAuthorized || isAssignedUser || isAssignerUser || isPrimaryReporteeDelegate;
                                                }
                                            }

                                            const isDisabled = action.disabled
                                                || isOutOfService
                                                || asset.status === 'On Leave' // Block all actions if asset is On Leave
                                                || !hasPermission // NEW: Use the new permission logic
                                                || (isAlreadyPending && !isActionBtn && !isEditBtn)  // block non-action buttons during pending (Edit button excluded - handled by permission logic)
                                                || (isAlreadyPending && isActionBtn);  // block action buttons too during pending (already in flight)

                                            // Show a special "Pending" label for L&D/EOL when already pending
                                            const btnLabel = (isAlreadyPending && isActionBtn)
                                                ? `${action.label} (Pending...)`
                                                : action.label;
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!isDisabled) action.onClick();
                                                    }}
                                                    disabled={isDisabled}
                                                    className={`text-slate-600 px-3 py-2.5 rounded-xl text-[11px] font-bold text-center leading-tight transition-all
                                                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 hover:shadow-md active:scale-95'}`}
                                                    style={{ backgroundColor: isDisabled ? '#f1f5f9' : (action.label === 'Delete Asset' ? '#fee2e2' : '#dde5c8') }}
                                                >
                                                    {isDeleteBtn && isDeleting ? 'Deleting...' : btnLabel}
                                                </button>

                                            );
                                        })}
                                    </div>
                                </div>

                            </div>
                        </div>


                    </div>

                    {/* Row 2: Handover Document / Assignment Actions */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
                        {/* Handover or Quick Actions Card - Expanded to Full Width */}
                        <div className="lg:col-span-12 flex flex-col">
                            {
                                true ? (
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full font-sans">
                                        <div className="px-8 py-4 border-b border-slate-50 bg-slate-50/50">
                                            <div className="flex flex-wrap items-center justify-between gap-4">
                                                {/* Tab Navigation */}
                                                <div className="flex items-center gap-1 p-1 bg-slate-100/50 rounded-2xl border border-slate-100">
                                                    {[
                                                        ...((asset.assignedTo || asset.status === 'Service' || asset.status === 'Unassigned') ? [{ id: 'document', label: 'Document', icon: FileText }] : []),
                                                        { id: 'accessories', label: 'Accessories', icon: Package },
                                                        { id: 'history', label: 'History', icon: History },
                                                        { id: 'images', label: 'Images', icon: ImageIcon },
                                                        ...(asset.status !== 'Returned' ? [{ id: 'edit', label: 'Service History', icon: PencilLine }] : [])
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
                                                    {/* Acceptance Buttons moved to top regular banner */}

                                                    <button
                                                        disabled={(!currentUser?.isAdmin && currentUser?.role !== 'Admin' && currentUser?.role !== 'ROOT') && (!asset.assetControllerId || currentUserEmployeeId?.toString() !== asset.assetControllerId?.toString()) && !asset.assignedTo}
                                                        onClick={() => setShowHandoverModal(true)}
                                                        className={`px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[11px] font-bold hover:bg-slate-50 transition-all flex items-center gap-2 ${((!currentUser?.isAdmin && currentUser?.role !== 'Admin' && currentUser?.role !== 'ROOT') && (!asset.assetControllerId || currentUserEmployeeId?.toString() !== asset.assetControllerId?.toString()) && !asset.assignedTo) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        <Printer size={16} /> Print
                                                    </button>

                                                    {/* Return/Reassign: assignee, original assigner, asset controller, or admin */}
                                                    {(() => {
                                                        const isAdm = currentUser?.isAdmin || currentUser?.role === 'Admin' || currentUser?.role === 'ROOT';
                                                        const isAcQuick = currentUserEmployeeId?.toString() === asset?.assetControllerId?.toString() ||
                                                            currentUserEmployeeId?.toString() === 'flowchart_assetcontroller';
                                                        const isAssignerQuick = asset.assignedBy?._id?.toString() === currentUserEmployeeId?.toString();
                                                        const atRef = asset?.assignedTo?._id ?? asset?.assignedTo;
                                                        const isAssigneeQuick = atRef && currentUserEmployeeId?.toString() === atRef.toString();
                                                        const showReturnStrip = isAdm || isAcQuick || isAssignerQuick || isAssigneeQuick;
                                                        if (!showReturnStrip) return null;
                                                        return (
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
                                                        );
                                                    })()}
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
                                                        {(() => {
                                                            if (groupedHistory.length === 0) {
                                                                return (
                                                                    <div className="text-center py-20 text-slate-400">
                                                                        <History size={48} className="mx-auto mb-4 opacity-20" />
                                                                        <p className="text-sm uppercase font-bold tracking-widest">No history records found</p>
                                                                    </div>
                                                                );
                                                            }
                                                            return groupedHistory.map((session, sIdx) => {
                                                                const main = session.request;
                                                                const isAssignment = session.type === 'Assignment';
                                                                const isService = session.type === 'Service';

                                                                return (
                                                                    <div key={sIdx} className={`rounded-2xl border transition-all overflow-hidden mb-6 ${(isAssignment || isService) ? 'border-blue-100 bg-blue-50/5' : 'border-slate-100 bg-white shadow-sm'}`}>
                                                                        {/* Status Line Indicator */}
                                                                        <div className={`h-1.5 w-full ${session.isFinalized ? 'bg-emerald-500' : 'bg-blue-500'}`} />

                                                                        {/* Session Header */}
                                                                        <div
                                                                            onClick={() => toggleHistory(sIdx)}
                                                                            className={`p-5 flex items-center justify-between cursor-pointer group transition-all ${(isAssignment || isService) ? 'bg-blue-50/50 hover:bg-blue-100/30' : 'bg-slate-50/50 hover:bg-slate-100/30'}`}
                                                                        >
                                                                            <div className="flex items-center gap-4">
                                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${session.isFinalized ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'bg-amber-50 text-amber-600 shadow-sm'}`}>
                                                                                    {session.type === 'Assignment' ? <UserPlus size={18} /> : session.type === 'Action' ? <RotateCw size={18} /> : session.type === 'Service' ? <Wrench size={18} /> : <History size={18} />}
                                                                                </div>
                                                                                <div>
                                                                                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.1em] leading-none mb-1.5 flex items-center gap-2">
                                                                                        {session.title}
                                                                                        <span className="text-[10px] text-slate-300 font-normal">#{main._id?.slice(-6)}</span>
                                                                                    </h4>
                                                                                    {session.type === 'Assignment' && main.assignedTo && (
                                                                                        <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mb-1">
                                                                                            TARGET: {main.assignedTo.firstName} {main.assignedTo.lastName}
                                                                                        </p>
                                                                                    )}
                                                                                    <p className="text-[9px] font-mono text-slate-400 flex items-center gap-2">
                                                                                        <History size={10} className="text-slate-300" />
                                                                                        Initiated: {new Date(main.date).toLocaleDateString()} {new Date(main.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                    </p>
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-center gap-3">
                                                                                {session.isFinalized ? (
                                                                                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full border border-emerald-100 shadow-sm">
                                                                                        <CheckCircle2 size={10} />
                                                                                        <span className="text-[9px] font-black uppercase tracking-widest">Completed</span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex items-center gap-2 bg-amber-50 text-amber-600 px-4 py-1.5 rounded-full border border-amber-100 shadow-sm animate-pulse">
                                                                                        <RotateCw size={10} className="animate-spin" />
                                                                                        <span className="text-[9px] font-black uppercase tracking-widest">In Progress</span>
                                                                                    </div>
                                                                                )}
                                                                                <div className={`p-2 rounded-lg transition-all ${expandedHistory[sIdx] ? 'bg-slate-200/50 rotate-180' : 'bg-transparent text-slate-300 group-hover:text-slate-600'}`}>
                                                                                    <ChevronDown size={14} />
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {expandedHistory[sIdx] && (
                                                                            <>

                                                                                {/* Session Body - Combined Request and Response */}
                                                                                <div className="p-5">
                                                                                    {/* Combined Box for Request and Response */}
                                                                                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                                                                                        {/* Request Section */}
                                                                                        <div className="pb-3 border-b border-slate-200">
                                                                                            <div className="flex items-start gap-3">
                                                                                                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                                                                                                <div className="flex-1">
                                                                                                    <div className="flex items-center gap-2 mb-1">
                                                                                                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-600">
                                                                                                            REQUEST
                                                                                                        </span>
                                                                                                        <span className="text-[9px] font-mono text-slate-400">{new Date(main.date).toLocaleDateString()} {new Date(main.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                                                    </div>
                                                                                                    <p className="text-[10px] text-slate-700 leading-relaxed">
                                                                                                        <span className="font-black text-slate-900 uppercase tracking-tighter">{main.performedBy?.firstName} {main.performedBy?.lastName}</span>
                                                                                                        {main.action === 'Assigned' ? ` requested to assign this asset to ` :
                                                                                                            main.action === 'Created' ? ` created this asset` :
                                                                                                                main.action === 'Returned' ? ` returned this asset` :
                                                                                                                    main.action === 'Unassigned' ? ` unassigned this asset` :
                                                                                                                        main.action === 'Service' || main.action === 'Service Send' ? ` sent asset for service/maintenance` :
                                                                                                                            main.action === 'On Leave' ? ` marked asset as On Leave` :
                                                                                                                                main.action === 'End of Life' ? ` marked asset as End of Life` :
                                                                                                                                    main.action === 'Out of Service' ? ` marked asset as Out of Service` :
                                                                                                                                        main.action === 'Transfer' ? ` transferred this asset` :
                                                                                                                                            main.action === 'Restored' || main.action === 'Live' || main.action === 'Service Receive' ? ` restored asset to service` :
                                                                                                                                                ` performed action: ${main.action}`}
                                                                                                        {main.assignedTo && (main.action === 'Assigned' || main.action === 'Transfer') && (
                                                                                                            <span className="font-black text-blue-600 uppercase tracking-tighter"> to {main.assignedTo.firstName} {main.assignedTo.lastName}</span>
                                                                                                        )}
                                                                                                        {!main.assignedTo && main.action !== 'Created' && main.action !== 'Returned' && main.action !== 'Unassigned' && main.action !== 'Service' && main.action !== 'Service Send' && main.action !== 'On Leave' && main.action !== 'End of Life' && main.action !== 'Out of Service' && main.action !== 'Restored' && main.action !== 'Live' && main.action !== 'Service Receive' && (
                                                                                                            <span className="font-black text-blue-600 uppercase tracking-tighter"> (System)</span>
                                                                                                        )}
                                                                                                    </p>
                                                                                                    {main.comments && (
                                                                                                        <div className="mt-2 p-2 bg-white rounded border border-slate-200">
                                                                                                            <p className="text-[9px] font-semibold text-slate-500 mb-1">Request Comments:</p>
                                                                                                            <p className="text-[10px] text-slate-700 italic">"{main.comments}"</p>
                                                                                                        </div>
                                                                                                    )}
                                                                                                    {main.file && (
                                                                                                        <button
                                                                                                            onClick={() => { setSelectedFile(main.file); setShowFileModal(true); }}
                                                                                                            className="mt-2 flex items-center gap-1 text-[8px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest"
                                                                                                        >
                                                                                                            <Paperclip size={10} /> View Request Attachment
                                                                                                        </button>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* Response Section */}
                                                                                        {session.responses.length > 0 ? (
                                                                                            <div className="space-y-3">
                                                                                                {session.responses.map((resp, rIdx) => (
                                                                                                    <div key={rIdx} className="flex items-start gap-3">
                                                                                                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${resp.action === 'Accepted' || resp.action === 'AcceptWithComments' ? 'bg-emerald-400' : resp.action === 'Rejected' ? 'bg-rose-400' : 'bg-slate-300'}`} />
                                                                                                        <div className="flex-1">
                                                                                                            <div className="flex items-center gap-2 mb-1">
                                                                                                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${resp.action === 'Accepted' || resp.action === 'AcceptWithComments' ? 'bg-emerald-100 text-emerald-600' :
                                                                                                                    resp.action === 'Rejected' ? 'bg-rose-100 text-rose-600' :
                                                                                                                        'bg-slate-100 text-slate-600'
                                                                                                                    }`}>
                                                                                                                    {resp.action === 'AcceptWithComments' ? 'ACCEPTED WITH COMMENTS' :
                                                                                                                        resp.action === 'Accepted' ? 'ACCEPTED' :
                                                                                                                            resp.action === 'Rejected' ? 'REJECTED' :
                                                                                                                                resp.action === 'Comment' ? 'COMMENT' : resp.action}
                                                                                                                </span>
                                                                                                                <span className="text-[9px] font-mono text-slate-400">{new Date(resp.date).toLocaleDateString()} {new Date(resp.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                                                            </div>
                                                                                                            <p className="text-[10px] text-slate-700 leading-relaxed font-medium mb-1">
                                                                                                                <span className="font-black text-slate-900 uppercase tracking-tighter">{resp.performedBy?.firstName} {resp.performedBy?.lastName}</span>
                                                                                                                {resp.comments || resp.message ? `: ${resp.comments || resp.message}` : ": Action processed."}
                                                                                                            </p>
                                                                                                            {(resp.comments || resp.message) && (
                                                                                                                <div className="mt-2 p-2 bg-white rounded border border-slate-200">
                                                                                                                    <p className="text-[9px] font-semibold text-slate-500 mb-1">
                                                                                                                        {resp.action === 'AcceptWithComments' ? 'Acceptance Comments:' :
                                                                                                                            resp.action === 'Rejected' ? 'Rejection Comments:' :
                                                                                                                                'Response Comments:'}
                                                                                                                    </p>
                                                                                                                    <p className="text-[10px] text-slate-700">"{resp.comments || resp.message}"</p>
                                                                                                                </div>
                                                                                                            )}
                                                                                                            {resp.file && (
                                                                                                                <button
                                                                                                                    onClick={() => { setSelectedFile(resp.file); setShowFileModal(true); }}
                                                                                                                    className="mt-2 flex items-center gap-1 text-[8px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest"
                                                                                                                >
                                                                                                                    <Paperclip size={10} /> View Response Attachment
                                                                                                                </button>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        ) : session.isFinalized ? (
                                                                                            // Standalone action (no response needed) - show action status
                                                                                            <div className="pt-2">
                                                                                                <div className="flex items-center gap-2 mb-2">
                                                                                                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                                                                                        {main.action}
                                                                                                    </span>
                                                                                                    <span className="text-[9px] font-mono text-slate-400">
                                                                                                        {new Date(main.date).toLocaleDateString()} {new Date(main.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                                    </span>
                                                                                                </div>
                                                                                                {main.comments && (
                                                                                                    <div className="mt-2 p-2 bg-white rounded border border-slate-200">
                                                                                                        <p className="text-[9px] font-semibold text-slate-500 mb-1">Action Details:</p>
                                                                                                        <p className="text-[10px] text-slate-700">"{main.comments}"</p>
                                                                                                    </div>
                                                                                                )}
                                                                                                {main.file && (
                                                                                                    <button
                                                                                                        onClick={() => { setSelectedFile(main.file); setShowFileModal(true); }}
                                                                                                        className="mt-2 flex items-center gap-1 text-[8px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest"
                                                                                                    >
                                                                                                        <Paperclip size={10} /> View Attachment
                                                                                                    </button>
                                                                                                )}
                                                                                            </div>
                                                                                        ) : (
                                                                                            <div className="pt-2">
                                                                                                <p className="text-[9px] text-slate-400 italic">No response yet. Waiting for action...</p>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                {/* Session Footer - Actions */}
                                                                                <div className="px-5 py-4 bg-slate-50/30 border-t border-slate-100 flex items-center justify-between gap-4">
                                                                                    <div className="flex items-center gap-4">
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                setSelectedHistoryItem(session.latestSnapshotAction || main);
                                                                                                setShowHistoryDetailModal(true);
                                                                                            }}
                                                                                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
                                                                                        >
                                                                                            <Maximize2 size={12} className="text-blue-600" />
                                                                                            Elaborate Details
                                                                                        </button>
                                                                                        {session.latestSnapshotAction && (
                                                                                            <button
                                                                                                disabled={isDownloadingHistory}
                                                                                                onClick={() => downloadHistoryPdf(session.latestSnapshotAction._id)}
                                                                                                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all shadow-sm disabled:opacity-50"
                                                                                            >
                                                                                                <div className={`${isDownloadingHistory ? 'animate-spin' : ''}`}>
                                                                                                    <Printer size={12} />
                                                                                                </div>
                                                                                                {isDownloadingHistory ? 'Generating...' : 'Print Handover Form'}
                                                                                            </button>
                                                                                        )}

                                                                                        {/* Show Print/Attachment for the latest snapshot in this session */}
                                                                                        {session.latestSnapshotAction?.file && (
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    setSelectedFile(session.latestSnapshotAction.file);
                                                                                                    setShowFileModal(true);
                                                                                                }}
                                                                                                className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all shadow-sm"
                                                                                            >
                                                                                                <Paperclip size={12} />
                                                                                                View Latest Document
                                                                                            </button>
                                                                                        )}
                                                                                    </div>

                                                                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                                                                        SESSION REF: {session.latestSnapshotAction?._id?.slice(-8) || main._id?.slice(-8)}
                                                                                    </p>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                </div>
                                            ) : activeTab === 'accessories' ? (
                                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px] flex flex-col uppercase tracking-widest font-black">
                                                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                                                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                            <Package size={16} className="text-blue-600" /> Attached Accessories
                                                        </h3>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                disabled={(!currentUser?.isAdmin && currentUser?.role !== 'Admin' && currentUser?.role !== 'ROOT') && (!asset.assetControllerId || currentUserEmployeeId?.toString() !== asset.assetControllerId?.toString()) && !asset.assignedTo}
                                                                onClick={() => setShowAddAccessoryForm(true)}
                                                                className={`px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black hover:bg-emerald-600 hover:text-white transition-all shadow-sm ${((!currentUser?.isAdmin && currentUser?.role !== 'Admin' && currentUser?.role !== 'ROOT') && (!asset.assetControllerId || currentUserEmployeeId?.toString() !== asset.assetControllerId?.toString()) && !asset.assignedTo) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            >
                                                                Add Accessories
                                                            </button>
                                                            <button
                                                                onClick={() => setActiveTab('accessories')}
                                                                className="px-4 py-2 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-black hover:bg-slate-600 hover:text-white transition-all shadow-sm"
                                                            >
                                                                View
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {/* Add Accessory Form */}
                                                    {showAddAccessoryForm && (
                                                        <div className="border-b border-slate-100 bg-emerald-50/30 p-4">
                                                            <div className="space-y-3">
                                                                <h4 className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">
                                                                    {editingAccessory ? 'Edit Accessory' : 'Add New Accessory'}
                                                                </h4>
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Accessory Name *"
                                                                        value={newAccessory.name}
                                                                        onChange={(e) => setNewAccessory({ ...newAccessory, name: e.target.value })}
                                                                        className="px-3 py-2 border border-emerald-200 rounded-lg text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                                    />
                                                                    <input
                                                                        type="number"
                                                                        placeholder="Amount *"
                                                                        value={newAccessory.amount}
                                                                        onChange={(e) => setNewAccessory({ ...newAccessory, amount: e.target.value })}
                                                                        className="px-3 py-2 border border-emerald-200 rounded-lg text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Description"
                                                                        value={newAccessory.description}
                                                                        onChange={(e) => setNewAccessory({ ...newAccessory, description: e.target.value })}
                                                                        className="px-3 py-2 border border-emerald-200 rounded-lg text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={handleAddAccessory}
                                                                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black hover:bg-emerald-700 transition-all"
                                                                    >
                                                                        {editingAccessory ? 'Update Accessory' : 'Add Accessory'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setShowAddAccessoryForm(false);
                                                                            setNewAccessory({ name: '', amount: '', description: '' });
                                                                            setEditingAccessory(null);
                                                                        }}
                                                                        className="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black hover:bg-slate-300 transition-all"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="p-8">
                                                        {!asset.accessories || asset.accessories.length === 0 ? (
                                                            <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                                                                <Package size={48} strokeWidth={1} className="mb-4 opacity-20" />
                                                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">No accessories found</span>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                {asset.accessories.map((acc, index) => {
                                                                    const isPending = !!acc.pendingAction;
                                                                    // Check if current user is the one who needs to approve this accessory action
                                                                    const canApproveAccessory = isPending && asset.actionRequiredBy?._id?.toString() === currentUserEmployeeId?.toString();

                                                                    return (
                                                                        <div
                                                                            key={index}
                                                                            className={`flex items-center justify-between p-6 rounded-2xl border shadow-sm transition-all group ${isPending
                                                                                ? 'bg-rose-500 border-rose-500 text-white shadow-xl shadow-rose-200'
                                                                                : 'bg-white border-slate-100 hover:shadow-md hover:border-blue-200 text-slate-800'
                                                                                }`}
                                                                        >
                                                                            <div className="flex items-center gap-6">
                                                                                <div className={`w-14 h-14 rounded-xl border flex items-center justify-center shadow-sm transition-all shrink-0 ${isPending ? 'bg-white/10 border-white/20 text-white' : 'bg-slate-50 border-slate-100 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50'
                                                                                    }`}>
                                                                                    <Package size={28} strokeWidth={1.5} />
                                                                                </div>
                                                                                <div className="flex flex-col">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className={`text-[14px] font-black uppercase tracking-tight ${isPending ? 'text-white' : 'text-slate-800'}`} title={acc.name}>{acc.name}</span>
                                                                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${isPending ? 'bg-white/20 text-white' : (acc.status === 'Attached' ? 'bg-emerald-50 text-emerald-600'
                                                                                            : acc.status === 'Transfered' ? 'bg-amber-50 text-amber-600'
                                                                                                : 'bg-rose-50 text-rose-600')
                                                                                            }`}>
                                                                                            {acc.status || 'Attached'}
                                                                                        </span>
                                                                                        {isPending && (
                                                                                            <div className="flex flex-col gap-1 items-start">
                                                                                                <span className="px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-white/20 text-white animate-pulse whitespace-nowrap">
                                                                                                    ⏳ {acc.pendingAction} Pending
                                                                                                </span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    <span className={`text-[10px] font-mono font-bold uppercase mt-1 ${isPending ? 'text-white/70' : 'text-slate-400'}`}>{acc.accessoryId}</span>
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-center gap-12">
                                                                                <div className="text-right">
                                                                                    <span className={`block text-[10px] font-black uppercase tracking-widest mb-1 ${isPending ? 'text-white/60' : 'text-slate-400'}`}>Value</span>
                                                                                    <span className={`text-[14px] font-black tracking-wider ${isPending ? 'text-white' : 'text-emerald-600'}`}>AED {new Intl.NumberFormat().format(acc.amount || 0)}</span>
                                                                                </div>

                                                                                {/* ── PENDING: show only Accept / Reject for the authorized approver ── */}
                                                                                {isPending ? (
                                                                                    (() => {
                                                                                        if (!canApproveAccessory) {
                                                                                            return (
                                                                                                <span className={`text-[10px] font-black uppercase tracking-widest ${isPending ? 'text-white/80' : 'text-sky-400'}`}>
                                                                                                    Awaiting Approval
                                                                                                </span>
                                                                                            );
                                                                                        }

                                                                                        return (
                                                                                            <div className="flex items-center gap-2">
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        // For Loss and Damage, open the Loss and Damage form modal directly
                                                                                                        if (acc.pendingAction === 'Loss and Damage' && !acc.pendingActionDetails?.fineData) {
                                                                                                            // Open Loss and Damage modal with accessory data
                                                                                                            setDamageInitialData({
                                                                                                                assetId: asset.assetId,
                                                                                                                assetName: asset.name,
                                                                                                                assetObjectId: asset._id,
                                                                                                                isAssetFlow: true,
                                                                                                                isApprovalFlow: true,
                                                                                                                isAccessoryFlow: true, // Flag for accessory
                                                                                                                accessoryId: acc.accessoryId,
                                                                                                                accessoryName: acc.name,
                                                                                                                accessoryObjectId: acc._id,
                                                                                                                employeeId: asset.assignedTo?.employeeId || '',
                                                                                                                employeeName: asset.assignedTo
                                                                                                                    ? `${asset.assignedTo.firstName || ''} ${asset.assignedTo.lastName || ''}`.trim()
                                                                                                                    : '',
                                                                                                                assignedToType: asset.assignedToType || (asset.assignedCompany ? 'Company' : 'Employee'),
                                                                                                                company: asset.assignedCompany?._id || asset.assignedCompany || null,
                                                                                                                description: acc.pendingActionDetails?.reason || '',
                                                                                                                attachment: acc.pendingActionDetails?.attachment || null,
                                                                                                                fineAmount: acc.amount ? String(acc.amount) : '',
                                                                                                                responsibleFor: asset.assignedToType === 'Company' ? 'Company' : 'Employee'
                                                                                                            });
                                                                                                            setShowDamageModal(true);
                                                                                                        } else {
                                                                                                            // For other actions, show the accept dialog
                                                                                                            setAccAcceptDialog({
                                                                                                                isOpen: true,
                                                                                                                accId: acc._id,
                                                                                                                accName: acc.name,
                                                                                                                pendingAction: acc.pendingAction,
                                                                                                                reason: '',
                                                                                                                attachment: null,
                                                                                                                loading: false
                                                                                                            });
                                                                                                        }
                                                                                                    }}
                                                                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-emerald-600 text-[10px] font-black hover:bg-emerald-50 transition-all uppercase tracking-tighter shadow-sm"
                                                                                                >
                                                                                                    ✓ Accept
                                                                                                </button>
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        setAccRejectDialog({
                                                                                                            isOpen: true,
                                                                                                            accId: acc._id,
                                                                                                            accName: acc.name,
                                                                                                            pendingAction: acc.pendingAction,
                                                                                                            reason: '',
                                                                                                            loading: false
                                                                                                        });
                                                                                                    }}
                                                                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-rose-600 text-[10px] font-black hover:bg-rose-50 transition-all uppercase tracking-tighter shadow-sm"
                                                                                                >
                                                                                                    ✕ Reject
                                                                                                </button>
                                                                                            </div>
                                                                                        );
                                                                                    })()
                                                                                ) : acc.status === 'Attached' && asset.status !== 'Draft' && (
                                                                                    <div className="flex items-center gap-2">
                                                                                        {/* ── NORMAL ACTION BUTTONS ── */}
                                                                                        {(() => {
                                                                                            const isAdmin = currentUser?.isAdmin || currentUser?.role === 'Admin' || currentUser?.role === 'ROOT';
                                                                                            const isAssetController = currentUserEmployeeId?.toString() === asset?.assetControllerId?.toString() ||
                                                                                                currentUserEmployeeId?.toString() === `flowchart_assetcontroller`;
                                                                                            const isAuthorized = isAdmin || isAssetController;
                                                                                            const isUnassigned = !asset.assignedTo;
                                                                                            const isAccessRestricted = isUnassigned && !isAuthorized;
                                                                                            // Disable ALL accessory actions when asset is Draft
                                                                                            const isAssetDraft = asset.status === 'Draft';
                                                                                            const isDisabled = isAccessRestricted || isAssetDraft;
                                                                                            return (
                                                                                                <>
                                                                                                    {/* Edit Accessory */}
                                                                                                    <button
                                                                                                        disabled={isDisabled}
                                                                                                        onClick={() => handleEditAccessory(acc)}
                                                                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-600 text-[9px] font-black hover:bg-amber-600 hover:text-white transition-all uppercase tracking-tighter shadow-sm border border-amber-100/50 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                                                        title="Edit Accessory"
                                                                                                    >
                                                                                                        <Package size={12} /> Edit
                                                                                                    </button>
                                                                                                    {/* Transfer → request-action */}
                                                                                                    <button
                                                                                                        disabled={isDisabled}
                                                                                                        onClick={() => setTransferModal({ isOpen: true, accessory: acc })}
                                                                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-[9px] font-black hover:bg-blue-600 hover:text-white transition-all uppercase tracking-tighter shadow-sm border border-blue-100/50 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                                                    >
                                                                                                        <ArrowRightLeft size={12} /> Transfer
                                                                                                    </button>
                                                                                                    {/* Loss & Damage → request-action */}
                                                                                                    <button
                                                                                                        disabled={isDisabled}
                                                                                                        onClick={() => {
                                                                                                            const targetEmployee = asset?.assignedTo || asset?.assetController;
                                                                                                            setDamageInitialData({
                                                                                                                assetId: asset.assetId,
                                                                                                                assetName: asset.name,
                                                                                                                assetObjectId: asset._id,
                                                                                                                isAssetFlow: true,
                                                                                                                isInitialRequest: true, // Flag for initial request
                                                                                                                isAccessoryFlow: true, // Flag for accessory
                                                                                                                accessoryId: acc.accessoryId,
                                                                                                                accessoryName: acc.name,
                                                                                                                accessoryObjectId: acc._id,
                                                                                                                employeeId: targetEmployee?.employeeId || '',
                                                                                                                employeeName: targetEmployee
                                                                                                                    ? `${targetEmployee.firstName || ''} ${targetEmployee.lastName || ''}`.trim()
                                                                                                                    : '',
                                                                                                                fineAmount: acc.amount ? String(acc.amount) : ''
                                                                                                            });
                                                                                                            setShowDamageModal(true);
                                                                                                        }}
                                                                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-500 text-[9px] font-black hover:bg-red-50 hover:text-red-500 transition-all uppercase tracking-tighter shadow-sm border border-slate-100 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                                                        title="Mark as Loss and Damage"
                                                                                                    >
                                                                                                        <AlertCircle size={12} /> Loss and Damage
                                                                                                    </button>
                                                                                                    {/* EOL → request-action via EndOfLifeModal */}
                                                                                                    <button
                                                                                                        disabled={isDisabled}
                                                                                                        onClick={() => {
                                                                                                            setEolTargetAccessory({ _id: acc._id, name: acc.name });
                                                                                                            setAssetActionType('End of Life');
                                                                                                            setShowEndOfLifeModal(true);
                                                                                                        }}
                                                                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-500 text-[9px] font-black hover:bg-rose-50 hover:text-rose-500 transition-all uppercase tracking-tighter shadow-sm border border-slate-100 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                                                        title="Mark as End of Life"
                                                                                                    >
                                                                                                        <Ban size={13} /> End of Life
                                                                                                    </button>
                                                                                                </>
                                                                                            );
                                                                                        })()}
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
                                                                    );
                                                                })}
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
                                                        {(() => {
                                                            const isAdmin = currentUser?.isAdmin || currentUser?.role === 'Admin' || currentUser?.role === 'ROOT';
                                                            const isAssetController = currentUserEmployeeId?.toString() === asset?.assetControllerId?.toString() ||
                                                                currentUserEmployeeId?.toString() === `flowchart_assetcontroller`;
                                                            const isAuthorized = isAdmin || isAssetController;
                                                            const isUnassigned = !asset.assignedTo;
                                                            const isAccessRestricted = isUnassigned && !isAuthorized;
                                                            const isAssetDraft = asset.status === 'Draft';
                                                            const isDisabled = isAccessRestricted || isAssetDraft;

                                                            return (
                                                                <label className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer transition-all shadow-sm ${isAccessRestricted ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                                                    Add Image
                                                                    <input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        className="hidden"
                                                                        disabled={isDisabled}
                                                                        onChange={(e) => {
                                                                            if (isAccessRestricted) return;
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
                                                                        }}
                                                                    />
                                                                </label>
                                                            );
                                                        })()}
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
                                                            <span>Service History</span>
                                                        </h3>
                                                        <p className="text-[11px] text-slate-400 mt-1 font-normal tracking-normal">Current status: <span className="font-bold text-slate-600">{asset.status}</span></p>
                                                    </div>
                                                    <div className="p-6">
                                                        {(() => {
                                                            const serviceHistoryItems = assetHistory?.filter(h =>
                                                                ['Service', 'Maintenance', 'Repair', 'Live', 'Service Send', 'Service Receive'].includes(h.action)
                                                            ) || [];

                                                            if (serviceHistoryItems.length === 0) {
                                                                return (
                                                                    <div className="py-24 flex flex-col items-center justify-center text-slate-300">
                                                                        <PencilLine size={48} strokeWidth={1} className="mb-4 opacity-20" />
                                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">No Service History</span>
                                                                    </div>
                                                                );
                                                            }

                                                            // Group Service sessions
                                                            const sorted = [...serviceHistoryItems].sort((a, b) => new Date(a.date) - new Date(b.date));
                                                            const sessions = [];
                                                            let currentSession = null;

                                                            sorted.forEach(item => {
                                                                const isSend = ['Service', 'Service Send', 'Maintenance', 'Repair'].includes(item.action);
                                                                const isReceive = ['Live', 'Service Receive'].includes(item.action);

                                                                if (isSend) {
                                                                    if (currentSession) sessions.push(currentSession);
                                                                    currentSession = { id: item._id, send: item, receive: null };
                                                                } else if (isReceive) {
                                                                    if (currentSession) {
                                                                        currentSession.receive = item;
                                                                        sessions.push(currentSession);
                                                                        currentSession = null;
                                                                    } else {
                                                                        sessions.push({ id: item._id, send: null, receive: item });
                                                                    }
                                                                }
                                                            });
                                                            if (currentSession) sessions.push(currentSession);

                                                            return (
                                                                <div className="space-y-6">
                                                                    {sessions.reverse().map((session, sIdx) => (
                                                                        <div key={session.id || sIdx} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
                                                                            <div className="flex flex-col">
                                                                                {/* SESSION HEADER - Status Indicator */}
                                                                                <div className={`h-1.5 w-full ${session.receive ? 'bg-emerald-500' : 'bg-blue-500'}`} />

                                                                                <div className="p-6 space-y-6">
                                                                                    {/* TIMELINE VIEW */}
                                                                                    <div className="flex items-start gap-6 relative">
                                                                                        {/* Vertical Connector Line */}
                                                                                        {session.receive && (
                                                                                            <div className="absolute left-[20px] top-[40px] bottom-[40px] w-0.5 border-l-2 border-dashed border-slate-200 z-0" />
                                                                                        )}

                                                                                        <div className="flex-1 space-y-8">
                                                                                            {/* SEND EVENT */}
                                                                                            {session.send && (
                                                                                                <div className="flex gap-4 relative z-10">
                                                                                                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 shadow-sm">
                                                                                                        <ArrowUpRight size={18} />
                                                                                                    </div>
                                                                                                    <div className="flex-1 min-w-0">
                                                                                                        <div className="flex justify-between items-center mb-1">
                                                                                                            <div className="flex items-center gap-2">
                                                                                                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                                                                                                                    {session.send.action === 'Service Send' ? 'Service Dispatched' : session.send.action}
                                                                                                                </span>
                                                                                                                <span className="text-xs font-black text-slate-800">
                                                                                                                    {new Date(session.send.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                                                                                                By {session.send.performedBy?.firstName || 'Staff'}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                        {session.send.comments && (
                                                                                                            <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-50">
                                                                                                                {session.send.comments}
                                                                                                            </p>
                                                                                                        )}
                                                                                                        {/* Documents in Send */}
                                                                                                        <div className="flex flex-wrap gap-2 mt-3">
                                                                                                            {(session.send.file || session.send.details?.invoice || session.send.details?.attachment) && (
                                                                                                                <button
                                                                                                                    onClick={() => { setSelectedFile(session.send.file || session.send.details?.invoice || session.send.details?.attachment); setShowFileModal(true); }}
                                                                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-[10px] font-bold text-slate-600 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm"
                                                                                                                >
                                                                                                                    <FileText size={12} /> View Send Document
                                                                                                                </button>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}

                                                                                            {/* RECEIVE EVENT */}
                                                                                            {session.receive && (
                                                                                                <div className="flex gap-4 relative z-10">
                                                                                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0 shadow-sm">
                                                                                                        <ArrowDownLeft size={18} />
                                                                                                    </div>
                                                                                                    <div className="flex-1 min-w-0">
                                                                                                        <div className="flex justify-between items-center mb-1">
                                                                                                            <div className="flex items-center gap-2">
                                                                                                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                                                                                                                    {session.receive.action === 'Service Receive' ? 'Service Completed' : 'Returned Live'}
                                                                                                                </span>
                                                                                                                <span className="text-xs font-black text-slate-800">
                                                                                                                    {new Date(session.receive.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                                                                                                Collected By {session.receive.performedBy?.firstName || 'Staff'}
                                                                                                            </span>
                                                                                                        </div>

                                                                                                        <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-50/50 space-y-3">
                                                                                                            {session.receive.comments && (
                                                                                                                <div className="space-y-1">
                                                                                                                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block">Service Report</span>
                                                                                                                    <p className="text-xs text-slate-600 font-medium leading-relaxed">{session.receive.comments}</p>
                                                                                                                </div>
                                                                                                            )}

                                                                                                            <div className="grid grid-cols-2 gap-4">
                                                                                                                {session.receive.details?.amount > 0 && (
                                                                                                                    <div className="space-y-0.5">
                                                                                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Cost</span>
                                                                                                                        <p className="text-xs font-black text-emerald-700">QAR {session.receive.details.amount.toLocaleString()}</p>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {session.receive.details?.serviceDuration && (
                                                                                                                    <div className="space-y-0.5">
                                                                                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Duration</span>
                                                                                                                        <p className="text-xs font-black text-slate-700">{session.receive.details.serviceDuration}</p>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                            </div>
                                                                                                        </div>

                                                                                                        {/* Documents in Receive */}
                                                                                                        <div className="flex flex-wrap gap-2 mt-4">
                                                                                                            {(session.receive.file || session.receive.details?.attachment) && (
                                                                                                                <button
                                                                                                                    onClick={() => { setSelectedFile(session.receive.file || session.receive.details?.attachment); setShowFileModal(true); }}
                                                                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-[10px] font-bold text-slate-600 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-sm"
                                                                                                                >
                                                                                                                    <FileText size={12} /> Combined Service Report
                                                                                                                </button>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Handover Form View - Default */
                                                <div className="flex justify-center p-4">
                                                    {(asset.assignedTo || asset.status === 'Service') ? (
                                                        <HandoverFormView asset={asset} isPrint={false} />
                                                    ) : (asset.status === 'Draft' || !asset.assignedTo) && latestHandoverDocument ? (
                                                        /* Show latest handover document for Draft or unassigned assets */
                                                        <div className="w-full flex flex-col items-center">
                                                            <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                                                                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest text-center">
                                                                    📄 Latest Handover Document ({new Date(latestHandoverDocument.date).toLocaleDateString()})
                                                                </p>
                                                            </div>
                                                            <HandoverFormView
                                                                asset={latestHandoverDocument.details}
                                                                isPrint={false}
                                                                overrideDate={latestHandoverDocument.date}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="w-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 bg-slate-50 border border-slate-100 rounded-xl">
                                                            <FileText size={48} className="mb-4 opacity-20" />
                                                            <h3 className="text-[12px] font-bold uppercase tracking-widest text-slate-500">Document Unavailable</h3>
                                                            <p className="text-[11px] font-medium mt-2">No handover document found in asset history.</p>
                                                        </div>
                                                    )}
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

                    {/* History Detail Modal - Shows Snapshot */}
                    {showHistoryDetailModal && selectedHistoryItem && (
                        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
                            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-5xl flex flex-col max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-300">
                                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm">
                                            <History size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest leading-none">
                                                Historical Snapshot
                                            </h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">
                                                Action: <span className="text-blue-600 font-bold">{selectedHistoryItem.action}</span> • {new Date(selectedHistoryItem.date).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowHistoryDetailModal(false)}
                                        className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto bg-slate-100/50 p-4 md:p-12 flex flex-col items-center">
                                    {selectedHistoryItem.details ? (
                                        <div className="w-full h-auto flex flex-col items-center py-6">
                                            <div className="shadow-2xl rounded-sm overflow-hidden bg-white max-w-full">
                                                <div className="scale-[0.8] md:scale-100 origin-top transform-gpu">
                                                    <HandoverFormView
                                                        asset={selectedHistoryItem.details}
                                                        isPrint={false}
                                                        overrideDate={selectedHistoryItem.date}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-24 text-center text-slate-400 uppercase tracking-widest font-black">
                                            <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
                                            Snapshot data not available for this record.
                                        </div>
                                    )}
                                </div>

                                <div className="p-8 border-t border-slate-100 bg-white flex justify-end gap-4">
                                    <button
                                        onClick={() => setShowHistoryDetailModal(false)}
                                        className="px-8 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all font-sans"
                                    >
                                        Close Preview
                                    </button>
                                    <button
                                        disabled={isDownloadingHistory}
                                        onClick={() => downloadHistoryPdf(selectedHistoryItem._id)}
                                        className="px-8 py-3 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all flex items-center gap-2 font-sans disabled:opacity-50"
                                    >
                                        <div className={isDownloadingHistory ? 'animate-spin' : ''}>
                                            <Printer size={16} />
                                        </div>
                                        {isDownloadingHistory ? 'Generating...' : 'Download Formal PDF'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Finalize Action Dialog (Reportee) */}
                    <AlertDialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
                        <AlertDialogContent className="max-w-md rounded-3xl p-8 border-none shadow-2xl">
                            <AlertDialogHeader>
                                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                                    <ShieldCheck size={32} className="text-blue-600" />
                                </div>
                                <AlertDialogTitle className="text-2xl font-black text-slate-800 tracking-tight">
                                    Final Acknowledgement
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-500 font-medium pt-2">
                                    Management has approved marking this asset ({asset?.name}) as <strong>{reporteeAction === 'eol' ? 'End of Life' : 'Loss and Damage'}</strong>.
                                    Please provide any final comments and acknowledge to finalize the "Out of Service" status.
                                </AlertDialogDescription>
                            </AlertDialogHeader>

                            <div className="my-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Final Comments</label>
                                    <textarea
                                        value={finalizeComment}
                                        onChange={(e) => setFinalizeComment(e.target.value)}
                                        placeholder="Add your final remarks here..."
                                        className="w-full min-h-[100px] p-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none text-[13px] font-medium"
                                    />
                                </div>
                            </div>

                            <AlertDialogFooter className="flex gap-3 sm:gap-0">
                                <AlertDialogCancel
                                    onClick={() => handleFinalizeAction(false)}
                                    disabled={isProcessingFinalize}
                                    className="flex-1 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 py-6"
                                >
                                    Decline / Query
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => handleFinalizeAction(true)}
                                    disabled={isProcessingFinalize}
                                    className="flex-[2] bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 py-6"
                                >
                                    {isProcessingFinalize ? (
                                        <Loader2 className="animate-spin mr-2" size={18} />
                                    ) : null}
                                    Acknowledge & Finalize
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>


                    <AssignAssetModal
                        isOpen={showAssignModal}
                        onClose={() => setShowAssignModal(false)}
                        asset={asset}
                        onUpdate={fetchAssetDetails}
                    />

                    <TransferAssetModal
                        isOpen={showTransferModal}
                        onClose={() => setShowTransferModal(false)}
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
                                <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-200 relative">
                                    <button
                                        onClick={() => setShowResponseModal(false)}
                                        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
                                    >
                                        <X size={18} />
                                    </button>
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
                                            assetHistory.map((entry, index) => {
                                                const isExpanded = expandedHistory[`modal_${index}`];
                                                const isComment = entry.action === 'Comment' || entry.action === 'AcceptWithComments';

                                                return (
                                                    <div key={index} className="flex gap-4 group">
                                                        <div className="flex flex-col items-center">
                                                            <div className={`w-3 h-3 rounded-full mt-3 shadow-sm transition-colors ${entry.action === 'Assigned' ? 'bg-blue-500 shadow-blue-200' :
                                                                entry.action === 'Accepted' ? 'bg-emerald-500 shadow-emerald-200' :
                                                                    entry.action === 'Rejected' ? 'bg-red-500 shadow-red-200' :
                                                                        entry.action === 'End of Life' ? 'bg-rose-600 shadow-rose-300' :
                                                                            entry.action === 'Created' ? 'bg-indigo-500 shadow-indigo-200' :
                                                                                'bg-gray-400'
                                                                }`} />
                                                            {index !== assetHistory.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 my-1 group-hover:bg-gray-200 transition-colors" />}
                                                        </div>
                                                        <div className="flex-1 pb-4">
                                                            <div className="bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all overflow-hidden font-sans">
                                                                <div
                                                                    onClick={() => setExpandedHistory(prev => ({ ...prev, [`modal_${index}`]: !isExpanded }))}
                                                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-white transition-colors"
                                                                >
                                                                    <div className="flex flex-col gap-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded w-fit ${entry.action === 'Assigned' ? 'bg-blue-100 text-blue-700' :
                                                                                entry.action === 'Accepted' ? 'bg-emerald-100 text-emerald-700' :
                                                                                    entry.action === 'Rejected' ? 'bg-red-100 text-red-700' :
                                                                                        entry.action === 'End of Life' ? 'bg-rose-100 text-rose-700' :
                                                                                            entry.action === 'Created' ? 'bg-indigo-100 text-indigo-700' :
                                                                                                'bg-gray-100 text-gray-600'
                                                                                }`}>
                                                                                {entry.action}
                                                                            </span>
                                                                            <span className="text-[10px] font-bold text-slate-800 uppercase tracking-tight">
                                                                                {entry.action === 'Assigned' && entry.assignedToType === 'Company' ? `Allocated to ${entry.assignedCompany?.name || 'Company'}` :
                                                                                    entry.action === 'Assigned' && entry.assignedTo ? `Assigned to ${entry.assignedTo.firstName}` :
                                                                                        entry.action === 'Returned' ? 'Returned' :
                                                                                            entry.action === 'Created' ? 'Asset Created' :
                                                                                                entry.action === 'Accepted' && entry.details?.approvalAction === 'Approve' ? 'Creation Approved' :
                                                                                                    entry.action === 'Rejected' && entry.details?.approvalAction === 'Reject' ? 'Creation Rejected' :
                                                                                                        entry.action === 'End of Life' ? 'Marked as End of Life' : 'Update'}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-[9px] text-gray-400 font-medium capitalize">
                                                                            {new Date(entry.date).toLocaleString()}
                                                                            {entry.action === 'Created' && (
                                                                                <span className="ml-2 text-indigo-600 font-black lowercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                                                                    (Age: {calculateAge(entry.date)})
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        {entry.performedBy && (
                                                                            <div className="hidden sm:flex items-center gap-2 bg-white px-2 py-1 rounded-full border border-slate-100 shadow-sm">
                                                                                <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[9px] font-bold">
                                                                                    {getInitials(entry.performedBy.firstName || 'U')}
                                                                                </div>
                                                                                <span className="text-[9px] font-bold text-gray-700 pr-1">
                                                                                    {entry.performedBy.firstName}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                                                    </div>
                                                                </div>

                                                                {isExpanded && (
                                                                    <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                        <div className="h-px bg-slate-200/50 mb-3" />
                                                                        <div className="text-[10px] text-gray-600 space-y-1">
                                                                            {entry.assignedTo && entry.action === 'Assigned' && (
                                                                                <p className="flex items-center gap-1">
                                                                                    To: <span className="font-bold text-gray-900">{entry.assignedTo.firstName} {entry.assignedTo.lastName}</span>
                                                                                </p>
                                                                            )}

                                                                            {entry.comments && (
                                                                                <div className="mt-2 bg-white/50 p-2 rounded border border-gray-100/50 italic text-gray-500">
                                                                                    &quot;{entry.comments}&quot;
                                                                                </div>
                                                                            )}

                                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                                {entry.file && (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setSelectedFile(entry.file);
                                                                                            setShowFileModal(true);
                                                                                        }}
                                                                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-colors border border-slate-200"
                                                                                    >
                                                                                        <FileText size={12} /> Attachment
                                                                                    </button>
                                                                                )}
                                                                                {entry.details && (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setSelectedHistoryItem(entry);
                                                                                            setShowHistoryDetailModal(true);
                                                                                        }}
                                                                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-colors shadow-sm"
                                                                                    >
                                                                                        <FileText size={12} /> Handover Details
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
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

                    {/* Send to Service Modal */}
                    {
                        showServiceModal && (
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
                                        fetchAssetHistory();
                                    } catch (err) {
                                        toast({ variant: 'destructive', title: 'Error', description: err?.response?.data?.message || 'Failed to send to service.' });
                                    }
                                }}
                            />
                        )
                    }

                    {/* Mark as Live Modal */}
                    {
                        showMarkAsLiveModal && (
                            <MarkAsLiveModal
                                isOpen={showMarkAsLiveModal}
                                assetName={asset?.name}
                                onClose={() => setShowMarkAsLiveModal(false)}
                                onConfirm={async ({ serviceReport, amount, attachment }) => {
                                    try {
                                        await axiosInstance.put(`/AssetItem/${asset._id}/status`, {
                                            status: 'Live',
                                            serviceReport,
                                            amount,
                                            attachment
                                        });
                                        toast({ title: 'Success', description: 'Asset is now Live.' });
                                        setShowMarkAsLiveModal(false);
                                        fetchAssetDetails();
                                        fetchAssetHistory();
                                    } catch (err) {
                                        toast({ variant: 'destructive', title: 'Error', description: err?.response?.data?.message || 'Failed to complete service.' });
                                    }
                                }}
                            />
                        )
                    }

                    {/* Loss & Damage Modal */}
                    {
                        showDamageModal && (
                            <AddLossDamageModal
                                isOpen={showDamageModal}
                                onClose={() => setShowDamageModal(false)}
                                onBack={() => setShowDamageModal(false)}
                                isAssetFlow={damageInitialData?.isAssetFlow !== false}
                                isInitialRequest={damageInitialData?.isInitialRequest === true}
                                isApprovalFlow={damageInitialData?.isApprovalFlow === true}
                                onAssetRequest={async (fineData) => {
                                    try {
                                        // Check if this is from approval flow (Asset Controller filling modal after approval)
                                        if (damageInitialData?.isApprovalFlow) {
                                            // Check if this is for an accessory
                                            if (damageInitialData?.isAccessoryFlow && damageInitialData?.accessoryObjectId) {
                                                // Call respond-action for accessory with fineData
                                                await axiosInstance.put(`/AssetItem/${assetId}/accessories/${damageInitialData.accessoryObjectId}/respond-action`, {
                                                    approve: true,
                                                    comment: approvalComment || '',
                                                    fineData: fineData
                                                });
                                                toast({
                                                    title: "Approved",
                                                    description: "Accessory Loss and Damage approved. Fine created with status Pending HR."
                                                });
                                            } else {
                                                // Call approve-action for main asset with fineData
                                                await axiosInstance.put(`/AssetItem/${assetId}/approve-action`, {
                                                    approve: true,
                                                    comment: approvalComment || '',
                                                    fineData: fineData
                                                });
                                                toast({
                                                    title: "Approved",
                                                    description: "Loss and Damage approved. Fine created with status Pending HR."
                                                });
                                            }
                                            setShowDamageModal(false);
                                            setApprovalComment('');
                                            fetchAssetDetails();
                                            fetchAssetHistory();
                                            router.replace(`/HRM/Asset/details/${assetId}`);
                                        } else if (damageInitialData?.isInitialRequest) {
                                            // Initial request flow (user requesting) - only send description and attachment
                                            // fineData will be { description, attachment } from modal
                                            const description = typeof fineData === 'string' ? fineData : (fineData?.description || '');
                                            const attachmentData = fineData?.attachment?.data
                                                ? `data:${fineData.attachment.mimeType || 'application/pdf'};base64,${fineData.attachment.data}`
                                                : null;

                                            await handleActionRequest({
                                                reason: description,
                                                attachment: attachmentData,
                                                fineData: null, // Don't send fineData in initial request for Loss and Damage
                                                customActionType: 'Loss and Damage',
                                                accessoryId: damageInitialData?.isAccessoryFlow ? damageInitialData?.accessoryObjectId : null
                                            });
                                            setShowDamageModal(false);
                                            fetchAssetDetails();
                                            fetchAssetHistory();
                                        } else {
                                            // Legacy flow - send full fineData
                                            await handleActionRequest({
                                                reason: fineData.description,
                                                attachment: fineData.attachment?.data ? `data:${fineData.attachment.mimeType || 'application/pdf'};base64,${fineData.attachment.data}` : null,
                                                fineData: null, // Don't send fineData in initial request for Loss and Damage
                                                customActionType: 'Loss and Damage',
                                                accessoryId: fineData.accessoryId || damageInitialData?.accessoryObjectId
                                            });
                                            setShowDamageModal(false);
                                        }
                                    } catch (err) {
                                        console.error("Failed to process L&D:", err);
                                        toast({
                                            variant: 'destructive',
                                            title: 'Error',
                                            description: err.response?.data?.message || 'Failed to process request.'
                                        });
                                    }
                                }}
                                initialData={damageInitialData || {
                                    assetId: asset?.assetId,
                                    assetName: asset?.name,
                                    employeeId: asset?.assignedTo?.employeeId || '',
                                    employeeName: asset?.assignedTo
                                        ? `${asset.assignedTo.firstName || ''} ${asset.assignedTo.lastName || ''}`.trim()
                                        : '',
                                    fineAmount: asset?.assetValue ? String(asset.assetValue) : ''
                                }}
                                employees={employees || []}
                            />
                        )
                    }

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
                        <AlertDialogContent className="bg-white rounded-[24px]">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-xl font-bold">{confirmDialog.title}</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm text-gray-500">
                                    {confirmDialog.description}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2">
                                <AlertDialogCancel className="rounded-xl border-gray-100 font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={async (e) => {
                                        e.preventDefault();
                                        if (confirmAction) {
                                            setConfirmDialog({ isOpen: false, title: '', description: '' });
                                            await confirmAction();
                                            setConfirmAction(null);
                                        } else {
                                            executeConfirmAction();
                                        }
                                    }}
                                    className={
                                        confirmDialog.title === 'Unassign Asset'
                                            ? 'bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-rose-100'
                                            : 'bg-slate-800 hover:bg-slate-900 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl'
                                    }
                                >
                                    Confirm
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* History Detail Modal (Historical Form View) */}
                    {
                        showHistoryDetailModal && selectedHistoryItem?.details && (
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
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => downloadHistoryPdf(selectedHistoryItem._id)}
                                                disabled={isDownloadingHistory}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-50"
                                            >
                                                {isDownloadingHistory ? <RotateCw size={12} className="animate-spin" /> : <Download size={12} />}
                                                Download PDF
                                            </button>
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
                                    </div>

                                    {/* Form Preview Area */}
                                    <div className="flex-1 overflow-y-auto p-12 bg-gray-100/50 scrollbar-hide flex flex-col items-center">
                                        {/* Metadata Summary */}
                                        <div className="w-full max-w-[210mm] mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status at time</p>
                                                <p className="text-[11px] font-bold text-blue-600">{selectedHistoryItem.details.status}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Assignment Type</p>
                                                <p className="text-[11px] font-bold text-gray-900">{selectedHistoryItem.details.assignmentType || 'N/A'}</p>
                                            </div>
                                            {selectedHistoryItem.details.assignedDays && (
                                                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Duration</p>
                                                    <p className="text-[11px] font-bold text-gray-900">{selectedHistoryItem.details.assignedDays} Days</p>
                                                </div>
                                            )}
                                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Action Performed</p>
                                                <p className="text-[11px] font-bold text-emerald-600">{selectedHistoryItem.action}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Performed By</p>
                                                <p className="text-[9px] font-bold text-gray-900 truncate">
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
                        )
                    }

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
                        onOpenChange={(open) => !open && setImageDeleteConfirm({ isOpen: false, imageId: null })}
                    >
                        <AlertDialogContent className="bg-white rounded-[24px]">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-xl font-bold text-red-600">Delete Image</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm text-gray-500">
                                    Are you sure you want to remove this image? This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2">
                                <AlertDialogCancel className="rounded-xl border-gray-100 font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDeleteImage}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-red-100"
                                >
                                    Delete Forever
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Image Upload Modal */}
                    {imageUploadModal.isOpen && (
                        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 uppercase tracking-widest font-black">
                            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="p-8 border-b border-gray-50">
                                    <h3 className="text-xl font-black text-gray-900 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm">
                                            <Camera size={20} />
                                        </div>
                                        Upload Image
                                    </h3>
                                </div>
                                <div className="p-8 space-y-6">
                                    <div className="w-full aspect-video rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden shadow-inner flex items-center justify-center">
                                        <img
                                            src={`data:${imageUploadModal.file?.type};base64,${imageUploadModal.base64}`}
                                            alt="Preview"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block ml-1">Caption</label>
                                        <input
                                            type="text"
                                            placeholder="Enter image caption..."
                                            value={imageUploadModal.caption}
                                            onChange={(e) => setImageUploadModal({ ...imageUploadModal, caption: e.target.value })}
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

                    {showEndOfLifeModal && (
                        <EndOfLifeModal
                            isOpen={showEndOfLifeModal}
                            onClose={() => setShowEndOfLifeModal(false)}
                            assetName={asset?.name}
                            type={assetActionType}
                            onConfirm={handleActionRequest}
                        />
                    )}

                    <AlertDialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
                        <AlertDialogContent className="bg-white rounded-[32px] border-none shadow-2xl overflow-hidden max-w-lg p-0">
                            <AlertDialogTitle className="sr-only">Approve Asset Action</AlertDialogTitle>
                            <div className="absolute top-0 left-0 w-full h-2 bg-sky-500"></div>
                            <button
                                onClick={() => setShowApprovalDialog(false)}
                                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100/50 text-slate-400 hover:text-slate-900 transition-all z-10"
                            >
                                <X size={18} />
                            </button>
                            <div className="p-8 pt-10">
                                <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-600 mb-4 mx-auto shadow-sm">
                                    <AlertCircle size={24} />
                                </div>
                                <h3 className="text-xl font-black text-slate-100 uppercase tracking-tight mb-2 text-center" style={{ color: '#1E293B' }}>
                                    Review {asset?.pendingAction || 'Asset Action'}
                                </h3>
                                <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest text-center mb-6">
                                    Action ID: Request-0{asset?._id?.slice(-4)}
                                </p>

                                {/* Request Details Section */}
                                <div className="space-y-4 mb-8 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Request Description</label>
                                        <p className="text-sm font-bold text-slate-700 leading-relaxed italic">
                                            &quot;{asset?.pendingActionDetails?.reason || 'No description provided'}&quot;
                                        </p>
                                    </div>

                                    {asset?.pendingActionDetails?.fineData && (
                                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200/50">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Proposed Fine</label>
                                                <p className="text-sm font-black text-rose-600">AED {new Intl.NumberFormat().format(asset.pendingActionDetails.fineData.amount || 0)}</p>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Category</label>
                                                <p className="text-xs font-bold text-slate-600">{asset.pendingActionDetails.fineData.type || 'Standard'}</p>
                                            </div>
                                        </div>
                                    )}

                                    {asset?.pendingActionDetails?.attachment && (
                                        <div className="pt-2">
                                            <button
                                                onClick={() => {
                                                    setSelectedFile(asset.pendingActionDetails.attachment);
                                                    setShowFileModal(true);
                                                }}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-[10px] font-black text-slate-600 rounded-xl hover:bg-sky-50 hover:text-sky-600 transition-all shadow-sm"
                                            >
                                                <FileText size={14} /> View Supporting Document
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Approval Comments</label>
                                        <textarea
                                            value={approvalComment}
                                            onChange={(e) => setApprovalComment(e.target.value)}
                                            placeholder="Add remarks or instructions..."
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all font-medium min-h-[80px]"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => {
                                                // For Loss and Damage without fineData, open the modal directly instead of calling approve
                                                if (asset?.pendingAction === 'Loss and Damage' && !asset?.pendingActionDetails?.fineData) {
                                                    const assetData = asset;
                                                    // Open Loss and Damage modal with existing data
                                                    setDamageInitialData({
                                                        assetId: assetData.assetId,
                                                        assetName: assetData.name,
                                                        assetObjectId: assetData._id,
                                                        isAssetFlow: true,
                                                        isApprovalFlow: true, // Flag to indicate this is from approval
                                                        employeeId: assetData.assignedTo?.employeeId || '',
                                                        employeeName: assetData.assignedTo
                                                            ? `${assetData.assignedTo.firstName || ''} ${assetData.assignedTo.lastName || ''}`.trim()
                                                            : '',
                                                        description: assetData.pendingActionDetails?.reason || '',
                                                        attachment: assetData.pendingActionDetails?.attachment || null,
                                                        fineAmount: asset?.assetValue ? String(asset.assetValue) : ''
                                                    });
                                                    setShowApprovalDialog(false);
                                                    setApprovalComment('');
                                                    setShowDamageModal(true);
                                                } else {
                                                    // For other actions or Loss and Damage with fineData, proceed normally
                                                    handleApproveAction(true);
                                                }
                                            }}
                                            disabled={isProcessingApproval}
                                            className="w-full py-4 bg-sky-600 text-white rounded-[20px] font-black text-xs uppercase tracking-[0.2em] hover:bg-sky-700 transition-all shadow-xl shadow-sky-100 disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isProcessingApproval && <Loader2 className="animate-spin" size={16} />}
                                            {isProcessingApproval ? 'Authorizing...' : 'Approve & Finalize'}
                                        </button>
                                        <p className="text-[9px] text-slate-400 text-center font-bold uppercase tracking-widest">
                                            {asset?.pendingAction === 'Loss and Damage' && !asset?.pendingActionDetails?.fineData
                                                ? 'Fill in fine details to complete approval'
                                                : 'This will update asset status to Out of Service'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Reject Dialog */}
                    <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                        <AlertDialogContent className="bg-white rounded-[32px] border-none shadow-2xl overflow-hidden max-w-sm p-0">
                            <AlertDialogTitle className="sr-only">Reject Asset Action</AlertDialogTitle>
                            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
                            <button
                                onClick={() => setShowRejectDialog(false)}
                                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100/50 text-slate-400 hover:text-slate-900 transition-all z-10"
                            >
                                <X size={18} />
                            </button>
                            <div className="p-8 pt-10 text-center">
                                <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 mb-4 mx-auto shadow-sm">
                                    <X size={24} strokeWidth={3} />
                                </div>
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">
                                    Reject Request?
                                </h3>
                                <AlertDialogDescription className="text-slate-500 text-sm font-medium leading-relaxed px-2 mb-6">
                                    You are about to reject the <span className="text-rose-600 font-bold">{asset?.pendingAction}</span> request. The asset will return to its previous state.
                                </AlertDialogDescription>

                                <div className="space-y-4">
                                    <div className="text-left">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1 mb-2">Reason for Rejection</label>
                                        <textarea
                                            value={approvalComment}
                                            onChange={(e) => setApprovalComment(e.target.value)}
                                            placeholder="Explain why this request is being rejected..."
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-medium min-h-[100px]"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => handleApproveAction(false)}
                                            disabled={isProcessingApproval || !approvalComment.trim()}
                                            className="w-full py-4 bg-rose-600 text-white rounded-[20px] font-black text-xs uppercase tracking-[0.2em] hover:bg-rose-700 transition-all shadow-xl shadow-rose-100 disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isProcessingApproval && <Loader2 className="animate-spin" size={16} />}
                                            {isProcessingApproval ? 'Processing...' : 'Confirm Reject'}
                                        </button>
                                        <button
                                            onClick={() => setShowRejectDialog(false)}
                                            className="w-full py-3 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-600 transition-all"
                                        >
                                            Keep Pending
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Finalize Action Dialog (Assigned User) */}
                    <AlertDialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
                        <AlertDialogContent className="bg-white rounded-[32px] border-none shadow-2xl overflow-hidden max-w-sm p-0">
                            <AlertDialogTitle className="sr-only">Finalize Asset Action</AlertDialogTitle>
                            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
                            <button
                                onClick={() => setShowFinalizeDialog(false)}
                                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
                            >
                                <X size={18} />
                            </button>
                            <div className="p-6 pt-8 text-center">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4 mx-auto shadow-sm">
                                    <ShieldCheck size={24} />
                                </div>
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">
                                    Finalize {asset?.pendingAction}?
                                </h3>
                                <AlertDialogDescription className="text-slate-500 text-sm font-medium leading-relaxed px-2 mb-6">
                                    By acknowledging this, you confirm the current state of the asset. Status will become <span className="text-emerald-600 font-bold underline">Out of Service</span>.
                                </AlertDialogDescription>
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => handleFinalizeAction(true)}
                                        disabled={isProcessingFinalize}
                                        className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
                                    >
                                        {isProcessingFinalize ? 'Processing...' : 'Acknowledge & Confirm'}
                                    </button>
                                    <button
                                        onClick={() => handleFinalizeAction(false)}
                                        disabled={isProcessingFinalize}
                                        className="w-full py-3 bg-white text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 border border-slate-100 transition-all font-black"
                                    >
                                        Cancel / Reject
                                    </button>
                                </div>
                            </div>
                        </AlertDialogContent>
                    </AlertDialog>

                    {showEditModal && (
                        <AddAssetTypeModal
                            isOpen={showEditModal}
                            onClose={() => setShowEditModal(false)}
                            onSuccess={fetchAssetDetails}
                            mode="asset"
                            initialData={asset}
                        />
                    )}

                    {/* ── Accessory Reject Reason Dialog ── */}
                    <AlertDialog open={accRejectDialog.isOpen} onOpenChange={(open) => !open && setAccRejectDialog(p => ({ ...p, isOpen: false, reason: '' }))}>
                        <AlertDialogContent className="max-w-md rounded-2xl p-0 overflow-hidden border border-slate-200 shadow-2xl">
                            <AlertDialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-rose-50/50">
                                <AlertDialogTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                                    <span className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-sm">✕</span>
                                    Reject {accRejectDialog.pendingAction}
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-xs text-slate-500 mt-1">
                                    You are rejecting the <strong className="text-slate-700">{accRejectDialog.pendingAction}</strong> request for accessory{' '}
                                    <strong className="text-slate-700">{accRejectDialog.accName}</strong>. Please provide a reason.
                                </AlertDialogDescription>
                            </AlertDialogHeader>

                            <div className="px-6 py-5">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                    Rejection Reason
                                </label>
                                <textarea
                                    className="w-full min-h-[100px] px-4 py-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 resize-none transition-all placeholder:text-slate-300"
                                    placeholder="Enter the reason for rejection..."
                                    value={accRejectDialog.reason}
                                    onChange={(e) => setAccRejectDialog(p => ({ ...p, reason: e.target.value }))}
                                />
                            </div>

                            <AlertDialogFooter className="px-6 pb-6 flex gap-3">
                                <AlertDialogCancel
                                    onClick={() => setAccRejectDialog(p => ({ ...p, isOpen: false, reason: '' }))}
                                    className="flex-1 rounded-xl border border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    disabled={accRejectDialog.loading}
                                    onClick={async (e) => {
                                        e.preventDefault();
                                        setAccRejectDialog(p => ({ ...p, loading: true }));
                                        try {
                                            await axiosInstance.put(
                                                `/AssetItem/${assetId}/accessories/${accRejectDialog.accId}/respond-action`,
                                                { approve: false, comment: accRejectDialog.reason }
                                            );
                                            toast({ title: 'Rejected', description: `${accRejectDialog.pendingAction} request for "${accRejectDialog.accName}" has been rejected.` });
                                            setAccRejectDialog({ isOpen: false, accId: null, accName: '', pendingAction: '', reason: '', loading: false });
                                            fetchAssetDetails();
                                            fetchAssetHistory();
                                        } catch (err) {
                                            toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.message || 'Failed to reject.' });
                                            setAccRejectDialog(p => ({ ...p, loading: false }));
                                        }
                                    }}
                                    className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                >
                                    {accRejectDialog.loading ? 'Rejecting...' : 'Confirm Reject'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* ── Accessory Accept Dialog ── */}
                    <AlertDialog open={accAcceptDialog.isOpen} onOpenChange={(open) => !open && setAccAcceptDialog(p => ({ ...p, isOpen: false, reason: '', attachment: null }))}>
                        <AlertDialogContent className="max-w-md rounded-2xl p-0 overflow-hidden border border-slate-200 shadow-2xl">
                            <AlertDialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-emerald-50/50">
                                <AlertDialogTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                                    <span className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-sm">✓</span>
                                    Approve {accAcceptDialog.pendingAction}
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-xs text-slate-500 mt-1">
                                    Confirm <strong className="text-slate-700">{accAcceptDialog.pendingAction}</strong> for accessory{' '}
                                    <strong className="text-slate-700">{accAcceptDialog.accName}</strong>. Attachment is optional.
                                </AlertDialogDescription>
                            </AlertDialogHeader>

                            <div className="px-6 py-5 space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                        Description / Comment (Optional)
                                    </label>
                                    <textarea
                                        className="w-full min-h-[100px] px-4 py-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 resize-none transition-all placeholder:text-slate-300"
                                        placeholder="Add any internal notes..."
                                        value={accAcceptDialog.reason}
                                        onChange={(e) => setAccAcceptDialog(p => ({ ...p, reason: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                        Internal Attachment
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => {
                                                        setAccAcceptDialog(prev => ({ ...prev, attachment: reader.result }));
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                            className="hidden"
                                            id="acc-accept-file-popup"
                                        />
                                        <label
                                            htmlFor="acc-accept-file-popup"
                                            className={`w-full h-12 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 cursor-pointer transition-all ${accAcceptDialog.attachment ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-emerald-400 hover:bg-emerald-50'}`}
                                        >
                                            <Paperclip size={14} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">
                                                {accAcceptDialog.attachment ? 'File Attached ✔' : 'Upload Attachment'}
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <AlertDialogFooter className="px-6 pb-6 flex gap-3">
                                <AlertDialogCancel
                                    onClick={() => setAccAcceptDialog(p => ({ ...p, isOpen: false, reason: '', attachment: null }))}
                                    className="flex-1 rounded-xl border border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all font-sans"
                                >
                                    Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    disabled={accAcceptDialog.loading}
                                    onClick={async (e) => {
                                        e.preventDefault();

                                        // For Loss and Damage without fineData, open the Loss and Damage form modal
                                        if (accAcceptDialog.pendingAction === 'Loss and Damage') {
                                            const accessory = asset.accessories?.find(a => a._id?.toString() === accAcceptDialog.accId?.toString() || a.accessoryId === accAcceptDialog.accId);
                                            if (accessory && !accessory.pendingActionDetails?.fineData) {
                                                setAccAcceptDialog({ isOpen: false, accId: null, accName: '', pendingAction: '', reason: '', attachment: null, loading: false });
                                                // Open Loss and Damage modal with accessory data
                                                setDamageInitialData({
                                                    assetId: asset.assetId,
                                                    assetName: asset.name,
                                                    assetObjectId: asset._id,
                                                    isAssetFlow: true,
                                                    isApprovalFlow: true,
                                                    isAccessoryFlow: true, // Flag for accessory
                                                    accessoryId: accessory.accessoryId,
                                                    accessoryName: accessory.name,
                                                    accessoryObjectId: accessory._id,
                                                    employeeId: asset.assignedTo?.employeeId || '',
                                                    employeeName: asset.assignedTo
                                                        ? `${asset.assignedTo.firstName || ''} ${asset.assignedTo.lastName || ''}`.trim()
                                                        : '',
                                                    assignedToType: asset.assignedToType || (asset.assignedCompany ? 'Company' : 'Employee'),
                                                    company: asset.assignedCompany?._id || asset.assignedCompany || null,
                                                    description: accessory.pendingActionDetails?.reason || accAcceptDialog.reason || '',
                                                    attachment: accessory.pendingActionDetails?.attachment || accAcceptDialog.attachment || null,
                                                    fineAmount: accessory.amount ? String(accessory.amount) : '',
                                                    responsibleFor: asset.assignedToType === 'Company' ? 'Company' : 'Employee' // Auto-set based on assignment
                                                });
                                                setShowDamageModal(true);
                                                return;
                                            }
                                        }

                                        // For other actions, proceed with normal approval
                                        setAccAcceptDialog(p => ({ ...p, loading: true }));
                                        try {
                                            await axiosInstance.put(
                                                `/AssetItem/${assetId}/accessories/${accAcceptDialog.accId}/respond-action`,
                                                {
                                                    approve: true,
                                                    comment: accAcceptDialog.reason,
                                                    attachment: accAcceptDialog.attachment
                                                }
                                            );
                                            toast({ title: 'Success', description: `${accAcceptDialog.pendingAction} has been approved.` });
                                            setAccAcceptDialog({ isOpen: false, accId: null, accName: '', pendingAction: '', reason: '', attachment: null, loading: false });
                                            fetchAssetDetails();
                                            fetchAssetHistory();
                                        } catch (err) {
                                            toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.message || 'Failed to approve.' });
                                            setAccAcceptDialog(p => ({ ...p, loading: false }));
                                        }
                                    }}
                                    className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                >
                                    {accAcceptDialog.loading ? 'Processing...' : 'Confirm Approve'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>

                {/* Return Asset Modal (similar to SalaryTab) */}
                {showReturnModal && asset && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col justify-between">
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-gray-50/30">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-100">
                                        <Undo2 size={24} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">Return Asset</h2>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            Asset: {asset.assetId} - {asset.name}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setShowReturnModal(false)} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                                {/* Asset Info Summary */}
                                <div className="grid grid-cols-2 gap-6 p-6 bg-slate-50/50 rounded-[24px] border border-slate-100">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Asset Type</label>
                                        <div className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 uppercase tracking-tight shadow-sm min-h-[48px] flex items-center">
                                            {asset.typeId?.name || asset.typeId || '-'}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Category</label>
                                        <div className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 uppercase tracking-tight shadow-sm min-h-[48px] flex items-center">
                                            {asset.categoryId?.name || asset.categoryId || '-'}
                                        </div>
                                    </div>
                                </div>

                                {/* Return Action Info */}
                                <div className="bg-blue-50 border border-blue-100 rounded-[24px] p-6 space-y-2">
                                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block pl-1">
                                        Returning To
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-blue-200 text-blue-700 flex items-center justify-center shadow-sm">
                                            <User size={24} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">
                                                {asset.assignedBy?.firstName
                                                    ? `${asset.assignedBy.firstName} ${asset.assignedBy.lastName} (Original Issuer)`
                                                    : "Asset Store / Admin"}
                                            </p>
                                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                                Asset will be returned to the store or original issuer.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                                <button
                                    onClick={() => setShowReturnModal(false)}
                                    className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-white hover:border-slate-300 transition-all active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={submitReturnAsset}
                                    disabled={isReturning}
                                    className="flex-[2] px-6 py-4 bg-amber-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-200 hover:bg-amber-600 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
                                >
                                    {isReturning ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <ArrowRightLeft size={18} strokeWidth={2.5} />
                                            Confirm Return
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Dialog */}
                <AlertDialog
                    open={showDeleteModal}
                    onOpenChange={(open) => !open && setShowDeleteModal(false)}
                >
                    <AlertDialogContent className="bg-white rounded-[24px]">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-xl font-bold">Delete Asset</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm text-gray-500">
                                Are you sure you want to delete <span className="font-bold text-gray-900">"{asset?.name || asset?.assetId}"</span>? This action is permanent and cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel className="rounded-xl border-gray-100 font-bold uppercase text-[10px] tracking-widest cursor-pointer">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleDeleteAsset();
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-red-100 cursor-pointer"
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </div>
        </div>
    );
}