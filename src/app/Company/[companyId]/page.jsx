'use client';



import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import { useParams, useRouter, useSearchParams } from 'next/navigation';

import Sidebar from '@/components/Sidebar';

import Navbar from '@/components/Navbar';

import axiosInstance from '@/utils/axios';
import { isAdmin } from '@/utils/permissions';

import { Building, Mail, Phone, Globe, MapPin, Edit2, Plus, FileText, User, ChevronLeft, ChevronRight, Calendar, Camera, X, Upload, Check, RotateCcw, Download, ChevronDown, Trash2, Search, XCircle, Undo2, ArrowRightLeft, PackageX, Square, CheckSquare, Ban, CheckCircle } from 'lucide-react';

import { Country } from 'country-state-city';

import Image from 'next/image';

import { useToast } from '@/hooks/use-toast';

import { DatePicker } from "@/components/ui/date-picker";

import dynamic from 'next/dynamic';

import {

    validateEmail,

    validatePhoneNumber,

    validateRequired

} from '@/utils/validation';



const PhoneInputField = dynamic(() => import('@/components/ui/phone-input'), {

    ssr: false,

    loading: () => <div className="h-11 w-full bg-gray-50 border border-gray-200 rounded-xl animate-pulse" />

});



import DocumentViewerModal from '@/app/emp/[employeeId]/components/modals/DocumentViewerModal';
import ActivationHoldReviewModal from './components/ActivationHoldReviewModal';
import { buildHeldActivationEditState } from './utils/heldActivationEditModal.js';

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



const getInitials = (name) => {

    if (!name) return 'C';

    const parts = name.split(' ');

    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();

    return name[0].toUpperCase();

};

/** Match pending not-renew row to a UI target (must align with backend samePendingTarget). */
const companyNotRenewPendingMatches = (r, t) => {
    if (!r || r.status !== 'pending' || !t) return false;
    if (r.kind !== t.kind) return false;
    if (t.kind === 'tradeLicense' || t.kind === 'establishmentCard') return true;
    if (t.kind === 'document') {
        if (t.documentItemId && r.documentItemId) return String(r.documentItemId) === String(t.documentItemId);
        return (
            typeof t.documentIndex === 'number' &&
            typeof r.documentIndex === 'number' &&
            r.documentIndex === t.documentIndex
        );
    }
    if (t.kind === 'ownerDoc') {
        return r.ownerIndex === t.ownerIndex && String(r.docKey || '') === String(t.docKey || '');
    }
    if (t.kind === 'ejari' || t.kind === 'insurance') {
        if (t.arrayItemId && r.arrayItemId) return String(r.arrayItemId) === String(t.arrayItemId);
        return typeof t.arrayIndex === 'number' && r.arrayIndex === t.arrayIndex;
    }
    return false;
};

const RESPONSIBILITY_CATEGORIES = [

    { id: 'hr', label: 'HR' },

    { id: 'accounts', label: 'Accounts' },

    { id: 'assetcontroller', label: 'Asset Controller' },

    { id: 'management', label: 'Management' },

    { id: 'admincontroller', label: 'Admin Controller' }

];



export default function CompanyProfilePage() {

    const params = useParams();

    const router = useRouter();

    const searchParams = useSearchParams();

    const { toast } = useToast();

    const companyId = params.companyId;



    const [company, setCompany] = useState(null);

    const [employeeCount, setEmployeeCount] = useState(0);

    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState(() => {
        // Check URL parameter for tab
        const tabParam = searchParams?.get('tab');
        return tabParam || 'basic';
    });

    const [docStatusTab, setDocStatusTab] = useState(() => {
        const v = searchParams?.get('docStatusTab');
        return v && ['live', 'old', 'memo'].includes(v) ? v : 'live';
    });
    const [companySectionPages, setCompanySectionPages] = useState({});
    const [companySectionExpanded, setCompanySectionExpanded] = useState({});

    const [activeFlowTab, setActiveFlowTab] = useState('responsibilities');

    const [activeOwnerTabIndex, setActiveOwnerTabIndex] = useState(0);

    const [imageError, setImageError] = useState(false);

    const [allCompanies, setAllCompanies] = useState([]);

    const getUniqueOwners = () => {
        const ownersMap = new Map();

        const getInfoScore = (obj) => {
            if (!obj) return 0;
            let score = 0;
            const fields = ['email', 'phone', 'passport', 'visa', 'emiratesId', 'nationality', 'labourCard'];
            fields.forEach(f => {
                if (obj[f]) {
                    if (typeof obj[f] === 'object') {
                        if (obj[f].number || obj[f].attachment) score += 5;
                    } else if (String(obj[f]).trim() !== '') {
                        score += 5;
                    }
                }
            });
            return score;
        };

        allCompanies.forEach(comp => {
            if (comp.owners) {
                comp.owners.forEach(owner => {
                    const name = owner.name?.trim();
                    if (!name) return;

                    const score = getInfoScore(owner);
                    const existing = ownersMap.get(name.toLowerCase());

                    if (!existing || score > existing.score) {
                        ownersMap.set(name.toLowerCase(), {
                            data: owner,
                            score: score,
                            fromCompany: comp.companyName
                        });
                    }
                });
            }
        });
        return Array.from(ownersMap.values()).map(item => ({
            ...item.data,
            fromCompany: item.fromCompany
        }));
    };

    const [allEmployees, setAllEmployees] = useState([]);

    const [allUsers, setAllUsers] = useState([]);

    const [selectedCategory, setSelectedCategory] = useState(null);

    const [responsibilities, setResponsibilities] = useState([]);



    // Modal State

    const [modalType, setModalType] = useState(null); // 'tradeLicense' | 'establishmentCard' | 'companyDocument'

    const [modalData, setModalData] = useState({});

    const [modalErrors, setModalErrors] = useState({});

    const [isSubmitting, setIsSubmitting] = useState(false);

    const [visaDropdownOpen, setVisaDropdownOpen] = useState(false);

    const [editingIndex, setEditingIndex] = useState(null);

    const [isRenewalModal, setIsRenewalModal] = useState(false);

    const [viewingDocument, setViewingDocument] = useState(null);

    const [dynamicTabs, setDynamicTabs] = useState(['assets']);

    const [activeDynamicTabs, setActiveDynamicTabs] = useState([]);

    const [isAddMoreOpen, setIsAddMoreOpen] = useState(false);

    const [isAddingNewTab, setIsAddingNewTab] = useState(false);

    const [newTabInput, setNewTabInput] = useState('');

    const fileInputRef = useRef(null);

    const visaDropdownRef = useRef(null);

    const addMoreRef = useRef(null);

    const respDropdownRef = useRef(null);
    const progressBarRef = useRef(null);
    const progressTooltipRef = useRef(null);

    const [respDropdownOpen, setRespDropdownOpen] = useState(false);

    const [itemToDelete, setItemToDelete] = useState(null);

    /** Not renew: `{ kind, ... }` including ejari/insurance with arrayIndex / arrayItemId. */
    const [notRenewData, setNotRenewData] = useState(null);
    const [notRenewReason, setNotRenewReason] = useState('');
    const [notRenewFile, setNotRenewFile] = useState(null);
    const [notRenewSubmitting, setNotRenewSubmitting] = useState(false);
    const [viewerIsDesignatedFlowchartHr, setViewerIsDesignatedFlowchartHr] = useState(false);
    const [hrRejectRequestId, setHrRejectRequestId] = useState(null);
    const [hrRejectComment, setHrRejectComment] = useState('');
    const [hrRespondSubmitting, setHrRespondSubmitting] = useState(false);

    const [ownerToDelete, setOwnerToDelete] = useState(null);

    const [documentToDelete, setDocumentToDelete] = useState(null);

    const [companyAssets, setCompanyAssets] = useState([]);

    const [assetsLoading, setAssetsLoading] = useState(false);
    const [selectedCompanyAssetIds, setSelectedCompanyAssetIds] = useState([]);
    const [companyBulkSubmitting, setCompanyBulkSubmitting] = useState(false);
    const [companyBulkDialog, setCompanyBulkDialog] = useState({
        open: false,
        mode: null, // 'return' | 'transfer' | 'endOfServices'
        leaveDuration: '1',
    });

    const [companyFines, setCompanyFines] = useState([]);

    const [finesLoading, setFinesLoading] = useState(false);
    const [activationSubmitting, setActivationSubmitting] = useState(false);
    const [showProgressTooltip, setShowProgressTooltip] = useState(false);
    const [isProgressTooltipLocked, setIsProgressTooltipLocked] = useState(false);
    const [activationDecisionLoading, setActivationDecisionLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [activationProgressFromApi, setActivationProgressFromApi] = useState(null);
    const [activationSubmitModalOpen, setActivationSubmitModalOpen] = useState(false);
    const [activationReviewModalOpen, setActivationReviewModalOpen] = useState(false);
    /** Non–Flowchart HR submit modal: queued entry ids included; unchecked rows are dropped on submit. */
    const [activationSubmitSelectedEntryIds, setActivationSubmitSelectedEntryIds] = useState([]);
    const [activationRejectReason, setActivationRejectReason] = useState('');
    const [activationRowNotesByGroupKey, setActivationRowNotesByGroupKey] = useState({});
    const [activationSelectedChangeIds, setActivationSelectedChangeIds] = useState([]);
    const [activationHoldReviewModalOpen, setActivationHoldReviewModalOpen] = useState(false);
    const [viewingCompanyChange, setViewingCompanyChange] = useState(null);
    const [viewingCompanyAttachment, setViewingCompanyAttachment] = useState(null);
    const [isDirectHrAction, setIsDirectHrAction] = useState(false);

    const [addForm, setAddForm] = useState({
        title: '',
        issueDate: '',
        attachment: null,
        isUploading: false
    });

    const [summaryPageIndex, setSummaryPageIndex] = useState(0);
    const [isSummaryHovered, setIsSummaryHovered] = useState(false);
    const [summaryPageVisible, setSummaryPageVisible] = useState(true);





    // Handle tab + owner sub-tab from URL (e.g. document expiry deep link)
    useEffect(() => {
        const tabParam = searchParams?.get('tab');
        if (tabParam && ['basic', 'owner', 'assets', 'fine', 'others', 'add', 'moa'].includes(tabParam)) {
            setActiveTab(tabParam);
        }
        const ownerTabParam = searchParams?.get('ownerTab');
        if (ownerTabParam !== null && ownerTabParam !== '') {
            const idx = parseInt(ownerTabParam, 10);
            if (!Number.isNaN(idx) && idx >= 0) {
                setActiveOwnerTabIndex(idx);
            }
        }
        const docStatusParam = searchParams?.get('docStatusTab');
        if (docStatusParam && ['live', 'old', 'memo'].includes(docStatusParam)) {
            setDocStatusTab(docStatusParam);
        }
    }, [searchParams]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const rawEmployeeUser = localStorage.getItem('employeeUser');
        const rawUser = localStorage.getItem('user');
        try {
            if (rawEmployeeUser) {
                setCurrentUser(JSON.parse(rawEmployeeUser));
                return;
            }
            if (rawUser) {
                setCurrentUser(JSON.parse(rawUser));
            }
        } catch {
            setCurrentUser(null);
        }
    }, []);

    // Close dropdown when clicking outside

    useEffect(() => {

        const handleClickOutside = (event) => {

            if (visaDropdownRef.current && !visaDropdownRef.current.contains(event.target)) {

                setVisaDropdownOpen(false);

            }

            if (addMoreRef.current && !addMoreRef.current.contains(event.target)) {

                setIsAddMoreOpen(false);

            }

            if (respDropdownRef.current && !respDropdownRef.current.contains(event.target)) {

                setRespDropdownOpen(false);

            }

        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => document.removeEventListener('mousedown', handleClickOutside);

    }, []);

    useEffect(() => {
        const handleProgressTooltipOutsideClick = (event) => {
            if (!showProgressTooltip && !isProgressTooltipLocked) return;
            const target = event.target;
            const clickedInsideBar = progressBarRef.current?.contains(target);
            const clickedInsideTooltip = progressTooltipRef.current?.contains(target);
            if (!clickedInsideBar && !clickedInsideTooltip) {
                setShowProgressTooltip(false);
                setIsProgressTooltipLocked(false);
            }
        };

        document.addEventListener('mousedown', handleProgressTooltipOutsideClick);
        return () => document.removeEventListener('mousedown', handleProgressTooltipOutsideClick);
    }, [showProgressTooltip, isProgressTooltipLocked]);



    const fetchCompany = useCallback(async () => {

        try {

            setLoading(true);

            const response = await axiosInstance.get(`/Company/${companyId}`);

            setCompany(response.data.company);
            setActivationProgressFromApi(response.data.activationProgress || null);
            setViewerIsDesignatedFlowchartHr(!!response.data.viewerIsDesignatedFlowchartHr);

            setEmployeeCount(response.data.employeeCount || 0);

        } catch (err) {

            console.error('Error fetching company:', err);

        } finally {

            setLoading(false);

        }

    }, [companyId]);



    useEffect(() => {

        if (companyId) fetchCompany();

    }, [fetchCompany, companyId]);



    useEffect(() => {

        if (company) {

            const baseTabs = ['assets', 'legal document with expiry', 'legal document without expiry', 'moa'];

            const backendTabs = company.customTabs || [];

            const mergedTabs = Array.from(new Set([...baseTabs, ...backendTabs]));

            setDynamicTabs(mergedTabs);



            // Automatically activate custom tabs that have data (but not insurance/ejari as they are cards now)

            const tabsToActivate = [];



            // Activate any custom tabs that were created

            backendTabs.forEach(tab => {

                if (!['insurance', 'ejari', 'assets'].includes(tab) && !tabsToActivate.includes(tab)) {

                    tabsToActivate.push(tab);

                }

            });



            setActiveDynamicTabs(prev => {

                const filteredPrev = prev.filter(t => !['insurance', 'ejari'].includes(t));

                const uniqueTabs = new Set([...filteredPrev, ...tabsToActivate]);

                return Array.from(uniqueTabs);

            });



            if (company.responsibilities) {

                setResponsibilities(company.responsibilities);

            }

        }

    }, [company]);



    const fetchAllEmployees = useCallback(async (compId) => {

        if (!compId) return;

        try {

            const response = await axiosInstance.get('/Employee', { params: { limit: 1000 } });

            const employees = response.data.employees || response.data || [];

            // Filter only employees belonging to this company (using the robust _id comparison)

            const companyEmployees = employees.filter(emp => {

                const empCompId = emp.company?._id || emp.company;

                return String(empCompId) === String(compId);

            });

            setAllEmployees(companyEmployees);

        } catch (err) {

            console.error('Error fetching employees:', err);

        }

    }, []);



    const fetchAllUsers = useCallback(async () => {

        try {

            const response = await axiosInstance.get('/User', { params: { limit: 1000 } });

            setAllUsers(response.data.users || response.data || []);

        } catch (err) {

            console.error('Error fetching users:', err);

        }

    }, []);



    const fetchAllCompanies = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/Company');
            setAllCompanies(response.data.companies || response.data || []);
        } catch (err) {
            console.error('Error fetching all companies:', err);
        }
    }, []);

    useEffect(() => {
        fetchAllCompanies();
    }, [fetchAllCompanies]);

    useEffect(() => {

        if (company?._id) {

            fetchAllEmployees(company._id);

        }

        fetchAllUsers();

    }, [company?._id, fetchAllEmployees, fetchAllUsers]);



    const fetchCompanyAssets = useCallback(async () => {
        if (!company?._id) return;
        try {
            setAssetsLoading(true);
            const res = await axiosInstance.get('/AssetItem/assigned/all');
            const all = res.data || [];
            const filtered = all.filter((a) => {
                const assetCompId = a.assignedCompany?._id || a.assignedCompany;
                return assetCompId && String(assetCompId) === String(company._id);
            });
            setCompanyAssets(filtered);
        } catch (err) {
            console.error('Error fetching company assets:', err);
        } finally {
            setAssetsLoading(false);
        }
    }, [company?._id]);

    useEffect(() => {
        if (activeTab === 'assets' && company?._id) {
            fetchCompanyAssets();
        }
    }, [activeTab, company?._id, fetchCompanyAssets]);

    useEffect(() => {

        if (activeTab === 'fine' && company?._id) {

            setFinesLoading(true);

            axiosInstance.get('/Fine', { params: { companyId: company._id, limit: 1000 } })

                .then(res => {

                    const fines = res.data.fines || res.data || [];

                    // Filter to show ONLY approved/paid company-responsible fines (not employee fines)
                    // Company fines are identified by:
                    // 1. assignedEmployees contains VEGA-HR-0000 (company record)
                    // 2. OR responsibleFor === 'Company' AND company matches
                    // 3. AND status must be Approved, Active, Completed, or Paid
                    const filtered = fines.filter(f => {

                        const fineCompanyId = f.company?._id || f.company;

                        const hasCompanyRecord = f.assignedEmployees?.some(emp =>

                            emp.employeeId === 'VEGA-HR-0000' ||

                            emp.employeeName === 'Vega Digital IT Solutions'

                        );

                        const isCompanyResponsible = f.responsibleFor === 'Company' &&

                            fineCompanyId &&

                            String(fineCompanyId) === String(company._id);

                        // Only show if it's a company record (VEGA-HR-0000) OR company is fully responsible
                        const isCompanyFine = hasCompanyRecord || isCompanyResponsible;

                        // Only show approved/paid fines
                        const isApprovedOrPaid = ['Approved', 'Active', 'Completed', 'Paid'].includes(f.fineStatus);

                        return isCompanyFine && isApprovedOrPaid;

                    });

                    setCompanyFines(filtered);

                })

                .catch(err => console.error('Error fetching company fines:', err))

                .finally(() => setFinesLoading(false));

        }

    }, [activeTab, company?._id]);



    const handleRemoveConfirm = async () => {

        if (itemToDelete === null) return;

        const updated = responsibilities.filter((_, i) => i !== itemToDelete);

        setResponsibilities(updated);

        try {

            await axiosInstance.patch(`/Company/${companyId}`, { responsibilities: updated });

            toast({ title: "Updated", description: "Responsibility removed successfully" });

            fetchCompany();

        } catch (err) {

            console.error('Error removing responsibility:', err);

            toast({ title: "Error", description: "Failed to remove responsibility", variant: "destructive" });

        } finally {

            setItemToDelete(null);

        }

    };



    const findPendingNotRenew = useCallback(
        (target) => (company?.pendingNotRenewRequests || []).find((r) => companyNotRenewPendingMatches(r, target)),
        [company]
    );

    useEffect(() => {
        if (!notRenewData) {
            setNotRenewReason('');
            setNotRenewFile(null);
        }
    }, [notRenewData]);

    const buildNotRenewPayload = () => {
        if (!notRenewData || !company?._id) return null;
        const base = {
            kind: notRenewData.kind,
            label: notRenewData.label || '',
            reason: notRenewReason.trim(),
            supportingAttachmentKey: '',
            supportingAttachmentName: '',
        };
        if (notRenewData.kind === 'tradeLicense' || notRenewData.kind === 'establishmentCard') return base;
        if (notRenewData.kind === 'document') {
            return {
                ...base,
                documentIndex: typeof notRenewData.index === 'number' ? notRenewData.index : undefined,
                documentItemId: notRenewData.documentItemId || undefined,
            };
        }
        if (notRenewData.kind === 'ownerDoc') {
            return {
                ...base,
                ownerIndex: notRenewData.ownerIndex,
                docKey: notRenewData.docKey,
            };
        }
        if (notRenewData.kind === 'ejari' || notRenewData.kind === 'insurance') {
            return {
                ...base,
                arrayIndex: typeof notRenewData.arrayIndex === 'number' ? notRenewData.arrayIndex : undefined,
                arrayItemId: notRenewData.arrayItemId || undefined,
            };
        }
        return null;
    };

    const handleNotRenewSubmit = async () => {
        if (!notRenewData || !company?._id) return;
        const reason = notRenewReason.trim();
        if (reason.length < 3) {
            toast({
                title: 'Reason required',
                description: 'Please enter at least 3 characters explaining why this document will not be renewed.',
                variant: 'destructive',
            });
            return;
        }
        const labelFallback = notRenewData.label || 'document';
        setNotRenewSubmitting(true);
        try {
            let supportingAttachmentKey = '';
            let supportingAttachmentName = '';
            if (notRenewFile) {
                const reader = new FileReader();
                const base64Data = await new Promise((resolve, reject) => {
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(notRenewFile);
                });
                const uploadRes = await axiosInstance.post(`/Company/${company._id}/upload`, {
                    fileData: base64Data,
                    fileName: notRenewFile.name || 'attachment',
                    folder: `company-documents/${company.companyId || companyId}/not-renew-support`,
                });
                supportingAttachmentKey = uploadRes.data.key || uploadRes.data.url || '';
                supportingAttachmentName = notRenewFile.name || '';
            }
            const payload = buildNotRenewPayload();
            if (!payload) {
                toast({ title: 'Error', description: 'Invalid not-renew target.', variant: 'destructive' });
                return;
            }
            payload.reason = reason;
            payload.supportingAttachmentKey = supportingAttachmentKey;
            payload.supportingAttachmentName = supportingAttachmentName;

            const response = await axiosInstance.post(`/Company/${company._id}/not-renew-requests`, payload);
            const message = String(response?.data?.message || '').toLowerCase();
            const wasAutoApproved = message.includes('moved to old documents') || message.includes('not renew applied');
            toast(
                wasAutoApproved
                    ? {
                          title: 'Completed',
                          description: 'Not renew applied. Document removed from Live and moved to Old Documents.',
                      }
                    : {
                          title: 'Submitted',
                          description: 'HR has been notified. This document is pending approval.',
                      }
            );
            setNotRenewData(null);
            fetchCompany();
        } catch (error) {
            console.error('Not Renew submit error:', error);
            toast({
                title: 'Error',
                description: error.response?.data?.message || `Failed to submit not-renew for ${labelFallback}`,
                variant: 'destructive',
            });
        } finally {
            setNotRenewSubmitting(false);
        }
    };

    const handleHrApproveNotRenew = async (requestId) => {
        if (!company?._id || !requestId) return;
        setHrRespondSubmitting(true);
        try {
            await axiosInstance.post(`/Company/${company._id}/not-renew-requests/${requestId}/respond`, { action: 'approve' });
            toast({ title: 'Approved', description: 'Not renew applied and document archived.' });
            fetchCompany();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'Could not approve.',
                variant: 'destructive',
            });
        } finally {
            setHrRespondSubmitting(false);
        }
    };

    const handleHrRejectNotRenew = async () => {
        if (!company?._id || !hrRejectRequestId) return;
        const hrComment = hrRejectComment.trim();
        if (hrComment.length < 3) {
            toast({
                title: 'Comment required',
                description: 'Please enter at least 3 characters for the rejection reason.',
                variant: 'destructive',
            });
            return;
        }
        setHrRespondSubmitting(true);
        try {
            await axiosInstance.post(`/Company/${company._id}/not-renew-requests/${hrRejectRequestId}/respond`, {
                action: 'reject',
                hrComment,
            });
            toast({ title: 'Rejected', description: 'The requester has been notified.' });
            setHrRejectRequestId(null);
            setHrRejectComment('');
            fetchCompany();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'Could not reject.',
                variant: 'destructive',
            });
        } finally {
            setHrRespondSubmitting(false);
        }
    };



    const viewerIsCompanyActivationSubmitter = useMemo(() => {
        if (!company || !currentUser) return false;
        const sid = company.activationSubmittedBy;
        const myObj = String(
            currentUser.employeeObjectId || currentUser.empObjectId || currentUser.linkedEmployee || '',
        ).trim();
        if (sid && myObj && String(sid) === String(myObj)) return true;
        return false;
    }, [company, currentUser]);

    const hasCompanyActivationHoldPending = useMemo(() => {
        return (
            Array.isArray(company?.activationHold?.unapprovedEntryIds) &&
            company.activationHold.unapprovedEntryIds.length > 0
        );
    }, [company?.activationHold?.unapprovedEntryIds]);

    /** Submitter may open activation submit while HR hold is open (same idea as employee profile hold). */
    const activationHoldResubmitEligible = useMemo(() => {
        if (!company || !currentUser) return false;
        if (String(company.activationStatus || '').trim().toLowerCase() !== 'submitted') return false;
        if (!viewerIsCompanyActivationSubmitter) return false;
        const unapprovedIds = Array.isArray(company?.activationHold?.unapprovedEntryIds)
            ? company.activationHold.unapprovedEntryIds
            : [];
        return unapprovedIds.length > 0;
    }, [company, currentUser, viewerIsCompanyActivationSubmitter]);

    const handleModalOpen = (type, index = null, contextTab = null, isRenewal = false) => {

        setModalType(type);

        setIsRenewalModal(isRenewal);

        setModalErrors({});

        const currentIndex = type === 'companyDocument'
            ? index
            : (index !== null ? index : editingIndex);

        let currentTab = contextTab || activeTab;



        if (type === 'tradeLicense') {

            setModalData({

                number: isRenewal ? '' : (company.tradeLicenseNumber || ''),

                issueDate: isRenewal ? '' : (company.tradeLicenseIssueDate ? new Date(company.tradeLicenseIssueDate).toISOString().split('T')[0] : (company.establishedDate ? new Date(company.establishedDate).toISOString().split('T')[0] : '')),

                expiryDate: isRenewal ? '' : (company.tradeLicenseExpiry ? new Date(company.tradeLicenseExpiry).toISOString().split('T')[0] : ''),

                owners: company.owners && company.owners.length > 0 ? (isRenewal ? company.owners.map(o => ({ ...o, attachment: null })) : [...company.owners]) : [{ name: company.tradeLicenseOwnerName || '', sharePercentage: '', attachment: '', isNew: !company.tradeLicenseOwnerName }],

                attachment: isRenewal ? null : (company.tradeLicenseAttachment || null)

            });

        } else if (type === 'establishmentCard') {

            setModalData({

                companyName: company.name || '',

                number: isRenewal ? '' : (company.establishmentCardNumber || ''),

                expiryDate: isRenewal ? '' : (company.establishmentCardExpiry ? new Date(company.establishmentCardExpiry).toISOString().split('T')[0] : ''),

                attachment: isRenewal ? null : (company.establishmentCardAttachment || null)

            });

        } else if (type === 'basicDetails') {

            setModalData({

                companyId: company.companyId || '',

                name: company.name || '',

                nickName: company.nickName || '',

                email: company.email || '',

                phone: company.phone || '',

                establishedDate: company.establishedDate ? new Date(company.establishedDate).toISOString().split('T')[0] : '',

                expiryDate: company.tradeLicenseExpiry ? new Date(company.tradeLicenseExpiry).toISOString().split('T')[0] : ''

            });

        } else if (type === 'companyDocument') {

            let doc = {};

            if (currentIndex !== null) {

                if (currentTab === 'insurance') doc = company.insurance?.[currentIndex] || {};

                else if (currentTab === 'ejari') doc = company.ejari?.[currentIndex] || {};

                else doc = company.documents?.[currentIndex] || {};



                // Use saved context if available

                if (doc.context) currentTab = doc.context;

            }

            const rawIssueDate = doc.issueDate || doc.startDate;
            const issueDate = rawIssueDate ? new Date(rawIssueDate).toISOString().split('T')[0] : '';
            const expiryDate = doc.expiryDate ? new Date(doc.expiryDate).toISOString().split('T')[0] : '';
            const valueRaw = doc.value ?? '';
            const isNoExpiryByContext =
                String(currentTab || '').toLowerCase() === 'document_without_expiry' ||
                String(currentTab || '').toLowerCase() === 'moa';

            setEditingIndex(currentIndex);
            setModalData({
                type: isRenewal ? '' : ((typeof doc.type === 'string' ? doc.type : null) || (String(currentTab).toLowerCase() === 'moa' ? 'MOA' : '')),
                description: isRenewal ? '' : (typeof doc.description === 'string' ? doc.description : ''),
                issueDate: isRenewal ? '' : issueDate,
                startDate: isRenewal ? '' : issueDate,
                hasExpiry: isRenewal ? true : !isNoExpiryByContext,
                expiryDate: isRenewal ? '' : expiryDate,
                hasValue: isRenewal ? true : !(valueRaw === '' || valueRaw === null || valueRaw === undefined),
                value: isRenewal ? '' : valueRaw,
                context: currentTab,
                attachment: isRenewal ? null : (doc.document?.url || null),
                fileName: isRenewal ? '' : (doc.document?.name || ''),
                mimeType: isRenewal ? 'application/pdf' : (doc.document?.mimeType || 'application/pdf'),
                provider: doc.provider || '',
                authority: doc.authority || '',
            });
            return;

        } else if (type === 'addNewCategory') {

            setModalData({

                type: '',

                issueDate: '',

                startDate: '',

                expiryDate: '',

                value: '',

                attachment: null

            });

        } else if (type === 'ownerDetails') {

            const owner = company.owners[activeOwnerTabIndex];

            setModalData({

                name: owner.name || '',

                sharePercentage: owner.sharePercentage || '',

                email: owner.email || company.email || '',

                phone: owner.phone || company.phone || '',

                nationality: owner.nationality || ''

            });

        } else if (['ownerPassport', 'ownerVisa', 'ownerEmiratesId', 'ownerMedical', 'ownerDrivingLicense', 'ownerLabourCard'].includes(type)) {

            const owner = company.owners[activeOwnerTabIndex];

            const fieldMap = {

                ownerPassport: 'passport',

                ownerVisa: 'visa',

                ownerEmiratesId: 'emiratesId',

                ownerMedical: 'medical',

                ownerDrivingLicense: 'drivingLicense',

                ownerLabourCard: 'labourCard'

            };

            const docField = fieldMap[type];

            const docData = (!isRenewal && owner[docField]) || {};

            setModalData({

                number: docData.number || '',

                nationality: docData.nationality || '',

                type: docData.type || '',

                issueDate: docData.issueDate ? new Date(docData.issueDate).toISOString().split('T')[0] : '',

                placeOfIssue: docData.placeOfIssue || '',

                countryOfIssue: docData.countryOfIssue || '',

                sponsor: docData.sponsor || '',

                provider: docData.provider || '',

                attachment: docData.attachment || null,

                lastUpdated: docData.lastUpdated ? new Date(docData.lastUpdated).toISOString().split('T')[0] : '',

                expiryDate: docData.expiryDate ? new Date(docData.expiryDate).toISOString().split('T')[0] : '',

            });

        } else if (type === 'addEjari' || type === 'addInsurance') {

            setModalType('companyDocument');

            const docType = type === 'addEjari' ? 'Ejari' : 'Insurance';

            setModalData({

                type: '',

                provider: '',

                authority: '',

                issueDate: '',

                startDate: '',

                value: '',

                expiryDate: '',

                attachment: null,

                fileName: '',

                mimeType: 'application/pdf',

                context: type === 'addEjari' ? 'ejari' : 'insurance'

            });

        }

    };

    const handleHeldActivationEdit = useCallback(
        (entry) => {
            const st = buildHeldActivationEditState(company, entry);
            if (!st?.ok) {
                toast({
                    title: 'Unable to open edit',
                    description: 'No saved proposal was found for this hold item.',
                    variant: 'destructive',
                });
                return;
            }
            setIsRenewalModal(false);
            setModalErrors({});
            if (st.tabAfterOpen) setActiveTab(st.tabAfterOpen);
            setEditingIndex(st.editingIndex ?? null);
            setModalData(st.modalData);
            setModalType(st.modalType);
        },
        [company, toast],
    );

    const handleModalClose = () => {

        setModalType(null);

        setModalData({});

        setModalErrors({});

        setEditingIndex(null);

        setIsRenewalModal(false);

    };

    const openCompanyAddDocumentModal = () => {
        setModalErrors({});
        setEditingIndex(null);
        const docContext = activeTab === 'moa' ? 'moa' : undefined;
        setModalData({
            type: '',
            description: '',
            issueDate: '',
            startDate: '',
            hasExpiry: true,
            expiryDate: '',
            hasValue: true,
            value: '',
            context: docContext,
            attachment: null,
            fileName: '',
            mimeType: 'application/pdf',
            provider: '',
            authority: '',
        });
        setModalType('companyDocument');
        setIsRenewalModal(false);
    };



    const handleFileChange = async (e) => {

        const file = e.target.files[0];

        if (!file) return;



        // Check file size (5MB limit)

        if (file.size > 5 * 1024 * 1024) {

            toast({ title: "Error", description: "File size exceeds 5MB limit", variant: "destructive" });

            return;

        }



        try {

            setIsSubmitting(true);



            const reader = new FileReader();

            reader.readAsDataURL(file);

            reader.onload = async () => {

                const base64Data = reader.result;



                try {

                    const response = await axiosInstance.post(`/Company/${company._id}/upload`, {

                        fileData: base64Data,

                        fileName: file.name,

                        folder: `company-documents/${company.companyId}`

                    });



                    setModalData(prev => ({

                        ...prev,

                        attachment: response.data.url,

                        publicId: response.data.key,

                        fileName: file.name,

                        mimeType: file.type

                    }));



                    toast({ title: "Success", description: "File uploaded successfully" });

                } catch (error) {

                    console.error('Error uploading file:', error);

                    toast({ title: "Error", description: "Failed to upload file", variant: "destructive" });

                } finally {

                    setIsSubmitting(false);

                }

            };

            reader.onerror = () => {

                toast({ title: "Error", description: "Failed to read file", variant: "destructive" });

                setIsSubmitting(false);

            };

        } catch (error) {

            console.error('File operation error:', error);

            setIsSubmitting(false);

        }

    };



    const handleSave = async (e) => {

        if (e) e.preventDefault();



        // Validation logic

        const errors = {};

        if (modalType === 'tradeLicense') {

            if (!modalData.number) errors.number = 'Trade License Number is required';

            if (!modalData.issueDate) errors.issueDate = 'Issue Date is required';

            if (!modalData.expiryDate) errors.expiryDate = 'Expiry Date is required';

            if (!modalData.attachment) errors.attachment = 'Attachment is required';

        } else if (modalType === 'establishmentCard') {

            if (!modalData.number) errors.number = 'Establishment Card Number is required';

            if (!modalData.expiryDate) errors.expiryDate = 'Expiry Date is required';

            if (!modalData.attachment) errors.attachment = 'Attachment is required';

        } else if (modalType === 'basicDetails') {

            if (!modalData.name) errors.name = 'Company Name is required';

            if (!modalData.email) errors.email = 'Email is required';

            else {

                const emailVal = validateEmail(modalData.email, true);

                if (!emailVal.isValid) errors.email = emailVal.error;

            }

            if (!modalData.phone) errors.phone = 'Phone Number is required';

            else {

                const phoneVal = validatePhoneNumber(modalData.phone, 'ae', true);

                if (!phoneVal.isValid) errors.phone = phoneVal.error;

            }

        } else if (['companyDocument', 'addNewCategory', 'addEjari', 'addInsurance'].includes(modalType)) {

            if (!modalData.type) errors.type = (modalData.context === 'ejari' ? 'Ejari Type' : modalData.context === 'insurance' ? 'Insurance Type' : 'Document Type') + ' is required';

            const isNoExpiry =

                modalData.hasExpiry === false ||

                modalData.context === 'document_without_expiry' ||
                modalData.context === 'moa' ||

                modalData.type?.toLowerCase().includes('without expiry') ||

                modalData.type?.toLowerCase().includes('moa');



            const docTypeLower = String(modalData.type || '').toLowerCase();
            const requiresIssueDate =
                modalData.context === 'ejari' ||
                modalData.context === 'insurance' ||
                docTypeLower.includes('ejar') ||
                docTypeLower.includes('insur');
            if (requiresIssueDate && !modalData.issueDate && !modalData.startDate) errors.issueDate = 'Issue Date is required';



            if (!modalData.expiryDate && !isNoExpiry) {

                errors.expiryDate = 'Expiry Date is required';

            }

            if (!modalData.attachment) errors.attachment = 'Attachment is required';

        } else if (modalType === 'addMemo') {
            if (!modalData.type?.trim()) errors.type = 'Document name is required';
            if (!modalData.memoCategory) errors.memoCategory = 'Category is required';
            if (!modalData.description?.trim()) errors.description = 'Description is required';
            if (!modalData.attachment) errors.attachment = 'Attachment is required';

        } else if (modalType === 'ownerDetails') {

            if (!modalData.name) errors.name = 'Name is required';

            if (!modalData.sharePercentage) errors.percentage = 'Share percentage is required';

            if (modalData.email) {

                const emailVal = validateEmail(modalData.email, false);

                if (!emailVal.isValid) errors.email = emailVal.error;

            }

            if (modalData.phone) {

                const phoneVal = validatePhoneNumber(modalData.phone, 'ae', false);

                if (!phoneVal.isValid) errors.phone = phoneVal.error;

            }

        } else if (['ownerPassport', 'ownerVisa', 'ownerEmiratesId', 'ownerMedical', 'ownerDrivingLicense', 'ownerLabourCard'].includes(modalType)) {

            if (!modalData.number) errors.number = (modalType === 'ownerMedical' ? 'Policy Number' : 'Number') + ' is required';

            if (!['ownerLabourCard'].includes(modalType) && !modalData.issueDate) errors.issueDate = 'Issue Date is required';

            if (!modalData.expiryDate) errors.expiryDate = 'Expiry Date is required';

            if (!modalData.attachment) errors.attachment = 'Attachment is required';

            if (modalType === 'ownerPassport') {

                if (!modalData.nationality) errors.nationality = 'Passport Nationality is required';

                if (!modalData.countryOfIssue) errors.countryOfIssue = 'Country of Issue is required';

            }

            if (modalType === 'ownerVisa' && !modalData.sponsor && !['Visiting', 'Visit'].includes(modalData.type)) errors.sponsor = 'Sponsor is required';

            if (modalType === 'ownerMedical' && !modalData.provider) errors.provider = 'Insurance Provider is required';

        }



        if (Object.keys(errors).length > 0) {

            setModalErrors(errors);

            toast({

                title: "Validation Error",

                description: "Please fill all required fields correctly",

                variant: "destructive"

            });

            return;

        }



        try {

            setIsSubmitting(true);

            const payload = {};

            if (modalType === 'tradeLicense') {

                if (isRenewalModal && company.tradeLicenseNumber) {

                    const historyDoc = {

                        type: 'Trade License',

                        description: `Previous License ${company.tradeLicenseNumber}`,

                        issueDate: company.tradeLicenseIssueDate,

                        expiryDate: company.tradeLicenseExpiry,

                        document: {

                            url: company.tradeLicenseAttachment,

                            name: `Trade License ${company.tradeLicenseNumber}`,

                            mimeType: 'application/pdf'

                        }

                    };

                    payload.documents = [historyDoc, ...(company.documents || [])];

                }

                // Validate total percentage for trade license owners

                const totalPercent = modalData.owners?.reduce((sum, o) => sum + (parseFloat(o.sharePercentage) || 0), 0) || 0;

                if (Math.round(totalPercent) !== 100) {

                    toast({

                        title: "100% Share Required",

                        description: `The total owner share percentage must be exactly 100%. Currently it is ${totalPercent}%.`,

                        variant: "destructive"

                    });

                    setIsSubmitting(false);

                    return;

                }



                payload.tradeLicenseNumber = modalData.number;

                payload.tradeLicenseIssueDate = modalData.issueDate;

                payload.tradeLicenseExpiry = modalData.expiryDate;

                payload.owners = modalData.owners;

                payload.tradeLicenseAttachment = modalData.attachment;

                if (modalData.owners && modalData.owners.length > 0) {

                    payload.tradeLicenseOwnerName = modalData.owners[0].name;

                }

            } else if (modalType === 'establishmentCard') {

                if (isRenewalModal && company.establishmentCardNumber) {

                    const historyDoc = {

                        type: 'Establishment Card',

                        description: `Previous Card ${company.establishmentCardNumber}`,

                        issueDate: company.establishmentCardIssueDate,

                        expiryDate: company.establishmentCardExpiry,

                        document: {

                            url: company.establishmentCardAttachment,

                            name: `Establishment Card ${company.establishmentCardNumber}`,

                            mimeType: 'application/pdf'

                        }

                    };

                    payload.documents = [historyDoc, ...(company.documents || [])];

                }

                payload.establishmentCardNumber = modalData.number;

                payload.establishmentCardExpiry = modalData.expiryDate;

                payload.establishmentCardAttachment = modalData.attachment;

            } else if (modalType === 'basicDetails') {

                payload.name = modalData.name;

                payload.nickName = modalData.nickName;

                payload.email = modalData.email;

                payload.phone = modalData.phone;

                payload.establishedDate = modalData.establishedDate;

                payload.tradeLicenseExpiry = modalData.expiryDate;

            } else if (['ownerPassport', 'ownerVisa', 'ownerEmiratesId', 'ownerMedical', 'ownerDrivingLicense', 'ownerLabourCard'].includes(modalType)) {

                const fieldMap = {

                    ownerPassport: 'passport',

                    ownerVisa: 'visa',

                    ownerEmiratesId: 'emiratesId',

                    ownerMedical: 'medical',

                    ownerDrivingLicense: 'drivingLicense',

                    ownerLabourCard: 'labourCard'

                };

                const docField = fieldMap[modalType];

                const updatedOwners = [...company.owners];

                const owner = updatedOwners[activeOwnerTabIndex];



                if (isRenewalModal && owner[docField]?.attachment) {

                    const historyDoc = {

                        type: `${owner.name} - ${docField.charAt(0).toUpperCase() + docField.slice(1)}`,

                        description: `Previous ${docField} for ${owner.name}`,

                        issueDate: owner[docField].issueDate,

                        expiryDate: owner[docField].expiryDate,

                        document: {

                            url: owner[docField].attachment,

                            name: `${docField} ${owner[docField].number}`,

                            mimeType: 'application/pdf'

                        }

                    };

                    payload.documents = [historyDoc, ...(company.documents || [])];

                }



                updatedOwners[activeOwnerTabIndex] = {

                    ...owner,

                    [docField]: {

                        provider: modalData.provider,

                        number: modalData.number,

                        nationality: modalData.nationality,

                        type: modalData.type,

                        issueDate: modalData.issueDate,

                        placeOfIssue: modalData.placeOfIssue,

                        countryOfIssue: modalData.countryOfIssue,

                        sponsor: modalData.sponsor,

                        lastUpdated: modalData.lastUpdated,

                        expiryDate: modalData.expiryDate,

                        attachment: modalData.attachment

                    }

                };

                payload.owners = updatedOwners;

            } else if (modalType === 'companyDocument') {

                const issueOrStart =
                    modalData.startDate ||
                    modalData.issueDate ||
                    '';
                const baseContext = String(modalData.context || '').toLowerCase();
                const shouldUseContextAsIs =
                    baseContext === 'ejari' || baseContext === 'insurance' || baseContext === 'moa';
                const resolvedContext = shouldUseContextAsIs
                    ? baseContext
                    : (modalData.hasExpiry === false ? 'document_without_expiry' : 'document_with_expiry');

                const newDoc = {

                    type: modalData.type,

                    description: modalData.description,

                    provider: modalData.provider,

                    issueDate: issueOrStart,

                    startDate: modalData.startDate || modalData.issueDate || '',

                    value: modalData.hasValue === false ? '' : modalData.value,

                    expiryDate: modalData.hasExpiry === false ? '' : modalData.expiryDate,

                    context: resolvedContext,

                    document: {

                        url: modalData.attachment,

                        name: modalData.fileName,

                        mimeType: modalData.mimeType || 'application/pdf'

                    }

                };



                const docType = modalData.type?.toLowerCase() || '';

                const isInsurance = modalData.context === 'insurance' || docType.includes('insur');

                const isEjari = modalData.context === 'ejari' || docType.includes('ejar');



                if (isInsurance) {

                    const updatedDocs = [...(company.insurance || [])];

                    if (isRenewalModal && editingIndex !== null && updatedDocs[editingIndex]) {

                        const oldDoc = updatedDocs[editingIndex];

                        const historyDoc = {

                            type: oldDoc.type || 'Insurance Policy',

                            description: `Previous ${oldDoc.provider || ''} Insurance Policy`,

                            context: 'insurance',

                            provider: oldDoc.provider,

                            issueDate: oldDoc.issueDate || oldDoc.startDate,

                            startDate: oldDoc.startDate,

                            expiryDate: oldDoc.expiryDate,

                            value: oldDoc.value,

                            document: oldDoc.document

                        };

                        payload.documents = [historyDoc, ...(company.documents || [])];

                        updatedDocs[editingIndex] = newDoc;

                    } else if (editingIndex !== null) {

                        updatedDocs[editingIndex] = newDoc;

                    } else {

                        updatedDocs.push(newDoc);

                    }

                    payload.insurance = updatedDocs;

                } else if (isEjari) {

                    const updatedDocs = [...(company.ejari || [])];

                    if (isRenewalModal && editingIndex !== null && updatedDocs[editingIndex]) {

                        const oldDoc = updatedDocs[editingIndex];

                        const historyDoc = {

                            type: oldDoc.type || 'Ejari Record',

                            description: `Previous Ejari Registration - ${oldDoc.type}`,

                            context: 'ejari',

                            provider: oldDoc.provider,

                            issueDate: oldDoc.issueDate,

                            startDate: oldDoc.startDate,

                            expiryDate: oldDoc.expiryDate,

                            value: oldDoc.value,

                            document: oldDoc.document

                        };

                        payload.documents = [historyDoc, ...(company.documents || [])];

                        updatedDocs[editingIndex] = newDoc;

                    } else if (editingIndex !== null) {

                        updatedDocs[editingIndex] = newDoc;

                    } else {

                        updatedDocs.push(newDoc);

                    }

                    payload.ejari = updatedDocs;

                } else {

                    const updatedDocs = [...(company.documents || [])];

                    if (isRenewalModal && editingIndex !== null && updatedDocs[editingIndex]) {
                        const oldDoc = updatedDocs[editingIndex];
                        const historyDoc = {
                            type: oldDoc.type ? `Previous ${oldDoc.type}` : 'Previous Document',
                            description: `Previous ${oldDoc.description || oldDoc.type || 'Document'}`,
                            issueDate: oldDoc.issueDate || oldDoc.startDate,
                            startDate: oldDoc.startDate,
                            expiryDate: oldDoc.expiryDate,
                            value: oldDoc.value,
                            document: oldDoc.document
                        };
                        updatedDocs[editingIndex] = newDoc;
                        payload.documents = [historyDoc, ...updatedDocs];
                    } else if (editingIndex !== null) {
                        updatedDocs[editingIndex] = newDoc;
                        payload.documents = updatedDocs;
                    } else {
                        updatedDocs.push(newDoc);
                        payload.documents = updatedDocs;
                    }

                }

            } else if (modalType === 'addNewCategory') {

                if (!modalData.type || !modalData.attachment) {

                    toast({ title: "Error", description: "Title and Attachment are mandatory", variant: "destructive" });

                    return;

                }

                const categoryName = modalData.type.trim().toLowerCase();

                const isInsurance = categoryName.includes('insur');

                const isEjari = categoryName.includes('ejar');



                const newDoc = {

                    type: modalData.type,

                    issueDate: modalData.issueDate,

                    startDate: modalData.startDate,

                    expiryDate: modalData.expiryDate,

                    value: modalData.value,

                    document: {

                        url: modalData.attachment,

                        name: modalData.fileName,

                        mimeType: modalData.mimeType || 'application/pdf'

                    }

                };



                // Add to dynamicTabs if not exists

                const existingTabs = company.customTabs || [];

                if (!existingTabs.includes(categoryName) && !['asset', 'insurance', 'ejari'].includes(categoryName)) {

                    payload.customTabs = [...existingTabs, categoryName];

                }



                if (isInsurance || isEjari) {

                    const field = isInsurance ? 'insurance' : 'ejari';

                    const structuredDoc = {

                        ...newDoc,

                        context: isInsurance ? 'insurance' : 'ejari',

                    };

                    const updatedTypeDocs = [...(company[field] || [])];

                    updatedTypeDocs.push(structuredDoc);

                    payload[field] = updatedTypeDocs;

                    // Live copy lives only on insurance/ejari; Documents tab reads those for Live. Avoid duplicating into documents[].

                    // Switch back to basic tab as they show as cards there

                    setActiveTab('basic');

                } else {

                    const updatedDocs = [...(company.documents || [])];

                    updatedDocs.push(newDoc);

                    payload.documents = updatedDocs;

                    // Switch to the new tab

                    setActiveTab(categoryName);

                    if (!activeDynamicTabs.includes(categoryName)) {

                        setActiveDynamicTabs(prev => [...prev, categoryName]);

                    }

                }

            } else if (modalType === 'ownerDetails') {

                const updatedOwners = [...company.owners];

                updatedOwners[activeOwnerTabIndex] = {

                    ...updatedOwners[activeOwnerTabIndex],

                    name: modalData.name,

                    sharePercentage: modalData.sharePercentage,

                    email: modalData.email,

                    phone: modalData.phone,

                    nationality: modalData.nationality

                };

                payload.owners = updatedOwners;

            } else if (modalType === 'addMemo') {
                const newDoc = {
                    type: modalData.type?.trim(),
                    issueDate: modalData.issueDate || modalData.startDate,
                    startDate: modalData.issueDate || modalData.startDate,
                    description: modalData.description?.trim(),
                    context: 'memo',
                    provider: modalData.memoCategory || 'General',
                    document: {
                        url: modalData.attachment,
                        name: modalData.fileName || modalData.type,
                        mimeType: modalData.mimeType || 'application/pdf'
                    }
                };
                const prevDocs = [...(company.documents || [])];
                if (editingIndex !== null && prevDocs[editingIndex]) {
                    prevDocs[editingIndex] = { ...prevDocs[editingIndex], ...newDoc };
                    payload.documents = prevDocs;
                } else {
                    payload.documents = [...prevDocs, newDoc];
                }
            }



            const res = await axiosInstance.patch(`/Company/${company._id}`, payload);



            toast({
                title: "Success",
                description:
                    typeof res?.data?.message === "string" ? res.data.message : "Details updated successfully",
            });

            fetchCompany(); // Refresh data

            handleModalClose();

        } catch (error) {

            console.error("Update error:", error);

            toast({ title: "Error", description: "Failed to update details", variant: "destructive" });

        } finally {

            setIsSubmitting(false);

        }

    };



    const handleAddOwner = () => {
        setModalData(prev => {
            const currentOwners = prev.owners || [];
            const newCount = currentOwners.length + 1;
            const equalShare = (100 / newCount).toFixed(2);

            const newOwner = {
                name: '',
                sharePercentage: equalShare,
                attachment: '',
                isNew: true
            };

            const updatedOwners = currentOwners.map(o => ({
                ...o,
                sharePercentage: equalShare
            }));

            const list = [...updatedOwners, newOwner];

            return {
                ...prev,
                owners: list
            };
        });
    };



    const handleRemoveOwner = (index) => {

        setOwnerToDelete(index);

    };



    const confirmRemoveOwner = () => {

        if (ownerToDelete === null) return;

        const index = ownerToDelete;

        setModalData(prev => {

            const temp = prev.owners.filter((_, i) => i !== index);

            if (temp.length === 0) return { ...prev, owners: [] };



            const equalShare = (100 / temp.length).toFixed(2);

            const updatedOwners = temp.map(o => ({

                ...o,

                sharePercentage: equalShare

            }));



            return {

                ...prev,

                owners: updatedOwners

            };

        });

        setOwnerToDelete(null);

    };



    const handleOwnerChange = (index, field, value) => {

        setModalData(prev => {

            const newOwners = [...prev.owners];



            if (field === 'sharePercentage') {

                const newValue = Math.min(100, Math.max(0, Number(value)));

                const oldValue = Number(newOwners[index].sharePercentage) || 0;



                newOwners[index] = { ...newOwners[index], sharePercentage: newValue };



                // If purely single owner, just set it (though usually 100)

                if (newOwners.length === 1) {

                    return { ...prev, owners: newOwners };

                }



                // Auto-balance others

                const remaining = 100 - newValue;

                const otherOwners = newOwners.filter((_, i) => i !== index);

                const currentSumOthers = otherOwners.reduce((sum, o) => sum + (Number(o.sharePercentage) || 0), 0);



                // Distribute remaining among others

                newOwners.forEach((owner, i) => {

                    if (i !== index) {

                        let newShare;

                        if (currentSumOthers === 0) {

                            // If others were 0, distribute equally

                            newShare = (remaining / otherOwners.length);

                        } else {

                            // Proportional distribution

                            const ratio = (Number(owner.sharePercentage) || 0) / currentSumOthers;

                            newShare = remaining * ratio;

                        }



                        // Avoid negative shares

                        if (newShare < 0) newShare = 0;



                        // Update

                        newOwners[i] = {

                            ...owner,

                            sharePercentage: Number.isInteger(newShare) ? newShare : newShare.toFixed(2)

                        };

                    }

                });

            } else {

                newOwners[index] = { ...newOwners[index], [field]: value };

            }



            return { ...prev, owners: newOwners };

        });

    };

    const confirmDeleteDocument = async () => {
        if (!documentToDelete) return;
        if (!isAdmin()) {
            toast({ title: "Access denied", description: "Only administrator can delete company documents.", variant: "destructive" });
            return;
        }

        try {
            const { kind, index, id: docId } = documentToDelete;
            let response;
            let actionType = 'deleted';

            if (kind === 'oldDocuments') {
                const deleteTarget = docId || index;
                response = await axiosInstance.delete(`/Company/${companyId}/old-document/${deleteTarget}`);
            } else if (kind === 'oldOwners') {
                const deleteTarget = docId || index;
                response = await axiosInstance.delete(`/Company/${companyId}/old-owner/${deleteTarget}`);
            } else {
                const docToDelete = company.documents[index];
                const isOld = docToDelete.description?.toLowerCase().includes('previous') || docToDelete.type?.toLowerCase().includes('previous');

                let updatedDocs;
                if (docStatusTab === 'live') {
                    // Soft Delete: Mark as Previous
                    updatedDocs = [...company.documents];
                    updatedDocs[index] = {
                        ...docToDelete,
                        type: `Previous ${docToDelete.type || 'Document'}`,
                        description: `Deleted/Archived - ${docToDelete.description || ''}`
                    };
                    actionType = 'moved to Old Documents';
                    response = await axiosInstance.patch(`/Company/${companyId}`, { documents: updatedDocs });
                } else {
                    // Hard Delete: Remove completely
                    updatedDocs = company.documents.filter((_, i) => i !== index);
                    // Use skipArchive=true to prevent it from moving to oldDocuments (if it was an old doc already)
                    response = await axiosInstance.patch(`/Company/${companyId}`, { documents: updatedDocs, skipArchive: true });
                }
            }

            toast({ title: "Success", description: `Document ${actionType} successfully` });
            fetchCompany();
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to delete document", variant: "destructive" });
        } finally {
            setDocumentToDelete(null);
        }
    };



    /** Opens Not Renew dialog for ejari / insurance (HR approval flow). */
    const openNotRenewEjariInsurance = (field, index, item) => {
        const label = field === 'ejari' ? 'Ejari' : field === 'insurance' ? 'Insurance' : field.charAt(0).toUpperCase() + field.slice(1);
        const row = item || company[field]?.[index];
        const detail = row?.type ? `${label} — ${row.type}` : label;
        setNotRenewData({
            kind: field,
            arrayIndex: index,
            arrayItemId: row?._id != null ? String(row._id) : undefined,
            label: detail,
        });
    };

    /** Permanently remove a row from ejari/insurance without archiving — administrators only. */
    const handleHardDeleteArrayItem = async (field, index) => {
        if (!isAdmin()) {
            toast({ title: "Access denied", description: "Only administrator can permanently delete this record.", variant: "destructive" });
            return;
        }
        const label = field === 'ejari' ? 'Ejari' : field === 'insurance' ? 'Insurance' : field;
        if (!window.confirm(`Permanently delete this ${label} entry? This cannot be undone.`)) return;
        try {
            const list = [...(company[field] || [])];
            if (index < 0 || index >= list.length) return;
            list.splice(index, 1);
            await axiosInstance.patch(`/Company/${company._id}`, { [field]: list });
            toast({ title: "Deleted", description: `${label} entry removed.` });
            fetchCompany();
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to delete record.", variant: "destructive" });
        }
    };



    const handleDeleteCategory = async (categoryToDelete) => {
        if (!isAdmin()) {
            toast({ title: "Access denied", description: "Only administrator can delete categories.", variant: "destructive" });
            return;
        }

        if (!confirm(`Are you sure you want to delete the category "${categoryToDelete}"? This action cannot be undone.`)) return;



        try {

            // Optimistically update UI

            const newDynamicTabs = dynamicTabs.filter(t => t !== categoryToDelete);



            // Wait for backend confirmation

            const updatedCustomTabs = (company.customTabs || []).filter(t => t !== categoryToDelete);



            await axiosInstance.patch(`/Company/${companyId}`, {

                customTabs: updatedCustomTabs

            });



            toast({

                title: "Success",

                description: `Category "${categoryToDelete}" deleted successfully`,

                variant: "success"

            });



            // Now update local state and fetch fresh data

            setDynamicTabs(newDynamicTabs);

            setActiveDynamicTabs(prev => prev.filter(t => t !== categoryToDelete));



            if (activeTab === categoryToDelete) setActiveTab('others');



            fetchCompany();



        } catch (error) {

            console.error('Error deleting category:', error);

            toast({

                title: "Error",

                description: "Failed to delete category",

                variant: "destructive"

            });

            fetchCompany(); // Revert state

        }

    };

    const handleDeleteTradeLicense = async () => {
        if (!isAdmin()) {
            toast({ title: "Access denied", description: "Only administrator can delete Trade License details.", variant: "destructive" });
            return;
        }
        if (!window.confirm("Delete Trade License card details?")) return;
        try {
            await axiosInstance.patch(`/Company/${companyId}`, {
                tradeLicenseNumber: null,
                tradeLicenseIssueDate: null,
                tradeLicenseExpiry: null,
                tradeLicenseAttachment: null
            });
            toast({ title: "Deleted", description: "Trade License details removed successfully." });
            fetchCompany();
        } catch (error) {
            toast({ title: "Error", description: "Failed to delete Trade License details.", variant: "destructive" });
        }
    };

    const handleDeleteEstablishmentCard = async () => {
        if (!isAdmin()) {
            toast({ title: "Access denied", description: "Only administrator can delete Establishment Card details.", variant: "destructive" });
            return;
        }
        if (!window.confirm("Delete Establishment Card details?")) return;
        try {
            await axiosInstance.patch(`/Company/${companyId}`, {
                establishmentCardNumber: null,
                establishmentCardExpiry: null,
                establishmentCardAttachment: null
            });
            toast({ title: "Deleted", description: "Establishment Card details removed successfully." });
            fetchCompany();
        } catch (error) {
            toast({ title: "Error", description: "Failed to delete Establishment Card details.", variant: "destructive" });
        }
    };

    const handleDeleteOwnerDocumentCard = async (docKey, ownerTabIndex = activeOwnerTabIndex) => {
        if (!isAdmin()) {
            toast({ title: "Access denied", description: "Only administrator can delete owner card records.", variant: "destructive" });
            return;
        }
        if (!window.confirm("Delete this owner document card?")) return;
        try {
            const updatedOwners = [...(company.owners || [])];
            const oi = typeof ownerTabIndex === 'number' ? ownerTabIndex : activeOwnerTabIndex;
            if (!updatedOwners[oi]) return;
            updatedOwners[oi] = {
                ...updatedOwners[oi],
                [docKey]: null
            };
            await axiosInstance.patch(`/Company/${companyId}`, { owners: updatedOwners });
            toast({ title: "Deleted", description: "Owner document card removed successfully." });
            fetchCompany();
        } catch (error) {
            toast({ title: "Error", description: "Failed to delete owner document card.", variant: "destructive" });
        }
    };

    const handleDeleteOwner = async (index) => {
        if (!isAdmin()) {
            toast({ title: "Access denied", description: "Only administrator can delete owners.", variant: "destructive" });
            return;
        }
        if (!window.confirm("Delete this owner entirely? This will also remove all their associated documents and cannot be undone.")) return;
        try {
            const updatedOwners = [...(company.owners || [])];
            updatedOwners.splice(index, 1);
            await axiosInstance.patch(`/Company/${companyId}`, { owners: updatedOwners });
            toast({ title: "Deleted", description: "Owner removed successfully." });
            fetchCompany();
            if (activeOwnerTabIndex >= updatedOwners.length) {
                setActiveOwnerTabIndex(Math.max(0, updatedOwners.length - 1));
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to delete owner.", variant: "destructive" });
        }
    };







    const formatDate = (dateString) => {

        if (!dateString) return '---';

        const d = dateString instanceof Date ? dateString : new Date(dateString);

        if (Number.isNaN(d.getTime())) return '---';

        return d.toLocaleDateString('en-GB');

    };

    const getExpiryVisualState = (dateString) => {
        // Old documents view should be strictly neutral (no red/amber styling).
        if (docStatusTab === 'old') return { className: 'text-gray-700 font-normal', tag: null };
        if (!dateString) return { className: 'text-gray-500', tag: null };
        const expiry = new Date(dateString);
        if (Number.isNaN(expiry.getTime())) return { className: 'text-gray-500', tag: null };

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const e = new Date(expiry);
        e.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil((e - today) / (1000 * 60 * 60 * 24));

        if (daysLeft < 0) {
            return { className: 'text-red-600 font-semibold', tag: 'Expired' };
        }
        if (daysLeft <= 30) {
            return { className: 'text-amber-600 font-semibold', tag: `${daysLeft}d left` };
        }
        return { className: 'text-gray-500', tag: null };
    };

    const isExpiredDate = (dateString) => getExpiryVisualState(dateString).tag === 'Expired';



    const getSummaryItems = () => {

        if (!company) return [];

        const items = [];

        const colors = ['bg-white', 'bg-blue-300', 'bg-sky-200'];



        const addExpiryItem = (label, date) => {

            if (date) {

                const d = new Date(date);

                if (!isNaN(d.getTime())) {

                    items.push({

                        text: `${label} expires on ${d.toLocaleDateString('en-GB')}`,

                        rawDate: d

                    });

                }

            }

        };



        const isOldDoc = (d) =>
            (d?.description?.toLowerCase()?.includes('previous') ?? false) ||
            (d?.type?.toLowerCase()?.includes('previous') ?? false);



        // Core Company Documents - explicitly prioritized

        addExpiryItem('Trade License', company.tradeLicenseExpiry);

        addExpiryItem('Establishment Card', company.establishmentCardExpiry);



        // Operational Documents (Collections)

        (company.insurance || []).forEach(ins => {

            if (ins == null || typeof ins !== 'object') return;

            if (!isOldDoc(ins)) addExpiryItem(ins.type || 'Insurance', ins.expiryDate);

        });

        (company.ejari || []).forEach(ej => {

            if (ej == null || typeof ej !== 'object') return;

            if (!isOldDoc(ej)) addExpiryItem(ej.type || 'Ejari', ej.expiryDate);

        });

        (company.documents || []).forEach(doc => {

            // Include only if not already covered (avoid duplicates if Logic changes)

            if (doc == null || typeof doc !== 'object') return;

            if (!isOldDoc(doc) && doc.expiryDate) {

                // optionally filter out if it's a known system type to avoid double listing

                const type = doc.type?.toLowerCase() || '';

                if (!type.includes('trade license') && !type.includes('establishment card')) {

                    addExpiryItem(doc.type || 'Document', doc.expiryDate);

                }

            }

        });



        // Owner Documents - specific fields as requested
        const formatOwnerNameForExpiry = (rawName) => {
            const safe = String(rawName || '').trim();
            if (!safe) return 'Owner';
            const parts = safe.split(/\s+/).filter(Boolean);
            if (parts.length < 2) return parts[0];
            const first = parts[0];
            const lastInitial = `${parts[parts.length - 1][0]}.`;
            return `${first} ${lastInitial}`;
        };

        (company.owners || []).forEach(owner => {
            if (owner == null || typeof owner !== 'object') return;

            const ownerName = formatOwnerNameForExpiry(owner.name);

            const docMap = {

                passport: 'Passport',

                visa: 'Visa',

                emiratesId: 'Emirates ID',

                medical: 'Medical Insurance',

                drivingLicense: 'Driving License',

                labourCard: 'Labour Card'

            };



            Object.entries(docMap).forEach(([field, label]) => {

                const doc = owner[field];

                if (doc && doc.expiryDate) {

                    addExpiryItem(`${ownerName}'s ${label}`, doc.expiryDate);

                }

            });

        });



        return items

            .sort((a, b) => a.rawDate - b.rawDate)

            .map((item, index) => ({

                ...item,

                color: colors[index % colors.length]

            }));

    };



    const statusItems = getSummaryItems();
    const SUMMARY_POINTS_PER_PAGE = 5;
    const summaryPages = useMemo(() => {
        if (!statusItems.length) return [];
        const pages = [];
        for (let i = 0; i < statusItems.length; i += SUMMARY_POINTS_PER_PAGE) {
            pages.push(statusItems.slice(i, i + SUMMARY_POINTS_PER_PAGE));
        }
        return pages;
    }, [statusItems]);

    useEffect(() => {
        if (summaryPages.length === 0) {
            setSummaryPageIndex(0);
            return;
        }
        setSummaryPageIndex((prev) => Math.min(prev, summaryPages.length - 1));
    }, [summaryPages.length]);

    useEffect(() => {
        if (isSummaryHovered || summaryPages.length <= 1) return;
        const timer = setInterval(() => {
            setSummaryPageIndex((prev) => (prev + 1) % summaryPages.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [isSummaryHovered, summaryPages.length]);

    useEffect(() => {
        if (summaryPages.length <= 1) return;
        setSummaryPageVisible(false);
        const t = setTimeout(() => setSummaryPageVisible(true), 40);
        return () => clearTimeout(t);
    }, [summaryPageIndex, summaryPages.length]);
    const localComputedActivationProgress = useMemo(() => {
        if (!company) return { checks: [], percentage: 0 };

        const hasValue = (v) => !(v === undefined || v === null || (typeof v === 'string' && v.trim() === ''));
        const moaAvailable = (company.documents || []).some((d) => {
            const t = String(d?.type || '').toLowerCase();
            return t.includes('moa') && !!d?.document?.url;
        });

        const checks = [
            {
                key: 'basicDetails',
                label: 'Basic details',
                completed: [
                    company.name,
                    company.nickName,
                    company.companyId,
                    company.email,
                    company.phone,
                    company.establishedDate,
                ].every(hasValue),
            },
            {
                key: 'tradeLicense',
                label: 'Trade License',
                completed: [company.tradeLicenseNumber, company.tradeLicenseIssueDate, company.tradeLicenseExpiry].every(hasValue) && !!company.tradeLicenseAttachment,
            },
            {
                key: 'establishmentCard',
                label: 'Establishment Card Details',
                completed: [company.establishmentCardNumber, company.establishmentCardExpiry].every(hasValue) && !!company.establishmentCardAttachment,
            },
            {
                key: 'moa',
                label: 'MOA',
                completed: moaAvailable,
            },
        ];

        const completed = checks.filter((c) => c.completed).length;
        return {
            checks,
            completed,
            total: checks.length,
            percentage: Math.round((completed / checks.length) * 100),
            missing: checks.filter((c) => !c.completed).map((c) => c.label),
        };
    }, [company]);
    const companyActivationProgress = activationProgressFromApi || localComputedActivationProgress;

    const activationHrSubmission = useMemo(() => {
        const workflow = Array.isArray(company?.activationWorkflow) ? company.activationWorkflow : [];
        const hrEntries = workflow
            .filter((w) => String(w?.role || '').toLowerCase() === 'hr')
            .slice()
            .sort((a, b) => new Date(b?.assignedAt || b?.actionedAt || 0) - new Date(a?.assignedAt || a?.actionedAt || 0));

        const submittedEntry =
            hrEntries.find((e) => e?.status === 'submitted') ||
            hrEntries[0] ||
            null;

        const raw = typeof submittedEntry?.comment === 'string' ? submittedEntry.comment : '';

        const parse = (text) => {
            if (!text || typeof text !== 'string') return { reason: '', description: '', attachment: '', requestedChanges: [], type: '' };

            // Stored by backend as:
            // "Reason: <reason> | Description: <desc> | Attachment: <url>"
            // Attachment part may be missing.
            const reasonMatch = text.match(/Reason:\s*(.*?)\s*\|\s*Description:/i);

            // First try the full form with Attachment block
            let descriptionMatch = text.match(/Description:\s*(.*?)\s*\|\s*Attachment:/i);
            // If there is no " | Attachment", capture until end of string
            if (!descriptionMatch) {
                descriptionMatch = text.match(/Description:\s*(.*)$/i);
            }

            const attachmentMatch = text.match(/Attachment:\s*(.*)$/i);
            const requestedChangesMatch = text.match(/Requested Changes:\s*(.*?)(\s*\|\s*Attachment:|$)/i);
            const typeMatch = text.match(/Type:\s*(.*?)(\s*\|\s*Reason:|$)/i);

            const reason = reasonMatch?.[1]?.trim() || '';
            const description = descriptionMatch?.[1]?.trim() || '';
            const attachment = attachmentMatch?.[1]?.trim() || '';
            const requestedChanges = (requestedChangesMatch?.[1] || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            const type = typeMatch?.[1]?.trim() || '';

            // Fallback if comment doesn't follow the expected format at all.
            if (!reason && !description && !attachment) {
                return { reason: text.trim(), description: '', attachment: '', requestedChanges: [], type: '' };
            }

            return { reason, description, attachment, requestedChanges, type };
        };

        const { reason, description, attachment, requestedChanges, type } = parse(raw);
        const structuredReasonRaw = typeof submittedEntry?.reason === 'string' ? submittedEntry.reason.trim() : '';
        const structuredDescriptionRaw = typeof submittedEntry?.description === 'string' ? submittedEntry.description.trim() : '';
        const structuredAttachmentRaw = typeof submittedEntry?.attachment === 'string' ? submittedEntry.attachment.trim() : '';
        const parsedStructuredReason = parse(structuredReasonRaw);
        const parsedStructuredDescription = parse(structuredDescriptionRaw);

        const finalReason =
            parsedStructuredReason.reason ||
            structuredReasonRaw ||
            reason;
        const finalDescription =
            structuredDescriptionRaw ||
            parsedStructuredReason.description ||
            parsedStructuredDescription.description ||
            description;
        const finalAttachment =
            structuredAttachmentRaw ||
            parsedStructuredReason.attachment ||
            parsedStructuredDescription.attachment ||
            attachment;

        return {
            entry: submittedEntry,
            raw,
            type: type || parsedStructuredReason.type || '',
            reason: finalReason,
            description: finalDescription,
            attachment: finalAttachment,
            requestedChanges: requestedChanges.length
                ? requestedChanges
                : (parse(finalDescription).requestedChanges || []),
        };
    }, [company]);

    const openActivationSubmitModal = () => {
        if (!company?._id) return;
        if ((companyActivationProgress?.percentage || 0) < 100) {
            toast({
                title: 'Completion required',
                description: 'Please complete all mandatory company sections to reach 100% before activation.',
                variant: 'destructive',
            });
            return;
        }
        setActivationSubmitModalOpen(true);
    };

    const handleSubmitForActivation = async () => {
        if (!company?._id) return;
        if ((companyActivationProgress?.percentage || 0) < 100) {
            toast({
                title: 'Completion required',
                description: 'Please complete all mandatory company sections to reach 100% before activation.',
                variant: 'destructive',
            });
            return;
        }

        try {
            setActivationSubmitting(true);
            if (viewerIsDesignatedFlowchartHr) {
                const response = await axiosInstance.post(`/Company/${company._id}/approve-activation`, {
                    approvedChangeIds: [],
                    selectionProvided: false,
                });
                if (response?.data?.company) setCompany(response.data.company);
                if (response?.data?.activationProgress) setActivationProgressFromApi(response.data.activationProgress);
                await fetchCompany();
                toast({
                    title: 'Company activated',
                    description: response?.data?.message || 'The company is now active.',
                });
                setActivationSubmitModalOpen(false);
                return;
            }

            const submitBody = {
                // Backend requires these keys; keep static defaults since form fields were removed by request.
                reason: 'Company submitted for activation',
                description: 'Submitted for activation review',
            };
            if (activationSubmitAllEntryIds.length > 0) {
                submitBody.selectionProvided = true;
                submitBody.includedChangeEntryIds = [...activationSubmitSelectedEntryIds.map(String)];
            }
            const response = await axiosInstance.post(`/Company/${company._id}/submit-activation`, submitBody);
            if (response?.data?.company) setCompany(response.data.company);
            if (response?.data?.activationProgress) setActivationProgressFromApi(response.data.activationProgress);
            await fetchCompany();
            toast({
                title: 'Sent for activation',
                description: 'Company has been submitted to HR for activation review.',
            });
            setActivationSubmitModalOpen(false);
        } catch (err) {
            if (err?.response?.data?.activationProgress) {
                setActivationProgressFromApi(err.response.data.activationProgress);
            }
            toast({
                title: 'Submission failed',
                description: err?.response?.data?.message || 'Unable to submit company for activation.',
                variant: 'destructive',
            });
        } finally {
            setActivationSubmitting(false);
        }
    };

    const handleViewCompanyRequestedChange = (cardLabel = '') => {
        const label = String(cardLabel || '').toLowerCase();
        if (label.includes('owner')) return setActiveTab('owner');
        if (label.includes('trade') || label.includes('establishment') || label.includes('moa') || label.includes('document') || label.includes('insurance') || label.includes('ejari')) {
            return setActiveTab('others');
        }
        return setActiveTab('basic');
    };
    const toCompanyLabel = (key = '') => String(key)
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (m) => m.toUpperCase());
    const toCompanyDisplay = (value) => {
        if (value == null || value === '') return '-';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') {
            const d = new Date(value);
            if (!Number.isNaN(d.getTime()) && (value.includes('T') || /^\d{4}-\d{2}-\d{2}$/.test(value))) {
                return d.toLocaleDateString();
            }
            return value;
        }
        return JSON.stringify(value);
    };
    const fileNameFrom = (value) => {
        if (!value) return '-';
        if (typeof value === 'string') {
            const clean = value.split('?')[0];
            const tail = clean.split('/').filter(Boolean).pop();
            return tail || clean;
        }
        if (typeof value === 'object') {
            if (value.name) return value.name;
            if (value.url) return fileNameFrom(value.url);
        }
        return '-';
    };
    const pickShapeFromSource = (source, template) => {
        if (template == null) return template;
        if (Array.isArray(template)) {
            if (!Array.isArray(source)) return [];
            return source;
        }
        if (typeof template !== 'object') return source;
        const next = {};
        Object.keys(template).forEach((key) => {
            if (source && Object.prototype.hasOwnProperty.call(source, key)) {
                next[key] = pickShapeFromSource(source[key], template[key]);
            }
        });
        return next;
    };
    const getCompanyReviewData = (entry, kind = 'proposed') => {
        if (!entry || typeof entry !== 'object') return {};
        const previous = entry.previousData && typeof entry.previousData === 'object' ? entry.previousData : {};
        const proposed = entry.proposedData && typeof entry.proposedData === 'object' ? entry.proposedData : {};

        if (kind === 'proposed') return proposed;
        if (Object.keys(proposed).length === 0) return previous;
        // Show only the same card/fields in Current Card that are being edited.
        return pickShapeFromSource(previous, proposed);
    };
    const companyRows = (data) => {
        if (!data || typeof data !== 'object') return [];
        const rows = [];
        const add = (label, value, url = '') => {
            if (value === undefined || value === null || value === '') return;
            rows.push({ label, value: toCompanyDisplay(value), url });
        };
        Object.entries(data).forEach(([key, value]) => {
            if (['_id', '__v', 'createdAt', 'updatedAt'].includes(key)) return;
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                if (value.url || key.toLowerCase().includes('attachment') || key.toLowerCase().includes('document')) {
                    const url = value.url || '';
                    add(toCompanyLabel(key), fileNameFrom(value), url);
                }
                return;
            }
            if (Array.isArray(value)) {
                add(toCompanyLabel(key), `${value.length} item(s)`);
                return;
            }
            add(toCompanyLabel(key), value);
        });
        return rows;
    };

    const filterCompanyReviewRowsToChangesOnly = (prevRows, propRows) => {
        const sig = (row) =>
            `${String(row?.value ?? '').trim()}||${String(row?.url ?? '').split('?')[0].trim()}`;
        const prevByLabel = new Map();
        for (const r of prevRows) {
            if (!prevByLabel.has(r.label)) prevByLabel.set(r.label, r);
        }
        const propLabels = new Set(propRows.map((r) => r.label));
        const changed = new Set();
        for (const pr of propRows) {
            const oldR = prevByLabel.get(pr.label);
            if (!oldR || sig(oldR) !== sig(pr)) changed.add(pr.label);
        }
        for (const r of prevRows) {
            if (!propLabels.has(r.label)) changed.add(r.label);
        }
        if (changed.size === 0) {
            return { prevRows, propRows };
        }
        return {
            prevRows: prevRows.filter((r) => changed.has(r.label)),
            propRows: propRows.filter((r) => changed.has(r.label)),
        };
    };

    const pendingActivationItems = (companyActivationProgress?.checks || [])
        .filter((check) => !check.completed);
    const pendingCompanyChanges = useMemo(() => {
        if (!Array.isArray(company?.pendingReactivationChanges)) return [];
        return company.pendingReactivationChanges.map((entry, idx) => ({
            ...entry,
            _id: String(entry?._id || idx),
            card: String(entry?.card || '').trim() || 'Company Profile',
            changeType: String(entry?.changeType || '').trim(),
            section: String(entry?.section || '').trim(),
        }));
    }, [company?.pendingReactivationChanges]);

    const pendingCompanyDisplayGroups = useMemo(() => {
        const byKey = new Map();
        for (const entry of pendingCompanyChanges) {
            const sec = String(entry.section || '').toLowerCase().trim();
            const ct = String(entry.changeType || '').toLowerCase().trim();
            const cardSlug = String(entry.card || '').trim().toLowerCase();
            // Group by card label too, so different company cards do not collapse into one row.
            const key = `${sec || 'companyprofile'}::${cardSlug || 'company-profile'}::${ct}`;
            if (!byKey.has(key)) {
                byKey.set(key, { key, ids: [], entries: [] });
            }
            const g = byKey.get(key);
            g.ids.push(entry._id);
            g.entries.push(entry);
        }
        const groups = [...byKey.values()].map((g) => {
            const sorted = [...g.entries].sort(
                (a, b) => new Date(b?.changedAt || 0) - new Date(a?.changedAt || 0),
            );
            const rep = sorted[0];
            const n = g.ids.length;
            const editHint = n > 1 ? ` · ${n} edits` : '';
            return {
                ...g,
                representativeEntry: rep,
                displayLabel: `${rep.card}${rep.changeType ? ` (${rep.changeType})` : ''}${editHint}`,
                sortTime: Math.min(
                    ...g.entries.map((e) => {
                        const t = new Date(e?.changedAt || 0).getTime();
                        return Number.isNaN(t) ? Infinity : t;
                    }),
                ),
            };
        });
        groups.sort((a, b) => a.sortTime - b.sortTime);
        return groups;
    }, [pendingCompanyChanges]);

    const activationSubmitAllEntryIds = useMemo(
        () => pendingCompanyDisplayGroups.flatMap((g) => g.ids.map(String)),
        [pendingCompanyDisplayGroups],
    );

    useEffect(() => {
        if (!activationSubmitModalOpen || viewerIsDesignatedFlowchartHr) return;
        setActivationSubmitSelectedEntryIds([...activationSubmitAllEntryIds]);
    }, [activationSubmitModalOpen, viewerIsDesignatedFlowchartHr, activationSubmitAllEntryIds]);

    const activationSubmitAllRowsSelected =
        activationSubmitAllEntryIds.length > 0 &&
        activationSubmitAllEntryIds.every((id) => activationSubmitSelectedEntryIds.includes(id));

    const toggleActivationSubmitSelectAll = () => {
        if (activationSubmitAllRowsSelected) {
            setActivationSubmitSelectedEntryIds([]);
            return;
        }
        setActivationSubmitSelectedEntryIds([...activationSubmitAllEntryIds]);
    };

    const toggleActivationSubmitGroupSelection = (groupIds) => {
        if (!Array.isArray(groupIds) || groupIds.length === 0) return;
        const strIds = groupIds.map(String);
        setActivationSubmitSelectedEntryIds((prev) => {
            const allIn = strIds.every((id) => prev.includes(id));
            if (allIn) return prev.filter((x) => !strIds.includes(x));
            return [...new Set([...prev, ...strIds])];
        });
    };

    useEffect(() => {
        setActivationRowNotesByGroupKey((prev) => {
            let next = { ...prev };
            let changed = false;
            pendingCompanyDisplayGroups.forEach((g) => {
                const fully = g.ids.length > 0 && g.ids.every((id) => activationSelectedChangeIds.includes(id));
                if (fully && next[g.key]) {
                    delete next[g.key];
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [activationSelectedChangeIds, pendingCompanyDisplayGroups]);

    const queuedCompanyChangeIdCount = pendingCompanyChanges.length;
    const selectedPendingChangeCount = pendingCompanyChanges.filter((c) =>
        activationSelectedChangeIds.includes(c._id),
    ).length;
    const allCompanyChangesSelected =
        queuedCompanyChangeIdCount > 0 && selectedPendingChangeCount === queuedCompanyChangeIdCount;
    /** Hold when at least one requested change is unchecked (including none checked = return all). */
    const holdEnabledForActivationReview =
        queuedCompanyChangeIdCount > 0 && !allCompanyChangesSelected;
    const activationRejectReasonTrimmed = String(activationRejectReason || '').trim();
    const activationStatusValue = String(company?.activationStatus || '').toLowerCase();
    /** Backend may keep status as submitted while activationHold lists HR corrections. */
    const onCompanyActivationHoldUi =
        hasCompanyActivationHoldPending || activationStatusValue === 'hold';
    const companyStatusValue = String(company?.status || '').toLowerCase();
    const canProcessCompanyActivationAsHr =
        viewerIsDesignatedFlowchartHr ||
        currentUser?.isAdmin ||
        currentUser?.employeeId === 'VEGA-HR-0000';

    const showActivationRequestButton =
        (companyActivationProgress?.percentage || 0) === 100 &&
        activationStatusValue !== 'submitted' &&
        (companyStatusValue === 'inactive' ||
            (viewerIsDesignatedFlowchartHr &&
                pendingCompanyChanges.length > 0 &&
                companyStatusValue === 'active'));

    const submittedToId = typeof company?.activationSubmittedTo === 'object'
        ? company?.activationSubmittedTo?._id
        : company?.activationSubmittedTo;
    const currentEmpObjectId = currentUser?.employeeObjectId || currentUser?._id || currentUser?.id || null;
    const canCurrentUserReviewActivation =
        !hasCompanyActivationHoldPending &&
        activationStatusValue !== 'hold' &&
        (activationStatusValue === 'submitted' || canProcessCompanyActivationAsHr) &&
        (
            (submittedToId && currentEmpObjectId && String(submittedToId) === String(currentEmpObjectId)) ||
            canProcessCompanyActivationAsHr
        );
    const openActivationReview = (isDirect = false) => {
        setIsDirectHrAction(isDirect);
        setActivationSelectedChangeIds(pendingCompanyChanges.map((c) => c._id));
        setActivationRejectReason('');
        setActivationRowNotesByGroupKey({});
        setActivationReviewModalOpen(true);
    };
    const toggleCompanyChangeGroupSelection = (groupIds) => {
        if (!Array.isArray(groupIds) || groupIds.length === 0) return;
        setActivationSelectedChangeIds((prev) => {
            const allIn = groupIds.every((id) => prev.includes(id));
            if (allIn) return prev.filter((x) => !groupIds.includes(x));
            return [...new Set([...prev, ...groupIds])];
        });
    };
    const toggleAllCompanyChanges = () => {
        if (allCompanyChangesSelected) {
            setActivationSelectedChangeIds([]);
            return;
        }
        setActivationSelectedChangeIds(pendingCompanyChanges.map((c) => c._id));
    };
    const filteredCompanyAssets = useMemo(() => companyAssets, [companyAssets]);

    const selectableCompanyAssetIds = useMemo(() => {
        return filteredCompanyAssets
            .filter((asset) => String(asset?.status || '').toLowerCase() === 'assigned' && !asset?.pendingAction)
            .map((asset) => String(asset?._id || asset?.id))
            .filter(Boolean);
    }, [filteredCompanyAssets]);

    useEffect(() => {
        const allowed = new Set(selectableCompanyAssetIds);
        setSelectedCompanyAssetIds((prev) => prev.filter((id) => allowed.has(String(id))));
    }, [selectableCompanyAssetIds]);

    const allSelectableCompanyAssetsSelected =
        selectableCompanyAssetIds.length > 0 &&
        selectableCompanyAssetIds.every((id) => selectedCompanyAssetIds.includes(String(id)));

    const toggleCompanyAssetSelection = (assetId) => {
        const id = String(assetId || '');
        if (!id) return;
        setSelectedCompanyAssetIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const toggleSelectAllCompanyAssets = () => {
        if (allSelectableCompanyAssetsSelected) {
            setSelectedCompanyAssetIds([]);
            return;
        }
        setSelectedCompanyAssetIds(selectableCompanyAssetIds);
    };

    const processCompanyBulkReturn = async () => {
        if (selectedCompanyAssetIds.length === 0 || companyBulkSubmitting) return;
        try {
            setCompanyBulkSubmitting(true);
            await Promise.all(
                selectedCompanyAssetIds.map((id) => axiosInstance.put(`/AssetItem/${encodeURIComponent(id)}/return`, {}))
            );
            toast({ title: 'Success', description: `Return processed for ${selectedCompanyAssetIds.length} asset(s).` });
            setSelectedCompanyAssetIds([]);
            await fetchCompanyAssets();
            return true;
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err?.response?.data?.message || 'Bulk return failed.',
            });
            return false;
        } finally {
            setCompanyBulkSubmitting(false);
        }
    };

    const submitCompanyBulkAction = async (actionType, payloadExtras = {}) => {
        if (selectedCompanyAssetIds.length === 0 || companyBulkSubmitting) return;
        try {
            setCompanyBulkSubmitting(true);
            await axiosInstance.put('/AssetItem/bulk/request-action', {
                assetIds: selectedCompanyAssetIds,
                actionType,
                ...payloadExtras,
            });
            toast({ title: 'Success', description: `${actionType} submitted for ${selectedCompanyAssetIds.length} asset(s).` });
            setSelectedCompanyAssetIds([]);
            await fetchCompanyAssets();
            return true;
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err?.response?.data?.message || `Bulk ${actionType} failed.`,
            });
            return false;
        } finally {
            setCompanyBulkSubmitting(false);
        }
    };

    const processCompanyBulkTransfer = async () => {
        if (selectedCompanyAssetIds.length === 0 || companyBulkSubmitting) return;
        const duration = parseInt(companyBulkDialog.leaveDuration, 10);
        if (!Number.isInteger(duration) || duration < 1 || duration > 30) {
            toast({ variant: 'destructive', title: 'Invalid duration', description: 'Please enter a number between 1 and 30.' });
            return false;
        }
        return submitCompanyBulkAction('Leave', {
            reason: `Leave duration: ${duration} days`,
            duration,
            leaveDuration: duration,
        });
    };

    const processCompanyBulkEndOfServices = async () => {
        if (selectedCompanyAssetIds.length === 0 || companyBulkSubmitting) return;
        return submitCompanyBulkAction('End of Services', {
            reason: 'End of Services return requested',
        });
    };

    const handleCompanyBulkReturn = () => {
        if (selectedCompanyAssetIds.length === 0 || companyBulkSubmitting) return;
        setCompanyBulkDialog({ open: true, mode: 'return', leaveDuration: '1' });
    };

    const handleCompanyBulkTransfer = () => {
        if (selectedCompanyAssetIds.length === 0 || companyBulkSubmitting) return;
        setCompanyBulkDialog({ open: true, mode: 'transfer', leaveDuration: '1' });
    };

    const handleCompanyBulkEndOfServices = () => {
        if (selectedCompanyAssetIds.length === 0 || companyBulkSubmitting) return;
        setCompanyBulkDialog({ open: true, mode: 'endOfServices', leaveDuration: '1' });
    };

    const handleCompanyBulkDialogConfirm = async () => {
        let ok = false;
        if (companyBulkDialog.mode === 'return') {
            ok = await processCompanyBulkReturn();
        } else if (companyBulkDialog.mode === 'transfer') {
            ok = await processCompanyBulkTransfer();
        } else if (companyBulkDialog.mode === 'endOfServices') {
            ok = await processCompanyBulkEndOfServices();
        }
        if (ok) {
            setCompanyBulkDialog({ open: false, mode: null, leaveDuration: '1' });
        }
    };

    const handleActivationDecision = async (decision, reasonOverride = '') => {
        if (!company?._id || !['approve', 'reject', 'hold'].includes(decision)) return;
        const rejectReason = String(reasonOverride || '').trim();
        if (decision === 'reject' && !rejectReason) {
            toast({
                title: 'Rejection reason required',
                description: 'Please enter a rejection description before rejecting this activation request.',
                variant: 'destructive',
            });
            return;
        }
        if (decision === 'hold') {
            const missingNoteGroup = pendingCompanyDisplayGroups.find((g) => {
                const unchecked = g.ids.filter((id) => !activationSelectedChangeIds.includes(id));
                if (!unchecked.length) return false;
                const note = String(activationRowNotesByGroupKey[g.key] || '').trim();
                return !note;
            });
            if (missingNoteGroup) {
                toast({
                    title: 'Instructions required',
                    description: `Add instructions for "${missingNoteGroup.displayLabel}" before using Hold.`,
                    variant: 'destructive',
                });
                return;
            }
        }
        try {
            setActivationDecisionLoading(true);
            const endpoint =
                decision === 'approve'
                    ? 'approve-activation'
                    : decision === 'hold'
                      ? 'hold-activation'
                      : 'reject-activation';
            const body =
                decision === 'reject'
                    ? { reason: rejectReason }
                    : decision === 'hold'
                      ? {
                            approvedChangeIds: activationSelectedChangeIds,
                            selectionProvided: true,
                            comment: '',
                            rowNotesByEntryId: (() => {
                                const out = {};
                                pendingCompanyDisplayGroups.forEach((g) => {
                                    const unchecked = g.ids.filter((id) => !activationSelectedChangeIds.includes(id));
                                    if (!unchecked.length) return;
                                    const note = String(activationRowNotesByGroupKey[g.key] || '').trim();
                                    if (!note) return;
                                    unchecked.forEach((id) => {
                                        out[id] = note;
                                    });
                                });
                                return out;
                            })(),
                        }
                      : {
                            approvedChangeIds: activationSelectedChangeIds,
                            selectionProvided: true,
                        };
            const response = await axiosInstance.post(`/Company/${company._id}/${endpoint}`, body);
            if (response?.data?.company) setCompany(response.data.company);
            if (response?.data?.activationProgress) setActivationProgressFromApi(response.data.activationProgress);
            await fetchCompany();
            toast({
                title:
                    decision === 'approve'
                        ? 'Activation approved'
                        : decision === 'hold'
                          ? 'Activation on hold'
                          : 'Activation rejected',
                description: response?.data?.message || 'Company activation decision has been applied.',
            });
            setActivationReviewModalOpen(false);
            setActivationRejectReason('');
            setActivationRowNotesByGroupKey({});
            setActivationSelectedChangeIds([]);
        } catch (err) {
            toast({
                title: 'Action failed',
                description: err?.response?.data?.message || 'Unable to process activation decision.',
                variant: 'destructive',
            });
        } finally {
            setActivationDecisionLoading(false);
        }
    };

    if (loading) {

        return (

            <div className="flex min-h-screen bg-[#F2F6F9]">

                <Sidebar />

                <div className="flex-1 flex flex-col items-center justify-center">

                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />

                </div>

            </div>

        );

    }



    if (!company) {

        return (

            <div className="flex min-h-screen bg-[#F2F6F9]">

                <Sidebar />

                <div className="flex-1 flex flex-col items-center justify-center">

                    <div className="text-gray-500 font-medium">Company not found</div>

                </div>

            </div>

        );

    }

    return (

        <div className="flex min-h-screen w-full bg-[#F2F6F9]">

            <Sidebar />

            <div className="flex-1 flex flex-col min-w-0 relative">

                <Navbar />

                <div className="p-8">

                    {/* Header Controls */}

                    <div className="flex items-center justify-between mb-6">

                        <button

                            onClick={() => router.push('/Company')}

                            className="bg-white p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm"

                        >

                            <ChevronLeft size={20} />

                        </button>

                    </div>

                    {(activationStatusValue === 'submitted' || onCompanyActivationHoldUi) && (
                        <div className={`mb-4 rounded-xl border px-4 py-3 flex items-center justify-between gap-3 ${
                            onCompanyActivationHoldUi ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'
                        }`}>
                            <div className={`text-sm ${onCompanyActivationHoldUi ? 'text-amber-900' : 'text-blue-900'}`}>
                                <span className="font-semibold">
                                    {onCompanyActivationHoldUi ? 'Activation on hold — HR needs corrections.' : 'Activation request pending HR action.'}
                                </span>
                                <span className="ml-1">
                                    {onCompanyActivationHoldUi
                                        ? (viewerIsCompanyActivationSubmitter ? 'Check the list and fix items.' : 'Wait for creator to fix and resubmit.')
                                        : (canCurrentUserReviewActivation ? 'Review.' : 'Wait for HR decision.')}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                {canCurrentUserReviewActivation && activationStatusValue === 'submitted' && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            openActivationReview(false);
                                        }}
                                        disabled={activationDecisionLoading}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
                                    >
                                        Review
                                    </button>
                                )}
                                {onCompanyActivationHoldUi && viewerIsCompanyActivationSubmitter && (
                                    <button
                                        type="button"
                                        onClick={() => setActivationHoldReviewModalOpen(true)}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 text-white bg-amber-500 hover:bg-amber-600 shadow-sm"
                                    >
                                        Fix Items
                                    </button>
                                )}
                                {activationHoldResubmitEligible && (
                                    <button
                                        type="button"
                                        onClick={openActivationSubmitModal}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-500 text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                                    >
                                        Resubmit
                                    </button>
                                )}
                            </div>
                        </div>
                    )}



                    {/* Header Grid (Equal Width) */}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 items-stretch">

                        {/* Profile Card (Left - col-span-1) */}

                        <div className="lg:col-span-1 bg-white rounded-lg shadow-sm p-6 flex flex-col items-start gap-3 relative min-h-[320px]">

                            <div className="flex items-start justify-between gap-6 w-full">
                                <div className="flex items-start gap-6 flex-1">

                                {/* Logo Section */}

                                <div className="relative group flex-shrink-0">

                                    <div className="w-32 h-36 rounded-lg border border-gray-200 overflow-hidden shadow-sm bg-blue-500 relative">

                                        {company.logo && !imageError ? (

                                            <Image

                                                src={company.logo}

                                                alt={company.name}

                                                fill

                                                className="object-cover"

                                                onError={() => setImageError(true)}

                                            />

                                        ) : (

                                            <div className="w-full h-full flex items-center justify-center text-white text-3xl font-semibold">

                                                {getInitials(company.name)}

                                            </div>

                                        )}

                                    </div>

                                    <button className="absolute -top-2 -right-2 w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10 border-2 border-white">

                                        <Camera size={14} />

                                    </button>

                                    {showActivationRequestButton && (
                                        <button
                                            type="button"
                                            disabled={activationSubmitting}
                                            onClick={() => {
                                                if (canProcessCompanyActivationAsHr) openActivationReview(true);
                                                else openActivationSubmitModal();
                                            }}
                                            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl border border-emerald-600 text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                                        >
                                            {activationSubmitting
                                                ? 'Submitting...'
                                                : canProcessCompanyActivationAsHr
                                                  ? 'Review / Activate'
                                                  : 'Submit for Approval'}
                                        </button>
                                    )}

                                </div>



                                {/* Name Section */}

                                <div className="flex-1 pt-2">

                                    <h1 className="text-2xl font-bold text-gray-800 leading-tight mb-1">

                                        {company.name} {company.nickName && <span className="text-gray-400 font-medium ml-2">({company.nickName})</span>}

                                    </h1>

                                    <div className="flex flex-col gap-2">

                                        <div className="flex items-center">

                                            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-wider">
                                                Registered Company
                                            </span>

                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-gray-500 text-[11px] font-medium mt-1">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <Mail size={12} className="text-blue-500 flex-shrink-0" />
                                                <span className="truncate">{company.email || '---'}</span>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <Calendar size={12} className="text-blue-500 flex-shrink-0" />
                                                <span>Established: {company.establishedDate ? new Date(company.establishedDate).toLocaleDateString('en-GB') : '---'}</span>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <Phone size={12} className="text-blue-500 flex-shrink-0" />
                                                <span>{company.phone || '---'}</span>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <User size={12} className="text-blue-500 flex-shrink-0" />
                                                <span>Total Employees: {employeeCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                </div>

                                {/* Activation Badge (Top Right) */}
                                {String(company?.status || '').toLowerCase() === 'active' && (
                                    <div className="shrink-0 pt-2">
                                        <span className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-100 text-green-700 border border-green-200 whitespace-nowrap shadow-sm">
                                            Profile activated
                                        </span>
                                    </div>
                                )}
                            </div>



                            <div className="w-full pt-2 mt-auto">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700">Profile Status</span>
                                    <span className="text-sm font-semibold text-gray-800">{companyActivationProgress?.percentage || 0}%</span>
                                </div>
                                <div
                                    ref={progressBarRef}
                                    className="relative w-full"
                                    onMouseEnter={() => setShowProgressTooltip(true)}
                                    onMouseLeave={() => {
                                        if (!isProgressTooltipLocked) setShowProgressTooltip(false);
                                    }}
                                    onClick={() => {
                                        setIsProgressTooltipLocked((prev) => !prev);
                                        setShowProgressTooltip(true);
                                    }}
                                >
                                    <div className="w-full bg-gray-200 rounded-full h-2.5 cursor-default">
                                        <div
                                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                            style={{ width: `${companyActivationProgress?.percentage || 0}%` }}
                                        />
                                    </div>

                                    {showProgressTooltip && (
                                        <div
                                            ref={progressTooltipRef}
                                            className="absolute bottom-full left-0 mb-2 w-72 bg-white/95 text-gray-700 text-xs rounded-lg shadow-lg border border-gray-200 p-3 z-50 backdrop-blur-sm"
                                            onMouseEnter={() => setShowProgressTooltip(true)}
                                            onMouseLeave={() => {
                                                if (!isProgressTooltipLocked) setShowProgressTooltip(false);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="font-semibold mb-2 text-sm text-gray-800 flex justify-between items-center">
                                                <span>Pending for Activation</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pendingActivationItems.length > 0
                                                    ? 'bg-red-100 text-red-600'
                                                    : 'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                    {pendingActivationItems.length > 0 ? `${pendingActivationItems.length} Pending` : 'Completed'}
                                                </span>
                                            </div>
                                            {pendingActivationItems.length > 0 ? (
                                                <div className="flex flex-col gap-1.5">
                                                    {pendingActivationItems.slice(0, 5).map((item) => (
                                                        <span key={item.key} className="text-gray-600 pl-2 border-l-2 border-gray-200">
                                                            {item.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2.5 py-2">
                                                    All required activation items are completed.
                                                </div>
                                            )}
                                            <div className="absolute bottom-0 left-4 transform translate-y-full">
                                                <div className="border-4 border-transparent border-t-white/95" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>



                        {/* Summary Card (Right - col-span-1) */}

                        <div className="lg:col-span-1 relative rounded-lg overflow-hidden shadow-sm text-white flex flex-col h-[320px]">

                            <div className="absolute inset-0 bg-gradient-to-r from-sky-500 via-sky-500 to-sky-400"></div>

                            <div className="absolute -left-24 -bottom-24 w-64 h-64 bg-blue-700/40 rounded-full"></div>

                            <div className="absolute -right-16 -top-16 w-48 h-48 bg-sky-300/30 rounded-full"></div>



                            <div className="relative p-8 flex-1 flex flex-col">

                                <h2 className="text-2xl font-semibold text-white mb-6">Company Summary</h2>

                                <div className="flex items-start gap-12 flex-1">

                                    {/* Icon Image */}

                                    <div className="relative flex-shrink-0 w-[114px] h-[177px]">

                                        <Image

                                            src="/assets/employee/tie-img.png"

                                            alt="Company Summary"

                                            width={114}

                                            height={177}

                                            className="object-contain"

                                        />

                                    </div>



                                    {/* Status List */}

                                    <div
                                        className="flex-1 pt-2"
                                        onMouseEnter={() => setIsSummaryHovered(true)}
                                        onMouseLeave={() => setIsSummaryHovered(false)}
                                    >
                                        <div
                                            className={`space-y-3 min-h-[180px] pr-2 transition-all duration-500 ease-in-out ${
                                                summaryPageVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                                            }`}
                                        >
                                            {statusItems.length > 0 ? (
                                                (summaryPages[summaryPageIndex] || []).map((item, index) => (
                                                    <div key={`${item.text}-${index}`} className="flex items-center gap-3">
                                                        <div className={`w-5 h-2 rounded-full ${item.color} shadow-sm shrink-0`} />
                                                        <p className="text-white text-[13px] font-medium leading-tight">{item.text}</p>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-5 h-2 rounded-full bg-white/20 shadow-sm shrink-0" />
                                                    <p className="text-white/60 text-[13px] font-medium">No expiring documents found</p>
                                                </div>
                                            )}
                                        </div>

                                        {summaryPages.length > 1 ? (
                                            <div className="mt-3 flex items-center justify-center gap-2">
                                                {summaryPages.map((_, idx) => (
                                                    <button
                                                        key={`summary-dot-${idx}`}
                                                        type="button"
                                                        onClick={() => setSummaryPageIndex(idx)}
                                                        aria-label={`Go to summary page ${idx + 1}`}
                                                        className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                                                            idx === summaryPageIndex
                                                                ? 'bg-white scale-125'
                                                                : 'bg-sky-200/80 hover:bg-sky-100'
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>

                                </div>

                            </div>

                        </div>

                    </div>



                    {/* Tab Navigation (Matched to Employee Profile) */}

                    <div className="flex items-center gap-8 mb-6 border-b border-gray-200 px-6">

                        <button
                            onClick={() => setActiveTab('basic')}
                            className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'basic' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <div className="flex items-center">
                                Basic Details
                                {(company?.pendingReactivationChanges || []).some(c => {
                                    const s = String(c?.section || '').toLowerCase();
                                    const cd = String(c?.card || '').toLowerCase();
                                    return s.includes('basic') || cd.includes('basic') || 
                                           s.includes('trade') || cd.includes('trade') || 
                                           s.includes('establishment') || cd.includes('establishment');
                                }) && (
                                    <span
                                        className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full cursor-help animate-pulse"
                                        title="pending changes in this tab"
                                    >
                                        !
                                    </span>
                                )}
                            </div>
                            {activeTab === 'basic' ? (
                                <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500" />
                            ) : null}
                        </button>

                        <button
                            onClick={() => setActiveTab('owner')}
                            className={`pb-3 text-sm font-semibold transition-all relative ${activeTab === 'owner' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <div className="flex items-center">
                                Owner Information
                                {(company?.pendingReactivationChanges || []).some(c => {
                                    const s = String(c?.section || '').toLowerCase();
                                    const cd = String(c?.card || '').toLowerCase();
                                    return s.includes('owner') || cd.includes('owner');
                                }) && (
                                    <span
                                        className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full cursor-help animate-pulse"
                                        title="pending changes in this tab"
                                    >
                                        !
                                    </span>
                                )}
                            </div>
                            {activeTab === 'owner' ? (
                                <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500" />
                            ) : null}
                        </button>

                        <button

                            onClick={() => setActiveTab('assets')}

                            className={`pb-3 text-sm font-semibold transition-all relative ${activeTab === 'assets' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'

                                }`}

                        >

                            Assets

                            {activeTab === 'assets' ? (

                                <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500" />

                            ) : null}

                        </button>

                        <button

                            onClick={() => setActiveTab('fine')}

                            className={`pb-3 text-sm font-semibold transition-all relative ${activeTab === 'fine' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'

                                }`}

                        >

                            Fine

                            {activeTab === 'fine' ? (

                                <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500" />

                            ) : null}

                        </button>

                        <button
                            onClick={() => setActiveTab('others')}
                            className={`pb-3 text-sm font-semibold transition-all relative ${activeTab === 'others' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <div className="flex items-center">
                                Documents
                                {(company?.pendingReactivationChanges || []).some(c => {
                                    const s = String(c?.section || '').toLowerCase();
                                    const cd = String(c?.card || '').toLowerCase();
                                    return s.includes('document') || cd.includes('document') || 
                                           s.includes('moa') || cd.includes('moa') || 
                                           s.includes('ejari') || cd.includes('ejari') || 
                                           s.includes('insurance') || cd.includes('insurance');
                                }) && (
                                    <span
                                        className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full cursor-help animate-pulse"
                                        title="pending changes in this tab"
                                    >
                                        !
                                    </span>
                                )}
                            </div>
                            {activeTab === 'others' ? (
                                <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500" />
                            ) : null}
                        </button>



                        {activeDynamicTabs.map((tab) => (

                            <div key={tab} className="group relative">

                                <button

                                    onClick={() => setActiveTab(tab)}

                                    className={`pb-3 text-sm font-semibold transition-all relative capitalize ${activeTab === tab ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}

                                >

                                    {tab}

                                    {activeTab === tab && (

                                        <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500" />

                                    )}

                                </button>

                                <button

                                    onClick={(e) => {

                                        e.stopPropagation();

                                        setActiveDynamicTabs(activeDynamicTabs.filter(t => t !== tab));

                                        if (activeTab === tab) setActiveTab('others');

                                    }}

                                    className="absolute -top-1 -right-2 p-0.5 bg-gray-100 text-gray-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity border border-gray-200"

                                    title="Close Tab"

                                >

                                    <X size={10} />

                                </button>

                            </div>

                        ))}



                        <div className="flex-1" />





                    </div>





                    {/* Tab Content */}

                    <div className="bg-transparent min-h-[400px]">

                        {activeTab === 'basic' && (

                            <div className="animate-in fade-in duration-500 space-y-8">

                                <div className="w-full columns-1 lg:columns-2 gap-6 space-y-0">

                                    {/* Masonry-style column flow (same pattern as employee BasicTab) */}

                                    <div className="mb-6 break-inside-avoid w-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">

                                        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">

                                            <div className="flex items-center">
                                                <h4 className="text-xl font-semibold text-gray-800">Basic Details</h4>
                                                {(company?.pendingReactivationChanges || []).some(c => {
                                                    const s = String(c?.section || '').toLowerCase();
                                                    const cd = String(c?.card || '').toLowerCase();
                                                    return s.includes('basic') || cd.includes('basic');
                                                }) && (
                                                    <span
                                                        className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full cursor-help animate-pulse"
                                                        title="waiting for hr approval"
                                                    >
                                                        !
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5">

                                                <button

                                                    onClick={() => handleModalOpen('basicDetails')}

                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"

                                                >

                                                    <Edit2 size={18} />

                                                </button>

                                            </div>

                                        </div>

                                        <div className="divide-y divide-gray-100">

                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                <span className="text-sm font-medium text-gray-500">Company ID</span>

                                                <span className="text-sm font-medium text-gray-500">{company.companyId}</span>

                                            </div>

                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                <span className="text-sm font-medium text-gray-500">Company Name</span>

                                                <span className="text-sm font-medium text-gray-500">{company.name}</span>

                                            </div>

                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                <span className="text-sm font-medium text-gray-500">Nick Name</span>

                                                <span className="text-sm font-medium text-gray-500">{company.nickName || '---'}</span>

                                            </div>

                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                <span className="text-sm font-medium text-gray-500">Email Address</span>

                                                <span className="text-sm font-medium text-gray-500">{company.email}</span>

                                            </div>

                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                <span className="text-sm font-medium text-gray-500">Contact Number</span>

                                                <span className="text-sm font-medium text-gray-500">{company.phone || '---'}</span>

                                            </div>

                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                <span className="text-sm font-medium text-gray-500">Establishment Date</span>

                                                <span className="text-sm font-medium text-gray-500">

                                                    {company.establishedDate ? new Date(company.establishedDate).toLocaleDateString('en-GB') : '---'}

                                                </span>

                                            </div>

                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                <span className="text-sm font-medium text-gray-500">Expiry Date</span>

                                                <span className={`text-sm font-medium ${getExpiryVisualState(company.tradeLicenseExpiry).className}`}>
                                                    {company.tradeLicenseExpiry ? new Date(company.tradeLicenseExpiry).toLocaleDateString('en-GB') : '---'}
                                                </span>

                                            </div>

                                        </div>

                                    </div>



                                    {/* Trade License Card */}

                                    {company.tradeLicenseNumber && (

                                        <div
                                            className={`mb-6 break-inside-avoid w-full rounded-xl shadow-sm border overflow-hidden ${
                                                isExpiredDate(company.tradeLicenseExpiry)
                                                    ? 'bg-red-50/70 border-red-200'
                                                    : 'bg-white border-slate-100'
                                            }`}
                                        >

                                            <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">

                                                <div className="flex items-center">
                                                    <h4 className="text-xl font-semibold text-gray-800">Trade License Details</h4>
                                                    {(company?.pendingReactivationChanges || []).some(c => {
                                                        const s = String(c?.section || '').toLowerCase();
                                                        const cd = String(c?.card || '').toLowerCase();
                                                        return s.includes('trade') || cd.includes('trade');
                                                    }) && (
                                                        <span
                                                            className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full cursor-help animate-pulse"
                                                            title="waiting for hr approval"
                                                        >
                                                            !
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2">

                                                    {company.tradeLicenseAttachment && (

                                                        <button

                                                            onClick={() => setViewingDocument({

                                                                data: company.tradeLicenseAttachment,

                                                                name: 'Trade License',

                                                                mimeType: 'application/pdf'

                                                            })}

                                                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"

                                                            title="Download/View Document"

                                                        >

                                                            <Download size={18} />

                                                        </button>

                                                    )}

                                                    <button

                                                        onClick={() => handleModalOpen('tradeLicense')}

                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"

                                                    >

                                                        <Edit2 size={18} />

                                                    </button>

                                                    <button

                                                        onClick={() => handleModalOpen('tradeLicense', null, null, true)}

                                                        className="p-2 text-orange-400 hover:bg-orange-50 rounded-lg transition-all"

                                                        title="Renew License"

                                                    >

                                                        <RotateCcw size={18} />

                                                    </button>

                                                    {!findPendingNotRenew({ kind: 'tradeLicense' })?.requestId ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setNotRenewData({ kind: 'tradeLicense', label: 'Trade License' })
                                                            }
                                                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                                                            title="Request not renew (requires HR approval)"
                                                        >
                                                            <Ban size={18} />
                                                        </button>
                                                    ) : null}

                                                    {isAdmin() && (
                                                        <button
                                                            onClick={handleDeleteTradeLicense}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Delete Trade License"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}

                                                </div>

                                            </div>

                                            {findPendingNotRenew({ kind: 'tradeLicense' })?.requestId ? (
                                                <div className="px-8 py-3 text-sm bg-amber-50 border-b border-amber-100 text-amber-900 flex flex-wrap items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <span className="font-semibold block">Pending HR approval</span>
                                                        {findPendingNotRenew({ kind: 'tradeLicense' })?.reason ? (
                                                            <span className="block text-xs text-amber-800/90 mt-1 font-medium whitespace-pre-wrap break-words">
                                                                {findPendingNotRenew({ kind: 'tradeLicense' }).reason}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {viewerIsDesignatedFlowchartHr ? (
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <button
                                                                type="button"
                                                                disabled={hrRespondSubmitting}
                                                                onClick={() => {
                                                                    const p = findPendingNotRenew({ kind: 'tradeLicense' });
                                                                    if (p?.requestId) handleHrApproveNotRenew(p.requestId);
                                                                }}
                                                                className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-white p-2 text-emerald-600 shadow-sm hover:bg-emerald-50 disabled:opacity-40"
                                                                title="Approve not renew"
                                                            >
                                                                <CheckCircle size={18} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={hrRespondSubmitting}
                                                                onClick={() => {
                                                                    const p = findPendingNotRenew({ kind: 'tradeLicense' });
                                                                    if (p?.requestId) {
                                                                        setHrRejectRequestId(p.requestId);
                                                                        setHrRejectComment('');
                                                                    }
                                                                }}
                                                                className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white p-2 text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-40"
                                                                title="Reject request"
                                                            >
                                                                <XCircle size={18} />
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : null}

                                            <div className="divide-y divide-gray-100">

                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                    <span className="text-sm font-medium text-gray-500">License Number</span>

                                                    <span className="text-sm font-medium text-gray-500">{company.tradeLicenseNumber}</span>

                                                </div>

                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                    <span className="text-sm font-medium text-gray-500">Issue Date</span>

                                                    <span className="text-sm font-medium text-gray-500">

                                                        {company.tradeLicenseIssueDate ? new Date(company.tradeLicenseIssueDate).toLocaleDateString('en-GB') : '---'}

                                                    </span>

                                                </div>

                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                    <span className="text-sm font-medium text-gray-500">Expiry Date</span>

                                                    <span className={`text-sm font-medium ${getExpiryVisualState(company.tradeLicenseExpiry).className}`}>
                                                        {company.tradeLicenseExpiry ? new Date(company.tradeLicenseExpiry).toLocaleDateString('en-GB') : '---'}
                                                    </span>

                                                </div>

                                                <div className="px-8 py-4 hover:bg-slate-50/50 transition-colors">

                                                    <span className="text-sm font-bold text-slate-500 block mb-2">Owners</span>

                                                    <div className="space-y-2">

                                                        {company.owners && company.owners.length > 0 ? (

                                                            company.owners.map((owner, idx) => (

                                                                <div key={idx} className="flex items-center justify-between">

                                                                    <span className="text-sm font-medium text-gray-700">{owner.name}</span>

                                                                    <span className="text-[11px] font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">

                                                                        {owner.sharePercentage || '0'}%

                                                                    </span>

                                                                </div>

                                                            ))

                                                        ) : (

                                                            <span className="text-sm font-medium text-gray-700">{company.tradeLicenseOwnerName || '---'}</span>

                                                        )}

                                                    </div>

                                                </div>

                                                {company.tradeLicenseAttachment && (

                                                    <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">

                                                        <span className="text-sm font-medium text-gray-500">Attachment</span>

                                                        <button

                                                            onClick={() => setViewingDocument({

                                                                data: company.tradeLicenseAttachment,

                                                                name: 'Trade License',

                                                                mimeType: 'application/pdf'

                                                            })}

                                                            className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1"

                                                        >

                                                            <FileText size={14} /> View Document

                                                        </button>

                                                    </div>

                                                )}

                                            </div>

                                        </div>

                                    )}



                                    {company.establishmentCardNumber && (

                                        <div
                                            className={`mb-6 break-inside-avoid w-full rounded-xl shadow-sm border overflow-hidden ${
                                                isExpiredDate(company.establishmentCardExpiry)
                                                    ? 'bg-red-50/70 border-red-200'
                                                    : 'bg-white border-slate-100'
                                            }`}
                                        >

                                            <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">

                                                <div className="flex items-center">
                                                    <h4 className="text-xl font-semibold text-gray-800">Establishment Card Details</h4>
                                                    {(company?.pendingReactivationChanges || []).some(c => {
                                                        const s = String(c?.section || '').toLowerCase();
                                                        const cd = String(c?.card || '').toLowerCase();
                                                        return s.includes('establishment') || cd.includes('establishment');
                                                    }) && (
                                                        <span
                                                            className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full cursor-help animate-pulse"
                                                            title="waiting for hr approval"
                                                        >
                                                            !
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2">

                                                    {company.establishmentCardAttachment && (

                                                        <button

                                                            onClick={() => setViewingDocument({

                                                                data: company.establishmentCardAttachment,

                                                                name: 'Establishment Card',

                                                                mimeType: 'application/pdf'

                                                            })}

                                                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"

                                                            title="Download/View Document"

                                                        >

                                                            <Download size={18} />

                                                        </button>

                                                    )}

                                                    <button

                                                        onClick={() => handleModalOpen('establishmentCard')}

                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"

                                                    >

                                                        <Edit2 size={18} />

                                                    </button>

                                                    <button

                                                        onClick={() => handleModalOpen('establishmentCard', null, null, true)}

                                                        className="p-2 text-orange-400 hover:bg-orange-50 rounded-lg transition-all"

                                                        title="Renew Card"

                                                    >

                                                        <RotateCcw size={18} />

                                                    </button>

                                                    {!findPendingNotRenew({ kind: 'establishmentCard' })?.requestId ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setNotRenewData({ kind: 'establishmentCard', label: 'Establishment Card' })
                                                            }
                                                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                                                            title="Request not renew (requires HR approval)"
                                                        >
                                                            <Ban size={18} />
                                                        </button>
                                                    ) : null}

                                                    {isAdmin() && (
                                                        <button
                                                            onClick={handleDeleteEstablishmentCard}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Delete Establishment Card"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}

                                                </div>

                                            </div>

                                            {findPendingNotRenew({ kind: 'establishmentCard' })?.requestId ? (
                                                <div className="px-8 py-3 text-sm bg-amber-50 border-b border-amber-100 text-amber-900 flex flex-wrap items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <span className="font-semibold block">Pending HR approval</span>
                                                        {findPendingNotRenew({ kind: 'establishmentCard' })?.reason ? (
                                                            <span className="block text-xs text-amber-800/90 mt-1 font-medium whitespace-pre-wrap break-words">
                                                                {findPendingNotRenew({ kind: 'establishmentCard' }).reason}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {viewerIsDesignatedFlowchartHr ? (
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <button
                                                                type="button"
                                                                disabled={hrRespondSubmitting}
                                                                onClick={() => {
                                                                    const p = findPendingNotRenew({ kind: 'establishmentCard' });
                                                                    if (p?.requestId) handleHrApproveNotRenew(p.requestId);
                                                                }}
                                                                className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-white p-2 text-emerald-600 shadow-sm hover:bg-emerald-50 disabled:opacity-40"
                                                                title="Approve not renew"
                                                            >
                                                                <CheckCircle size={18} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={hrRespondSubmitting}
                                                                onClick={() => {
                                                                    const p = findPendingNotRenew({ kind: 'establishmentCard' });
                                                                    if (p?.requestId) {
                                                                        setHrRejectRequestId(p.requestId);
                                                                        setHrRejectComment('');
                                                                    }
                                                                }}
                                                                className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white p-2 text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-40"
                                                                title="Reject request"
                                                            >
                                                                <XCircle size={18} />
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : null}

                                            <div className="divide-y divide-slate-50">

                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                    <span className="text-sm font-medium text-gray-500">Card Number</span>

                                                    <span className="text-sm font-medium text-gray-500">{company.establishmentCardNumber}</span>

                                                </div>



                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                    <span className="text-sm font-medium text-gray-500">Expiry Date</span>

                                                    <span className={`text-sm font-medium ${getExpiryVisualState(company.establishmentCardExpiry).className}`}>
                                                        {company.establishmentCardExpiry ? new Date(company.establishmentCardExpiry).toLocaleDateString('en-GB') : '---'}
                                                    </span>

                                                </div>

                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                    <span className="text-sm font-medium text-gray-500">Company Name</span>

                                                    <span className="text-sm font-medium text-gray-500">{company.name}</span>

                                                </div>

                                                {company.establishmentCardAttachment && (

                                                    <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">

                                                        <span className="text-sm font-medium text-gray-500">Attachment</span>

                                                        <button

                                                            onClick={() => setViewingDocument({

                                                                data: company.establishmentCardAttachment,

                                                                name: 'Establishment Card',

                                                                mimeType: 'application/pdf'

                                                            })}

                                                            className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1"

                                                        >

                                                            <FileText size={14} /> View Document

                                                        </button>

                                                    </div>

                                                )}

                                            </div>

                                        </div>

                                    )}

                                    {(company.ejari || []).map((ej, ejIdx) => {
                                        if (!ej || typeof ej !== 'object') return null;
                                        const attachUrl = ej?.document?.url || ej?.attachment;
                                        const issueRaw = ej?.issueDate || ej?.startDate;
                                        const expiryRaw = ej?.expiryDate;
                                        return (
                                            <div
                                                key={ej?._id ? String(ej._id) : `ejari-${ejIdx}`}
                                                className={`mb-6 break-inside-avoid w-full rounded-xl shadow-sm border overflow-hidden ${
                                                    isExpiredDate(expiryRaw)
                                                        ? 'bg-red-50/70 border-red-200'
                                                        : 'bg-white border-slate-100'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
                                                    <h4 className="text-xl font-semibold text-gray-800">
                                                        Ejari{ej?.type ? ` — ${ej.type}` : ''}
                                                    </h4>
                                                    <div className="flex items-center gap-2">
                                                        {attachUrl && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setViewingDocument({
                                                                        data: attachUrl,
                                                                        name: ej?.type || 'Ejari',
                                                                        mimeType: ej?.document?.mimeType || 'application/pdf',
                                                                    })
                                                                }
                                                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                                title="Download/View Document"
                                                            >
                                                                <Download size={18} />
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingIndex(ejIdx);
                                                                handleModalOpen('companyDocument', ejIdx, 'ejari');
                                                            }}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingIndex(ejIdx);
                                                                handleModalOpen('companyDocument', ejIdx, 'ejari', true);
                                                            }}
                                                            className="p-2 text-orange-400 hover:bg-orange-50 rounded-lg transition-all"
                                                            title="Renew Ejari"
                                                        >
                                                            <RotateCcw size={18} />
                                                        </button>
                                                        {!findPendingNotRenew({
                                                            kind: 'ejari',
                                                            arrayIndex: ejIdx,
                                                            arrayItemId: ej?._id != null ? String(ej._id) : undefined,
                                                        })?.requestId ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => openNotRenewEjariInsurance('ejari', ejIdx, ej)}
                                                                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                                                                title="Request not renew (requires HR approval)"
                                                            >
                                                                <Ban size={18} />
                                                            </button>
                                                        ) : null}
                                                        {isAdmin() && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleHardDeleteArrayItem('ejari', ejIdx)}
                                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                                title="Permanently delete this Ejari entry"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                {findPendingNotRenew({
                                                    kind: 'ejari',
                                                    arrayIndex: ejIdx,
                                                    arrayItemId: ej?._id != null ? String(ej._id) : undefined,
                                                })?.requestId ? (
                                                    <div className="px-8 py-3 text-sm bg-amber-50 border-b border-amber-100 text-amber-900 flex flex-wrap items-start justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <span className="font-semibold block">Pending HR approval</span>
                                                            {findPendingNotRenew({
                                                                kind: 'ejari',
                                                                arrayIndex: ejIdx,
                                                                arrayItemId: ej?._id != null ? String(ej._id) : undefined,
                                                            })?.reason ? (
                                                                <span className="block text-xs text-amber-800/90 mt-1 font-medium whitespace-pre-wrap break-words">
                                                                    {
                                                                        findPendingNotRenew({
                                                                            kind: 'ejari',
                                                                            arrayIndex: ejIdx,
                                                                            arrayItemId: ej?._id != null ? String(ej._id) : undefined,
                                                                        }).reason
                                                                    }
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        {viewerIsDesignatedFlowchartHr ? (
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <button
                                                                    type="button"
                                                                    disabled={hrRespondSubmitting}
                                                                    onClick={() => {
                                                                        const p = findPendingNotRenew({
                                                                            kind: 'ejari',
                                                                            arrayIndex: ejIdx,
                                                                            arrayItemId: ej?._id != null ? String(ej._id) : undefined,
                                                                        });
                                                                        if (p?.requestId) handleHrApproveNotRenew(p.requestId);
                                                                    }}
                                                                    className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-white p-2 text-emerald-600 shadow-sm hover:bg-emerald-50 disabled:opacity-40"
                                                                    title="Approve not renew"
                                                                >
                                                                    <CheckCircle size={18} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={hrRespondSubmitting}
                                                                    onClick={() => {
                                                                        const p = findPendingNotRenew({
                                                                            kind: 'ejari',
                                                                            arrayIndex: ejIdx,
                                                                            arrayItemId: ej?._id != null ? String(ej._id) : undefined,
                                                                        });
                                                                        if (p?.requestId) {
                                                                            setHrRejectRequestId(p.requestId);
                                                                            setHrRejectComment('');
                                                                        }
                                                                    }}
                                                                    className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white p-2 text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-40"
                                                                    title="Reject request"
                                                                >
                                                                    <XCircle size={18} />
                                                                </button>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                                <div className="divide-y divide-slate-50">
                                                    {ej?.provider ? (
                                                        <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                            <span className="text-sm font-medium text-gray-500">Provider</span>
                                                            <span className="text-sm font-medium text-gray-500">{ej.provider}</span>
                                                        </div>
                                                    ) : null}
                                                    <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                        <span className="text-sm font-medium text-gray-500">Issue / Start</span>
                                                        <span className="text-sm font-medium text-gray-500">{formatDate(issueRaw)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                        <span className="text-sm font-medium text-gray-500">Expiry Date</span>
                                                        <span className={`text-sm font-medium ${getExpiryVisualState(expiryRaw).className}`}>
                                                            {formatDate(expiryRaw)}
                                                        </span>
                                                    </div>
                                                    {ej?.value != null && ej?.value !== '' ? (
                                                        <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                            <span className="text-sm font-medium text-gray-500">Value (AED)</span>
                                                            <span className="text-sm font-medium text-gray-500">
                                                                {Number(ej.value).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                    {attachUrl ? (
                                                        <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">
                                                            <span className="text-sm font-medium text-gray-500">Attachment</span>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setViewingDocument({
                                                                        data: attachUrl,
                                                                        name: ej?.type || 'Ejari',
                                                                        mimeType: ej?.document?.mimeType || 'application/pdf',
                                                                    })
                                                                }
                                                                className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1"
                                                            >
                                                                <FileText size={14} /> View Document
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        );
                                    })}

                                </div>

                                {/* Quick Access Buttons */}

                                <div className="flex flex-wrap gap-3 px-2">

                                    {!company.tradeLicenseNumber && (

                                        <button

                                            onClick={() => handleModalOpen('tradeLicense')}

                                            className="bg-[#00B894] hover:bg-[#00A383] text-white px-5 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 shadow-sm"

                                        >

                                            Trade License <Plus size={14} strokeWidth={3} className="text-white/80" />

                                        </button>

                                    )}

                                    {!company.establishmentCardNumber && (

                                        <button

                                            onClick={() => handleModalOpen('establishmentCard')}

                                            className="bg-[#00B894] hover:bg-[#00A383] text-white px-5 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 shadow-sm"

                                        >

                                            Establishment Card <Plus size={14} strokeWidth={3} className="text-white/80" />

                                        </button>

                                    )}

                                    <button

                                        type="button"

                                        onClick={() => {

                                            setEditingIndex(null);

                                            handleModalOpen('addEjari');

                                        }}

                                        className="bg-[#00B894] hover:bg-[#00A383] text-white px-5 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 shadow-sm"

                                    >

                                        Ejari <Plus size={14} strokeWidth={3} className="text-white/80" />

                                    </button>





                                </div>

                            </div>

                        )}



                        {activeTab === 'owner' && (

                            <div className="animate-in fade-in duration-500 space-y-6">

                                {company.owners && company.owners.length > 0 ? (

                                    <>

                                        {/* Owner Sub-tabs Header */}

                                        <div className="flex items-center justify-between gap-4 pb-2 border-b border-gray-100">

                                            <div className="flex flex-wrap gap-8">

                                                {company.owners.map((owner, index) => (

                                                    <button

                                                        key={index}

                                                        onClick={() => setActiveOwnerTabIndex(index)}

                                                        className={`pb-3 text-sm font-semibold tracking-tight transition-all relative ${activeOwnerTabIndex === index

                                                            ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'

                                                            : 'text-gray-400 hover:text-gray-600'

                                                            }`}

                                                    >

                                                        {owner.name || `Owner ${index + 1}`}

                                                    </button>

                                                ))}

                                            </div>
                                            <button
                                                onClick={() => handleModalOpen('tradeLicense')}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                                            >
                                                <Plus size={14} strokeWidth={3} /> Add Owner
                                            </button>
                                        </div>



                                        {/* Owner Details Layout */}

                                        <div className="pt-6 space-y-8">

                                            {/* Top Grid: Personal Details and Filled Cards */}

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

                                                {/* Card 1: Personal Details (Always First) */}
                                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                                                    <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                                                        <div className="flex items-center">
                                                            <h4 className="text-xl font-semibold text-gray-800">Owner Details</h4>
                                                            {(company?.pendingReactivationChanges || []).some(c => {
                                                                const s = String(c?.section || '').toLowerCase();
                                                                const cd = String(c?.card || '').toLowerCase();
                                                                return s.includes('owner') || cd.includes('owner');
                                                            }) && (
                                                                <span
                                                                    className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full cursor-help animate-pulse"
                                                                    title="waiting for hr approval"
                                                                >
                                                                    !
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-1.5">

                                                            <button

                                                                onClick={() => handleModalOpen('ownerDetails')}

                                                                className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-colors"

                                                            >

                                                                <Edit2 size={18} />

                                                            </button>

                                                            {isAdmin() && (
                                                                <button
                                                                    onClick={() => handleDeleteOwner(activeOwnerTabIndex)}
                                                                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                                    title="Delete Owner Entirely"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            )}

                                                        </div>

                                                    </div>

                                                    <div className="p-8 space-y-0">

                                                        {[

                                                            { label: 'Full Name', value: company.owners[activeOwnerTabIndex]?.name },

                                                            { label: 'Email Address', value: company.owners[activeOwnerTabIndex]?.email || company.email, lowercase: true },

                                                            { label: 'Contact Number', value: company.owners[activeOwnerTabIndex]?.phone || company.phone },

                                                            { label: 'Nationality', value: company.owners[activeOwnerTabIndex]?.nationality },

                                                            { label: 'Share Percentage', value: company.owners[activeOwnerTabIndex]?.sharePercentage ? `${company.owners[activeOwnerTabIndex].sharePercentage}%` : null },

                                                        ].map((item, idx) => (

                                                            <div key={idx} className="flex justify-between items-center py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50/30 px-2 -mx-2 rounded-lg transition-colors">

                                                                <span className="text-sm font-medium text-gray-500">{item.label}</span>

                                                                <span className={`text-sm font-medium text-gray-500 ${item.lowercase ? 'lowercase' : ''}`}>{item.value || '---'}</span>

                                                            </div>

                                                        ))}

                                                    </div>

                                                </div>



                                                {/* Map through docs and show cards if filled */}

                                                {[

                                                    { id: 'passport', label: 'Passport', fields: [{ key: 'number', label: 'Number' }, { key: 'nationality', label: 'Nationality' }, { key: 'issueDate', label: 'Issue date', isDate: true }, { key: 'expiryDate', label: 'Expiry date', isDate: true }, { key: 'countryOfIssue', label: 'Country of issue' }], modal: 'ownerPassport' },

                                                    { id: 'visa', label: 'Visa', fields: [{ key: 'type', label: 'Visa Type' }, { key: 'number', label: 'Number' }, { key: 'issueDate', label: 'Issue date', isDate: true }, { key: 'expiryDate', label: 'Date of Expiry', isDate: true }, { key: 'sponsor', label: 'Sponsor' }], modal: 'ownerVisa' },

                                                    { id: 'labourCard', label: 'Labour Card', fields: [{ key: 'number', label: 'Number' }, { key: 'expiryDate', label: 'Expiry Date', isDate: true }, { key: 'lastUpdated', label: 'Last Updated', isDate: true }], modal: 'ownerLabourCard' },

                                                    { id: 'emiratesId', label: 'Emirates ID', fields: [{ key: 'number', label: 'Number' }, { key: 'issueDate', label: 'Issue Date', isDate: true }, { key: 'expiryDate', label: 'Expiry Date', isDate: true }], modal: 'ownerEmiratesId' },

                                                    { id: 'medical', label: 'Medical Insurance', fields: [{ key: 'provider', label: 'Provider' }, { key: 'number', label: 'Policy Number' }, { key: 'issueDate', label: 'Issue Date', isDate: true }, { key: 'expiryDate', label: 'Expiry Date', isDate: true }], modal: 'ownerMedical' },

                                                    { id: 'drivingLicense', label: 'Driving License', fields: [{ key: 'number', label: 'Number' }, { key: 'expiryDate', label: 'Expiry Date', isDate: true }], modal: 'ownerDrivingLicense' }

                                                ].filter(doc => company.owners[activeOwnerTabIndex]?.[doc.id]?.number).map((doc, idx) => (

                                                    <div
                                                        key={idx}
                                                        className={`rounded-2xl shadow-sm border overflow-hidden ${
                                                            isExpiredDate(company.owners[activeOwnerTabIndex]?.[doc.id]?.expiryDate)
                                                                ? 'bg-red-50/70 border-red-200'
                                                                : 'bg-white border-gray-100'
                                                        }`}
                                                    >

                                                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/20">
                                                            <div className="flex items-center">
                                                                <h4 className="text-sm font-semibold text-gray-800">{doc.label}</h4>
                                                                {(company?.pendingReactivationChanges || []).some(c => String(c?.section || '').toLowerCase() === `owner${doc.id.toLowerCase()}`) && (
                                                                    <span
                                                                        className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full cursor-help animate-pulse"
                                                                        title="waiting for hr approval"
                                                                    >
                                                                        !
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center gap-1.5">

                                                                <button onClick={() => handleModalOpen(doc.modal)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><Edit2 size={18} /></button>

                                                                <button onClick={() => handleModalOpen(doc.modal, null, null, true)} className="p-1.5 text-orange-400 hover:bg-orange-50 rounded-lg transition-all" title={`Renew ${doc.label}`}><RotateCcw size={18} /></button>

                                                                {isAdmin() && (
                                                                    <button
                                                                        onClick={() => handleDeleteOwnerDocumentCard(doc.id)}
                                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                        title={`Delete ${doc.label}`}
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                )}

                                                                {!findPendingNotRenew({
                                                                    kind: 'ownerDoc',
                                                                    ownerIndex: activeOwnerTabIndex,
                                                                    docKey: doc.id,
                                                                })?.requestId ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setNotRenewData({
                                                                                kind: 'ownerDoc',
                                                                                ownerIndex: activeOwnerTabIndex,
                                                                                docKey: doc.id,
                                                                                label: doc.label,
                                                                            })
                                                                        }
                                                                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                                                                        title={`Request not renew for ${doc.label} (HR approval)`}
                                                                    >
                                                                        <Ban size={18} />
                                                                    </button>
                                                                ) : null}

                                                                {isAdmin() && (
                                                                    <button
                                                                        onClick={() => handleDeleteOwnerDocumentCard(doc.id)}
                                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                                        title={`Delete ${doc.label}`}
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                )}

                                                                {company.owners[activeOwnerTabIndex]?.[doc.id]?.attachment ? (

                                                                    <button

                                                                        onClick={() => setViewingDocument({

                                                                            data: company.owners[activeOwnerTabIndex][doc.id].attachment,

                                                                            name: doc.label,

                                                                            mimeType: 'application/pdf'

                                                                        })}

                                                                        className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"

                                                                    >

                                                                        <Download size={14} />

                                                                    </button>

                                                                ) : (

                                                                    <button className="p-1.5 text-gray-300 cursor-not-allowed"><Download size={14} /></button>

                                                                )}

                                                            </div>

                                                        </div>

                                                        {findPendingNotRenew({
                                                            kind: 'ownerDoc',
                                                            ownerIndex: activeOwnerTabIndex,
                                                            docKey: doc.id,
                                                        })?.requestId ? (
                                                            <div className="px-6 py-3 text-sm bg-amber-50 border-b border-amber-100 text-amber-900 flex flex-wrap items-start justify-between gap-3">
                                                                <div className="min-w-0 flex-1">
                                                                    <span className="font-semibold block">Pending HR approval</span>
                                                                    {findPendingNotRenew({
                                                                        kind: 'ownerDoc',
                                                                        ownerIndex: activeOwnerTabIndex,
                                                                        docKey: doc.id,
                                                                    })?.reason ? (
                                                                        <span className="block text-xs text-amber-800/90 mt-1 font-medium whitespace-pre-wrap break-words">
                                                                            {
                                                                                findPendingNotRenew({
                                                                                    kind: 'ownerDoc',
                                                                                    ownerIndex: activeOwnerTabIndex,
                                                                                    docKey: doc.id,
                                                                                }).reason
                                                                    }
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                                {viewerIsDesignatedFlowchartHr ? (
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <button
                                                                            type="button"
                                                                            disabled={hrRespondSubmitting}
                                                                            onClick={() => {
                                                                                const p = findPendingNotRenew({
                                                                                    kind: 'ownerDoc',
                                                                                    ownerIndex: activeOwnerTabIndex,
                                                                                    docKey: doc.id,
                                                                                });
                                                                                if (p?.requestId) handleHrApproveNotRenew(p.requestId);
                                                                            }}
                                                                            className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-white p-2 text-emerald-600 shadow-sm hover:bg-emerald-50 disabled:opacity-40"
                                                                            title="Approve not renew"
                                                                        >
                                                                            <CheckCircle size={18} />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            disabled={hrRespondSubmitting}
                                                                            onClick={() => {
                                                                                const p = findPendingNotRenew({
                                                                                    kind: 'ownerDoc',
                                                                                    ownerIndex: activeOwnerTabIndex,
                                                                                    docKey: doc.id,
                                                                                });
                                                                                if (p?.requestId) {
                                                                                    setHrRejectRequestId(p.requestId);
                                                                                    setHrRejectComment('');
                                                                                }
                                                                            }}
                                                                            className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white p-2 text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-40"
                                                                            title="Reject request"
                                                                        >
                                                                            <XCircle size={18} />
                                                                        </button>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        ) : null}

                                                        <div className="p-6 space-y-5">

                                                            {doc.fields.map((field, fIdx) => (

                                                                <div key={fIdx} className="flex justify-between items-center group">

                                                                    <span className="text-sm font-medium text-gray-500">{field.label}</span>

                                                                    <span className={`text-sm font-medium ${field.key === 'expiryDate'
                                                                        ? getExpiryVisualState(company.owners[activeOwnerTabIndex]?.[doc.id]?.[field.key]).className
                                                                        : 'text-gray-500'
                                                                        }`}>

                                                                        {field.isDate

                                                                            ? (company.owners[activeOwnerTabIndex]?.[doc.id]?.[field.key]

                                                                                ? new Date(company.owners[activeOwnerTabIndex][doc.id][field.key]).toLocaleDateString('en-GB')

                                                                                : '---')

                                                                            : (company.owners[activeOwnerTabIndex]?.[doc.id]?.[field.key] || '---')

                                                                        }

                                                                    </span>

                                                                </div>

                                                            ))}

                                                        </div>

                                                    </div>

                                                ))}

                                            </div>



                                            {/* Bottom Row: Missing Documents Buttons */}

                                            <div className="flex flex-wrap gap-4 pt-4">

                                                {[

                                                    { id: 'passport', label: 'Passport', modal: 'ownerPassport' },

                                                    { id: 'visa', label: 'Visa', isDropdown: true },

                                                    { id: 'labourCard', label: 'Labour Card', modal: 'ownerLabourCard' },

                                                    { id: 'emiratesId', label: 'Emirates ID', modal: 'ownerEmiratesId' },

                                                    { id: 'medical', label: 'Medical Insurance', modal: 'ownerMedical' },

                                                    { id: 'drivingLicense', label: 'Driving License', modal: 'ownerDrivingLicense' }

                                                ].filter(doc => !company.owners[activeOwnerTabIndex]?.[doc.id]?.number).map((btn, idx) => (

                                                    <div key={idx} className="relative" ref={btn.isDropdown ? visaDropdownRef : null}>

                                                        <button

                                                            onClick={() => btn.isDropdown ? setVisaDropdownOpen(!visaDropdownOpen) : handleModalOpen(btn.modal)}

                                                            className="bg-[#00B894] hover:bg-[#00A383] text-white px-6 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 shadow-sm"

                                                        >

                                                            {btn.label} <Plus size={16} strokeWidth={3} />

                                                        </button>

                                                        {btn.isDropdown && visaDropdownOpen && (

                                                            <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">

                                                                {['Visit', 'Employment', 'Spouse'].map((type) => (

                                                                    <button

                                                                        key={type}

                                                                        onClick={() => {

                                                                            setModalData({ ...modalData, type: type });

                                                                            setModalType('ownerVisa');

                                                                            setVisaDropdownOpen(false);

                                                                        }}

                                                                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"

                                                                    >

                                                                        {type} Visa

                                                                    </button>

                                                                ))}

                                                            </div>

                                                        )}

                                                    </div>

                                                ))}

                                            </div>

                                        </div>

                                    </>

                                ) : (

                                    <div className="bg-white rounded-2xl shadow-sm p-8 flex flex-col items-center justify-center py-24 text-center border border-gray-100">

                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4 border border-gray-100">

                                            <User size={32} />

                                        </div>

                                        <h4 className="text-lg font-bold text-gray-700">No Owner Records Found</h4>

                                        <p className="text-sm text-gray-400 max-w-xs leading-relaxed">Ownership and stakeholder information has not been added to the trade license yet.</p>

                                        <button

                                            onClick={() => handleModalOpen('tradeLicense')}

                                            className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"

                                        >

                                            Add Owner Info

                                        </button>

                                    </div>

                                )}

                            </div>

                        )}



                        {activeTab === 'assets' && (

                            <div className="animate-in fade-in duration-500">

                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 min-h-[400px]">

                                    <div className="flex items-center justify-between mb-6">

                                        <div>

                                            <h3 className="text-xl font-semibold text-gray-800">Company Assets</h3>

                                            <p className="text-sm text-gray-400 mt-0.5">Assets assigned directly to this company</p>

                                        </div>

                                    </div>

                                    <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
                                        {selectedCompanyAssetIds.length > 0 && (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200">
                                                {selectedCompanyAssetIds.length} selected
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleCompanyBulkReturn}
                                            disabled={selectedCompanyAssetIds.length === 0 || companyBulkSubmitting}
                                            className="bg-white hover:bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Bulk return"
                                        >
                                            <Undo2 size={14} />
                                            <span>Bulk Return</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCompanyBulkTransfer}
                                            disabled={selectedCompanyAssetIds.length === 0 || companyBulkSubmitting}
                                            className="bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-200 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Bulk transfer"
                                        >
                                            <ArrowRightLeft size={14} />
                                            <span>Bulk Transfer</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCompanyBulkEndOfServices}
                                            disabled={selectedCompanyAssetIds.length === 0 || companyBulkSubmitting}
                                            className="bg-white hover:bg-rose-50 text-rose-800 border border-rose-200 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Bulk end of services"
                                        >
                                            <PackageX size={14} />
                                            <span>Bulk End Of Services</span>
                                        </button>
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">

                                        <table className="w-full text-left">

                                            <thead className="bg-gray-50/80 border-b border-gray-100">

                                                <tr>
                                                    <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-12">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleSelectAllCompanyAssets();
                                                            }}
                                                            className="text-blue-600 hover:text-blue-800 disabled:opacity-40"
                                                            disabled={selectableCompanyAssetIds.length === 0}
                                                            aria-label="Select all assets"
                                                        >
                                                            {allSelectableCompanyAssetsSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                                        </button>
                                                    </th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Asset Name</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Asset ID</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Type / Category</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Value</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Assigned Date</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Attachment</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Action</th>

                                                </tr>

                                            </thead>

                                            <tbody className="divide-y divide-gray-50">

                                                {assetsLoading ? (

                                                    <tr>

                                                        <td colSpan={9} className="px-6 py-20 text-center">

                                                            <div className="flex flex-col items-center gap-3 text-gray-300">

                                                                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />

                                                                <span className="text-sm font-semibold text-gray-400">Loading assets...</span>

                                                            </div>

                                                        </td>

                                                    </tr>

                                                ) : filteredCompanyAssets.length === 0 ? (

                                                    <tr>

                                                        <td colSpan={9} className="px-6 py-20 text-center">

                                                            <div className="flex flex-col items-center gap-3">

                                                                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100">

                                                                    <Building size={28} className="text-gray-300" />

                                                                </div>

                                                                <span className="text-sm font-semibold text-gray-400">
                                                                    No assets assigned directly to this company
                                                                </span>

                                                            </div>

                                                        </td>

                                                    </tr>

                                                ) : (

                                                    filteredCompanyAssets.map((asset, idx) => {

                                                        const statusColors = {

                                                            'Assigned': 'bg-emerald-100 text-emerald-700',

                                                            'Unassigned': 'bg-gray-100 text-gray-500',

                                                            'Maintenance': 'bg-amber-100 text-amber-700',

                                                            'On Service': 'bg-blue-100 text-blue-600',

                                                            'Lost': 'bg-red-100 text-red-600',

                                                            'Returned': 'bg-purple-100 text-purple-600',

                                                            'Out of Service': 'bg-gray-100 text-gray-500',

                                                            'End of Life': 'bg-slate-100 text-slate-500',

                                                        };

                                                        const statusClass = statusColors[asset.status] || 'bg-blue-100 text-blue-600';

                                                        const empName = asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : '---';



                                                        return (

                                                            <tr
                                                                key={asset._id || idx}
                                                                className="hover:bg-blue-50/20 transition-colors group cursor-pointer"
                                                                onClick={() => router.push(`/HRM/Asset/details/${asset._id || asset.id}`)}
                                                            >
                                                                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                                    <button
                                                                        type="button"
                                                                        className="text-blue-600 hover:text-blue-800 disabled:opacity-30"
                                                                        onClick={() => toggleCompanyAssetSelection(asset._id || asset.id)}
                                                                        disabled={!(String(asset?.status || '').toLowerCase() === 'assigned' && !asset?.pendingAction)}
                                                                        aria-label={`Select ${asset.name || 'asset'}`}
                                                                    >
                                                                        {selectedCompanyAssetIds.includes(String(asset._id || asset.id)) ? (
                                                                            <CheckSquare size={16} />
                                                                        ) : (
                                                                            <Square size={16} />
                                                                        )}
                                                                    </button>
                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <div className="flex flex-col">

                                                                        <span className="text-sm font-semibold text-gray-700">{asset.name || '---'}</span>

                                                                    </div>

                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <span className="text-sm font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">

                                                                        {asset.assetId || '---'}

                                                                    </span>

                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <span className="text-sm text-gray-600 capitalize">{asset.typeId?.name || asset.categoryId?.name || '---'}</span>

                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <span className="text-sm font-bold text-emerald-600">{asset.assetValue ? `${Number(asset.assetValue).toLocaleString()} AED` : '---'}</span>

                                                                </td>

                                                                <td className="px-6 py-4 text-sm font-medium text-gray-500">

                                                                    {asset.updatedAt ? new Date(asset.updatedAt).toLocaleDateString('en-GB') : '---'}

                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>

                                                                        {asset.status || 'Assigned'}

                                                                    </span>

                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <div className="flex items-center gap-2">
                                                                        {asset.invoiceFile && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setViewingDocument({
                                                                                        data: asset.invoiceFile,
                                                                                        name: `${asset.name} Invoice`,
                                                                                        mimeType: 'application/pdf'
                                                                                    });
                                                                                }}
                                                                                className="text-blue-600 hover:text-blue-800 transition-colors"
                                                                                title="View Invoice"
                                                                            >
                                                                                <FileText size={18} />
                                                                            </button>
                                                                        )}
                                                                        {(asset.documents || []).map((doc, dIdx) => (
                                                                            doc.attachment && (
                                                                                <button
                                                                                    key={dIdx}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setViewingDocument({
                                                                                            data: doc.attachment,
                                                                                            name: `${asset.name} - ${doc.type || 'Document'}`,
                                                                                            mimeType: 'application/pdf'
                                                                                        });
                                                                                    }}
                                                                                    className="text-indigo-500 hover:text-indigo-700 transition-colors"
                                                                                    title={doc.type || 'Asset Document'}
                                                                                >
                                                                                    <File size={18} />
                                                                                </button>
                                                                            )
                                                                        ))}
                                                                        {!asset.invoiceFile && (asset.documents || []).filter(d => d.attachment).length === 0 && (
                                                                            <span className="text-gray-300">---</span>
                                                                        )}
                                                                    </div>

                                                                </td>

                                                                <td className="px-6 py-4 text-right">

                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            router.push(`/HRM/Asset/details/${asset._id || asset.id}`);
                                                                        }}

                                                                        className="opacity-0 group-hover:opacity-100 transition-all p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"

                                                                        title="View Asset Details"

                                                                    >

                                                                        <ChevronRight size={18} />

                                                                    </button>

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

                        )}





                        {activeTab === 'fine' && (

                            <div className="animate-in fade-in duration-500">

                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 min-h-[400px]">

                                    <div className="flex items-center justify-between mb-6">

                                        <div>

                                            <h3 className="text-xl font-semibold text-gray-800">Company Fines</h3>

                                            <p className="text-sm text-gray-400 mt-0.5">Fines where the company is responsible or has contributed</p>

                                        </div>

                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">

                                        <table className="w-full text-left">

                                            <thead className="bg-gray-50/80 border-b border-gray-100">

                                                <tr>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Fine ID</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Fine Type</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Amount</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Company Share</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Awarded Date</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Action</th>

                                                </tr>

                                            </thead>

                                            <tbody className="divide-y divide-gray-50">

                                                {finesLoading ? (

                                                    <tr>

                                                        <td colSpan={7} className="px-6 py-20 text-center">

                                                            <div className="flex flex-col items-center gap-3 text-gray-300">

                                                                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />

                                                                <span className="text-sm font-semibold text-gray-400">Loading fines...</span>

                                                            </div>

                                                        </td>

                                                    </tr>

                                                ) : companyFines.length === 0 ? (

                                                    <tr>

                                                        <td colSpan={7} className="px-6 py-20 text-center">

                                                            <div className="flex flex-col items-center gap-3">

                                                                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100">

                                                                    <FileText size={28} className="text-gray-300" />

                                                                </div>

                                                                <span className="text-sm font-semibold text-gray-400">No company-contributed fines found</span>

                                                            </div>

                                                        </td>

                                                    </tr>

                                                ) : (

                                                    companyFines.map((fine, idx) => {

                                                        const statusColors = {

                                                            'Pending': 'bg-yellow-100 text-yellow-700',

                                                            'Pending HR': 'bg-orange-100 text-orange-700',

                                                            'Pending Accounts': 'bg-blue-100 text-blue-700',

                                                            'Pending Authorization': 'bg-purple-100 text-purple-700',

                                                            'Approved': 'bg-green-100 text-green-700',

                                                            'Active': 'bg-emerald-100 text-emerald-700',

                                                            'Completed': 'bg-teal-100 text-teal-700',

                                                            'Paid': 'bg-gray-100 text-gray-700',

                                                            'Rejected': 'bg-red-100 text-red-700',

                                                            'Cancelled': 'bg-slate-100 text-slate-700',

                                                            'Draft': 'bg-gray-100 text-gray-500'

                                                        };

                                                        const statusClass = statusColors[fine.fineStatus] || 'bg-blue-100 text-blue-600';

                                                        const companyAmount = fine.companyAmount || 0;

                                                        const totalAmount = fine.fineAmount || 0;

                                                        return (

                                                            <tr
                                                                key={fine._id || idx}
                                                                className="hover:bg-blue-50/20 transition-colors group cursor-pointer"
                                                                onClick={() => router.push(`/HRM/Fine/${fine._id || fine.fineId}`)}
                                                            >

                                                                <td className="px-6 py-4">

                                                                    <span className="text-sm font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">

                                                                        {fine.fineId || '---'}

                                                                    </span>

                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <span className="text-sm text-gray-600 capitalize">{fine.fineType || fine.subCategory || '---'}</span>

                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <span className="text-sm font-bold text-red-600">{totalAmount ? `${Number(totalAmount).toLocaleString()} AED` : '---'}</span>

                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <span className="text-sm font-bold text-emerald-600">{companyAmount ? `${Number(companyAmount).toLocaleString()} AED` : '0 AED'}</span>

                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>

                                                                        {fine.fineStatus || 'Pending'}

                                                                    </span>

                                                                </td>

                                                                <td className="px-6 py-4 text-sm font-medium text-gray-500">

                                                                    {fine.awardedDate ? new Date(fine.awardedDate).toLocaleDateString('en-GB') : '---'}

                                                                </td>

                                                                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>

                                                                    <button

                                                                        onClick={() => router.push(`/HRM/Fine/${fine._id || fine.fineId}`)}

                                                                        className="opacity-0 group-hover:opacity-100 transition-all p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"

                                                                        title="View Fine Details"

                                                                    >

                                                                        <ChevronRight size={18} />

                                                                    </button>

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

                        )}



                        {(activeTab === 'others' || activeTab === 'moa' || activeDynamicTabs.includes(activeTab)) && (

                            <div className={`${activeTab === 'moa' ? '' : 'bg-white rounded-xl shadow-sm border border-gray-100 p-8'} animate-in fade-in duration-500 min-h-[400px]`}>

                                <div className="flex flex-col gap-6 mb-8">

                                    <div className="flex items-center justify-between">

                                        <h3 className="text-xl font-semibold text-gray-800 capitalize">

                                            {activeTab === 'others' ? 'Documents' :

                                                activeTab === 'moa' ? 'MOA Documents' :

                                                    `${activeTab} Documents`}

                                        </h3>

                                        <div className="flex items-center gap-2 flex-wrap justify-end">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setModalErrors({});
                                                    handleModalOpen('companyDocument', null, 'moa');
                                                }}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                                            >
                                                <Plus size={16} /> Add MOA
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingIndex(null);
                                                    setModalErrors({});
                                                    setModalData({
                                                        type: '',
                                                        description: '',
                                                        issueDate: '',
                                                        memoCategory: 'General',
                                                        attachment: null,
                                                        fileName: '',
                                                        mimeType: 'application/pdf'
                                                    });
                                                    setModalType('addMemo');
                                                }}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                                            >
                                                <Plus size={16} /> Add Memo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingIndex(null);
                                                    openCompanyAddDocumentModal();
                                                }}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                                                disabled={docStatusTab === 'memo'}
                                                title={docStatusTab === 'memo' ? 'Switch to Live or Old to add non-memo documents' : 'Add Document'}
                                            >
                                                <Plus size={16} /> Add Document
                                            </button>
                                        </div>

                                    </div>



                                    {/* Document Status Filter Tabs - Hide for MOA */}

                                    {activeTab !== 'moa' && (

                                        <div className="flex items-center gap-6 border-b border-gray-100">

                                            <button

                                                onClick={() => setDocStatusTab('live')}

                                                className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all relative ${docStatusTab === 'live'

                                                    ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'

                                                    : 'text-gray-400 hover:text-gray-600'

                                                    }`}

                                            >

                                                Live Documents

                                            </button>

                                            <button

                                                onClick={() => setDocStatusTab('old')}

                                                className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all relative ${docStatusTab === 'old'

                                                    ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'

                                                    : 'text-gray-400 hover:text-gray-600'

                                                    }`}

                                            >

                                                Old Documents

                                            </button>

                                            <button

                                                onClick={() => setDocStatusTab('memo')}

                                                className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all relative ${docStatusTab === 'memo'

                                                    ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'

                                                    : 'text-gray-400 hover:text-gray-600'

                                                    }`}

                                            >

                                                Memo

                                            </button>

                                        </div>

                                    )}

                                </div>



                                {(() => {
                                    const isOldDoc = (d) =>
                                        (d?.description?.toLowerCase()?.includes('previous') ?? false) ||
                                        (d?.type?.toLowerCase()?.includes('previous') ?? false);
                                    const isMemoView = docStatusTab === 'memo';
                                    const isLiveView = docStatusTab === 'live';
                                    const isOldView = docStatusTab === 'old';

                                    const documentsFromMain = (company.documents || []).map((d, i) => ({ ...d, sourceKind: 'documents', sourceIndex: i }));
                                    const documentsFromOld = (company.oldDocuments || []).map((d, i) => ({ ...d, sourceKind: 'oldDocuments', sourceIndex: i }));
                                    
                                    const mergedSource = [...documentsFromMain, ...documentsFromOld];

                                    const docsSource = mergedSource.filter(
                                        (doc) =>
                                            doc &&
                                            (
                                                isMemoView
                                                    ? true
                                                    : (isLiveView ? (doc.sourceKind === 'documents' && !isOldDoc(doc)) : (doc.sourceKind === 'oldDocuments' || isOldDoc(doc)))
                                            )
                                    );
                                    const openAttachment = (doc, fallbackName = 'Document') => {
                                        const fileData = doc?.document?.url || doc?.attachment;
                                        if (!fileData) return;
                                        setViewingDocument({
                                            data: fileData,
                                            name: doc?.type || fallbackName,
                                            mimeType: doc?.document?.mimeType || 'application/pdf'
                                        });
                                    };

                                    const checkIsQueued = (sectionName) => {
                                        return (company?.pendingReactivationChanges || []).some(
                                            (change) => String(change?.section || '').toLowerCase() === String(sectionName).toLowerCase()
                                        );
                                    };

                                    const basicDetailsRows = isMemoView
                                        ? []
                                        : isLiveView
                                        ? [
                                            {
                                                documentType: 'Trade License',
                                                isQueued: checkIsQueued('tradelicense'),
                                                issueDate: company.tradeLicenseIssueDate,
                                                expiryDate: company.tradeLicenseExpiry,
                                                attachment: company.tradeLicenseAttachment,
                                                onView: company.tradeLicenseAttachment ? () => openAttachment({ attachment: company.tradeLicenseAttachment, type: 'Trade License' }, 'Trade License') : null,
                                                onEdit: () => handleModalOpen('tradeLicense'),
                                                onRenew: () => handleModalOpen('tradeLicense', null, null, true),
                                                onNotRenew: () => setNotRenewData({ kind: 'tradeLicense', label: 'Trade License' }),
                                                onDelete: handleDeleteTradeLicense,
                                                notRenewPendingTarget: { kind: 'tradeLicense' },
                                            },
                                            {
                                                documentType: 'Establishment Card',
                                                isQueued: checkIsQueued('establishmentcard'),
                                                issueDate: company.establishmentCardIssueDate,
                                                expiryDate: company.establishmentCardExpiry,
                                                attachment: company.establishmentCardAttachment,
                                                onView: company.establishmentCardAttachment ? () => openAttachment({ attachment: company.establishmentCardAttachment, type: 'Establishment Card' }, 'Establishment Card') : null,
                                                onEdit: () => handleModalOpen('establishmentCard'),
                                                onRenew: () => handleModalOpen('establishmentCard', null, null, true),
                                                onNotRenew: () => setNotRenewData({ kind: 'establishmentCard', label: 'Establishment Card' }),
                                                onDelete: handleDeleteEstablishmentCard,
                                                notRenewPendingTarget: { kind: 'establishmentCard' },
                                            }
                                        ].filter((r) => r.issueDate || r.expiryDate || r.attachment)
                                        : docsSource
                                             .filter((d) => {
                                                 const t = String(d?.type || '').toLowerCase();
                                                 return t.includes('trade license') || t.includes('establishment card');
                                             })
                                             .map((d) => ({
                                                 documentType: d.type || 'Document',
                                                 issueDate: d.issueDate || d.startDate,
                                                 expiryDate: d.expiryDate,
                                                 attachment: d?.document?.url || d?.attachment,
                                                 onView: (d?.document?.url || d?.attachment)
                                                     ? () => openAttachment(d, d.type || 'Document')
                                                     : null,
                                                 onRenew: null,
                                                 onDelete: () => setDocumentToDelete({ kind: d.sourceKind, index: d.sourceIndex, id: d._id || d.id }),
                                             }))
                                             .filter((r) => r.issueDate || r.expiryDate || r.attachment);

                                    const parseOwnerDocsFromSource = (sourceDocs) => {
                                        const grouped = {};
                                        sourceDocs.forEach((doc) => {
                                            if (doc == null || typeof doc !== 'object') return;
                                            const rawType = String(doc?.type || '');
                                            const sepIndex = rawType.indexOf(' - ');
                                            if (sepIndex <= 0) return;
                                            const ownerName = rawType.slice(0, sepIndex).trim();
                                            const docType = rawType.slice(sepIndex + 3).trim();
                                            if (!ownerName || !docType) return;
                                            if (!grouped[ownerName]) grouped[ownerName] = [];
                                            grouped[ownerName].push({
                                                ownerName,
                                                documentType: docType,
                                                documentNumber: '',
                                                issueDate: doc?.issueDate || doc?.startDate,
                                                expiryDate: doc?.expiryDate,
                                                attachment: doc?.document?.url || doc?.attachment,
                                                sourceKind: doc.sourceKind,
                                                sourceIndex: doc.sourceIndex,
                                                _id: doc._id || doc.id,
                                                onDelete: () => setDocumentToDelete({ kind: doc.sourceKind, index: doc.sourceIndex, id: doc._id || doc.id })
                                            });
                                        });
                                        return grouped;
                                    };

                                    const ownerDocsFromSource = parseOwnerDocsFromSource(docsSource);

                                    const buildOwnerDocRowsFromOwnerObject = (owner, ownerIndex, { isArchived = false } = {}) => {
                                        const ownerName = owner?.name || `Owner ${ownerIndex + 1}`;
                                        const docs = [
                                            { key: 'passport', label: 'Passport' },
                                            { key: 'visa', label: 'Visa' },
                                            { key: 'labourCard', label: 'Labour Card' },
                                            { key: 'emiratesId', label: 'Emirates ID' },
                                            { key: 'medical', label: 'Medical Insurance' },
                                            { key: 'drivingLicense', label: 'Driving License' }
                                        ].map((m) => {
                                            const d = owner?.[m.key] || {};
                                            return {
                                                isQueued: isArchived ? false : checkIsQueued('Owner'),
                                                ownerName,
                                                ownerIndex,
                                                ownerDocKey: m.key,
                                                documentType: m.label,
                                                documentNumber: d.number || d.idNumber || '',
                                                issueDate: d.issueDate || d.startDate,
                                                expiryDate: d.expiryDate,
                                                attachment: d.attachment,
                                                notRenewPendingTarget: isArchived
                                                    ? undefined
                                                    : {
                                                        kind: 'ownerDoc',
                                                        ownerIndex,
                                                        docKey: m.key,
                                                    },
                                            };
                                        }).filter((d) => d.documentNumber || d.issueDate || d.expiryDate || d.attachment);

                                        // Owner-level attachment (legacy)
                                        if (owner?.attachment) {
                                            docs.push({
                                                isQueued: isArchived ? false : checkIsQueued('Owner'),
                                                ownerName,
                                                ownerIndex,
                                                ownerDocKey: 'attachment',
                                                documentType: 'Owner Attachment',
                                                documentNumber: '',
                                                issueDate: null,
                                                expiryDate: null,
                                                attachment: owner.attachment,
                                                notRenewPendingTarget: undefined,
                                            });
                                        }

                                        return { ownerName, docs };
                                    };

                                    const archivedOwnerGroups = isOldView
                                        ? (company.oldOwners || []).map((owner, ownerIndex) => {
                                            const group = buildOwnerDocRowsFromOwnerObject(owner, ownerIndex, { isArchived: true });
                                            const archivedAtLabel = owner?.archivedAt ? new Date(owner.archivedAt).toLocaleDateString('en-GB') : '';
                                            const reasonLabel = owner?.archiveReason ? String(owner.archiveReason) : 'Archived';
                                            return {
                                                ...group,
                                                archiveReason: owner?.archiveReason ? String(owner.archiveReason) : '',
                                                replacedByName: owner?.replacedByName ? String(owner.replacedByName) : '',
                                                archivedMeta: `${reasonLabel}${archivedAtLabel ? ` • ${archivedAtLabel}` : ''}`,
                                                onDelete: () => setDocumentToDelete({ kind: 'oldOwners', index: ownerIndex, id: owner._id || owner.id }),
                                            };
                                        }).filter((g) => (g.docs || []).length > 0)
                                        : [];

                                    // Map current live documents for each owner to allow filtering duplicates in Old view.
                                    const liveOwnerDocsMap = new Map();
                                    if (isOldView) {
                                        (company.owners || []).forEach((owner, idx) => {
                                            const ownerName = owner?.name || `Owner ${idx + 1}`;
                                            const built = buildOwnerDocRowsFromOwnerObject(owner, idx, { isArchived: false });
                                            liveOwnerDocsMap.set(String(ownerName).trim().toLowerCase(), built.docs);
                                        });
                                    }

                                    const ownerGroups = isMemoView
                                        ? []
                                        : isLiveView
                                        ? (company.owners || []).map((owner, ownerIndex) => {
                                            const ownerName = owner?.name || `Owner ${ownerIndex + 1}`;
                                            const built = buildOwnerDocRowsFromOwnerObject(owner, ownerIndex, { isArchived: false });
                                            return { ownerName, docs: built.docs };
                                        }).map((g) => {
                                            // Keep backward compatibility for legacy rows in documents[].
                                            // But do not re-add the core owner card doc types here, otherwise
                                            // deleted/not-renewed owner cards can incorrectly appear in Live.
                                            const ownerCoreTypes = new Set([
                                                'passport',
                                                'visa',
                                                'labour card',
                                                'emirates id',
                                                'medical insurance',
                                                'driving license',
                                            ]);
                                            const legacyOwnerDocs = (ownerDocsFromSource[g.ownerName] || []).filter((x) => {
                                                const t = String(x?.documentType || '').trim().toLowerCase();
                                                return !ownerCoreTypes.has(t);
                                            });
                                            return { ...g, docs: [...g.docs, ...legacyOwnerDocs] };
                                        }).filter((g) => g.docs.length > 0)
                                        : (() => {
                                            const legacyGroups = Object.keys(ownerDocsFromSource).map((ownerName) => ({ ownerName, docs: ownerDocsFromSource[ownerName] }));
                                            // Old view should prefer structured archived owners (oldOwners) and also include any legacy owner docs.
                                            const combined = isOldView ? [...archivedOwnerGroups, ...legacyGroups] : legacyGroups;
                                            if (!isOldView) return combined;

                                            // Merge groups with same ownerName for Old view so each owner appears only once.
                                            const mapByOwner = new Map();
                                            for (const g of combined) {
                                                if (!g || !g.ownerName) continue;
                                                const key = String(g.ownerName).trim();
                                                const existing = mapByOwner.get(key);
                                                const liveDocs = liveOwnerDocsMap.get(key.toLowerCase()) || [];

                                                if (!existing) {
                                                    // Filter out docs that are currently live even for the first group found
                                                    const filteredDocs = (g.docs || []).filter(d => !liveDocs.some(ld => {
                                                        const typeMatch = String(ld.documentType || '').toLowerCase() === String(d.documentType || '').toLowerCase();
                                                        const issueMatch = String(ld.issueDate || '') === String(d.issueDate || '');
                                                        const expiryMatch = String(ld.expiryDate || '') === String(d.expiryDate || '');
                                                        const idMatch = d._id && ld._id && String(d._id) === String(ld._id);
                                                        return idMatch || (typeMatch && issueMatch && expiryMatch);
                                                    }));

                                                    mapByOwner.set(key, { ...g, docs: filteredDocs });
                                                } else {
                                                    // Merge docs while deduplicating identical entries and filtering live data
                                                    const newDocs = g.docs || [];
                                                    for (const d of newDocs) {
                                                        const isDuplicateInOld = existing.docs.some((ex) => {
                                                            const typeMatch = String(ex.documentType || '').toLowerCase() === String(d.documentType || '').toLowerCase();
                                                            const issueMatch = String(ex.issueDate || '') === String(d.issueDate || '');
                                                            const expiryMatch = String(ex.expiryDate || '') === String(d.expiryDate || '');
                                                            const idMatch = d._id && ex._id && String(d._id) === String(ex._id);
                                                            return idMatch || (typeMatch && issueMatch && expiryMatch);
                                                        });
                                                        const isCurrentlyLive = liveDocs.some((ld) => {
                                                            const typeMatch = String(ld.documentType || '').toLowerCase() === String(d.documentType || '').toLowerCase();
                                                            const issueMatch = String(ld.issueDate || '') === String(d.issueDate || '');
                                                            const expiryMatch = String(ld.expiryDate || '') === String(d.expiryDate || '');
                                                            const idMatch = d._id && ld._id && String(d._id) === String(ld._id);
                                                            return idMatch || (typeMatch && issueMatch && expiryMatch);
                                                        });
                                                        if (!isDuplicateInOld && !isCurrentlyLive) {
                                                            existing.docs.push(d);
                                                        }
                                                    }
                                                    // Prefer structured archive metadata when present.
                                                    if (!existing.archiveReason && g.archiveReason) existing.archiveReason = g.archiveReason;
                                                    if (!existing.replacedByName && g.replacedByName) existing.replacedByName = g.replacedByName;
                                                }
                                            }
                                            return Array.from(mapByOwner.values()).filter((g) => (g.docs || []).length > 0);
                                        })();

                                    const documentWithExpiryRows = [];
                                    const documentWithoutExpiryRows = [];
                                    const moaRows = [];
                                    const memoRows = [];

                                    if (isLiveView) {
                                        (company.insurance || []).filter(Boolean).forEach((doc, idx) => {
                                            documentWithExpiryRows.push({
                                                documentType: doc?.type ? `Insurance — ${doc.type}` : 'Insurance',
                                                isQueued: checkIsQueued('insurance'),
                                                issueDate: doc?.issueDate || doc?.startDate,
                                                expiryDate: doc?.expiryDate,
                                                description: doc?.description || '',
                                                amount: doc?.value,
                                                attachment: doc?.document?.url || doc?.attachment,
                                                onView: () => openAttachment(doc, doc?.type || 'Insurance'),
                                                onEdit: () => { setEditingIndex(idx); handleModalOpen('companyDocument', idx, 'insurance'); },
                                                onRenew: () => { setEditingIndex(idx); handleModalOpen('companyDocument', idx, 'insurance', true); },
                                                onNotRenew: () => openNotRenewEjariInsurance('insurance', idx, doc),
                                                onDelete: () => handleHardDeleteArrayItem('insurance', idx),
                                                notRenewPendingTarget: {
                                                    kind: 'insurance',
                                                    arrayIndex: idx,
                                                    arrayItemId: doc?._id != null ? String(doc._id) : undefined,
                                                },
                                            });
                                        });
                                        (company.ejari || []).filter(Boolean).forEach((doc, idx) => {
                                            basicDetailsRows.push({
                                                documentType: doc?.type ? `Ejari — ${doc.type}` : 'Ejari',
                                                isQueued: checkIsQueued('ejari'),
                                                issueDate: doc?.issueDate || doc?.startDate,
                                                expiryDate: doc?.expiryDate,
                                                description: doc?.description || '',
                                                attachment: doc?.document?.url || doc?.attachment,
                                                onView: () => openAttachment(doc, doc?.type || 'Ejari'),
                                                onEdit: () => { setEditingIndex(idx); handleModalOpen('companyDocument', idx, 'ejari'); },
                                                onRenew: () => { setEditingIndex(idx); handleModalOpen('companyDocument', idx, 'ejari', true); },
                                                onNotRenew: () => openNotRenewEjariInsurance('ejari', idx, doc),
                                                onDelete: () => handleHardDeleteArrayItem('ejari', idx),
                                                notRenewPendingTarget: {
                                                    kind: 'ejari',
                                                    arrayIndex: idx,
                                                    arrayItemId: doc?._id != null ? String(doc._id) : undefined,
                                                },
                                            });
                                        });
                                    }

                                    docsSource.forEach((doc) => {
                                        const { sourceIndex, sourceKind } = doc;
                                        if (doc == null || typeof doc !== 'object') return;

                                        // Live Documents lists Ejari/Insurance from company.ejari / company.insurance only.
                                        // Skip flat copies in documents[] (legacy rows with context) so renewals stay: live in arrays, old in documents.
                                        if (isLiveView) {
                                            const ctxFlat = String(doc?.context || '').toLowerCase();
                                            if (ctxFlat === 'ejari' || ctxFlat === 'insurance') return;
                                        }

                                        const t = String(doc?.type || '').toLowerCase();
                                        const context = String(doc?.context || '').toLowerCase();
                                        const dLower = String(doc?.description || '').toLowerCase();
                                        const expiryRaw = doc?.expiryDate;
                                        const expiryStr = String(expiryRaw || '').trim().toLowerCase();
                                        const hasExpiryValue =
                                            !!expiryRaw &&
                                            !['---', '-', 'n/a', 'na', 'null', 'undefined'].includes(expiryStr);
                                        const isExplicitWithExpiry =
                                            context === 'document_with_expiry' ||
                                            t.includes('with expiry') ||
                                            dLower.includes('with expiry');
                                        const isMoa = t.includes('moa') || context === 'moa';
                                        const isWithoutExpiry = context === 'document_without_expiry';
                                        const isOtherDocument =
                                            context === 'other_document' ||
                                            t.includes('other document') ||
                                            t === 'other';
                                        const isOwnerPattern =
                                            t.includes(' - passport') ||
                                            t.includes(' - visa') ||
                                            t.includes(' - labour card') ||
                                            t.includes(' - emirates id') ||
                                            t.includes(' - medical insurance') ||
                                            t.includes(' - driving license');
                                        const isBasicSystemDoc =
                                            t.includes('trade license') ||
                                            t.includes('establishment card');
                                        const isMemoDoc =
                                            context === 'memo' ||
                                            dLower === 'memo' ||
                                            t === 'memo' ||
                                            t.includes('memo');

                                        if (isMoa) {
                                            if (isMemoView) return;
                                            moaRows.push({
                                                documentType: doc.type || 'MOA',
                                                isQueued: doc.isQueued || (company?.pendingReactivationChanges || []).some(c => c.section === 'moa' || (c.section === 'document' && c.documentItemId === String(doc?._id))),
                                                issueDate: doc.issueDate || doc.startDate,
                                                description: doc.description || '',
                                                attachment: doc?.document?.url || doc?.attachment,
                                                onView: () => openAttachment(doc, 'MOA'),
                                                onEdit: isLiveView ? () => { setEditingIndex(sourceIndex); handleModalOpen('companyDocument', sourceIndex, doc.context || 'moa'); } : null,
                                                onRenew: isLiveView ? () => { setEditingIndex(sourceIndex); handleModalOpen('companyDocument', sourceIndex, doc.context || 'moa', true); } : null,
                                                onNotRenew: isLiveView
                                                    ? () =>
                                                          setNotRenewData({
                                                              kind: 'document',
                                                              index: sourceIndex,
                                                              documentItemId: doc?._id != null ? String(doc._id) : undefined,
                                                              label: doc.type || 'MOA',
                                                          })
                                                    : null,
                                                onDelete: () => setDocumentToDelete({ kind: sourceKind, index: sourceIndex, id: doc._id || doc.id }),
                                                notRenewPendingTarget: {
                                                    kind: 'document',
                                                    documentIndex: sourceIndex,
                                                    documentItemId: doc?._id != null ? String(doc._id) : undefined,
                                                },
                                            });
                                            return;
                                        }

                                        if (isOwnerPattern || isBasicSystemDoc) {
                                            return;
                                        }

                                        if (isWithoutExpiry) {
                                            documentWithoutExpiryRows.push({
                                                documentType: doc.type || 'Document',
                                                isQueued: doc.isQueued || (company?.pendingReactivationChanges || []).some(c => c.section === 'document' && c.documentItemId === String(doc?._id)),
                                                description: doc.description || '',
                                                issueDate: doc.issueDate || doc.startDate,
                                                attachment: doc?.document?.url || doc?.attachment,
                                                onView: () => openAttachment(doc),
                                                onEdit: isLiveView ? () => { setEditingIndex(sourceIndex); handleModalOpen('companyDocument', sourceIndex, doc.context || 'document_without_expiry'); } : null,
                                                onNotRenew: isLiveView
                                                    ? () =>
                                                          setNotRenewData({
                                                              kind: 'document',
                                                              index: sourceIndex,
                                                              documentItemId: doc?._id != null ? String(doc._id) : undefined,
                                                              label: doc.type || 'Document',
                                                          })
                                                    : null,
                                                onDelete: () => setDocumentToDelete({ kind: sourceKind, index: sourceIndex, id: doc._id || doc.id }),
                                                notRenewPendingTarget: {
                                                    kind: 'document',
                                                    documentIndex: sourceIndex,
                                                    documentItemId: doc?._id != null ? String(doc._id) : undefined,
                                                },
                                            });
                                            return;
                                        }

                                        if (isMemoDoc) {
                                            if (!isMemoView) return;
                                            const isArchivedMemo = isOldDoc(doc);
                                            memoRows.push({
                                                documentType: doc.type || 'Memo',
                                                issueDate: doc.issueDate || doc.startDate,
                                                description: doc.description || '',
                                                category: doc.provider || 'General',
                                                attachment: doc?.document?.url || doc?.attachment,
                                                onView: () => openAttachment(doc, doc.type || 'Memo'),
                                                onEdit: !isArchivedMemo
                                                    ? () => {
                                                        setModalErrors({});
                                                        setEditingIndex(sourceIndex);
                                                        const rawIssue = doc.issueDate || doc.startDate;
                                                        setModalData({
                                                            type: doc.type || '',
                                                            description: doc.description || '',
                                                            issueDate: rawIssue ? new Date(rawIssue).toISOString().split('T')[0] : '',
                                                            memoCategory: doc.provider || 'General',
                                                            attachment: doc?.document?.url || doc?.attachment,
                                                            fileName: doc?.document?.name || doc.type || '',
                                                            mimeType: doc?.document?.mimeType || 'application/pdf'
                                                        });
                                                        setModalType('addMemo');
                                                    }
                                                    : null,
                                                onNotRenew: !isArchivedMemo
                                                    ? () =>
                                                          setNotRenewData({
                                                              kind: 'document',
                                                              index: sourceIndex,
                                                              documentItemId: doc?._id != null ? String(doc._id) : undefined,
                                                              label: doc.type || 'Memo',
                                                          })
                                                    : null,
                                                onDelete: () => setDocumentToDelete({ kind: sourceKind, index: sourceIndex, id: doc._id || doc.id }),
                                                notRenewPendingTarget: !isArchivedMemo
                                                    ? {
                                                          kind: 'document',
                                                          documentIndex: sourceIndex,
                                                          documentItemId: doc?._id != null ? String(doc._id) : undefined,
                                                      }
                                                    : undefined,
                                            });
                                            return;
                                        }

                                        if (isMemoView) return;

                                        if (hasExpiryValue || isExplicitWithExpiry) {
                                            const ctxDoc = String(doc?.context || '').toLowerCase();
                                            if (ctxDoc === 'ejari') {
                                                basicDetailsRows.push({
                                                    documentType:
                                                        doc.type && doc.type !== 'Ejari Record'
                                                            ? `Ejari — ${doc.type}`
                                                            : 'Ejari',
                                                    isQueued: doc.isQueued || (company?.pendingReactivationChanges || []).some(c => c.section === 'ejari' || (c.section === 'document' && c.documentItemId === String(doc?._id))),
                                                    issueDate: doc.issueDate || doc.startDate,
                                                    expiryDate: doc.expiryDate,
                                                    description: doc.description || '',
                                                    attachment: doc?.document?.url || doc?.attachment,
                                                    onView: () => openAttachment(doc),
                                                    onEdit: isLiveView ? () => { setEditingIndex(sourceIndex); handleModalOpen('companyDocument', sourceIndex, 'ejari'); } : null,
                                                    onRenew: isLiveView ? () => { setEditingIndex(sourceIndex); handleModalOpen('companyDocument', sourceIndex, 'ejari', true); } : null,
                                                    onNotRenew: isLiveView
                                                        ? () =>
                                                              setNotRenewData({
                                                                  kind: 'document',
                                                                  index: sourceIndex,
                                                                  documentItemId: doc?._id != null ? String(doc._id) : undefined,
                                                                  label: doc.type || 'Ejari',
                                                              })
                                                        : null,
                                                    onDelete: () => setDocumentToDelete({ kind: sourceKind, index: sourceIndex, id: doc._id || doc.id }),
                                                    notRenewPendingTarget: isLiveView
                                                        ? {
                                                              kind: 'document',
                                                              documentIndex: sourceIndex,
                                                              documentItemId: doc?._id != null ? String(doc._id) : undefined,
                                                          }
                                                        : undefined,
                                                });
                                                return;
                                            }
                                            let expiryDocLabel = doc.type || 'Document';
                                            if (ctxDoc === 'insurance' && isOldDoc(doc)) {
                                                expiryDocLabel = doc.type ? `Insurance — ${doc.type}` : 'Insurance (previous)';
                                            }
                                            documentWithExpiryRows.push({
                                                documentType: expiryDocLabel,
                                                isQueued: doc.isQueued || (company?.pendingReactivationChanges || []).some(c => c.section === 'insurance' || (c.section === 'document' && c.documentItemId === String(doc?._id))),
                                                issueDate: doc.issueDate || doc.startDate,
                                                expiryDate: doc.expiryDate,
                                                description: doc.description || '',
                                                amount: doc.value,
                                                attachment: doc?.document?.url || doc?.attachment,
                                                onView: () => openAttachment(doc),
                                                onEdit: isLiveView ? () => { setEditingIndex(sourceIndex); handleModalOpen('companyDocument', sourceIndex, doc.context || 'document_with_expiry'); } : null,
                                                onRenew: isLiveView ? () => { setEditingIndex(sourceIndex); handleModalOpen('companyDocument', sourceIndex, doc.context || 'document_with_expiry', true); } : null,
                                                onNotRenew: isLiveView
                                                    ? () =>
                                                          setNotRenewData({
                                                              kind: 'document',
                                                              index: sourceIndex,
                                                              documentItemId: doc?._id != null ? String(doc._id) : undefined,
                                                              label: expiryDocLabel,
                                                          })
                                                    : null,
                                                onDelete: () => setDocumentToDelete({ kind: sourceKind, index: sourceIndex, id: doc._id || doc.id }),
                                                notRenewPendingTarget: isLiveView
                                                    ? {
                                                          kind: 'document',
                                                          documentIndex: sourceIndex,
                                                          documentItemId: doc?._id != null ? String(doc._id) : undefined,
                                                      }
                                                    : undefined,
                                            });
                                            return;
                                        }
                                        if (isOtherDocument) {
                                            return;
                                        } else if (!hasExpiryValue) {
                                            documentWithoutExpiryRows.push({
                                                documentType: doc.type || 'Document',
                                                isQueued: doc.isQueued || (company?.pendingReactivationChanges || []).some(c => c.section === 'document' && c.documentItemId === String(doc?._id)),
                                                description: doc.description || '',
                                                issueDate: doc.issueDate || doc.startDate,
                                                attachment: doc?.document?.url || doc?.attachment,
                                                onView: () => openAttachment(doc),
                                                onEdit: isLiveView ? () => { setEditingIndex(sourceIndex); handleModalOpen('companyDocument', sourceIndex, doc.context || 'document_without_expiry'); } : null,
                                                onNotRenew: isLiveView
                                                    ? () =>
                                                          setNotRenewData({
                                                              kind: 'document',
                                                              index: sourceIndex,
                                                              documentItemId: doc?._id != null ? String(doc._id) : undefined,
                                                              label: doc.type || 'Document',
                                                          })
                                                    : null,
                                                onDelete: () => setDocumentToDelete({ kind: sourceKind, index: sourceIndex, id: doc._id || doc.id }),
                                                notRenewPendingTarget: isLiveView
                                                    ? {
                                                          kind: 'document',
                                                          documentIndex: sourceIndex,
                                                          documentItemId: doc?._id != null ? String(doc._id) : undefined,
                                                      }
                                                    : undefined,
                                            });
                                        }
                                    });

                                    const hasAnyDocs =
                                        isMemoView
                                            ? memoRows.length > 0
                                            : (
                                                basicDetailsRows.length > 0 ||
                                                ownerGroups.length > 0 ||
                                                documentWithExpiryRows.length > 0 ||
                                                documentWithoutExpiryRows.length > 0 ||
                                                moaRows.length > 0
                                            );

                                    const renderEmpty = () => (
                                        <div className="py-20 flex flex-col items-center justify-center text-gray-400 bg-gray-50/30 rounded-3xl border border-dashed border-gray-200">
                                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100 mb-4 opacity-50">
                                                <Upload size={32} strokeWidth={1.5} />
                                            </div>
                                            <h4 className="text-sm font-bold text-gray-500 mb-1">No Documents Found</h4>
                                            <p className="text-xs font-medium text-gray-400 text-center max-w-xs">There are no {docStatusTab} documents in this view.</p>
                                        </div>
                                    );

                                    if (!hasAnyDocs) return renderEmpty();

                                    const docRowActions = ({ onView, onEdit, onRenew, onNotRenew, onDelete, pendingTarget }) => {
                                        const pendingRequest = pendingTarget
                                            ? findPendingNotRenew(pendingTarget)
                                            : null;
                                        const hasPending = !isOldView && !!pendingRequest?.requestId;
                                        const showHrActions = !isOldView && viewerIsDesignatedFlowchartHr && hasPending;
                                        const effOnEdit = isOldView ? null : onEdit;
                                        const effOnRenew = isOldView ? null : onRenew;
                                        const effOnNotRenew = isOldView ? null : onNotRenew;
                                        const effOnDelete = (isOldView && !isAdmin()) ? null : onDelete;
                                        const has =
                                            onView ||
                                            effOnEdit ||
                                            effOnRenew ||
                                            (effOnNotRenew && !hasPending) ||
                                            (isAdmin() && effOnDelete) ||
                                            hasPending ||
                                            showHrActions;
                                        if (!has) {
                                            return <span className="text-gray-300 text-sm">—</span>;
                                        }
                                        return (
                                            <div className="flex h-full min-h-[44px] flex-nowrap items-center justify-end gap-0.5 sm:gap-1">
                                                {onView && (
                                                    <button
                                                        type="button"
                                                        onClick={onView}
                                                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center ${isOldView ? 'text-gray-600 hover:bg-gray-50' : 'text-blue-600 hover:bg-blue-50'} rounded-lg transition-colors`}
                                                        title="Download / view attachment"
                                                    >
                                                        <Download size={16} />
                                                    </button>
                                                )}
                                                {onEdit && (
                                                    !isOldView && (
                                                    <button
                                                        type="button"
                                                        onClick={onEdit}
                                                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center ${isOldView ? 'text-gray-600 hover:bg-gray-50' : 'text-blue-600 hover:bg-blue-50'} rounded-lg transition-colors`}
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    )
                                                )}
                                                {onRenew && (
                                                    !isOldView && (
                                                    <button
                                                        type="button"
                                                        onClick={onRenew}
                                                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center ${isOldView ? 'text-gray-600 hover:bg-gray-50' : 'text-amber-600 hover:bg-amber-50'} rounded-lg transition-colors`}
                                                        title="Renew"
                                                    >
                                                        <RotateCcw size={16} />
                                                    </button>
                                                    )
                                                )}
                                                {hasPending && (
                                                    <div
                                                        className={`inline-flex max-w-[11rem] sm:max-w-[14rem] flex-nowrap items-center gap-1 rounded-lg border ${isOldView ? 'border-gray-200 bg-gray-50' : 'border-amber-200 bg-amber-50'} px-2 py-1.5 shrink-0`}
                                                        title={pendingRequest?.reason ? `Pending HR approval — ${pendingRequest.reason}` : 'Pending HR approval'}
                                                    >
                                                        <span
                                                            className={`text-[10px] font-bold uppercase tracking-wide whitespace-nowrap shrink-0 ${isOldView ? 'text-gray-700' : 'text-amber-900'}`}
                                                        >
                                                            Pending
                                                        </span>
                                                        {showHrActions && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    disabled={hrRespondSubmitting}
                                                                    onClick={() => handleHrApproveNotRenew(pendingRequest.requestId)}
                                                                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${isOldView ? 'border-gray-200 bg-white text-gray-600' : 'border-emerald-200 bg-white text-emerald-600'} shadow-sm hover:${isOldView ? 'bg-gray-50' : 'bg-emerald-50'} disabled:opacity-40`}
                                                                    title="Approve not renew"
                                                                >
                                                                    <CheckCircle size={16} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={hrRespondSubmitting}
                                                                    onClick={() => {
                                                                        setHrRejectRequestId(pendingRequest.requestId);
                                                                        setHrRejectComment('');
                                                                    }}
                                                                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${isOldView ? 'border-gray-200 bg-white text-gray-600' : 'border-rose-200 bg-white text-rose-600'} shadow-sm hover:${isOldView ? 'bg-gray-50' : 'bg-rose-50'} disabled:opacity-40`}
                                                                    title="Reject request"
                                                                >
                                                                    <XCircle size={16} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                                {onNotRenew && !hasPending && (
                                                    !isOldView && (
                                                    <button
                                                        type="button"
                                                        onClick={onNotRenew}
                                                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                        title="Request not renew (HR approval)"
                                                    >
                                                        <Ban size={16} />
                                                    </button>
                                                    )
                                                )}
                                                {isAdmin() && onDelete && (
                                                    <button
                                                        type="button"
                                                        onClick={onDelete}
                                                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors`}
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    };

                                    const ownerCards = isLiveView && (company.owners || []).length > 0
                                        ? (company.owners || []).map((owner, i) => {
                                            const ownerName = owner?.name || `Owner ${i + 1}`;
                                            const group = ownerGroups.find((g) => g.ownerName === ownerName) || { ownerName, docs: [] };
                                            return { ownerName, docs: group.docs || [], onDelete: () => handleDeleteOwner(i) };
                                        })
                                        : (isOldView ? ownerGroups : []);

                                    const SECTION_PAGE_SIZE = 10;
                                    const getSectionPagination = (sectionKey, rows) => {
                                        const totalRows = rows.length;
                                        const isExpanded = !!companySectionExpanded[sectionKey];
                                        const totalPages = Math.max(1, Math.ceil(totalRows / SECTION_PAGE_SIZE));
                                        const currentPage = Math.min(companySectionPages[sectionKey] || 1, totalPages);
                                        const startIndex = (currentPage - 1) * SECTION_PAGE_SIZE;
                                        const pagedRows = isExpanded ? rows : rows.slice(startIndex, startIndex + SECTION_PAGE_SIZE);
                                        return { pagedRows, totalRows, totalPages, currentPage, isExpanded };
                                    };

                                    const renderSectionExpandToggle = (sectionKey, pagination) => (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCompanySectionExpanded((prev) => ({ ...prev, [sectionKey]: !pagination.isExpanded }));
                                                setCompanySectionPages((prev) => ({ ...prev, [sectionKey]: 1 }));
                                            }}
                                            className={
                                                isOldView
                                                    ? "px-2.5 py-1 rounded-md border border-gray-200 bg-gray-50 text-[11px] font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                                                    : "px-2.5 py-1 rounded-md border border-blue-200 bg-blue-50 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                                            }
                                        >
                                            {pagination.isExpanded ? 'Paginated View' : 'Expand All'}
                                        </button>
                                    );

                                    const renderSectionControls = (sectionKey, pagination) => (
                                        <div className="flex items-center justify-center gap-2 border-t border-gray-100 bg-gray-50/40 px-4 py-2">
                                            {!pagination.isExpanded && pagination.totalRows > SECTION_PAGE_SIZE && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setCompanySectionPages((prev) => ({
                                                                ...prev,
                                                                [sectionKey]: Math.max(1, pagination.currentPage - 1)
                                                            }))
                                                        }
                                                        disabled={pagination.currentPage <= 1}
                                                        className="h-8 min-w-[64px] rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                                                    >
                                                        Prev
                                                    </button>
                                                    <span className="h-8 min-w-[108px] inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 shadow-sm">
                                                        Page {pagination.currentPage} / {pagination.totalPages}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setCompanySectionPages((prev) => ({
                                                                ...prev,
                                                                [sectionKey]: Math.min(pagination.totalPages, pagination.currentPage + 1)
                                                            }))
                                                        }
                                                        disabled={pagination.currentPage >= pagination.totalPages}
                                                        className="h-8 min-w-[64px] rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                                                    >
                                                        Next
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    );

                                    const basicPagination = getSectionPagination(`company:${docStatusTab}:basic`, basicDetailsRows);
                                    const moaPagination = getSectionPagination(`company:${docStatusTab}:moa`, moaRows);
                                    const expiryPagination = getSectionPagination(`company:${docStatusTab}:withExpiry`, documentWithExpiryRows);
                                    const noExpiryPagination = getSectionPagination(`company:${docStatusTab}:withoutExpiry`, documentWithoutExpiryRows);
                                    const memoPagination = getSectionPagination(`company:${docStatusTab}:memo`, memoRows);

                                    return (
                                        <div className="space-y-8">
                                            {!isMemoView && basicDetailsRows.length > 0 && (
                                                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                    <h4 className="px-6 py-4 text-base font-bold text-gray-800 border-b border-gray-100">Basic Details </h4>
                                                    <table className="w-full text-left">
                                                        <thead className="bg-gray-50 border-b border-gray-100">
                                                            <tr>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Document Type</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Description</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Issue Date</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Expiry Date</th>
                                                                <th className="w-0 min-w-[7rem] px-3 py-3" scope="col">
                                                                    {renderSectionExpandToggle(`company:${docStatusTab}:basic`, basicPagination)}
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {basicPagination.pagedRows.map((row, i) => (
                                                                <tr
                                                                    key={`basic-${i}`}
                                                                    className={`group transition-colors ${
                                                                        getExpiryVisualState(row.expiryDate).tag === 'Expired'
                                                                            ? 'bg-red-50/70 hover:bg-red-100/70'
                                                                            : 'hover:bg-blue-50/30'
                                                                    }`}
                                                                >
                                                                    <td className="px-6 py-3 text-sm font-semibold text-gray-700">
                                                                        <div className="flex items-center gap-2">
                                                                            {row.documentType}
                                                                            {row.isQueued && (
                                                                                <span
                                                                                    className="inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full cursor-help animate-pulse"
                                                                                    title="waiting for hr approval"
                                                                                >
                                                                                    !
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {row.documentNumber ? (
                                                                            <div className="text-[11px] text-gray-400 font-medium">{row.documentNumber}</div>
                                                                        ) : null}
                                                                    </td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600">{row.description || '-'}</td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600">{formatDate(row.issueDate)}</td>
                                                                    <td className={`px-6 py-3 text-sm ${getExpiryVisualState(row.expiryDate).className}`}>{formatDate(row.expiryDate)}</td>
                                                                    <td className="px-3 py-3 text-sm text-right align-middle whitespace-nowrap">
                                                                        {docRowActions({
                                                                            onView: row.onView,
                                                                            onEdit: row.onEdit,
                                                                            onRenew: row.onRenew,
                                                                            onNotRenew: row.onNotRenew,
                                                                            onDelete: row.onDelete,
                                                                            pendingTarget: row.notRenewPendingTarget,
                                                                        })}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {renderSectionControls(`company:${docStatusTab}:basic`, basicPagination)}
                                                </div>
                                            )}

                                            {!isMemoView && moaRows.length > 0 && (
                                                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                    <h4 className="px-6 py-4 text-base font-bold text-gray-800 border-b border-gray-100">MOA</h4>
                                                    <table className="w-full text-left">
                                                        <thead className="bg-gray-50 border-b border-gray-100">
                                                            <tr>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Type</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Issue Date</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Description</th>
                                                                <th className="w-0 min-w-[7rem] px-3 py-3" scope="col">
                                                                    {renderSectionExpandToggle(`company:${docStatusTab}:moa`, moaPagination)}
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {moaPagination.pagedRows.map((row, i) => (
                                                                <tr key={`moa-${i}`} className="group hover:bg-blue-50/30 transition-colors">
                                                                    <td className="px-6 py-3 text-sm font-semibold text-gray-700">
                                                                        <div className="flex items-center gap-2">
                                                                            {row.documentType || 'MOA'}
                                                                            {row.isQueued && (
                                                                                <span
                                                                                    className="inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full cursor-help animate-pulse"
                                                                                    title="waiting for hr approval"
                                                                                >
                                                                                    !
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600">{formatDate(row.issueDate)}</td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600">{row.description || '-'}</td>
                                                                    <td className="px-3 py-3 text-sm text-right align-middle whitespace-nowrap">
                                                                        {docRowActions({
                                                                            onView: row.onView,
                                                                            onEdit: row.onEdit,
                                                                            onRenew: row.onRenew,
                                                                            onNotRenew: row.onNotRenew,
                                                                            onDelete: row.onDelete,
                                                                            pendingTarget: row.notRenewPendingTarget,
                                                                        })}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {renderSectionControls(`company:${docStatusTab}:moa`, moaPagination)}
                                                </div>
                                            )}

                                            {!isMemoView && ownerCards.length > 0 && (
                                                <div className="rounded-xl border border-gray-100 shadow-sm bg-white p-6 space-y-5">
                                                    <h4 className="text-base font-bold text-gray-800">Owner Details</h4>
                                                    {ownerCards.map((ownerCard, i) => (
                                                        <div key={`owner-card-${i}`} className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                                                            {(() => {
                                                                const ownerSectionKey = `company:${docStatusTab}:owner:${ownerCard.ownerName}:${i}`;
                                                                const ownerPagination = getSectionPagination(ownerSectionKey, ownerCard.docs || []);
                                                                return (
                                                                    <>
                                                            <h5 className="px-6 py-4 text-sm font-bold text-gray-800 border-b border-gray-100">
                                                                <div className="flex items-center gap-3 flex-wrap">
                                                                    <span>{ownerCard.ownerName}</span>
                                                                    {isOldView ? (
                                                                        <div className="flex items-center gap-2">
                                                                            {ownerCard.archiveReason === 'Replaced' && ownerCard.replacedByName
                                                                                ? (
                                                                                    <span className="text-[11px] font-semibold text-gray-600 bg-gray-50 px-2.5 py-0.5 rounded-full border border-gray-100 whitespace-nowrap">
                                                                                        (Old to {ownerCard.replacedByName})
                                                                                    </span>
                                                                                )
                                                                                : (
                                                                                    <span className="text-[11px] font-semibold text-gray-600 bg-gray-50 px-2.5 py-0.5 rounded-full border border-gray-100 whitespace-nowrap">
                                                                                        {ownerCard.archivedMeta || '(Old)'}
                                                                                    </span>
                                                                                )
                                                                            }
                                                                            {isAdmin() && ownerCard.onDelete && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => { e.stopPropagation(); ownerCard.onDelete(); }}
                                                                                    className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                                                                    title="Permanently delete this archived owner record"
                                                                                >
                                                                                    <Trash2 size={14} />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        isAdmin() && ownerCard.onDelete && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => { e.stopPropagation(); ownerCard.onDelete(); }}
                                                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                                title="Delete Owner (Admin Only)"
                                                                            >
                                                                                <Trash2 size={18} />
                                                                            </button>
                                                                        )
                                                                    )}
                                                                </div>
                                                            </h5>
                                                            <table className="w-full text-left">
                                                                <thead className="bg-gray-50 border-b border-gray-100">
                                                                    <tr>
                                                                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Document Type</th>
                                                                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Issue Date</th>
                                                                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Expiry Date</th>
                                                                        <th className="w-0 min-w-[3rem] px-3 py-3" scope="col">
                                                                            {renderSectionExpandToggle(ownerSectionKey, ownerPagination)}
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-50">
                                                                    {ownerPagination.totalRows > 0 ? ownerPagination.pagedRows.map((row, idx) => (
                                                                        <tr
                                                                            key={`owner-doc-${i}-${idx}`}
                                                                            className={`group transition-colors ${
                                                                                isOldView ? 'bg-white hover:bg-gray-50' : (getExpiryVisualState(row.expiryDate).tag === 'Expired'
                                                                                    ? 'bg-red-50/70 hover:bg-red-100/70'
                                                                                    : 'hover:bg-blue-50/30'
                                                                                )
                                                                            }`}
                                                                        >
                                                                            <td className="px-6 py-3 text-sm font-semibold text-gray-700">
                                                                                <div className="flex items-center gap-2">
                                                                                    {row.documentType}
                                                                                    {row.isQueued && (
                                                                                        <span
                                                                                            className={`inline-flex items-center justify-center w-4 h-4 ${isOldView ? 'bg-gray-200 text-gray-700' : 'bg-red-500 text-white'} text-[10px] font-bold rounded-full cursor-help animate-pulse`}
                                                                                            title="waiting for hr approval"
                                                                                        >
                                                                                            !
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-6 py-3 text-sm text-gray-600">{formatDate(row.issueDate)}</td>
                                                                            <td className={`px-6 py-3 text-sm ${getExpiryVisualState(row.expiryDate).className}`}>{formatDate(row.expiryDate)}</td>
                                                                            <td className="px-3 py-3 text-sm text-right align-middle whitespace-nowrap">
                                                                                {docRowActions({
                                                                                    onView: row.attachment
                                                                                        ? () =>
                                                                                              openAttachment(
                                                                                                  { attachment: row.attachment, type: row.documentType },
                                                                                                  row.documentType
                                                                                              )
                                                                                        : null,
                                                                                    onEdit:
                                                                                        typeof row.ownerIndex === 'number' && row.ownerDocKey
                                                                                            ? () => {
                                                                                                  const modalByKey = {
                                                                                                      passport: 'ownerPassport',
                                                                                                      visa: 'ownerVisa',
                                                                                                      labourCard: 'ownerLabourCard',
                                                                                                      emiratesId: 'ownerEmiratesId',
                                                                                                      medical: 'ownerMedical',
                                                                                                      drivingLicense: 'ownerDrivingLicense',
                                                                                                  };
                                                                                                  const mt = modalByKey[row.ownerDocKey];
                                                                                                  if (!mt) return;
                                                                                                  setActiveOwnerTabIndex(row.ownerIndex);
                                                                                                  handleModalOpen(mt);
                                                                                              }
                                                                                            : null,
                                                                                    onRenew:
                                                                                        typeof row.ownerIndex === 'number' && row.ownerDocKey
                                                                                            ? () => {
                                                                                                  const modalByKey = {
                                                                                                      passport: 'ownerPassport',
                                                                                                      visa: 'ownerVisa',
                                                                                                      labourCard: 'ownerLabourCard',
                                                                                                      emiratesId: 'ownerEmiratesId',
                                                                                                      medical: 'ownerMedical',
                                                                                                      drivingLicense: 'ownerDrivingLicense',
                                                                                                  };
                                                                                                  const mt = modalByKey[row.ownerDocKey];
                                                                                                  if (!mt) return;
                                                                                                  setActiveOwnerTabIndex(row.ownerIndex);
                                                                                                  handleModalOpen(mt, null, null, true);
                                                                                              }
                                                                                            : null,
                                                                                    onNotRenew:
                                                                                        typeof row.ownerIndex === 'number' && row.ownerDocKey
                                                                                            ? () =>
                                                                                                  setNotRenewData({
                                                                                                      kind: 'ownerDoc',
                                                                                                      ownerIndex: row.ownerIndex,
                                                                                                      docKey: row.ownerDocKey,
                                                                                                      label: row.documentType,
                                                                                                  })
                                                                                            : null,
                                                                                    onDelete:
                                                                                        typeof row.ownerIndex === 'number' && row.ownerDocKey
                                                                                            ? () => {
                                                                                                  setActiveOwnerTabIndex(row.ownerIndex);
                                                                                                  handleDeleteOwnerDocumentCard(row.ownerDocKey, row.ownerIndex);
                                                                                              }
                                                                                            : null,
                                                                                    pendingTarget: row.notRenewPendingTarget,
                                                                                })}
                                                                            </td>
                                                                        </tr>
                                                                    )) : (
                                                                        <tr>
                                                                            <td className="px-6 py-4 text-sm text-gray-500 italic" colSpan={4}>
                                                                                No owner documents available for this owner.
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                            {renderSectionControls(ownerSectionKey, ownerPagination)}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {!isMemoView && documentWithExpiryRows.length > 0 && (
                                                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                    <h4 className="px-6 py-4 text-base font-bold text-gray-800 border-b border-gray-100">Document With Expiry</h4>
                                                    <table className="w-full text-left">
                                                        <thead className="bg-gray-50 border-b border-gray-100">
                                                            <tr>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Document Type</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Description</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Issue Date</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Expiry Date</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Amount</th>
                                                                <th className="w-0 min-w-[7rem] px-3 py-3" scope="col">
                                                                    {renderSectionExpandToggle(`company:${docStatusTab}:withExpiry`, expiryPagination)}
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {expiryPagination.pagedRows.map((row, i) => (
                                                                <tr
                                                                    key={`with-exp-${i}`}
                                                                    className={`group transition-colors ${
                                                                        getExpiryVisualState(row.expiryDate).tag === 'Expired'
                                                                            ? 'bg-red-50/70 hover:bg-red-100/70'
                                                                            : 'hover:bg-blue-50/30'
                                                                    }`}
                                                                >
                                                                    <td className="px-6 py-3 text-sm font-semibold text-gray-700">
                                                                        <div className="flex items-center gap-2">
                                                                            {row.documentType}
                                                                            {row.isQueued && (
                                                                                <span
                                                                                    className="inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full cursor-help animate-pulse"
                                                                                    title="waiting for hr approval"
                                                                                >
                                                                                    !
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600">{row.description || '-'}</td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600">{formatDate(row.issueDate)}</td>
                                                                    <td className={`px-6 py-3 text-sm ${getExpiryVisualState(row.expiryDate).className}`}>{formatDate(row.expiryDate)}</td>
                                                                    <td className="px-6 py-3 text-sm text-gray-700">{row.amount ? `${Number(row.amount).toLocaleString()} AED` : '-'}</td>
                                                                    <td className="px-3 py-3 text-sm text-right align-middle whitespace-nowrap">
                                                                        {docRowActions({
                                                                            onView: row.onView,
                                                                            onEdit: row.onEdit,
                                                                            onRenew: row.onRenew,
                                                                            onNotRenew: row.onNotRenew,
                                                                            onDelete: row.onDelete,
                                                                            pendingTarget: row.notRenewPendingTarget,
                                                                        })}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {renderSectionControls(`company:${docStatusTab}:withExpiry`, expiryPagination)}
                                                </div>
                                            )}

                                            {!isMemoView && documentWithoutExpiryRows.length > 0 && (
                                                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                    <h4 className="px-6 py-4 text-base font-bold text-gray-800 border-b border-gray-100">Document Without Expiry</h4>
                                                    <table className="w-full text-left">
                                                        <thead className="bg-gray-50 border-b border-gray-100">
                                                            <tr>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Document Type</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Document Description</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Issue Date</th>
                                                                <th className="w-0 min-w-[5rem] px-3 py-3" scope="col">
                                                                    {renderSectionExpandToggle(`company:${docStatusTab}:withoutExpiry`, noExpiryPagination)}
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {noExpiryPagination.pagedRows.map((row, i) => (
                                                                <tr key={`without-exp-${i}`} className="group hover:bg-blue-50/30 transition-colors">
                                                                    <td className="px-6 py-3 text-sm font-semibold text-gray-700">
                                                                        <div className="flex items-center gap-2">
                                                                            {row.documentType}
                                                                            {row.isQueued && (
                                                                                <span
                                                                                    className="inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full cursor-help animate-pulse"
                                                                                    title="waiting for hr approval"
                                                                                >
                                                                                    !
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600">{row.description || '-'}</td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600">{formatDate(row.issueDate)}</td>
                                                                    <td className="px-3 py-3 text-sm text-right align-middle whitespace-nowrap">
                                                                        {docRowActions({
                                                                            onView: row.onView,
                                                                            onEdit: row.onEdit,
                                                                            onRenew: null,
                                                                            onNotRenew: row.onNotRenew,
                                                                            onDelete: row.onDelete,
                                                                            pendingTarget: row.notRenewPendingTarget,
                                                                        })}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {renderSectionControls(`company:${docStatusTab}:withoutExpiry`, noExpiryPagination)}
                                                </div>
                                            )}

                                            {isMemoView && memoRows.length > 0 && (
                                                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                    <h4 className="px-6 py-4 text-base font-bold text-gray-800 border-b border-gray-100">Memo</h4>
                                                    <table className="w-full text-left">
                                                        <thead className="bg-gray-50 border-b border-gray-100">
                                                            <tr>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Document Name</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Description</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Issue Date</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Category</th>
                                                                <th className="w-0 min-w-[5rem] px-3 py-3" scope="col">
                                                                    {renderSectionExpandToggle(`company:${docStatusTab}:memo`, memoPagination)}
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {memoPagination.pagedRows.map((row, i) => (
                                                                <tr key={`memo-${i}`} className="group hover:bg-blue-50/30 transition-colors">
                                                                    <td className="px-6 py-3 text-sm font-semibold text-gray-700">{row.documentType}</td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600">{row.description || '-'}</td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600">{formatDate(row.issueDate)}</td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600">{row.category}</td>
                                                                    <td className="px-3 py-3 text-sm text-right align-middle whitespace-nowrap">
                                                                        {docRowActions({
                                                                            onView: row.onView,
                                                                            onEdit: row.onEdit,
                                                                            onRenew: null,
                                                                            onNotRenew: row.onNotRenew,
                                                                            onDelete: row.onDelete,
                                                                            pendingTarget: row.notRenewPendingTarget,
                                                                        })}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {renderSectionControls(`company:${docStatusTab}:memo`, memoPagination)}
                                                </div>
                                            )}

                                        </div>
                                    );

                                })()}

                            </div>

                        )}







                    </div>

                </div>



                {/* Modal Overlay */}

                {modalType && (

                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">

                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

                            {/* Modal Header */}

                            <div className={`px-8 py-6 border-b border-gray-100 flex items-center ${['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical'].includes(modalType) ? 'justify-center relative' : 'justify-between'} flex-shrink-0`}>

                                <div className={`flex flex-col ${['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical'].includes(modalType) ? 'items-center' : ''}`}>

                                    <h3 className="font-semibold text-xl text-gray-800 tracking-tight">

                                        {modalType === 'basicDetails' ? 'Edit Basic Details' :

                                            modalType === 'tradeLicense' ? 'Trade License Details' :

                                                modalType === 'establishmentCard' ? 'Establishment Card Details' :

                                                    modalType === 'ownerPassport' ? 'Passport Details' :

                                                        modalType === 'ownerVisa' ? 'Visa Requirements' :

                                                            modalType === 'ownerEmiratesId' ? 'Owner Emirates ID' :

                                                                modalType === 'ownerMedical' ? 'Medical Insurance' :

                                                                    modalType === 'ownerDrivingLicense' ? 'Owner Driving License' :

                                                                        modalType === 'ownerDetails' ? 'Owner Basic Details' :

                                                                            modalType === 'companyDocument'
                                                                                ? (isRenewalModal
                                                                                    ? 'Renew Document'
                                                                                    : (editingIndex !== null
                                                                                        ? 'Edit Document'
                                                                                        : 'Add Document'))
                                                                                :

                                                                                modalType === 'addEjari' ? (modalData.type ? `Add ${modalData.type}` : 'Add Ejari Record') :

                                                                                    modalType === 'addInsurance' ? `Add ${modalData.type || 'Insurance'} Policy` :

                                                                                        modalType === 'addNewCategory' ? 'Add New Category' :

                                                                                            modalType === 'ownerLabourCard' ? 'Labour Card' :
                                                                                                modalType === 'addMemo' ? (editingIndex !== null ? 'Edit Memo' : 'Add Memo') :
                                                                                                    modalType === 'assignEmployee' ? `Assign ${selectedCategory?.toUpperCase() || ''} Responsibility` : ''}

                                    </h3>

                                    {modalType === 'ownerVisa' && (

                                        <p className="text-xs font-semibold text-gray-400 capitalize">{modalData.type || 'Employment'} Visa details</p>

                                    )}

                                </div>

                                <button onClick={handleModalClose} className={`text-gray-400 hover:text-gray-600 transition-colors ${['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical'].includes(modalType) ? 'absolute right-8' : ''}`}>

                                    <X size={20} />

                                </button>

                            </div>



                            {/* Modal Body */}

                            <div className="p-8 overflow-y-auto flex-1">

                                <form id="documentForm" onSubmit={handleSave} className="space-y-6">

                                    {modalType === 'basicDetails' && (

                                        <>

                                            {/* Company ID (Read-only) */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500">Company ID</label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="text"

                                                        value={modalData.companyId}

                                                        disabled

                                                        className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 cursor-not-allowed"

                                                    />

                                                </div>

                                            </div>

                                            {/* Name */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-medium text-gray-500">Company Name <span className="text-red-500">*</span></label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="text"

                                                        required

                                                        value={modalData.name}

                                                        onChange={(e) => setModalData({ ...modalData, name: e.target.value })}

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.name ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}

                                                    />

                                                    {modalErrors.name && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.name}</p>}

                                                </div>

                                            </div>



                                            {/* Nick Name */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-medium text-gray-500">Nick Name</label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="text"

                                                        value={modalData.nickName}

                                                        onChange={(e) => setModalData({ ...modalData, nickName: e.target.value })}

                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"

                                                        placeholder="Shorter name for internal use"

                                                    />

                                                </div>

                                            </div>



                                            {/* Email */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-medium text-gray-500">Email <span className="text-red-500">*</span></label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="email"

                                                        required

                                                        value={modalData.email}

                                                        onChange={(e) => setModalData({ ...modalData, email: e.target.value })}

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.email ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}

                                                    />

                                                    {modalErrors.email && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.email}</p>}

                                                </div>

                                            </div>



                                            {/* Phone */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-medium text-gray-500">Contact Number</label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="text"

                                                        value={modalData.phone}

                                                        onChange={(e) => setModalData({ ...modalData, phone: e.target.value })}

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.phone ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}

                                                    />

                                                    {modalErrors.phone && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.phone}</p>}

                                                </div>

                                            </div>



                                            {/* Established Date */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-medium text-gray-500">Establishment Date</label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        value={modalData.establishedDate}
                                                        onChange={(date) => setModalData({ ...modalData, establishedDate: date })}
                                                        className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.establishedDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}
                                                    />
                                                    {modalErrors.establishedDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.establishedDate}</p>}

                                                </div>

                                            </div>



                                            {/* Expiry Date */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-medium text-gray-500">Expiry Date</label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        value={modalData.expiryDate}
                                                        onChange={(date) => setModalData({ ...modalData, expiryDate: date })}
                                                        className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.expiryDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}
                                                    />
                                                    {modalErrors.expiryDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.expiryDate}</p>}

                                                </div>

                                            </div>

                                        </>

                                    )}



                                    {modalType === 'addMemo' && (
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    Document Name <span className="text-red-500">*</span>
                                                </label>
                                                <div className="w-2/3">
                                                    <input
                                                        type="text"
                                                        required
                                                        value={modalData.type || ''}
                                                        onChange={(e) => setModalData({ ...modalData, type: e.target.value })}
                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.type ? 'border-red-500' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`}
                                                        placeholder="Document name"
                                                    />
                                                    {modalErrors.type && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase">{modalErrors.type}</p>}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">Issue Date</label>
                                                <div className="w-2/3">
                                                    <DatePicker
                                                        value={modalData.issueDate}
                                                        onChange={(date) => setModalData({ ...modalData, issueDate: date })}
                                                        className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.issueDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`}
                                                    />
                                                    {modalErrors.issueDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase">{modalErrors.issueDate}</p>}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    Category <span className="text-red-500">*</span>
                                                </label>
                                                <div className="w-2/3">
                                                    <select
                                                        value={modalData.memoCategory || 'General'}
                                                        onChange={(e) => setModalData({ ...modalData, memoCategory: e.target.value })}
                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.memoCategory ? 'border-red-500' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`}
                                                    >
                                                        <option value="HR">HR</option>
                                                        <option value="Admin">Admin</option>
                                                        <option value="General">General</option>
                                                        <option value="Projects">Projects</option>
                                                    </select>
                                                    {modalErrors.memoCategory && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase">{modalErrors.memoCategory}</p>}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    Description <span className="text-red-500">*</span>
                                                </label>
                                                <div className="w-2/3">
                                                    <textarea
                                                        value={modalData.description || ''}
                                                        onChange={(e) => setModalData({ ...modalData, description: e.target.value })}
                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.description ? 'border-red-500' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all min-h-[90px]`}
                                                        placeholder="Enter memo description"
                                                    />
                                                    {modalErrors.description && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase">{modalErrors.description}</p>}
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-gray-100">
                                                <label className="text-sm font-bold text-gray-500 mb-3 block">Attachment <span className="text-red-500">*</span></label>
                                                {modalData.attachment ? (
                                                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                                        <span className="text-sm font-medium text-blue-700">File Attached</span>
                                                        <button type="button" onClick={() => setModalData({ ...modalData, attachment: null, fileName: '' })} className="text-blue-500 hover:text-blue-700"><X size={16} /></button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className={`w-full flex items-center justify-center gap-2 p-8 border-2 border-dashed ${modalErrors.attachment ? 'border-red-300 bg-red-50/10' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'} rounded-xl transition-all group`}
                                                    >
                                                        <Upload size={18} className="text-gray-400 group-hover:text-blue-500" />
                                                        <span className="text-sm font-medium text-gray-500 group-hover:text-blue-600">Upload Attachment</span>
                                                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />
                                                    </button>
                                                )}
                                                {modalErrors.attachment && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase text-center">{modalErrors.attachment}</p>}
                                            </div>
                                        </div>
                                    )}

                                    {modalType === 'establishmentCard' && (

                                        <div className="space-y-6">

                                            {/* Card Number */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500">

                                                    Card Number <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="text"

                                                        required

                                                        value={modalData.number}

                                                        onChange={(e) => setModalData({ ...modalData, number: e.target.value })}

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.number ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}

                                                        placeholder="e.g. 123456"

                                                    />

                                                    {modalErrors.number && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.number}</p>}

                                                </div>

                                            </div>







                                            {/* Expiry Date */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500">

                                                    Expiry Date <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        value={modalData.expiryDate}

                                                        onChange={(date) => setModalData({ ...modalData, expiryDate: date })}

                                                        className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.expiryDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}

                                                    />

                                                    {modalErrors.expiryDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.expiryDate}</p>}

                                                </div>

                                            </div>



                                            {/* Attachment */}

                                            <div className="pt-4 border-t border-gray-100">

                                                <div className="flex items-center justify-between mb-3">

                                                    <label className="text-sm font-bold text-gray-500">Attachment</label>

                                                </div>

                                                {modalData.attachment ? (

                                                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">

                                                        <span className="text-sm font-medium text-blue-700 truncate max-w-[200px]">Document Attached</span>

                                                        <button

                                                            type="button"

                                                            onClick={() => setModalData({ ...modalData, attachment: null })}

                                                            className="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-100 rounded-full transition-colors"

                                                        >

                                                            <X size={16} />

                                                        </button>

                                                    </div>

                                                ) : (

                                                    <>

                                                        <button

                                                            type="button"

                                                            onClick={() => fileInputRef.current?.click()}

                                                            className={`w-full flex items-center justify-center gap-2 p-8 border-2 border-dashed ${modalErrors.attachment ? 'border-red-300 bg-red-50/10' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'} rounded-xl transition-all group`}

                                                        >

                                                            <div className={`w-10 h-10 ${modalErrors.attachment ? 'bg-red-50' : 'bg-gray-50'} rounded-full flex items-center justify-center group-hover:scale-110 transition-transform`}>

                                                                <Upload size={18} className={`${modalErrors.attachment ? 'text-red-400' : 'text-gray-400 group-hover:text-blue-500'}`} />

                                                            </div>

                                                            <span className={`text-sm font-medium ${modalErrors.attachment ? 'text-red-500' : 'text-gray-500 group-hover:text-blue-600'}`}>Upload Establishment Card</span>

                                                            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />

                                                        </button>

                                                        {modalErrors.attachment && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight text-center">{modalErrors.attachment}</p>}

                                                    </>

                                                )}

                                            </div>

                                        </div>

                                    )}



                                    {modalType === 'tradeLicense' && (

                                        <div className="space-y-6">

                                            {/* License Number */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500">

                                                    License Number <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="text"

                                                        required

                                                        value={modalData.number}

                                                        onChange={(e) => setModalData({ ...modalData, number: e.target.value })}

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.number ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}

                                                        placeholder=""

                                                    />

                                                    {modalErrors.number && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.number}</p>}

                                                </div>

                                            </div>



                                            {/* Issue Date */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500">

                                                    Issue Date

                                                </label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        value={modalData.issueDate}

                                                        onChange={(date) => setModalData({ ...modalData, issueDate: date })}

                                                        className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.issueDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}

                                                    />

                                                    {modalErrors.issueDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.issueDate}</p>}

                                                </div>

                                            </div>



                                            {/* Expiry Date */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500">

                                                    Expiry Date <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        value={modalData.expiryDate}

                                                        onChange={(date) => setModalData({ ...modalData, expiryDate: date })}

                                                        className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.expiryDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}

                                                    />

                                                    {modalErrors.expiryDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.expiryDate}</p>}

                                                </div>

                                            </div>



                                            {/* Owners Section */}

                                            <div className="space-y-4 pt-4 border-t border-gray-100">

                                                <div className="flex items-center justify-between">

                                                    <div className="flex flex-col">

                                                        <label className="text-sm font-bold text-gray-500">Owners</label>

                                                        <p className="text-[10px] text-gray-400 font-bold italic mt-1">
                                                            For an active company, owner changes are queued for HR activation approval before they apply.
                                                        </p>



                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setModalType('selectEmployeeForOwner');
                                                                const owners = getUniqueOwners();
                                                                setModalData({ ...modalData, filteredOwners: owners, allOwners: owners });
                                                            }}
                                                            className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                                                        >
                                                            + Add Existing
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleAddOwner}
                                                            className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                                                        >
                                                            + Add Owner
                                                        </button>
                                                    </div>

                                                </div>

                                                <div className="space-y-3">

                                                    {modalData.owners?.map((owner, index) => (

                                                        <div key={index} className="flex gap-2 items-end">

                                                            <div className="flex-1">

                                                                <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">

                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Owner Name</label>

                                                                    <input

                                                                        type="text"

                                                                        placeholder="Enter name"

                                                                        value={owner.name}

                                                                        onChange={(e) => handleOwnerChange(index, "name", e.target.value)}

                                                                        className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-bold mt-0.5 text-gray-900"

                                                                    />

                                                                </div>

                                                            </div>

                                                            <div className="w-24">

                                                                <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">

                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter text-center block">Share %</label>

                                                                    <div className="relative mt-0.5">

                                                                        <input

                                                                            type="number"

                                                                            placeholder="0"

                                                                            value={owner.sharePercentage}

                                                                            onChange={(e) => handleOwnerChange(index, "sharePercentage", e.target.value)}

                                                                            className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-black text-center text-blue-600"

                                                                        />

                                                                        <span className="absolute right-[-4px] top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-300">%</span>

                                                                    </div>

                                                                </div>

                                                            </div>

                                                            <div className="pb-1">

                                                                <button

                                                                    type="button"

                                                                    onClick={() => handleRemoveOwner(index)}

                                                                    className="w-12 h-14 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"

                                                                    title="Delete Owner"

                                                                >

                                                                    <Trash2 size={18} />

                                                                </button>

                                                            </div>

                                                        </div>

                                                    ))}

                                                </div>

                                            </div>



                                            {/* Attachment */}

                                            <div className="pt-4 border-t border-gray-100">

                                                <div className="flex items-center justify-between mb-3">

                                                    <label className="text-sm font-bold text-gray-500">Attachment</label>

                                                </div>

                                                {modalData.attachment ? (

                                                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">

                                                        <span className="text-sm font-medium text-blue-700 truncate max-w-[200px]">Document Attached</span>

                                                        <button

                                                            type="button"

                                                            onClick={() => setModalData({ ...modalData, attachment: null })}

                                                            className="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-100 rounded-full transition-colors"

                                                        >

                                                            <X size={16} />

                                                        </button>

                                                    </div>

                                                ) : (

                                                    <>

                                                        <button

                                                            type="button"

                                                            onClick={() => fileInputRef.current?.click()}

                                                            className={`w-full flex items-center justify-center gap-2 p-8 border-2 border-dashed ${modalErrors.attachment ? 'border-red-300 bg-red-50/10' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'} rounded-xl transition-all group`}

                                                        >

                                                            <div className={`w-10 h-10 ${modalErrors.attachment ? 'bg-red-50' : 'bg-gray-50'} rounded-full flex items-center justify-center group-hover:scale-110 transition-transform`}>

                                                                <Upload size={18} className={`${modalErrors.attachment ? 'text-red-400' : 'text-gray-400 group-hover:text-blue-500'}`} />

                                                            </div>

                                                            <span className={`text-sm font-medium ${modalErrors.attachment ? 'text-red-500' : 'text-gray-500 group-hover:text-blue-600'}`}>Upload License Document</span>

                                                            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />

                                                        </button>

                                                        {modalErrors.attachment && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight text-center">{modalErrors.attachment}</p>}

                                                    </>

                                                )}

                                            </div>

                                        </div>

                                    )}





                                    {['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical'].includes(modalType) && (

                                        <div className="space-y-4">

                                            {/* Provider Row (Medical only) */}

                                            {modalType === 'ownerMedical' && (

                                                <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between">

                                                    <label className="text-sm font-medium text-gray-700">Provider <span className="text-red-500">*</span></label>

                                                    <input

                                                        type="text"

                                                        required

                                                        value={modalData.provider || ''}

                                                        onChange={(e) => setModalData({ ...modalData, provider: e.target.value })}

                                                        className={`w-2/3 px-4 py-2.5 bg-gray-50/50 border ${modalErrors.provider ? 'border-red-400 ring-2 ring-red-50' : 'border-gray-100'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all`}

                                                    />

                                                    {modalErrors.provider && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase absolute right-5 bottom-0">{modalErrors.provider}</p>}

                                                </div>

                                            )}



                                            {/* Number Box (Policy Number for Medical) */}

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between">

                                                <label className="text-sm font-medium text-gray-700">{modalType === 'ownerMedical' ? 'Policy Number' : 'Number'} <span className="text-red-500">*</span></label>

                                                <input

                                                    type="text"

                                                    required

                                                    value={modalData.number || ''}

                                                    onChange={(e) => setModalData({ ...modalData, number: e.target.value })}

                                                    className={`w-2/3 px-4 py-2.5 bg-gray-50/50 border ${modalErrors.number ? 'border-red-400 ring-2 ring-red-50' : 'border-gray-100'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all`}

                                                />

                                                {modalErrors.number && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase absolute right-5 bottom-0">{modalErrors.number}</p>}

                                            </div>



                                            {/* Issue Date Box (EID and Medical only) */}

                                            {['ownerEmiratesId', 'ownerMedical'].includes(modalType) && (

                                                <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between">

                                                    <label className="text-sm font-medium text-gray-700">Issue Date <span className="text-red-500">*</span></label>

                                                    <div className="w-2/3">

                                                        <DatePicker

                                                            required

                                                            maxDate={new Date()}

                                                            value={modalData.issueDate || ''}

                                                            onChange={(date) => setModalData({ ...modalData, issueDate: date })}

                                                            className={`w-full h-[41px] px-4 py-2.5 bg-gray-50/50 border ${modalErrors.issueDate ? 'border-red-400 ring-2 ring-red-50' : 'border-gray-100'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all`}

                                                        />

                                                        {modalErrors.issueDate && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase absolute right-5 bottom-0">{modalErrors.issueDate}</p>}

                                                    </div>

                                                </div>

                                            )}



                                            {/* Expiry Date Box */}

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between">

                                                <label className="text-sm font-medium text-gray-700">Expiry Date <span className="text-red-500">*</span></label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        required

                                                        minDate={modalData.issueDate || new Date()}

                                                        value={modalData.expiryDate || ''}

                                                        onChange={(date) => setModalData({ ...modalData, expiryDate: date })}

                                                        className={`w-full h-[41px] px-4 py-2.5 bg-gray-50/50 border ${modalErrors.expiryDate ? 'border-red-400 ring-2 ring-red-50' : 'border-gray-100'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all`}

                                                    />

                                                    {modalErrors.expiryDate && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase absolute right-5 bottom-0">{modalErrors.expiryDate}</p>}

                                                </div>

                                            </div>



                                            {/* Document Box */}

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl">

                                                <div className="flex items-center justify-between mb-4">

                                                    <label className="text-sm font-medium text-gray-700">Document <span className="text-red-500">*</span></label>

                                                    <div className="w-2/3">

                                                        {modalData.attachment ? (

                                                            <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-100 rounded-xl">

                                                                <span className="text-xs font-semibold text-blue-700 truncate max-w-[150px]">Document Attached</span>

                                                                <button onClick={() => setModalData({ ...modalData, attachment: null })} className="text-blue-500 hover:text-blue-700"><X size={14} /></button>

                                                            </div>

                                                        ) : (

                                                            <>

                                                                <button

                                                                    type="button"

                                                                    onClick={() => fileInputRef.current?.click()}

                                                                    className={`w-full flex items-center border ${modalErrors.attachment ? 'border-red-300' : 'border-gray-100'} bg-gray-50/50 rounded-xl overflow-hidden group`}

                                                                >

                                                                    <span className={`bg-white px-4 py-2.5 ${modalErrors.attachment ? 'text-red-500' : 'text-blue-500'} text-sm font-semibold border-r border-gray-100 hover:bg-gray-50 transition-colors`}>Choose File</span>

                                                                    <span className="px-4 text-xs text-gray-400 truncate flex-1 text-left">No file chosen</span>

                                                                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

                                                                </button>

                                                                {modalErrors.attachment && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase text-right">{modalErrors.attachment}</p>}

                                                            </>

                                                        )}

                                                    </div>

                                                </div>

                                                <div className="text-center w-full">

                                                    <p className="text-[10px] text-gray-400 font-medium tracking-tight">Upload file in PDF format only (Max 5MB)</p>

                                                </div>

                                            </div>

                                        </div>

                                    )}



                                    {modalType === 'ownerDetails' && (

                                        <div className="space-y-6">

                                            {/* Owner Name */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-wide">

                                                    Full Name <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="text"

                                                        required

                                                        value={modalData.name}

                                                        onChange={(e) => setModalData({ ...modalData, name: e.target.value })}

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.name ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}

                                                        placeholder="Enter owner full name"

                                                    />

                                                    {modalErrors.name && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.name}</p>}

                                                </div>

                                            </div>



                                            {/* Email */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-wide">

                                                    Email Address

                                                </label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="email"

                                                        value={modalData.email || ''}

                                                        onChange={(e) => setModalData({ ...modalData, email: e.target.value })}

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.email ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}

                                                        placeholder="office@owner.com"

                                                    />

                                                    {modalErrors.email && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.email}</p>}

                                                </div>

                                            </div>



                                            {/* Contact Number */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-wide">

                                                    Contact Number

                                                </label>

                                                <div className="w-2/3">

                                                    <PhoneInputField

                                                        defaultCountry="AE"

                                                        value={modalData.phone || ''}

                                                        onChange={(value) => setModalData({ ...modalData, phone: value })}

                                                        placeholder="Contact Number"

                                                        disabled={false}

                                                    />

                                                </div>

                                            </div>



                                            {/* Nationality */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-wide">

                                                    Nationality

                                                </label>

                                                <div className="w-2/3">

                                                    <select

                                                        value={modalData.nationality || ''}

                                                        onChange={(e) => setModalData({ ...modalData, nationality: e.target.value })}

                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700"

                                                    >

                                                        <option value="">Select Nationality</option>

                                                        {Country.getAllCountries().map(c => (

                                                            <option key={c.isoCode} value={c.name}>{c.name}</option>

                                                        ))}

                                                    </select>

                                                </div>

                                            </div>



                                            {/* Share Percentage */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-wide">

                                                    Share % <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3 relative">

                                                    <input

                                                        type="number"

                                                        required

                                                        value={modalData.sharePercentage}

                                                        onChange={(e) => setModalData({ ...modalData, sharePercentage: e.target.value })}

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.percentage ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}

                                                        placeholder="e.g. 50"

                                                    />

                                                    {modalErrors.percentage && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.percentage}</p>}

                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>

                                                </div>

                                            </div>

                                        </div>

                                    )}



                                    {['ownerPassport', 'ownerVisa', 'ownerDrivingLicense'].includes(modalType) && (

                                        <div className="space-y-6">

                                            {/* Document Number */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-medium text-gray-500">

                                                    {modalType === 'ownerPassport' ? 'Passport Number' : (modalType === 'ownerVisa' ? 'Visa Number' : 'Doc Number')} <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="text"

                                                        required

                                                        value={modalData.number || ''}

                                                        onChange={(e) => setModalData({ ...modalData, number: e.target.value })}

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.number ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700`}

                                                        placeholder={`Enter ${modalType === 'ownerPassport' ? 'passport' : 'document'} number`}

                                                    />

                                                    {modalErrors.number && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.number}</p>}

                                                </div>

                                            </div>





                                            {modalType === 'ownerPassport' && (

                                                <div className="flex items-center gap-6">

                                                    <label className="w-1/3 text-sm font-medium text-gray-500">Passport Nationality <span className="text-red-500">*</span></label>

                                                    <div className="w-2/3">

                                                        <select

                                                            required

                                                            value={modalData.nationality || ''}

                                                            onChange={(e) => setModalData({ ...modalData, nationality: e.target.value })}

                                                            className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.nationality ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700`}

                                                        >

                                                            <option value="">Select Nationality</option>

                                                            {Country.getAllCountries().map(c => (

                                                                <option key={c.isoCode} value={c.name}>{c.name}</option>

                                                            ))}

                                                        </select>

                                                        {modalErrors.nationality && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.nationality}</p>}

                                                    </div>

                                                </div>

                                            )}



                                            {['ownerPassport', 'ownerVisa', 'ownerDrivingLicense'].includes(modalType) && (

                                                <div className="flex items-center gap-6">

                                                    <label className="w-1/3 text-sm font-medium text-gray-500">Issue Date <span className="text-red-500">*</span></label>

                                                    <div className="w-2/3">

                                                        <DatePicker

                                                            required

                                                            maxDate={new Date()}

                                                            value={modalData.issueDate || ''}

                                                            onChange={(date) => setModalData({ ...modalData, issueDate: date })}

                                                            className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.issueDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700`}

                                                        />

                                                        {modalErrors.issueDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.issueDate}</p>}

                                                    </div>

                                                </div>

                                            )}



                                            {/* Expiry Date */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-medium text-gray-500">Expiry Date <span className="text-red-500">*</span></label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        required

                                                        minDate={modalData.issueDate || new Date()}

                                                        value={modalData.expiryDate || ''}

                                                        onChange={(date) => setModalData({ ...modalData, expiryDate: date })}

                                                        className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.expiryDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700`}

                                                    />

                                                    {modalErrors.expiryDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.expiryDate}</p>}

                                                </div>

                                            </div>



                                            {modalType === 'ownerPassport' && (

                                                <div className="flex items-center gap-6">

                                                    <label className="w-1/3 text-sm font-medium text-gray-500">Country of Issue <span className="text-red-500">*</span></label>

                                                    <div className="w-2/3">

                                                        <select

                                                            required

                                                            value={modalData.countryOfIssue || ''}

                                                            onChange={(e) => setModalData({ ...modalData, countryOfIssue: e.target.value })}

                                                            className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.countryOfIssue ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700`}

                                                        >

                                                            <option value="">Select Country</option>

                                                            {Country.getAllCountries().map(c => (

                                                                <option key={c.isoCode} value={c.name}>{c.name}</option>

                                                            ))}

                                                        </select>

                                                        {modalErrors.countryOfIssue && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.countryOfIssue}</p>}

                                                    </div>

                                                </div>

                                            )}



                                            {modalType === 'ownerVisa' && !['Visiting', 'Visit'].includes(modalData.type) && (

                                                <div className="flex items-center gap-6">

                                                    <label className="w-1/3 text-sm font-medium text-gray-500">Visa Sponsor <span className="text-red-500">*</span></label>

                                                    <div className="w-2/3">

                                                        <input

                                                            type="text"

                                                            required

                                                            value={modalData.sponsor || ''}

                                                            onChange={(e) => setModalData({ ...modalData, sponsor: e.target.value })}

                                                            className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.sponsor ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700`}

                                                            placeholder="Enter visa sponsor"

                                                        />

                                                        {modalErrors.sponsor && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.sponsor}</p>}

                                                    </div>

                                                </div>

                                            )}



                                            {/* Attachment */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-tight">{modalType === 'ownerPassport' ? 'Passport Copy' : 'Attachment'}</label>

                                                <div className="w-2/3">

                                                    {modalData.attachment ? (

                                                        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">

                                                            <div className="flex items-center gap-2 overflow-hidden">

                                                                <FileText size={16} className="text-blue-500 shrink-0" />

                                                                <span className="text-sm font-semibold text-blue-700 truncate">Document Attached</span>

                                                            </div>

                                                            <button

                                                                type="button"

                                                                onClick={() => setModalData({ ...modalData, attachment: null })}

                                                                className="p-1 hover:bg-blue-100 rounded-lg text-blue-500 transition-all"

                                                            >

                                                                <X size={16} />

                                                            </button>

                                                        </div>

                                                    ) : (

                                                        <>

                                                            <button

                                                                type="button"

                                                                onClick={() => fileInputRef.current?.click()}

                                                                className={`w-full border-2 border-dashed ${modalErrors.attachment ? 'border-red-300 bg-red-50/10' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/20'} rounded-xl p-8 flex flex-col items-center justify-center gap-2 transition-all group`}

                                                            >

                                                                <Upload className={`${modalErrors.attachment ? 'text-red-400' : 'text-gray-300 group-hover:text-blue-500'} transition-all`} />

                                                                <span className={`text-sm font-semibold ${modalErrors.attachment ? 'text-red-500' : 'text-gray-400 group-hover:text-blue-600'}`}>Click to upload document</span>

                                                                <input

                                                                    ref={fileInputRef}

                                                                    type="file"

                                                                    className="hidden"

                                                                    onChange={handleFileChange}

                                                                />

                                                            </button>

                                                            {modalErrors.attachment && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight text-center">{modalErrors.attachment}</p>}

                                                        </>

                                                    )}

                                                </div>

                                            </div>

                                        </div>

                                    )}



                                    {['companyDocument', 'addNewCategory', 'addEjari', 'addInsurance'].includes(modalType) && (

                                        <div className="space-y-6">

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">

                                                    {modalData.context === 'ejari' ? 'Ejari Type' :

                                                        modalData.context === 'insurance' ? 'Insurance Type' :

                                                            'Document Type'} <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="text"

                                                        required

                                                        value={modalData.type || ''}

                                                        onChange={(e) => setModalData({ ...modalData, type: e.target.value })}

                                                        placeholder={

                                                            modalData.context === 'ejari' ? 'e.g. Office Rental, Warehouse Lease...' :

                                                                modalData.context === 'insurance' ? 'e.g. Health Insurance, Property Insurance...' :

                                                                    'e.g. VAT Certificate, Rental Agreement...'

                                                        }

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.type ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}

                                                    />

                                                    {modalErrors.type && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.type}</p>}

                                                </div>

                                            </div>

                                            {!(modalData.context === 'ejari' || modalData.context === 'insurance') && (
                                                <div className="flex items-center gap-6">
                                                    <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">
                                                        Has Expiry Date? <span className="text-red-500">*</span>
                                                    </label>
                                                    <div className="w-2/3 flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setModalData({ ...modalData, hasExpiry: true })}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${modalData.hasExpiry !== false ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                                        >
                                                            Yes
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setModalData({ ...modalData, hasExpiry: false, expiryDate: '' })}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${modalData.hasExpiry === false ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                                        >
                                                            No
                                                        </button>
                                                    </div>
                                                </div>
                                            )}



                                            {((modalData.type?.toLowerCase().includes('insur') || modalData.type?.toLowerCase().includes('ejar'))) && modalType !== 'addNewCategory' ? (

                                                <>

                                                    {modalData.type?.toLowerCase().includes('insur') && (

                                                        <div className="flex items-center gap-6">

                                                            <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">Provider</label>

                                                            <div className="w-2/3">

                                                                <input

                                                                    type="text"

                                                                    value={modalData.provider || ''}

                                                                    onChange={(e) => setModalData({ ...modalData, provider: e.target.value })}

                                                                    placeholder="e.g. AXA, Oman Insurance..."

                                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"

                                                                />

                                                            </div>

                                                        </div>

                                                    )}



                                                    {/* Issue Date (for Ejari and Insurance) */}

                                                    <div className="flex items-center gap-6">

                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">

                                                            Issue Date <span className="text-red-500">*</span>

                                                        </label>

                                                        <div className="w-2/3">

                                                            <DatePicker

                                                                required

                                                                maxDate={new Date()} // Cannot be in the future

                                                                value={modalData.startDate || ''}

                                                                onChange={(date) => setModalData({ ...modalData, startDate: date })}

                                                                className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.issueDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}

                                                            />

                                                            {modalErrors.issueDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.issueDate}</p>}

                                                        </div>

                                                    </div>



                                                    {/* Expiry Date (for Ejari and Insurance) */}

                                                    <div className="flex items-center gap-6">

                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">

                                                            Expiry Date <span className="text-red-500">*</span>

                                                        </label>

                                                        <div className="w-2/3">

                                                            <DatePicker
                                                                required
                                                                minDate={modalData.startDate || new Date()} // Must be after issue date
                                                                value={modalData.expiryDate || ''}
                                                                onChange={(date) => setModalData({ ...modalData, expiryDate: date })}
                                                                className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.expiryDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}
                                                            />
                                                            {modalErrors.expiryDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.expiryDate}</p>}

                                                        </div>

                                                    </div>

                                                </>

                                            ) : null}



                                            {!['moa', 'legal document with expiry', 'legal document without expiry'].includes(modalData.type?.toLowerCase()) && (

                                                <div className="flex items-center gap-6">

                                                    <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">Add Value? <span className="text-red-500">*</span></label>

                                                    <div className="w-2/3 flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setModalData({ ...modalData, hasValue: true })}
                                                            className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                                                                modalData.hasValue !== false
                                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                                    : 'bg-white text-gray-600 border-gray-300'
                                                            }`}
                                                        >
                                                            Yes
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setModalData({ ...modalData, hasValue: false, value: '' })}
                                                            className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                                                                modalData.hasValue === false
                                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                                    : 'bg-white text-gray-600 border-gray-300'
                                                            }`}
                                                        >
                                                            No
                                                        </button>
                                                    </div>

                                                </div>

                                            )}

                                            {!['moa', 'legal document with expiry', 'legal document without expiry'].includes(modalData.type?.toLowerCase()) && modalData.hasValue !== false && (

                                                <div className="flex items-center gap-6">

                                                    <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">Value (AED)</label>

                                                    <div className="w-2/3">

                                                        <input

                                                            type="number"

                                                            min="0"

                                                            step="0.01"

                                                            value={modalData.value || ''}

                                                            onChange={(e) => setModalData({ ...modalData, value: e.target.value })}

                                                            onKeyPress={(e) => {

                                                                // Only allow numbers and decimal point

                                                                if (!/[0-9.]/.test(e.key)) {

                                                                    e.preventDefault();

                                                                }

                                                            }}

                                                            placeholder="Enter document value"

                                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"

                                                        />

                                                    </div>

                                                </div>

                                            )}





                                            {/* Note field - hidden for Ejari and Insurance */}

                                            {true && (

                                                <div className="flex items-center gap-6">

                                                    <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-tight">Note</label>

                                                    <div className="w-2/3">

                                                        <textarea

                                                            value={modalData.description || ''}

                                                            onChange={(e) => setModalData({ ...modalData, description: e.target.value })}

                                                            placeholder="Add any notes here..."

                                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700 min-h-[100px]"

                                                        />

                                                    </div>

                                                </div>

                                            )}





                                            {/* Date Fields - Controlled by context */}

                                            {!(modalData.type?.toLowerCase().includes('insur') || modalData.type?.toLowerCase().includes('ejar')) && (

                                                <div className="flex items-center gap-6">

                                                    <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-tight">

                                                        Issue Date <span className="text-gray-400 font-normal text-xs ml-1">(Optional)</span>

                                                    </label>

                                                    <div className="w-2/3">

                                                        <DatePicker

                                                            maxDate={new Date()} // Cannot be in the future

                                                            value={modalData.issueDate || ''}

                                                            onChange={(date) => setModalData({ ...modalData, issueDate: date })}

                                                            className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.issueDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}

                                                        />

                                                        {modalErrors.issueDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.issueDate}</p>}

                                                    </div>

                                                </div>

                                            )}



                                            {/* Expiry Date for other documents (not Ejari/Insurance/MOA/No-Expiry) */}

                                            {!(modalData.type?.toLowerCase().includes('insur') || modalData.type?.toLowerCase().includes('ejar')) &&

                                                !modalData.type?.toLowerCase().includes('without expiry') &&

                                                !modalData.type?.toLowerCase().includes('moa') &&

                                                modalData.context !== 'document_without_expiry' &&

                                                modalData.context !== 'moa' &&
                                                modalData.hasExpiry !== false && (

                                                    <div className="flex items-center gap-6">

                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">

                                                            Expiry Date <span className="text-red-500">*</span>

                                                        </label>

                                                        <div className="w-2/3">

                                                            <DatePicker

                                                                required

                                                                minDate={modalData.issueDate || new Date()} // Must be after issue date

                                                                value={modalData.expiryDate || ''}

                                                                onChange={(date) => setModalData({ ...modalData, expiryDate: date })}

                                                                className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.expiryDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}

                                                            />

                                                            {modalErrors.expiryDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.expiryDate}</p>}

                                                        </div>

                                                    </div>

                                                )}



                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-tight">Attachment</label>

                                                <div className="w-2/3">

                                                    {modalData.attachment ? (

                                                        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">

                                                            <div className="flex items-center gap-2 overflow-hidden">

                                                                <FileText size={16} className="text-blue-500 shrink-0" />

                                                                <span className="text-sm font-semibold text-blue-700 truncate">Document Attached</span>

                                                            </div>

                                                            <button

                                                                type="button"

                                                                onClick={() => setModalData({ ...modalData, attachment: null })}

                                                                className="p-1 hover:bg-blue-100 rounded-lg text-blue-500 transition-all"

                                                            >

                                                                <X size={16} />

                                                            </button>

                                                        </div>

                                                    ) : (

                                                        <button

                                                            type="button"

                                                            onClick={() => fileInputRef.current?.click()}

                                                            className="w-full border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center gap-2 hover:border-blue-300 hover:bg-blue-50/20 transition-all group"

                                                        >

                                                            <Upload className="text-gray-300 group-hover:text-blue-500 transition-all" />

                                                            <span className="text-sm font-semibold text-gray-400 group-hover:text-blue-600">Click to upload document</span>

                                                            <input

                                                                ref={fileInputRef}

                                                                type="file"

                                                                className="hidden"

                                                                onChange={handleFileChange}

                                                            />

                                                        </button>

                                                    )}

                                                </div>

                                            </div>

                                        </div>

                                    )}



                                    {modalType === 'addCustomResponsibility' && (

                                        <div className="space-y-6">

                                            <div className="flex flex-col gap-2">

                                                <label className="text-sm font-bold text-gray-500 uppercase">Category Name</label>

                                                <input

                                                    type="text"

                                                    required

                                                    value={modalData.category || ''}

                                                    onChange={(e) => setModalData({ ...modalData, category: e.target.value })}

                                                    placeholder="e.g. IT Manager, Safety Officer..."

                                                    className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.category ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}

                                                />

                                                {modalErrors.category && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.category}</p>}

                                            </div>

                                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">

                                                <p className="text-xs text-blue-700 font-medium leading-relaxed">

                                                    After defining the category, you will be prompted to assign an employee to it.

                                                </p>

                                            </div>

                                            <div className="flex justify-end">

                                                <button

                                                    type="button"

                                                    onClick={() => {

                                                        if (!modalData.category) {

                                                            setModalErrors({ category: "Category name is required" });

                                                            toast({ title: "Required", description: "Please enter a category name", variant: "destructive" });

                                                            return;

                                                        }

                                                        setModalErrors({});

                                                        setSelectedCategory(modalData.category);

                                                        setModalType('assignEmployee');

                                                        setModalData({});

                                                    }}

                                                    className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 flex items-center gap-2 hover:bg-blue-700 transition-all"

                                                >

                                                    Next: Assign Employee <ArrowRight size={18} />

                                                </button>

                                            </div>

                                        </div>

                                    )}



                                    {modalType === 'assignEmployee' && (

                                        <div className="space-y-6">

                                            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-4">

                                                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm capitalize">
                                                    {selectedCategory?.charAt(0)}
                                                </div>

                                                <div className="flex flex-col">

                                                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Assigning for</span>

                                                    <span className="text-sm font-bold text-blue-700 capitalize">{selectedCategory?.replace(/([A-Z])/g, ' $1').trim()}</span>

                                                </div>

                                            </div>



                                            <div className="flex flex-col gap-2">

                                                <label className="text-sm font-bold text-gray-500">Search & Select Employee</label>

                                                <div className="relative">

                                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />

                                                    <input

                                                        type="text"

                                                        placeholder="Search by name or ID..."

                                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"

                                                        onChange={(e) => {

                                                            const query = e.target.value.toLowerCase();

                                                            const filtered = allEmployees.filter(emp =>

                                                                `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(query) ||

                                                                emp.employeeId?.toLowerCase().includes(query)

                                                            );

                                                            setModalData({ ...modalData, filteredEmployees: filtered });

                                                        }}

                                                    />

                                                </div>

                                            </div>



                                            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">

                                                {(modalData.filteredEmployees || allEmployees).length === 0 ? (

                                                    <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">

                                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-gray-300 mx-auto mb-3 shadow-sm">

                                                            <Search size={24} />

                                                        </div>

                                                        <p className="text-sm font-bold text-gray-500">No Eligible Employees Found</p>

                                                        <p className="text-xs text-gray-400 mt-1">Try searching by name or ID, or ensure employees are assigned to this company.</p>

                                                    </div>

                                                ) : (

                                                    (modalData.filteredEmployees || allEmployees).map((emp) => {

                                                        const isAlreadyAssigned = (responsibilities || []).some(r => r.empObjectId === emp._id && r.category === selectedCategory);

                                                        const isSystemUser = allUsers.some(u => u.employeeId === emp.employeeId);

                                                        const hasCompanyEmail = !!emp.companyEmail;

                                                        const isEligible = isSystemUser && hasCompanyEmail;



                                                        return (

                                                            <button

                                                                key={emp._id}

                                                                type="button"

                                                                disabled={isAlreadyAssigned || isSubmitting || !isEligible}

                                                                onClick={async () => {

                                                                    if (isAlreadyAssigned || !isEligible) return;

                                                                    const newResp = {

                                                                        category: selectedCategory,

                                                                        employeeId: emp.employeeId,

                                                                        employeeName: `${emp.firstName} ${emp.lastName}`,

                                                                        designation: emp.designation?.name || emp.designation || 'N/A',

                                                                        empObjectId: emp._id

                                                                    };

                                                                    const updatedResps = [...responsibilities, newResp];

                                                                    setResponsibilities(updatedResps);

                                                                    handleModalClose();



                                                                    try {

                                                                        setIsSubmitting(true);

                                                                        await axiosInstance.patch(`/Company/${companyId}`, { responsibilities: updatedResps });

                                                                        toast({ title: "Success", description: `${emp.firstName} assigned to ${selectedCategory}` });

                                                                        fetchCompany();

                                                                    } catch (err) {

                                                                        console.error('Error assigning responsibility:', err);

                                                                        toast({ title: "Error", description: err.response?.data?.message || "Failed to save responsibility", variant: "destructive" });

                                                                    } finally {

                                                                        setIsSubmitting(false);

                                                                    }

                                                                }}

                                                                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all group border ${isAlreadyAssigned || !isEligible

                                                                    ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'

                                                                    : 'bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-200 shadow-sm'}`}

                                                            >

                                                                <div className="flex items-center gap-3">

                                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm text-sm ${isAlreadyAssigned || !isEligible ? 'bg-gray-200 text-gray-400' : 'bg-blue-50 text-blue-600'}`}>

                                                                        {emp.firstName?.charAt(0)}

                                                                    </div>

                                                                    <div className="flex flex-col text-left">

                                                                        <div className="flex items-center gap-2">

                                                                            <span className={`text-sm font-bold ${isAlreadyAssigned || !isEligible ? 'text-gray-400' : 'text-gray-700'}`}>{emp.firstName} {emp.lastName}</span>

                                                                            {!hasCompanyEmail && !isAlreadyAssigned && (

                                                                                <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 uppercase">No Co. Email</span>

                                                                            )}

                                                                            {!isSystemUser && !isAlreadyAssigned && (

                                                                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase">Not a User</span>

                                                                            )}

                                                                        </div>

                                                                        <span className="text-[11px] text-gray-400 font-medium">{emp.designation?.name || emp.designation || 'N/A'} • {emp.companyName}</span>

                                                                    </div>

                                                                </div>

                                                                {isAlreadyAssigned ? (

                                                                    <span className="text-[10px] font-bold text-orange-400 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100 uppercase tracking-wider">Already Assigned</span>

                                                                ) : !isEligible ? (

                                                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200 uppercase tracking-wider">Ineligible</span>

                                                                ) : (

                                                                    <span className="text-xs font-bold text-gray-300 group-hover:text-blue-500">Select</span>

                                                                )}

                                                            </button>

                                                        );

                                                    })

                                                )}

                                            </div>

                                        </div>

                                    )}





                                </form>

                            </div>



                            {modalType === 'selectEmployeeForOwner' && (
                                <div className="space-y-6">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-bold text-gray-500">Pick Existing Owner</label>
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Search owners..."
                                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                onChange={(e) => {
                                                    const query = e.target.value.toLowerCase();
                                                    const filtered = (modalData.allOwners || []).filter(o =>
                                                        o.name?.toLowerCase().includes(query) ||
                                                        o.fromCompany?.toLowerCase().includes(query)
                                                    );
                                                    setModalData({ ...modalData, filteredOwners: filtered });
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                        {(modalData.filteredOwners || []).length === 0 ? (
                                            <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                                <p className="text-sm font-bold text-gray-500">No Existing Owners Found</p>
                                            </div>
                                        ) : (
                                            (modalData.filteredOwners || []).map((owner, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                        const currentOwners = modalData.owners || [];
                                                        const newCount = currentOwners.length + 1;
                                                        const equalShare = (100 / newCount).toFixed(2);

                                                        const newOwner = {
                                                            ...owner,
                                                            sharePercentage: equalShare,
                                                            isNew: true,
                                                        };
                                                        delete newOwner._id;
                                                        delete newOwner.fromCompany;

                                                        const updatedOwners = currentOwners.map(o => ({
                                                            ...o,
                                                            sharePercentage: equalShare
                                                        }));

                                                        setModalData({
                                                            ...modalData,
                                                            owners: [...updatedOwners, newOwner],
                                                            filteredOwners: null
                                                        });
                                                        setModalType('tradeLicense');
                                                    }}
                                                    className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-sm text-sm">
                                                            {owner.name?.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col text-left">
                                                            <span className="text-sm font-bold text-gray-700">{owner.name}</span>
                                                            <span className="text-[11px] text-gray-400 font-medium">From: {owner.fromCompany}</span>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-300 group-hover:text-blue-500">Pick</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Modal Footer */}

                            {modalType !== 'ownerVisaTypeSelection' && modalType !== 'assignEmployee' && (

                                <div className={`px-8 py-6 border-t border-gray-100 flex items-center ${['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical'].includes(modalType) ? 'justify-end' : 'justify-end'} gap-4`}>

                                    <button

                                        onClick={handleModalClose}

                                        className={`px-6 py-2.5 text-sm font-semibold ${['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical'].includes(modalType) ? 'text-red-500 hover:text-red-600' : 'text-red-500 hover:text-red-600 hover:bg-red-50'} rounded-xl transition-all`}

                                        type="button"

                                    >

                                        Cancel

                                    </button>

                                    <button

                                        form="documentForm"

                                        type="submit"

                                        disabled={isSubmitting}

                                        className={`px-12 py-2.5 ${['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical'].includes(modalType) ? 'bg-[#5174FF] hover:bg-[#4063FF] rounded-xl' : 'bg-blue-600 hover:bg-blue-700 rounded-xl'} text-white text-sm font-semibold shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 flex items-center gap-2`}

                                    >

                                        {isSubmitting ? 'Updating...' : (modalType.startsWith('owner') || modalType === 'addNewCategory' ? 'Save' : 'Update')}

                                    </button>

                                </div>

                            )}

                        </div>

                    </div >

                )

                }



                {activationSubmitModalOpen && (
                    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">
                                        {viewerIsDesignatedFlowchartHr ? 'Activate company' : 'Submit for Approval'}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {viewerIsDesignatedFlowchartHr
                                            ? 'As designated Flowchart HR, confirming activates this company immediately (no separate approval queue).'
                                            : 'Select requested changes and submit for approval.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActivationSubmitModalOpen(false)}
                                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="px-6 py-5 space-y-4">
                                {!viewerIsDesignatedFlowchartHr && (
                                    <>
                                        {pendingCompanyDisplayGroups.length > 0 ? (
                                            <div className="space-y-2">
                                                <p className="text-xs text-gray-500 leading-snug">
                                                    Check a row to send it to HR with this request. Unchecked rows are
                                                    removed from the reactivation queue when you submit. Use View to
                                                    compare current versus edited fields.
                                                </p>
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-sm font-semibold text-gray-700">
                                                        Requested Changes
                                                    </div>
                                                    <label className="inline-flex items-center gap-2 text-xs text-gray-600 shrink-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={activationSubmitAllRowsSelected}
                                                            onChange={toggleActivationSubmitSelectAll}
                                                        />
                                                        Select all
                                                    </label>
                                                </div>
                                                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                                                    {pendingCompanyDisplayGroups.map((group) => {
                                                        const groupFullySelected =
                                                            group.ids.length > 0 &&
                                                            group.ids.every((id) =>
                                                                activationSubmitSelectedEntryIds.includes(String(id)),
                                                            );
                                                        return (
                                                            <div
                                                                key={group.key}
                                                                className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                                                            >
                                                                <div className="flex items-center justify-between px-3 py-2 gap-2">
                                                                    <label className="inline-flex items-center gap-2 flex-1 min-w-0">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={groupFullySelected}
                                                                            onChange={() =>
                                                                                toggleActivationSubmitGroupSelection(
                                                                                    group.ids,
                                                                                )
                                                                            }
                                                                        />
                                                                        <span
                                                                            className="text-sm text-gray-800 truncate"
                                                                            title={group.displayLabel}
                                                                        >
                                                                            {group.displayLabel}
                                                                        </span>
                                                                    </label>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const entry = group.representativeEntry;
                                                                            handleViewCompanyRequestedChange(entry.card);
                                                                            setViewingCompanyChange(entry);
                                                                        }}
                                                                        className="text-xs font-semibold text-blue-700 hover:underline shrink-0"
                                                                    >
                                                                        View
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                                                No queued change rows yet. Complete and save edits on company cards until they
                                                appear here, then describe anything else HR should know below.
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setActivationSubmitModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmitForActivation}
                                    disabled={activationSubmitting}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {activationSubmitting
                                        ? 'Submitting...'
                                        : viewerIsDesignatedFlowchartHr
                                          ? 'Activate now'
                                          : 'Submit for Approval'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activationReviewModalOpen && (
                    <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Activation Request Review</h3>
                                    <p className="text-sm text-gray-500">
                                        Requested message for HR action.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActivationReviewModalOpen(false);
                                        setActivationSelectedChangeIds([]);
                                        setActivationRowNotesByGroupKey({});
                                        setActivationRejectReason('');
                                    }}
                                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="px-6 py-5 space-y-4">
                                {!isDirectHrAction && (
                                    <>
                                        {(!activationHrSubmission?.reason?.trim() && !activationHrSubmission?.description?.trim()) ? (
                                            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
                                                <p className="text-sm text-blue-800 font-medium italic">
                                                    You are reviewing pending changes as an HR administrator. You can directly approve these changes below.
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="space-y-1">
                                                    <div className="text-sm font-semibold text-gray-700">Activation Type</div>
                                                    <div className="text-sm text-gray-800 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 whitespace-pre-wrap">
                                                        {activationHrSubmission?.type?.trim() ? activationHrSubmission.type : '---'}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}

                                {!isDirectHrAction && activationHrSubmission?.attachment?.trim() ? (
                                    <div className="space-y-1">
                                        <div className="text-sm font-semibold text-gray-700">Attachment</div>
                                        <a
                                            href={activationHrSubmission.attachment}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm text-blue-700 font-semibold hover:underline break-all"
                                        >
                                            View attachment
                                        </a>
                                    </div>
                                ) : null}
                                {pendingCompanyChanges.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm font-semibold text-gray-700">Requested Changes</div>
                                            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                                                <input
                                                    type="checkbox"
                                                    checked={allCompanyChangesSelected}
                                                    onChange={toggleAllCompanyChanges}
                                                />
                                                Select all
                                            </label>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Unchecked rows require per-item instructions below — visible to the submitter on hold and in email.
                                        </p>
                                        <div className="space-y-2">
                                            {pendingCompanyDisplayGroups.map((group) => {
                                                const groupFullySelected =
                                                    group.ids.length > 0 &&
                                                    group.ids.every((id) => activationSelectedChangeIds.includes(id));
                                                return (
                                                    <div
                                                        key={group.key}
                                                        className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                                                    >
                                                        <div className="flex items-center justify-between px-3 py-2 gap-2">
                                                            <label className="inline-flex items-center gap-2 flex-1 min-w-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={groupFullySelected}
                                                                    onChange={() => toggleCompanyChangeGroupSelection(group.ids)}
                                                                />
                                                                <span
                                                                    className="text-sm text-gray-800 truncate"
                                                                    title={group.displayLabel}
                                                                >
                                                                    {group.displayLabel}
                                                                </span>
                                                            </label>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const entry = group.representativeEntry;
                                                                    handleViewCompanyRequestedChange(entry.card);
                                                                    setViewingCompanyChange(entry);
                                                                }}
                                                                className="text-xs font-semibold text-blue-700 hover:underline shrink-0"
                                                            >
                                                                View
                                                            </button>
                                                        </div>
                                                        {!groupFullySelected ? (
                                                            <div className="px-3 pb-2.5 pt-1 border-t border-gray-100 bg-slate-50/70">
                                                                <label className="text-xs font-semibold text-gray-600 block mb-1">
                                                                    Instructions for unchecked item <span className="text-red-500">*</span>
                                                                </label>
                                                                <textarea
                                                                    value={activationRowNotesByGroupKey[group.key] || ''}
                                                                    onChange={(e) =>
                                                                        setActivationRowNotesByGroupKey((prev) => ({
                                                                            ...prev,
                                                                            [group.key]: e.target.value,
                                                                        }))
                                                                    }
                                                                    placeholder="What should be fixed for this section (mandatory) — emailed to submitter if you use Hold"
                                                                    rows={2}
                                                                    className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y min-h-[56px]"
                                                                />
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {queuedCompanyChangeIdCount > 0 && !allCompanyChangesSelected && (
                                    <p className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                        <span className="font-semibold">Accept</span> is only available when every requested change is checked.
                                        Use <span className="font-semibold">Hold</span> to send unchecked items back (you can leave all unchecked to return everything).
                                        <span className="font-semibold"> Reject</span> requires the description below.
                                    </p>
                                )}

                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-gray-700">
                                        Rejection Description <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={activationRejectReason}
                                        onChange={(e) => setActivationRejectReason(e.target.value)}
                                        placeholder="Please provide a reason for rejection..."
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[96px]"
                                    />
                                    <p className="text-xs text-gray-500">
                                        Mandatory when rejecting this activation request.
                                    </p>
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleActivationDecision('approve');
                                    }}
                                    disabled={
                                        activationDecisionLoading ||
                                        (queuedCompanyChangeIdCount > 0 &&
                                            !allCompanyChangesSelected)
                                    }
                                    className="px-4 py-2 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={
                                        queuedCompanyChangeIdCount > 0 && !allCompanyChangesSelected
                                            ? 'Select every row to fully activate, or use Hold'
                                            : undefined
                                    }
                                >
                                    Accept
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleActivationDecision('hold')}
                                    disabled={activationDecisionLoading || !holdEnabledForActivationReview}
                                    title={
                                        holdEnabledForActivationReview
                                            ? 'Return unchecked items to the submitter (checked rows are treated as HR-approved for this step)'
                                            : queuedCompanyChangeIdCount === 0
                                              ? ''
                                              : 'Check every row to use Accept, or uncheck at least one to use Hold'
                                    }
                                    className="px-4 py-2 rounded-xl border border-amber-200 text-amber-900 text-sm font-semibold hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Hold
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleActivationDecision('reject', activationRejectReason);
                                    }}
                                    disabled={activationDecisionLoading || !activationRejectReasonTrimmed}
                                    title={
                                        activationRejectReasonTrimmed
                                            ? 'Reject this activation request'
                                            : 'Enter a rejection description to enable Reject'
                                    }
                                    className="px-4 py-2 rounded-xl border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Reject
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActivationReviewModalOpen(false);
                                        setActivationSelectedChangeIds([]);
                                        setActivationRowNotesByGroupKey({});
                                        setActivationRejectReason('');
                                    }}
                                    className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50"
                                    disabled={activationDecisionLoading}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {viewingCompanyChange && (() => {
                    const prevSource = companyRows(getCompanyReviewData(viewingCompanyChange, 'previous'));
                    const propSource = companyRows(getCompanyReviewData(viewingCompanyChange, 'proposed'));
                    const { prevRows: coPrevRows, propRows: coPropRows } =
                        filterCompanyReviewRowsToChangesOnly(prevSource, propSource);
                    return (
                        <div className="fixed inset-0 z-[130] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                    <h3 className="text-2xl font-bold text-gray-900">{viewingCompanyChange.card || 'Company Change'}</h3>
                                    <button
                                        type="button"
                                        onClick={() => setViewingCompanyChange(null)}
                                        className="text-sm text-gray-500 hover:text-gray-700"
                                    >
                                        Close
                                    </button>
                                </div>
                                <div className="px-6 py-5 max-h-[72vh] overflow-y-auto space-y-5">
                                    <div>
                                        <div className="text-sm font-semibold uppercase text-gray-600 mb-2">Current Card</div>
                                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                                            {coPrevRows.length > 0 ? (
                                                coPrevRows.map((row, idx) => (
                                                    <div key={`prev-${idx}`} className="grid grid-cols-12 border-b border-gray-100 last:border-b-0">
                                                        <div className="col-span-4 px-3 py-2.5 text-sm font-semibold text-gray-700 bg-gray-50">{row.label}</div>
                                                        <div className="col-span-8 px-3 py-2.5 text-sm text-gray-800 flex items-center justify-between gap-2">
                                                            <span className="truncate">{row.value}</span>
                                                            {row.url ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setViewingCompanyAttachment({ title: row.label, url: row.url })}
                                                                    className="text-xs font-semibold text-blue-700 hover:underline shrink-0"
                                                                >
                                                                    View
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="px-3 py-3 text-sm text-gray-500">No current data available.</div>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-sm font-semibold uppercase text-blue-700 mb-2">Edited Card</div>
                                        <div className="rounded-xl border border-blue-200 overflow-hidden bg-blue-50/30">
                                            {coPropRows.length > 0 ? (
                                                coPropRows.map((row, idx) => (
                                                    <div key={`next-${idx}`} className="grid grid-cols-12 border-b border-blue-100 last:border-b-0">
                                                        <div className="col-span-4 px-3 py-2.5 text-sm font-semibold text-blue-700">{row.label}</div>
                                                        <div className="col-span-8 px-3 py-2.5 text-sm text-gray-800 flex items-center justify-between gap-2">
                                                            <span className="truncate">{row.value}</span>
                                                            {row.url ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setViewingCompanyAttachment({ title: row.label, url: row.url })}
                                                                    className="text-xs font-semibold text-blue-700 hover:underline shrink-0"
                                                                >
                                                                    View
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="px-3 py-3 text-sm text-gray-500">No edited data available.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {viewingCompanyAttachment?.url && (
                    <div className="fixed inset-0 z-[140] bg-black/60 flex items-center justify-center p-4">
                        <div className="w-full max-w-5xl h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
                            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                                <div className="text-sm font-semibold text-gray-800 truncate">
                                    {viewingCompanyAttachment.title || 'Attachment'}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setViewingCompanyAttachment(null)}
                                    className="text-sm text-gray-500 hover:text-gray-700"
                                >
                                    Close
                                </button>
                            </div>
                            <iframe
                                src={viewingCompanyAttachment.url}
                                title={viewingCompanyAttachment.title || 'Attachment preview'}
                                className="w-full flex-1"
                            />
                        </div>
                    </div>
                )}

                <AlertDialog
                    open={companyBulkDialog.open}
                    onOpenChange={(open) =>
                        setCompanyBulkDialog((prev) => (open ? prev : { open: false, mode: null, leaveDuration: '1' }))
                    }
                >
                    <AlertDialogContent className="bg-white rounded-2xl border-gray-100 shadow-2xl p-6">
                        <AlertDialogHeader className="mb-2">
                            <AlertDialogTitle className="text-lg font-bold text-gray-900">
                                {companyBulkDialog.mode === 'return' && 'Confirm Bulk Return'}
                                {companyBulkDialog.mode === 'transfer' && 'Confirm Bulk Transfer'}
                                {companyBulkDialog.mode === 'endOfServices' && 'Confirm End Of Services'}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-sm text-gray-600">
                                {companyBulkDialog.mode === 'return' && `Process bulk return for ${selectedCompanyAssetIds.length} selected asset(s)?`}
                                {companyBulkDialog.mode === 'transfer' && `Submit transfer request for ${selectedCompanyAssetIds.length} selected asset(s)?`}
                                {companyBulkDialog.mode === 'endOfServices' && `Submit End Of Services for ${selectedCompanyAssetIds.length} selected asset(s)?`}
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        {companyBulkDialog.mode === 'transfer' && (
                            <div className="mb-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Leave Duration (1-30 days)</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={30}
                                    value={companyBulkDialog.leaveDuration}
                                    onChange={(e) =>
                                        setCompanyBulkDialog((prev) => ({ ...prev, leaveDuration: e.target.value }))
                                    }
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        )}

                        <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel
                                className="rounded-xl"
                                disabled={companyBulkSubmitting}
                            >
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                                disabled={companyBulkSubmitting}
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleCompanyBulkDialogConfirm();
                                }}
                            >
                                {companyBulkSubmitting ? 'Processing...' : 'Confirm'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <DocumentViewerModal

                    isOpen={!!viewingDocument}

                    onClose={() => setViewingDocument(null)}

                    viewingDocument={viewingDocument}

                />



                <AlertDialog open={itemToDelete !== null} onOpenChange={(open) => !open && setItemToDelete(null)}>

                    <AlertDialogContent className="bg-white rounded-3xl border-gray-100 shadow-2xl p-8">

                        <AlertDialogHeader className="mb-4">

                            <AlertDialogTitle className="text-xl font-bold text-gray-800">Are you absolutely sure?</AlertDialogTitle>

                            <AlertDialogDescription className="text-gray-500 font-medium">

                                This will remove the assigned responsibility for this employee. This action cannot be undone.

                            </AlertDialogDescription>

                        </AlertDialogHeader>

                        <AlertDialogFooter className="gap-3">

                            <AlertDialogCancel className="rounded-xl border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all px-6">Cancel</AlertDialogCancel>

                            <AlertDialogAction

                                onClick={handleRemoveConfirm}

                                className="rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-lg shadow-red-100 px-8"

                            >

                                Remove Responsibility

                            </AlertDialogAction>

                        </AlertDialogFooter>

                    </AlertDialogContent>

                </AlertDialog>



                <AlertDialog open={notRenewData !== null} onOpenChange={(open) => !open && setNotRenewData(null)}>

                    <AlertDialogContent className="bg-white rounded-3xl border-gray-100 shadow-2xl p-8 max-w-lg">

                        <AlertDialogHeader className="mb-4">

                            <AlertDialogTitle className="text-xl font-bold text-gray-800">Request document not renew</AlertDialogTitle>

                            <AlertDialogDescription className="text-gray-500 font-medium">

                                Designated HR will review this request. The current {notRenewData?.label || 'document'} remains on the profile until HR approves.

                            </AlertDialogDescription>

                        </AlertDialogHeader>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-sm font-semibold text-gray-700 block mb-1">Reason (required)</label>
                                <textarea
                                    value={notRenewReason}
                                    onChange={(e) => setNotRenewReason(e.target.value)}
                                    rows={4}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Explain why this document will not be renewed."
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-700 block mb-1">Supporting attachment (optional)</label>
                                <input
                                    type="file"
                                    accept="application/pdf,image/*"
                                    onChange={(e) => setNotRenewFile(e.target.files?.[0] || null)}
                                    className="text-sm w-full"
                                />
                            </div>
                        </div>

                        <AlertDialogFooter className="gap-3">

                            <AlertDialogCancel className="rounded-xl border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all px-6">Cancel</AlertDialogCancel>

                            <AlertDialogAction

                                onClick={(e) => {
                                    e.preventDefault();
                                    handleNotRenewSubmit();
                                }}

                                disabled={notRenewSubmitting}

                                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all shadow-lg shadow-amber-100 px-8"

                            >

                                {notRenewSubmitting ? 'Submitting...' : 'Submit for HR approval'}

                            </AlertDialogAction>

                        </AlertDialogFooter>

                    </AlertDialogContent>

                </AlertDialog>

                <AlertDialog
                    open={hrRejectRequestId !== null}
                    onOpenChange={(open) => {
                        if (!open && !hrRespondSubmitting) {
                            setHrRejectRequestId(null);
                            setHrRejectComment('');
                        }
                    }}
                >
                    <AlertDialogContent className="bg-white rounded-3xl border-gray-100 shadow-2xl p-8 max-w-lg">
                        <AlertDialogHeader className="mb-4">
                            <AlertDialogTitle className="text-xl font-bold text-gray-800">Reject not renew request</AlertDialogTitle>
                            <AlertDialogDescription className="text-gray-500 font-medium">
                                A clear rejection reason is required so the requester understands why the document was not approved for non-renewal.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <textarea
                            value={hrRejectComment}
                            onChange={(e) => setHrRejectComment(e.target.value)}
                            rows={4}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
                            placeholder="Rejection reason (min. 3 characters)"
                        />
                        <AlertDialogFooter className="gap-3">
                            <AlertDialogCancel
                                className="rounded-xl border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all px-6"
                                disabled={hrRespondSubmitting}
                            >
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold px-8"
                                disabled={hrRespondSubmitting || hrRejectComment.trim().length < 3}
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleHrRejectNotRenew();
                                }}
                            >
                                {hrRespondSubmitting ? 'Sending...' : 'Confirm reject'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>



                <AlertDialog open={ownerToDelete !== null} onOpenChange={(open) => !open && setOwnerToDelete(null)}>

                    <AlertDialogContent className="bg-white rounded-3xl border-gray-100 shadow-2xl p-8">

                        <AlertDialogHeader className="mb-4">

                            <AlertDialogTitle className="text-xl font-bold text-gray-800">Confirm Owner Removal</AlertDialogTitle>

                            <AlertDialogDescription className="text-gray-500 font-medium whitespace-pre-line">

                                Are you sure you want to remove this owner?

                                {"\n\n"}

                                Their details and associated documents will also be removed from the profile view. This action cannot be undone.

                            </AlertDialogDescription>

                        </AlertDialogHeader>

                        <AlertDialogFooter className="gap-3">

                            <AlertDialogCancel className="rounded-xl border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all px-6">Cancel</AlertDialogCancel>

                            <AlertDialogAction

                                onClick={confirmRemoveOwner}

                                className="rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-lg shadow-red-100 px-8"

                            >

                                Remove Owner

                            </AlertDialogAction>

                        </AlertDialogFooter>

                    </AlertDialogContent>

                </AlertDialog>



                <AlertDialog open={documentToDelete !== null} onOpenChange={(open) => !open && setDocumentToDelete(null)}>

                    <AlertDialogContent className="bg-white rounded-3xl border-gray-100 shadow-2xl p-8">

                        <AlertDialogHeader className="mb-4">

                            <AlertDialogTitle className="text-xl font-bold text-gray-800">Confirm Deletion</AlertDialogTitle>

                            <AlertDialogDescription className="text-gray-500 font-medium">

                                Are you sure you want to delete this document? This action cannot be undone.

                            </AlertDialogDescription>

                        </AlertDialogHeader>

                        <AlertDialogFooter className="gap-3">

                            <AlertDialogCancel className="rounded-xl border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all px-6">Cancel</AlertDialogCancel>

                            <AlertDialogAction

                                onClick={confirmDeleteDocument}

                                className="rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-lg shadow-red-100 px-8"

                            >

                                Delete Document

                            </AlertDialogAction>

                        </AlertDialogFooter>

                    </AlertDialogContent>

                </AlertDialog>

                <ActivationHoldReviewModal
                    isOpen={activationHoldReviewModalOpen}
                    onClose={() => setActivationHoldReviewModalOpen(false)}
                    company={company}
                    onEditHeldEntry={handleHeldActivationEdit}
                    onSubmitForActivation={() => openActivationSubmitModal()}
                />

            </div >

        </div >

    );

}