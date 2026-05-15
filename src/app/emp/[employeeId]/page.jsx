'use client';

import { useEffect, useMemo, useRef, useState, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Country, State } from 'country-state-city';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import { tryNavigateListReturn } from '@/utils/listReturnNavigation';
// Phone input is handled by DynamicPhoneInput component (via PhoneInputField)
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    validateRequired,
    validateBankName,
    validateAccountName,
    validateAccountNumber,
    validateIBAN,
    validateSWIFT,
    validateTextLength,
    validatePhoneNumber,
    validateEmail,
    validateDate,
    validateName,
    extractCountryCode
} from "@/utils/validation";
import ProfileHeader from './components/ProfileHeader';
import EmploymentSummary from './components/EmploymentSummary';
import TabNavigation from './components/TabNavigation';
// Temporarily using regular imports to fix dynamic import issues
import BasicTab from './components/tabs/BasicTab';
import WorkDetailsTab from './components/tabs/WorkDetailsTab';
import SalaryTab from './components/tabs/SalaryTab';
import PersonalTab from './components/tabs/PersonalTab';
import DocumentsTab from './components/tabs/DocumentsTab';
import TrainingTab from './components/tabs/TrainingTab';
import WorkDetailsModal from './components/modals/WorkDetailsModal';
import NoticeApprovalModal from './components/modals/NoticeApprovalModal';
import BankDetailsModal from './components/modals/BankDetailsModal';
import AddressModal from './components/modals/AddressModal';
import ContactModal from './components/modals/ContactModal';
import PersonalDetailsModal from './components/modals/PersonalDetailsModal';
import EducationModal from './components/modals/EducationModal';
import ExperienceModal from './components/modals/ExperienceModal';
import SalaryModal from './components/modals/SalaryModal';
import EmiratesIdModal from './components/modals/EmiratesIdModal';
import LabourCardModal from './components/modals/LabourCardModal';
import MedicalInsuranceModal from './components/modals/MedicalInsuranceModal';
import DrivingLicenseModal from './components/modals/DrivingLicenseModal';
import DocumentModal from './components/modals/DocumentModal';
import TrainingModal from './components/modals/TrainingModal';
import BasicDetailsModal from './components/modals/BasicDetailsModal';
import ImageUploadModal from './components/modals/ImageUploadModal';
import DocumentViewerModal from './components/modals/DocumentViewerModal';
import CertificateModal from '@/components/modals/CertificateModal';
import DeleteConfirmDialog from './components/modals/DeleteConfirmDialog';
import { formatPhoneForInput, formatPhoneForSave, normalizeText, normalizeContactNumber, getCountryName, getStateName, getFullLocation, sanitizeContact, contactsAreSame, getInitials, formatDate, calculateDaysUntilExpiry, calculateTenure, getAllCountriesOptions, getAllCountryNames } from './utils/helpers';
import { departmentOptions, statusOptions, getDesignationOptions } from './utils/constants';
import { hasPermission, isAdmin, canViewAnyOf } from '@/utils/permissions';
import { EMPLOYEE_MAIN_TAB_MODULES, COMPANY_MAIN_TAB_MODULES } from '@/constants/hrmModulePermissions';
import { toast } from '@/hooks/use-toast';
import { ChevronLeft } from 'lucide-react';

import { filterSnapshotRowsToChangesOnly, resolveActivationSnapshot } from './utils/pendingActivationSnapshotRows';

import ActivationHoldReviewModal from './components/ActivationHoldReviewModal';
import HeldPendingsReviewModal from './components/HeldPendingsReviewModal';
import PermissionGuard from '@/components/PermissionGuard';

function normalizeEmployeeIdCompare(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function viewerIsEmployeeProfileSubject(employee, currentUser) {
    if (!employee || !currentUser) return false;
    const profObj = String(employee._id || '');
    const myObj = String(
        currentUser.employeeObjectId || currentUser.empObjectId || currentUser.linkedEmployee || '',
    );
    const profEidNorm = normalizeEmployeeIdCompare(employee.employeeId);
    const myEidNorm = normalizeEmployeeIdCompare(currentUser.employeeId);
    const myUserId = String(currentUser._id || currentUser.id || '').trim();

    if (profObj && myObj && profObj === myObj) return true;
    if (profEidNorm && myEidNorm && profEidNorm === myEidNorm) return true;

    if (myUserId && profObj && myUserId === profObj) return true;

    const emails = new Set(
        [
            employee.email,
            employee.workEmail,
            employee.companyEmail,
            employee.personalEmail,
        ]
            .map((e) => String(e || '').toLowerCase().trim())
            .filter(Boolean),
    );
    const myEmails = [
        currentUser.email,
        currentUser.workEmail,
        currentUser.companyEmail,
        currentUser.personalEmail,
    ]
        .map((e) => String(e || '').toLowerCase().trim())
        .filter(Boolean);
    if (emails.size && myEmails.some((m) => emails.has(m))) return true;

    return false;
}

/** Same portal user who submitted for activation (stored on submit); legacy rows fall back to profile subject. */
function viewerIsProfileActivationSubmitter(employee, currentUser) {
    if (!employee || !currentUser) return false;
    const sid = employee.profileActivationSubmittedBy;
    const myObj = String(
        currentUser.employeeObjectId || currentUser.empObjectId || currentUser.linkedEmployee || '',
    ).trim();
    if (sid && myObj && String(sid) === String(myObj)) return true;
    if (!sid) return viewerIsEmployeeProfileSubject(employee, currentUser);
    return false;
}

/** Submitter may resubmit while status is submitted and HR hold exists (server no longer requires every row saved first). */
function activationHoldResubmitEligible(employee, currentUser) {
    if (!employee || !currentUser) return false;
    if (String(employee.profileApprovalStatus || '').trim().toLowerCase() !== 'submitted') return false;
    if (!viewerIsProfileActivationSubmitter(employee, currentUser)) return false;
    const holdIds = Array.isArray(employee.profileActivationHold?.unapprovedEntryIds)
        ? employee.profileActivationHold.unapprovedEntryIds
        : [];
    return holdIds.length > 0;
}

function hasProfileActivationHoldPending(employee) {
    return (
        Array.isArray(employee?.profileActivationHold?.unapprovedEntryIds) &&
        employee.profileActivationHold.unapprovedEntryIds.length > 0
    );
}

const EMP_PROFILE_MAIN_TABS = ['basic', 'personal', 'work-details', 'salary', 'documents', 'training'];
const EMP_PROFILE_SALARY_ACTIONS = [
    'Salary History',
    'Fine',
    'Rewards',
    'NCR',
    'Loans',
    'Advance',
    'Assets',
    'CTC',
    'Certificate',
];

function EmployeeProfilePageContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const rawEmployeeIdFromUrl = params?.employeeId;
    // Extract ID part from format "ID.name-slug"
    const employeeId = rawEmployeeIdFromUrl ? rawEmployeeIdFromUrl.split('.')[0] : null;
    const DEFAULT_PHONE_COUNTRY = 'AE';

    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [viewerIsDesignatedFlowchartHr, setViewerIsDesignatedFlowchartHr] = useState(false);
    const [activeTab, setActiveTab] = useState('basic');
    const [activeSubTab, setActiveSubTab] = useState('basic-details');
    const [selectedSalaryAction, setSelectedSalaryAction] = useState('Salary History');
    const [salaryHistoryPage, setSalaryHistoryPage] = useState(1);
    const [salaryHistoryItemsPerPage, setSalaryHistoryItemsPerPage] = useState(10);
    const [imageError, setImageError] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        employeeId: '',
        firstName: '',
        lastName: '',
        contactNumber: '',
        email: '',
        dateOfBirth: '',
        maritalStatus: '',
        fathersName: '',
        gender: '',
        nationality: '',
        numberOfDependents: '',
        status: '',
        probationPeriod: null
    });


    const handleBackNavigation = () => {
        if (tryNavigateListReturn(router)) return;

        const from = searchParams.get('from');
        const fromCompany = searchParams.get('fromCompany');

        if (from === 'company' && fromCompany) {
            router.push(`/Company/${fromCompany}`);
            return;
        }

        // Reconstruct filters for return navigation
        const params = new URLSearchParams();
        const filters = ['company', 'search', 'dept', 'desig', 'job', 'profile', 'gender', 'page', 'perPage'];
        filters.forEach(filter => {
            const value = searchParams.get(filter);
            if (value) params.append(filter, value);
        });

        const queryString = params.toString();
        if (queryString) {
            router.push(`/emp?${queryString}`);
        } else {
            router.push('/emp');
        }
    };
    const [salaryMode, setSalaryMode] = useState('view'); // 'view', 'add', 'edit', 'increment'

    const [editFormErrors, setEditFormErrors] = useState({});
    const [editCountryCode, setEditCountryCode] = useState('ae'); // Default to UAE (ISO code)
    const [showWorkDetailsModal, setShowWorkDetailsModal] = useState(false);
    const [workDetailsForm, setWorkDetailsForm] = useState({
        reportingAuthority: '',
        overtime: false,
        status: 'Probation',
        probationPeriod: null,
        designation: '',
        department: '',
        primaryReportee: '',
        secondaryReportee: '',
        dateOfJoining: '',
        companyEmail: '',
        enablePortalAccess: false
    });
    const [updatingWorkDetails, setUpdatingWorkDetails] = useState(false);
    const [workDetailsErrors, setWorkDetailsErrors] = useState({});


    const statusOptions = [
        { value: 'Probation', label: 'Probation' },
        { value: 'Permanent', label: 'Permanent' },
        { value: 'Temporary', label: 'Temporary' },
        { value: 'Notice', label: 'Notice' }
    ];
    const [showPersonalModal, setShowPersonalModal] = useState(false);
    const [personalForm, setPersonalForm] = useState({
        email: '',
        contactNumber: '',
        dateOfBirth: '',
        maritalStatus: '',
        fathersName: '',
        nationality: '',
        numberOfDependents: ''
    });
    const [savingPersonal, setSavingPersonal] = useState(false);
    const [personalFormErrors, setPersonalFormErrors] = useState({});
    const [contactFormErrors, setContactFormErrors] = useState({});
    const [selectedCountryCode, setSelectedCountryCode] = useState('ae'); // Default to UAE (ISO code)
    const [contactCountryCode, setContactCountryCode] = useState('ae'); // Default to UAE (ISO code)
    const [updating, setUpdating] = useState(false);
    const [confirmUpdateOpen, setConfirmUpdateOpen] = useState(false);
    // Confirmation dialogs state
    const [confirmDeleteEducation, setConfirmDeleteEducation] = useState({
        open: false,
        educationId: null
    });
    const [confirmDeleteExperience, setConfirmDeleteExperience] = useState({
        open: false,
        experienceId: null
    });
    const [confirmDeleteSalary, setConfirmDeleteSalary] = useState({
        open: false,
        salaryIndex: null,
        sortedHistory: null
    });
    const [currentUser, setCurrentUser] = useState(null);

    // Fetch logged-in user
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const userData = localStorage.getItem('employeeUser');
            if (userData) {
                try {
                    setCurrentUser(JSON.parse(userData));
                } catch (e) {
                    console.error("Failed to parse user data", e);
                }
            }
        }
    }, []);

    const [flowchartHrEmpObjectId, setFlowchartHrEmpObjectId] = useState(null);
    const [flowchartHrEmployeeId, setFlowchartHrEmployeeId] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!token) {
            setFlowchartHrEmpObjectId(null);
            setFlowchartHrEmployeeId(null);
            return undefined;
        }
        axiosInstance
            .get("/Flowchart/active-holder/hr")
            .then(({ data }) => {
                if (cancelled) return;
                if (data?.ok && data.empObjectId) {
                    setFlowchartHrEmpObjectId(data.empObjectId);
                    setFlowchartHrEmployeeId(data.employeeId || null);
                } else {
                    setFlowchartHrEmpObjectId(null);
                    setFlowchartHrEmployeeId(null);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setFlowchartHrEmpObjectId(null);
                    setFlowchartHrEmployeeId(null);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const [confirmDeleteTraining, setConfirmDeleteTraining] = useState({
        open: false,
        trainingIndex: null
    });

    // Handle tab switching via query param (main tab, personal sub-tab, salary action)
    useEffect(() => {
        const tabRaw = String(searchParams.get('tab') || '').trim().toLowerCase();
        const subTabRaw = String(searchParams.get('subTab') || '').trim().toLowerCase();
        const salaryActionRaw = String(searchParams.get('salaryAction') || '').trim();
        const tabAlias = tabRaw === 'work' ? 'work-details' : tabRaw;
        if (tabAlias && EMP_PROFILE_MAIN_TABS.includes(tabAlias)) {
            setActiveTab(tabAlias);
            if (tabAlias === 'personal') {
                if (['personal-info', 'education', 'experience'].includes(subTabRaw)) {
                    setActiveSubTab(subTabRaw);
                } else {
                    setActiveSubTab('personal-info');
                }
            } else if (tabAlias === 'basic') {
                setActiveSubTab('basic-details');
            }
            if (tabAlias === 'salary') {
                const match = salaryActionRaw
                    ? EMP_PROFILE_SALARY_ACTIONS.find((a) => a.toLowerCase() === salaryActionRaw.toLowerCase())
                    : null;
                setSelectedSalaryAction(match || 'Salary History');
            } else {
                setSelectedSalaryAction('Salary History');
            }
        }
    }, [searchParams]);
    const [confirmDeleteDocument, setConfirmDeleteDocument] = useState({
        open: false,
        index: null
    });
    const [empDocNotRenewTarget, setEmpDocNotRenewTarget] = useState(null);
    const [empDocNotRenewReason, setEmpDocNotRenewReason] = useState('');
    const [empDocNotRenewFile, setEmpDocNotRenewFile] = useState(null);
    const [empDocNotRenewSubmitting, setEmpDocNotRenewSubmitting] = useState(false);
    const [empHrRespondSubmitting, setEmpHrRespondSubmitting] = useState(false);
    const [hrRejectEmpDocRequestId, setHrRejectEmpDocRequestId] = useState(null);
    const [hrRejectEmpDocComment, setHrRejectEmpDocComment] = useState('');
    const [confirmDeleteCard, setConfirmDeleteCard] = useState({
        open: false,
        type: null
    });
    const [reportingAuthorityOptions, setReportingAuthorityOptions] = useState([]);
    const [reportingAuthorityLoading, setReportingAuthorityLoading] = useState(false);
    const [reportingAuthorityError, setReportingAuthorityError] = useState('');
    const [showBankModal, setShowBankModal] = useState(false);
    const [bankModalMode, setBankModalMode] = useState('edit');
    const [bankForm, setBankForm] = useState({
        bankName: '',
        accountName: '',
        accountNumber: '',
        ibanNumber: '',
        swiftCode: '',
        otherDetails: '',
        file: null,
        fileBase64: '',
        fileName: '',
        fileMime: ''
    });
    const [savingBank, setSavingBank] = useState(false);
    const [bankFormErrors, setBankFormErrors] = useState({
        bankName: '',
        accountName: '',
        accountNumber: '',
        ibanNumber: '',
        swiftCode: '',
        otherDetails: '',
        file: ''
    });
    // Keep just-saved bank data visible while backend queue sync catches up.
    const [localPendingBankData, setLocalPendingBankData] = useState(null);
    const bankFileRef = useRef(null);
    const [showSalaryModal, setShowSalaryModal] = useState(false);
    const [salaryForm, setSalaryForm] = useState({
        month: '',
        fromDate: '',
        basic: '',
        houseRentAllowance: '',
        vehicleAllowance: '',
        fuelAllowance: '',
        otherAllowance: '',
        totalSalary: '',
        offerLetterFile: null,
        offerLetterFileBase64: '',
        offerLetterFileName: '',
        offerLetterFileMime: ''
    });
    const [editingSalaryIndex, setEditingSalaryIndex] = useState(null);
    /** Stable target for in-place salary history edits (display list can be deduped / reordered vs raw `employee.salaryHistory`). */
    const [editingSalaryEntryId, setEditingSalaryEntryId] = useState(null);
    const [savingSalary, setSavingSalary] = useState(false);
    const [uploadingDocument, setUploadingDocument] = useState(false);
    const [showCertificateModal, setShowCertificateModal] = useState(false);
    const [certificateEditData, setCertificateEditData] = useState(null);
    const [certificateEditIndex, setCertificateEditIndex] = useState(null);
    const [certificateEditSource, setCertificateEditSource] = useState('employee');

    const handleOpenCertificateModal = () => {
        setCertificateEditData(null);
        setCertificateEditIndex(null);
        setCertificateEditSource('employee');
        setShowCertificateModal(true);
    };

    const handleEditCertificate = (cert, index, source = 'employee') => {
        setCertificateEditData(cert);
        setCertificateEditIndex(index);
        setCertificateEditSource(source);
        setShowCertificateModal(true);
    };
    const [salaryFormErrors, setSalaryFormErrors] = useState({
        month: '',
        fromDate: '',
        basic: '',
        houseRentAllowance: '',
        vehicleAllowance: '',
        fuelAllowance: '',
        otherAllowance: '',
        offerLetter: ''
    });
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [addressModalType, setAddressModalType] = useState('current');
    const [addressForm, setAddressForm] = useState({
        line1: '',
        line2: '',
        city: '',
        state: '',
        country: '',
        postalCode: ''
    });
    const [addressStateOptions, setAddressStateOptions] = useState([]);
    const [savingAddress, setSavingAddress] = useState(false);
    const [addressFormErrors, setAddressFormErrors] = useState({});
    const [showContactModal, setShowContactModal] = useState(false);
    const [showVisaTypeDropdownInModal, setShowVisaTypeDropdownInModal] = useState(false);
    const [contactForms, setContactForms] = useState([
        { name: '', relation: 'Self', number: '' }
    ]);
    const [savingContact, setSavingContact] = useState(false);
    const [editingContactIndex, setEditingContactIndex] = useState(null);
    const [editingContactId, setEditingContactId] = useState(null);
    const [isEditingExistingContact, setIsEditingExistingContact] = useState(false);
    const [deletingContactId, setDeletingContactId] = useState(null);
    const activeContactForm = contactForms[0] || { name: '', relation: 'Self', number: '' };
    const [statusMessage, setStatusMessage] = useState('');
    const educationCertificateFileRef = useRef(null);
    const [showDocumentViewer, setShowDocumentViewer] = useState(false);
    const [showProgressTooltip, setShowProgressTooltip] = useState(false);
    const [viewingDocument, setViewingDocument] = useState({
        data: '',
        name: '',
        mimeType: ''
    });
    const reportingAuthorityDisplayName = useMemo(() => {
        const reportee = employee?.primaryReportee;
        if (!reportee) return null;
        // Handle populated object
        if (typeof reportee === 'object' && reportee !== null) {
            return `${reportee.firstName || ''} ${reportee.lastName || ''}`.trim() || reportee.employeeId || null;
        }
        // Handle string/ID
        const match = reportingAuthorityOptions.find(option => option.value === reportee);
        return match?.label || null;
    }, [employee?.primaryReportee, reportingAuthorityOptions]);

    const reportingAuthorityEmail = useMemo(() => {
        const reportee = employee?.primaryReportee;
        if (!reportee) return null;
        // Handle populated object
        if (typeof reportee === 'object' && reportee !== null) {
            return reportee.companyEmail || reportee.workEmail || reportee.email || null;
        }
        // Handle string/ID
        const match = reportingAuthorityOptions.find(option => option.value === reportee);
        return match?.email || null;
    }, [employee?.primaryReportee, reportingAuthorityOptions]);
    const [sendingApproval, setSendingApproval] = useState(false);
    const [showApprovalSubmitModal, setShowApprovalSubmitModal] = useState(false);
    const [approvalDescription, setApprovalDescription] = useState('');
    /** Submit-for-approval modal: queued row diff preview (Current vs Edited). */
    const [approvalSubmitViewingChange, setApprovalSubmitViewingChange] = useState(null);
    const [approvalSubmitViewingAttachment, setApprovalSubmitViewingAttachment] = useState(null);
    /** Entry `_id`s (queued rows) checked for inclusion in submit; unchecked are removed from pending on submit. */
    const [approvalSubmitSelectedEntryIds, setApprovalSubmitSelectedEntryIds] = useState([]);

    const basicTabCardApisRef = useRef(null);
    const [showActivationHoldReview, setShowActivationHoldReview] = useState(false);
    const [pendingHeldActivationEntry, setPendingHeldActivationEntry] = useState(null);
    const [showHeldPendingsHodModal, setShowHeldPendingsHodModal] = useState(false);
    /** `${employeeId}:${unapprovedRowId}` — survives closing the HOD held-pendings modal until hold rows or employee change. */
    const [heldPendingsCheckByKey, setHeldPendingsCheckByKey] = useState({});

    // Notice Approval Flow
    const [showNoticeApprovalModal, setShowNoticeApprovalModal] = useState(false);
    const [showReviewButton, setShowReviewButton] = useState(false);
    const [probationActionLoading, setProbationActionLoading] = useState(false);

    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'review_notice') {
            const reporteeEmail = reportingAuthorityEmail;
            const currentUserEmail = currentUser?.companyEmail || currentUser?.workEmail || currentUser?.email;

            // Check if user is the primary reportee
            const isPrimaryReportee = reporteeEmail && currentUserEmail && reporteeEmail.toLowerCase() === currentUserEmail.toLowerCase();

            if (employee && currentUser) {
                const myObj = currentUser.employeeObjectId || currentUser.empObjectId || currentUser._id || currentUser.id;
                const submittedTo = employee?.noticeRequest?.submittedTo;
                const isSubmittedToMe = submittedTo && myObj && String(submittedTo) === String(myObj);
                const isWorkflowAssignee = Array.isArray(employee?.noticeRequest?.workflow)
                    ? employee.noticeRequest.workflow.some(
                        (step) =>
                            step?.status === 'Pending' &&
                            step?.assignedTo &&
                            myObj &&
                            String(step.assignedTo) === String(myObj)
                    )
                    : false;
                const isGlobalAdmin =
                    isAdmin() ||
                    currentUser?.role === "Admin" ||
                    currentUser?.role === "ROOT" ||
                    currentUser?.isAdmin === true;
                const canReviewNoticeRequest = Boolean(
                    isGlobalAdmin || isPrimaryReportee || isSubmittedToMe || isWorkflowAssignee
                );

                setShowReviewButton(canReviewNoticeRequest);

                if (canReviewNoticeRequest) {
                    // Automatically open modal if requested via URL
                    if (employee.noticeRequest?.status === 'Pending') {
                        setShowNoticeApprovalModal(true);
                    }
                } else {
                    // Diagnostic Toast for unauthorized access
                    toast({
                        variant: "destructive",
                        title: "Notice Approval Access Denied",
                        description: `You are not authorized. Logged in as: ${currentUserEmail}, Expected: ${reporteeEmail || 'Assigned approver'}`
                    });
                }
            }
        }
    }, [searchParams, employee?._id, employee?.noticeRequest?.status, currentUser, reportingAuthorityEmail]);
    const [activatingProfile, setActivatingProfile] = useState(false);
    const [educationDetails, setEducationDetails] = useState([]);
    const [showEducationModal, setShowEducationModal] = useState(false);
    const [savingEducation, setSavingEducation] = useState(false);
    const [educationErrors, setEducationErrors] = useState({});
    const [editingEducationId, setEditingEducationId] = useState(null);
    const [deletingEducationId, setDeletingEducationId] = useState(null);
    const initialEducationForm = {
        universityOrBoard: '',
        collegeOrInstitute: '',
        course: '',
        fieldOfStudy: '',
        completedYear: '',
        certificateName: '',
        certificateData: '',
        certificateMime: ''
    };
    const [educationForm, setEducationForm] = useState(initialEducationForm);

    // Experience Details State
    const [experienceDetails, setExperienceDetails] = useState([]);
    const [showExperienceModal, setShowExperienceModal] = useState(false);
    const [savingExperience, setSavingExperience] = useState(false);
    const [experienceErrors, setExperienceErrors] = useState({});
    const [editingExperienceId, setEditingExperienceId] = useState(null);
    const [deletingExperienceId, setDeletingExperienceId] = useState(null);
    const initialExperienceForm = {
        company: '',
        designation: '',
        startDate: '',
        endDate: '',
        certificateName: '',
        certificateData: '',
        certificateMime: ''
    };
    const [experienceForm, setExperienceForm] = useState(initialExperienceForm);
    const experienceCertificateFileRef = useRef(null);

    // Emirates ID State
    const [showEmiratesIdModal, setShowEmiratesIdModal] = useState(false);
    const [emiratesIdForm, setEmiratesIdForm] = useState({
        number: '',
        issueDate: '',
        expiryDate: '',
        file: null
    });
    const [emiratesIdErrors, setEmiratesIdErrors] = useState({});
    const [savingEmiratesId, setSavingEmiratesId] = useState(false);
    const emiratesIdFileRef = useRef(null);

    // Labour Card State
    const [showLabourCardModal, setShowLabourCardModal] = useState(false);
    const [labourCardForm, setLabourCardForm] = useState({
        number: '',
        issueDate: '',
        expiryDate: '',
        file: null,
        contractFile: null
    });
    const [labourCardErrors, setLabourCardErrors] = useState({});
    const [savingLabourCard, setSavingLabourCard] = useState(false);
    const labourCardFileRef = useRef(null);
    const labourContractFileRef = useRef(null);

    // Medical Insurance State
    const [showMedicalInsuranceModal, setShowMedicalInsuranceModal] = useState(false);
    const [medicalInsuranceForm, setMedicalInsuranceForm] = useState({
        provider: '',
        number: '',
        issueDate: '',
        expiryDate: '',
        file: null
    });
    const [medicalInsuranceErrors, setMedicalInsuranceErrors] = useState({});
    const [savingMedicalInsurance, setSavingMedicalInsurance] = useState(false);
    const medicalInsuranceFileRef = useRef(null);

    // Driving License State
    const [showDrivingLicenseModal, setShowDrivingLicenseModal] = useState(false);
    const [drivingLicenseForm, setDrivingLicenseForm] = useState({
        number: '',
        issueDate: '',
        expiryDate: '',
        file: null
    });
    const [drivingLicenseErrors, setDrivingLicenseErrors] = useState({});
    const [savingDrivingLicense, setSavingDrivingLicense] = useState(false);
    const drivingLicenseFileRef = useRef(null);

    // Documents State — modalMode: labour (salary breakdown), standard
    const [showDocumentModal, setShowDocumentModal] = useState(false);
    const [documentModalMode, setDocumentModalMode] = useState('standard');
    const [documentForm, setDocumentForm] = useState({
        type: '',
        description: '',
        issueDate: '',
        expiryDate: '',
        hasExpiry: true,
        hasValue: false,
        value: '',
        basicSalary: '',
        houseRentAllowance: '',
        vehicleAllowance: '',
        fuelAllowance: '',
        otherAllowance: '',
        totalSalary: '',
        file: null,
        fileBase64: '',
        fileName: '',
        fileMime: '',
        isRenewMode: false
    });
    const [savingDocument, setSavingDocument] = useState(false);
    const [documentErrors, setDocumentErrors] = useState({});
    const [editingDocumentIndex, setEditingDocumentIndex] = useState(null);
    const [deletingDocumentIndex, setDeletingDocumentIndex] = useState(null);
    const documentFileRef = useRef(null);
    const offerLetterFileRef = useRef(null);

    // Training State
    const [showTrainingModal, setShowTrainingModal] = useState(false);
    const [trainingForm, setTrainingForm] = useState({
        trainingName: '',
        trainingDetails: '',
        provider: '',
        trainingDate: '',
        trainingCost: '',
        certificate: null,
        certificateBase64: '',
        certificateName: '',
        certificateMime: ''
    });
    const [savingTraining, setSavingTraining] = useState(false);
    const [trainingErrors, setTrainingErrors] = useState({});
    const [editingTrainingIndex, setEditingTrainingIndex] = useState(null);
    const [deletingTrainingIndex, setDeletingTrainingIndex] = useState(null);
    const trainingCertificateFileRef = useRef(null);

    // Get all countries for dropdown options - memoize to avoid recalculating on every render
    const allCountriesOptions = useMemo(() => getAllCountriesOptions(), []);
    const allCountryNamesList = useMemo(() => getAllCountryNames(), []);

    const normalizeNationalityForEditForm = useCallback(
        (nationalityValue) => {
            if (!nationalityValue || String(nationalityValue).trim() === '') return '';
            const raw = nationalityValue.toString().trim();
            const countryName = getCountryName(raw.toUpperCase());
            const matchedOption = allCountriesOptions.find(
                (option) =>
                    option.value.toLowerCase() === countryName.toLowerCase() ||
                    option.value.toLowerCase() === raw.toLowerCase(),
            );
            return matchedOption ? matchedOption.value : countryName || raw;
        },
        [allCountriesOptions],
    );

    const openEditModal = useCallback(
        (proposedMerge = null, options = {}) => {
            if (!employee) return;
            const hasProposedPatch = proposedMerge != null && typeof proposedMerge === 'object';
            const skipTabGuard = options.skipTabGuard === true || hasProposedPatch;
            if (!skipTabGuard && activeTab !== 'basic') return;

            let formattedDateOfBirth = '';
            if (employee.dateOfBirth) {
                const date = new Date(employee.dateOfBirth);
                if (!Number.isNaN(date.getTime())) {
                    formattedDateOfBirth = date.toISOString().split('T')[0];
                }
            }

            const nationalityValue = employee.nationality || employee.country || '';
            const baseForm = {
                employeeId: employee.employeeId || '',
                firstName: employee.firstName || '',
                lastName: employee.lastName || '',
                email: employee.email || employee.workEmail || '',
                contactNumber: formatPhoneForInput(employee.contactNumber || ''),
                dateOfBirth: formattedDateOfBirth,
                maritalStatus: employee.maritalStatus || '',
                fathersName: employee.fathersName || '',
                nationality: normalizeNationalityForEditForm(nationalityValue),
                numberOfDependents: employee.numberOfDependents ? String(employee.numberOfDependents) : '',
                status: employee.status || '',
                probationPeriod: employee.probationPeriod || null,
            };

            let nextForm = baseForm;

            if (hasProposedPatch) {
                const p = proposedMerge;
                nextForm = { ...baseForm };
                const assign = (key, val) => {
                    if (val === undefined || val === null || val === '') return;
                    nextForm[key] = val;
                };
                if (p.firstName != null && String(p.firstName).trim() !== '') assign('firstName', String(p.firstName).trim());
                if (p.lastName != null && String(p.lastName).trim() !== '') assign('lastName', String(p.lastName).trim());
                const emailGuess = p.email || p.workEmail || p.companyEmail;
                if (emailGuess != null && String(emailGuess).trim() !== '')
                    assign('email', String(emailGuess).trim());
                if (p.contactNumber != null && String(p.contactNumber).trim() !== '') {
                    const digits = String(p.contactNumber).replace(/\D/g, '');
                    if (digits) nextForm.contactNumber = formatPhoneForInput(digits);
                }
                if (p.dateOfBirth) {
                    const d = new Date(p.dateOfBirth);
                    if (!Number.isNaN(d.getTime())) nextForm.dateOfBirth = d.toISOString().split('T')[0];
                }
                if (p.maritalStatus != null && String(p.maritalStatus).trim() !== '')
                    assign('maritalStatus', String(p.maritalStatus).trim());
                if (p.fathersName != null && String(p.fathersName).trim() !== '')
                    assign('fathersName', String(p.fathersName).trim());
                if (p.numberOfDependents !== undefined && p.numberOfDependents !== null && String(p.numberOfDependents).trim() !== '') {
                    nextForm.numberOfDependents = String(p.numberOfDependents);
                }
                if (p.status != null && String(p.status).trim() !== '') assign('status', String(p.status).trim());
                if (p.probationPeriod !== undefined && p.probationPeriod !== null) nextForm.probationPeriod = p.probationPeriod;
                const natSource = p.nationality || p.country;
                if (natSource != null && String(natSource).trim() !== '') {
                    nextForm.nationality = normalizeNationalityForEditForm(String(natSource).trim());
                }
                if (p.employeeId != null && String(p.employeeId).trim() !== '')
                    nextForm.employeeId = String(p.employeeId).trim();
            }

            setEditForm(nextForm);
            setEditFormErrors({});
            setShowEditModal(true);
        },
        [employee, activeTab, normalizeNationalityForEditForm],
    );



    const openWorkDetailsModal = (holdEntryOverride = null) => {
        if (!employee) return;

        let pendingWorkProposal = null;
        if (
            holdEntryOverride &&
            typeof holdEntryOverride === 'object' &&
            holdEntryOverride.proposedData &&
            typeof holdEntryOverride.proposedData === 'object'
        ) {
            pendingWorkProposal = holdEntryOverride;
        } else if (Array.isArray(employee?.pendingReactivationChanges)) {
            pendingWorkProposal = [...employee.pendingReactivationChanges]
                .reverse()
                .find((c) => {
                    if (holdEntryOverride?._id && c?._id && String(holdEntryOverride._id) === String(c._id)) {
                        return c.proposedData && typeof c.proposedData === 'object';
                    }
                    return (
                        c &&
                        typeof c === 'object' &&
                        String(c.section || '').toLowerCase() === 'workdetails' &&
                        ['update', 'edit'].includes(String(c.changeType || '').toLowerCase()) &&
                        c.proposedData &&
                        typeof c.proposedData === 'object'
                    );
                });
        }

        const effectiveWork = {
            ...employee,
            ...(pendingWorkProposal?.proposedData || {})
        };

        // Set default probation period to 6 months if status is Probation and not set
        let probationPeriod = effectiveWork.probationPeriod;
        if ((effectiveWork.status === 'Probation' || !effectiveWork.status) && !probationPeriod) {
            probationPeriod = 6; // Default 6 months
        }

        setWorkDetailsForm({
            reportingAuthority: (() => {
                if (!effectiveWork?.reportingAuthority) return '';
                // If it's a populated object, extract the ID
                if (typeof effectiveWork.reportingAuthority === 'object' && effectiveWork.reportingAuthority !== null) {
                    // Try _id first (MongoDB ObjectId or string)
                    const id = effectiveWork.reportingAuthority._id;
                    if (id) {
                        return typeof id === 'string' ? id : (id.toString ? id.toString() : String(id));
                    }
                    // Fallback to employeeId if _id is not available
                    return effectiveWork.reportingAuthority.employeeId || '';
                }
                // If it's already a string/ID, return as is
                return String(effectiveWork.reportingAuthority || '');
            })(),
            overtime: effectiveWork.overtime || false,
            status: effectiveWork.status || 'Probation',
            probationPeriod: probationPeriod,
            designation: effectiveWork.designation || '',
            department: effectiveWork.department || '',
            contractJoiningDate: effectiveWork.contractJoiningDate || '',
            dateOfJoining: effectiveWork.dateOfJoining || '',
            primaryReportee: (() => {
                if (!effectiveWork?.primaryReportee) return '';
                // If it's a populated object, extract the ID
                if (typeof effectiveWork.primaryReportee === 'object' && effectiveWork.primaryReportee !== null) {
                    // Extract _id (MongoDB ObjectId or string) - this is what reportingAuthorityOptions use
                    const id = effectiveWork.primaryReportee._id;
                    if (id) {
                        // Convert to string to match options
                        return typeof id === 'string' ? id : (id.toString ? id.toString() : String(id));
                    }
                    // Fallback: if _id is not available, return empty and let user select
                    return '';
                }
                // If it's already a string/ID, return as is
                return String(effectiveWork.primaryReportee || '');
            })(),
            secondaryReportee: (() => {
                if (!effectiveWork?.secondaryReportee) return '';
                // If it's a populated object, extract the ID
                if (typeof effectiveWork.secondaryReportee === 'object' && effectiveWork.secondaryReportee !== null) {
                    // Extract _id (MongoDB ObjectId or string) - this is what reportingAuthorityOptions use
                    const id = effectiveWork.secondaryReportee._id;
                    if (id) {
                        // Convert to string to match options
                        return typeof id === 'string' ? id : (id.toString ? id.toString() : String(id));
                    }
                    // Fallback: if _id is not available, return empty and let user select
                    return '';
                }
                // If it's already a string/ID, return as is
                return String(effectiveWork.secondaryReportee || '');
            })(),
            companyEmail: effectiveWork.companyEmail || '',
            company: typeof effectiveWork.company === 'object' ? effectiveWork.company?._id : (effectiveWork.company || ''),
            enablePortalAccess: effectiveWork.enablePortalAccess || false
        });
        setWorkDetailsErrors({});
        setShowWorkDetailsModal(true);
    };

    const handleHeldActivationEdit = useCallback((entry) => {
        const sec = String(entry?.section || '').toLowerCase();
        if (
            sec === 'passport' ||
            sec === 'visa' ||
            sec === 'emiratesid' ||
            sec === 'labourcard' ||
            sec === 'medicalinsurance' ||
            sec === 'drivinglicense'
        ) {
            setPendingHeldActivationEntry(entry || null);
            setActiveTab('basic');
            setActiveSubTab('basic-details');
            return;
        }
        if (sec === 'basicdetails') {
            setActiveTab('basic');
            setActiveSubTab('basic-details');
            window.setTimeout(() => openEditModal(entry?.proposedData, { skipTabGuard: true }), 0);
            return;
        }
        if (sec === 'workdetails') {
            setActiveTab('work-details');
            window.setTimeout(() => openWorkDetailsModal(entry), 0);
            return;
        }
        toast({
            title: 'Update this section',
            description: 'Open the matching tab on your profile, edit the relevant card, and save.',
        });
    }, [openEditModal]);

    useEffect(() => {
        if (!pendingHeldActivationEntry) return;
        if (activeTab !== 'basic') return;
        const apis = basicTabCardApisRef.current;
        if (!apis) return;
        const sec = String(pendingHeldActivationEntry?.section || '').toLowerCase();
        const proposed = pendingHeldActivationEntry?.proposedData;
        if (sec === 'passport') apis.openPassportActivationHold?.(proposed);
        else if (sec === 'visa') apis.openVisaActivationHold?.(proposed);
        else if (sec === 'emiratesid') apis.openEmiratesIdActivationHold?.(proposed);
        else if (sec === 'labourcard') apis.openLabourCardActivationHold?.(proposed);
        else if (sec === 'medicalinsurance') apis.openMedicalInsuranceActivationHold?.(proposed);
        else if (sec === 'drivinglicense') apis.openDrivingLicenseActivationHold?.(proposed);
        setPendingHeldActivationEntry(null);
    }, [pendingHeldActivationEntry, activeTab]);

    useEffect(() => {
        if (!employee) return;
        const isCompanyProfile = employee?.employeeId === 'VEGA-HR-0000';
        const tabMap = isCompanyProfile ? COMPANY_MAIN_TAB_MODULES : EMPLOYEE_MAIN_TAB_MODULES;
        const keysForProfile = isCompanyProfile
            ? ['basic', 'work-details']
            : ['basic', 'work-details', 'salary', 'personal', 'documents', 'training'];
        if (!keysForProfile.includes(activeTab)) return;
        const permIds = tabMap[activeTab];
        if (!permIds?.length) return;
        if (isAdmin() || canViewAnyOf(permIds)) return;
        for (const k of keysForProfile) {
            if (canViewAnyOf(tabMap[k] || [])) {
                setActiveTab(k);
                return;
            }
        }
    }, [employee, activeTab]);
    const handleOpenEducationModal = useCallback(() => {
        setEducationForm(initialEducationForm);
        setEducationErrors({});
        setEditingEducationId(null);
        if (educationCertificateFileRef.current) {
            educationCertificateFileRef.current.value = '';
        }
        setShowEducationModal(true);
    }, []);

    const handleSaveEducation = async () => {
        // Validation
        const errors = {};
        // universityOrBoard and collegeOrInstitute are now optional
        if (!educationForm.course) errors.course = 'Course is required';
        if (!educationForm.fieldOfStudy) errors.fieldOfStudy = 'Field of Study is required';
        if (!educationForm.completedYear) errors.completedYear = 'Completed Year is required';

        if (Object.keys(errors).length > 0) {
            setEducationErrors(errors);
            return;
        }

        setSavingEducation(true);
        try {
            const payload = {
                universityOrBoard: educationForm.universityOrBoard.trim(),
                collegeOrInstitute: educationForm.collegeOrInstitute.trim(),
                course: educationForm.course.trim(),
                fieldOfStudy: educationForm.fieldOfStudy.trim(),
                completedYear: educationForm.completedYear.trim(),
                certificate: educationForm.certificateName && educationForm.certificateData
                    ? {
                        name: educationForm.certificateName,
                        data: educationForm.certificateData,
                        mimeType: educationForm.certificateMime || 'application/pdf'
                    }
                    : null
            };

            let response;
            if (editingEducationId) {
                // Update existing education
                response = await axiosInstance.patch(`/Employee/${employeeId}/education/${editingEducationId}`, payload);
                toast({
                    title: "Education Updated",
                    description: "Education details have been updated successfully."
                });
            } else {
                // Add new education
                response = await axiosInstance.post(`/Employee/${employeeId}/education`, payload);
                toast({
                    title: "Education Added",
                    description: "Education details have been added successfully."
                });
            }

            // Optimistically update - use response data if available, otherwise refetch
            const updatedEmployee = response.data?.employee;
            if (updatedEmployee) {
                setEmployee(updatedEmployee);
            } else {
                // Only refetch if response doesn't include updated employee
                fetchEmployee(true).catch(err => console.error('Failed to refresh:', err));
            }

            setShowEducationModal(false);
            setEducationForm(initialEducationForm);
            setEditingEducationId(null);
            setEducationErrors({});
            if (educationCertificateFileRef.current) {
                educationCertificateFileRef.current.value = '';
            }
        } catch (error) {
            console.error('Failed to save education:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || error.message || "Failed to save education details. Please try again."
            });
        } finally {
            setSavingEducation(false);
        }
    };

    const handleEditEducation = useCallback((education) => {
        setEducationForm({
            universityOrBoard: education.universityOrBoard || '',
            collegeOrInstitute: education.collegeOrInstitute || '',
            course: education.course || '',
            fieldOfStudy: education.fieldOfStudy || '',
            completedYear: education.completedYear || '',
            certificateName: education.certificate?.name || '',
            certificateData: education.certificate?.data || '',
            certificateMime: education.certificate?.mimeType || ''
        });
        setEditingEducationId(education._id || education.id);
        setEducationErrors({});
        setShowEducationModal(true);
    }, []);

    // Validate individual education field
    const validateEducationField = (field, value) => {
        const errors = { ...educationErrors };
        let error = '';

        if (field === 'course' || field === 'fieldOfStudy') {
            if (!value || value.trim() === '') {
                error = `${field === 'course' ? 'Course' : 'Field of Study'} is required`;
            } else if (!/^[A-Za-z\s]+$/.test(value)) {
                error = 'Only letters and spaces are allowed. No numbers or special characters.';
            }
        } else if (field === 'universityOrBoard' || field === 'collegeOrInstitute') {
            if (value && value.trim() !== '' && !/^[A-Za-z\s]+$/.test(value)) {
                error = 'Only letters and spaces are allowed. No numbers or special characters.';
            }
        } else if (field === 'completedYear') {
            if (!value || value.trim() === '') {
                error = 'Completed Year is required';
            } else if (!/^\d{4}$/.test(value)) {
                error = 'Year must be in YYYY format (e.g., 2024)';
            } else {
                const year = parseInt(value, 10);
                const currentYear = new Date().getFullYear();
                if (year < 1900 || year > currentYear) {
                    error = `Year must be between 1900 and ${currentYear}`;
                }
            }
        }

        if (error) {
            errors[field] = error;
        } else {
            delete errors[field];
        }
        setEducationErrors(errors);
    };

    const handleEducationChange = (field, value) => {
        let processedValue = value;

        // Apply input restrictions for text fields (letters and spaces only)
        if (field === 'universityOrBoard' || field === 'collegeOrInstitute' || field === 'course' || field === 'fieldOfStudy') {
            // Only allow letters and spaces
            processedValue = value.replace(/[^A-Za-z\s]/g, '');
        } else if (field === 'completedYear') {
            // Only allow digits, max 4 digits
            processedValue = value.replace(/[^\d]/g, '').slice(0, 4);
        }

        setEducationForm(prev => ({ ...prev, [field]: processedValue }));

        // Clear error for this field when user starts typing
        if (educationErrors[field]) {
            setEducationErrors(prev => {
                const updated = { ...prev };
                delete updated[field];
                return updated;
            });
        }

        // Real-time validation
        validateEducationField(field, processedValue);
    };

    const handleEducationFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setEducationForm(prev => ({
                ...prev,
                certificateName: '',
                certificateData: '',
                certificateMime: ''
            }));
            // Clear certificate error
            if (educationErrors.certificate) {
                setEducationErrors(prev => {
                    const updated = { ...prev };
                    delete updated.certificate;
                    return updated;
                });
            }
            return;
        }

        // Validate file type and size
        const allowedTypes = ['application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!allowedTypes.includes(file.type)) {
            setEducationErrors(prev => ({
                ...prev,
                certificate: 'Only PDF files are allowed.'
            }));
            if (e.target) { e.target.value = ''; }
            setEducationForm(prev => ({
                ...prev,
                certificateName: '',
                certificateData: '',
                certificateMime: ''
            }));
            return;
        }

        if (file.size > maxSize) {
            setEducationErrors(prev => ({
                ...prev,
                certificate: 'File size cannot exceed 5MB.'
            }));
            if (e.target) { e.target.value = ''; }
            setEducationForm(prev => ({
                ...prev,
                certificateName: '',
                certificateData: '',
                certificateMime: ''
            }));
            return;
        }

        // Clear certificate error if file is valid
        if (educationErrors.certificate) {
            setEducationErrors(prev => {
                const updated = { ...prev };
                delete updated.certificate;
                return updated;
            });
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            let base64Data = '';
            if (typeof result === 'string') {
                const parts = result.split(',');
                base64Data = parts.length > 1 ? parts[1] : parts[0];
            }
            setEducationForm(prev => ({
                ...prev,
                certificateName: file.name,
                certificateMime: file.type,
                certificateData: base64Data
            }));
        };
        reader.readAsDataURL(file);
    };





    const getSalaryPrefillForLabourModal = useCallback(() => {
        const salaryHistory = Array.isArray(employee?.salaryHistory) ? employee.salaryHistory : [];
        const latest = salaryHistory.length > 0 ? salaryHistory[0] : null;
        const toStr = (v) => (v === null || v === undefined || v === '' ? '' : String(v));
        return {
            basicSalary: toStr(latest?.basicSalary ?? employee?.basicSalary ?? employee?.basic ?? ''),
            houseRentAllowance: toStr(latest?.houseRentAllowance ?? employee?.houseRentAllowance ?? ''),
            vehicleAllowance: toStr(latest?.vehicleAllowance ?? employee?.vehicleAllowance ?? ''),
            fuelAllowance: toStr(latest?.fuelAllowance ?? employee?.fuelAllowance ?? ''),
            otherAllowance: toStr(latest?.otherAllowance ?? employee?.otherAllowance ?? ''),
            totalSalary: toStr(latest?.monthlySalary ?? employee?.monthlySalary ?? employee?.totalSalary ?? '')
        };
    }, [employee]);

    const handleSaveDocument = async () => {
        // Validation
        const errors = {};
        const isLabourModal = documentModalMode === 'labour';
        const hasExpiry = documentForm.hasExpiry !== false;

        if (!isLabourModal && !documentForm.type?.trim()) errors.type = 'Document Type is required';
        if (!isLabourModal && !documentForm.description?.trim()) errors.description = 'Description is required';
        if (!documentForm.file && !documentForm.fileName) errors.file = 'Document File is required';

        if (!isLabourModal && hasExpiry && !String(documentForm.expiryDate || '').trim()) {
            errors.expiryDate = 'Expiry date is required when expiry is Yes';
        }

        if (isLabourModal) {
            ['basicSalary', 'houseRentAllowance', 'vehicleAllowance', 'fuelAllowance', 'otherAllowance', 'totalSalary'].forEach((key) => {
                if (documentForm[key] === '' || documentForm[key] === null || documentForm[key] === undefined) {
                    errors[key] = 'This field is required';
                }
            });
            const salaryKeys = ['basicSalary', 'houseRentAllowance', 'vehicleAllowance', 'fuelAllowance', 'otherAllowance', 'totalSalary'];
            const hasSalaryFieldErrors = salaryKeys.some((k) => errors[k]);
            if (!hasSalaryFieldErrors) {
                const b = Number(documentForm.basicSalary) || 0;
                const h = Number(documentForm.houseRentAllowance) || 0;
                const v = Number(documentForm.vehicleAllowance) || 0;
                const f = Number(documentForm.fuelAllowance) || 0;
                const o = Number(documentForm.otherAllowance) || 0;
                const t = Number(documentForm.totalSalary) || 0;
                const sum = b + h + v + f + o;
                if (Math.abs(sum - t) > 0.01) {
                    errors.totalSalary = 'Basic + allowances must equal Total Salary';
                }
            }
        }

        if (Object.keys(errors).length > 0) {
            setDocumentErrors(errors);
            return;
        }

        setSavingDocument(true);
        try {
            const effectiveType = documentModalMode === 'labour' ? 'Labour Card Salary' : documentForm.type.trim();
            const valueRaw = documentForm.value;
            const costParsed = valueRaw === '' || valueRaw === null || valueRaw === undefined
                ? null
                : Number(String(valueRaw).replace(/,/g, ''));
            const costPayload = Number.isFinite(costParsed) ? costParsed : null;

            const payload = {
                type: effectiveType,
                description: documentForm.description || '',
                issueDate: documentForm.issueDate || null,
                expiryDate: hasExpiry ? (documentForm.expiryDate || null) : null,
                cost: documentForm.hasValue ? costPayload : null,
                isRenewMode: !!documentForm.isRenewMode,
                basicSalary: documentForm.basicSalary !== '' ? Number(documentForm.basicSalary) : null,
                houseRentAllowance: documentForm.houseRentAllowance !== '' ? Number(documentForm.houseRentAllowance) : null,
                vehicleAllowance: documentForm.vehicleAllowance !== '' ? Number(documentForm.vehicleAllowance) : null,
                fuelAllowance: documentForm.fuelAllowance !== '' ? Number(documentForm.fuelAllowance) : null,
                otherAllowance: documentForm.otherAllowance !== '' ? Number(documentForm.otherAllowance) : null,
                totalSalary: documentForm.totalSalary !== '' ? Number(documentForm.totalSalary) : null,
                document: documentForm.fileName && documentForm.fileBase64
                    ? {
                        name: documentForm.fileName,
                        data: documentForm.fileBase64,
                        mimeType: documentForm.fileMime || 'application/pdf'
                    }
                    : null
            };

            let response;
            if (editingDocumentIndex !== null) {
                // Update existing document
                response = await axiosInstance.patch(`/Employee/${employeeId}/document/${editingDocumentIndex}`, payload);
                toast({
                    title: "Document Updated",
                    description: "Document details have been updated successfully."
                });
            } else {
                // Add new document
                response = await axiosInstance.post(`/Employee/${employeeId}/document`, payload);
                toast({
                    title: "Document Added",
                    description: "Document details have been added successfully."
                });
            }

            // Optimistically update - use response data if available, otherwise refetch
            const updatedEmployee = response.data?.employee;
            if (updatedEmployee) {
                setEmployee(updatedEmployee);
            } else {
                // Only refetch if response doesn't include updated employee
                fetchEmployee(true).catch(err => console.error('Failed to refresh:', err));
            }

            setShowDocumentModal(false);
            setDocumentForm({
                type: '',
                description: '',
                issueDate: '',
                expiryDate: '',
                hasExpiry: true,
                hasValue: false,
                value: '',
                basicSalary: '',
                houseRentAllowance: '',
                vehicleAllowance: '',
                fuelAllowance: '',
                otherAllowance: '',
                totalSalary: '',
                file: null,
                fileBase64: '',
                fileName: '',
                fileMime: '',
                isRenewMode: false
            });
            setEditingDocumentIndex(null);
            setDocumentErrors({});
            setDocumentModalMode('standard');
            if (documentFileRef.current) {
                documentFileRef.current.value = '';
            }
        } catch (error) {
            console.error('Failed to save document:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || error.message || "Failed to save document details. Please try again."
            });
        } finally {
            setSavingDocument(false);
        }
    };

    const handleDeleteDocument = (target) => {
        if (!isAdmin()) {
            toast({ variant: "destructive", title: "Access denied", description: "Only administrator can delete documents." });
            return;
        }
        setConfirmDeleteDocument({
            open: true,
            index: target
        });
    };

    const handleNotRenewDocument = (doc) => {
        if (!doc || typeof doc.index !== 'number' || !doc.expiryDate) {
            toast({ variant: "destructive", title: "Not available", description: "This document cannot be marked as Not Renewed." });
            return;
        }
        if (!employee?._id) {
            toast({ variant: "destructive", title: "Error", description: "Employee record is still loading." });
            return;
        }
        const pendingList = Array.isArray(employee.pendingNotRenewRequests) ? employee.pendingNotRenewRequests : [];
        const docItemId = doc.manualDocItemId || (employee.documents?.[doc.index]?._id ? String(employee.documents[doc.index]._id) : '');
        const hasPending = pendingList.some((p) => {
            if (p.status !== 'pending' || p.kind !== 'manualDocument') return false;
            if (docItemId && p.documentItemId && String(p.documentItemId) === String(docItemId)) return true;
            return typeof p.documentIndex === 'number' && p.documentIndex === doc.index;
        });
        if (hasPending) {
            toast({ title: "Already pending", description: "A not-renew request is already waiting for HR approval." });
            return;
        }
        setEmpDocNotRenewTarget(doc);
        setEmpDocNotRenewReason('');
        setEmpDocNotRenewFile(null);
    };

    const requestEmployeeCardNotRenew = async ({ kind, label, visaType }) => {
        if (!employeeId) return;
        const pendingList = Array.isArray(employee?.pendingNotRenewRequests) ? employee.pendingNotRenewRequests : [];
        const alreadyPending = pendingList.some((r) => {
            if (r?.status !== 'pending' || String(r?.kind || '') !== String(kind || '')) return false;
            if (String(kind || '') === 'visa') {
                return String(r?.visaType || '') === String(visaType || '');
            }
            return true;
        });
        if (alreadyPending) {
            toast({
                title: 'Already pending',
                description: 'A pending not-renew request already exists for this document.',
            });
            return;
        }
        const payload = {
            kind,
            label: label || 'Document',
            reason: `Requested not renew from ${label || 'document'} card.`,
        };
        if (visaType) payload.visaType = visaType;
        try {
            const response = await axiosInstance.post(`/Employee/${employeeId}/document-not-renew-requests`, payload);
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
                        description: 'HR has been notified. This document remains live until HR approves.',
                    }
            );
            fetchEmployee(true).catch(() => { /* noop */ });
        } catch (error) {
            if ((error.response?.data?.message || '').toLowerCase().includes('pending not-renew request already exists')) {
                fetchEmployee(true).catch(() => { /* noop */ });
            }
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to submit not-renew request.',
            });
        }
    };

    const handleEmpDocNotRenewSubmit = async () => {
        if (!empDocNotRenewTarget || !employeeId) return;
        const reason = empDocNotRenewReason.trim();
        if (reason.length < 3) {
            toast({
                title: 'Reason required',
                description: 'Please enter at least 3 characters explaining why this document will not be renewed.',
                variant: 'destructive',
            });
            return;
        }
        const doc = empDocNotRenewTarget;
        const docItemId = doc.manualDocItemId || (employee?.documents?.[doc.index]?._id ? String(employee.documents[doc.index]._id) : undefined);
        setEmpDocNotRenewSubmitting(true);
        try {
            let supportingAttachmentKey = '';
            let supportingAttachmentName = '';
            if (empDocNotRenewFile) {
                const base64Payload = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result?.toString()?.split(',')[1] || '');
                    reader.onerror = reject;
                    reader.readAsDataURL(empDocNotRenewFile);
                });
                if (!base64Payload) throw new Error('Invalid file data');
                const uploadRes = await axiosInstance.post(`/Employee/upload-document/${employeeId}`, {
                    document: base64Payload,
                    fileName: empDocNotRenewFile.name || 'attachment',
                    folder: `employee-documents/${employeeId}/not-renew-support`,
                });
                supportingAttachmentKey = uploadRes?.data?.url || uploadRes?.data?.publicId || '';
                supportingAttachmentName = empDocNotRenewFile.name || '';
            }
            const response = await axiosInstance.post(`/Employee/${employeeId}/document-not-renew-requests`, {
                kind: 'manualDocument',
                label: doc.type || 'Document',
                documentIndex: doc.index,
                documentItemId: docItemId,
                reason,
                supportingAttachmentKey,
                supportingAttachmentName,
            });
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
                        description: 'HR has been notified. This document stays live until HR approves.',
                    }
            );
            setEmpDocNotRenewTarget(null);
            fetchEmployee(true).catch(() => { /* noop */ });
        } catch (error) {
            console.error('Employee not-renew submit error:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description:
                    error.response?.data?.message ||
                    error.message ||
                    `Failed to submit not-renew for ${doc?.type || 'document'}`,
            });
        } finally {
            setEmpDocNotRenewSubmitting(false);
        }
    };

    const handleHrApproveEmpManualDocNotRenew = async (requestId) => {
        if (!employeeId || !requestId) return;
        setEmpHrRespondSubmitting(true);
        try {
            await axiosInstance.post(`/Employee/${employeeId}/document-not-renew-requests/${requestId}/respond`, {
                action: 'approve',
            });
            toast({ title: 'Approved', description: 'Not renew applied and document archived.' });
            fetchEmployee(true).catch(() => { /* noop */ });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Could not approve.',
            });
        } finally {
            setEmpHrRespondSubmitting(false);
        }
    };

    const findPendingCardNotRenewRequest = useCallback(
        ({ kind, visaType }) => {
            const list = Array.isArray(employee?.pendingNotRenewRequests) ? employee.pendingNotRenewRequests : [];
            return (
                list.find((r) => {
                    if (r?.status !== 'pending') return false;
                    if (String(r?.kind || '') !== String(kind || '')) return false;
                    if (String(kind || '') === 'visa') {
                        return String(r?.visaType || '') === String(visaType || '');
                    }
                    return true;
                }) || null
            );
        },
        [employee?.pendingNotRenewRequests],
    );

    const handleCardHrApproveNotRenew = useCallback(
        async ({ kind, visaType }) => {
            const req = findPendingCardNotRenewRequest({ kind, visaType });
            if (!req?.requestId) return;
            await handleHrApproveEmpManualDocNotRenew(req.requestId);
        },
        [findPendingCardNotRenewRequest],
    );

    const handleCardHrRejectNotRenewOpen = useCallback(
        ({ kind, visaType }) => {
            const req = findPendingCardNotRenewRequest({ kind, visaType });
            if (!req?.requestId) return;
            setHrRejectEmpDocRequestId(req.requestId);
            setHrRejectEmpDocComment('');
        },
        [findPendingCardNotRenewRequest],
    );

    const handleHrRejectEmpManualDocNotRenew = async () => {
        if (!employeeId || !hrRejectEmpDocRequestId) return;
        const hrComment = hrRejectEmpDocComment.trim();
        if (hrComment.length < 3) {
            toast({
                variant: 'destructive',
                title: 'Comment required',
                description: 'Please enter at least 3 characters for the rejection reason.',
            });
            return;
        }
        setEmpHrRespondSubmitting(true);
        try {
            await axiosInstance.post(
                `/Employee/${employeeId}/document-not-renew-requests/${hrRejectEmpDocRequestId}/respond`,
                { action: 'reject', hrComment }
            );
            toast({ title: 'Rejected', description: 'The requester has been notified.' });
            setHrRejectEmpDocRequestId(null);
            setHrRejectEmpDocComment('');
            fetchEmployee(true).catch(() => { /* noop */ });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Could not reject.',
            });
        } finally {
            setEmpHrRespondSubmitting(false);
        }
    };

    const confirmDeleteDocumentAction = async () => {
        const target = confirmDeleteDocument.index;
        if (target === null || target === undefined) return;

        setConfirmDeleteDocument({ open: false, index: null });
        const deleteKey = typeof target === 'number' ? target : (target?.deleteTarget?.kind || 'system');
        setDeletingDocumentIndex(deleteKey);

        try {
            let response = null;
            const kind = target?.deleteTarget?.kind;
            const updatedEmployeeData = { ...employee };

            if (typeof target === 'number') {
                updatedEmployeeData.documents = (employee?.documents || []).filter((_, idx) => idx !== target);
                setEmployee(updatedEmployeeData);
                response = await axiosInstance.delete(`/Employee/${employeeId}/document/${target}`);
            } else if (kind === 'archived_old') {
                const oldDocs = Array.isArray(employee?.oldDocuments) ? employee.oldDocuments : [];
                const removeId = String(target?.deleteTarget?.oldDocumentId || '').trim();
                const removeIndexRaw = target?.deleteTarget?.oldIndex;
                const removeIndex = Number.isFinite(Number(removeIndexRaw)) ? Number(removeIndexRaw) : null;

                // Optimistic update
                let updatedOldDocs = removeId ? oldDocs.filter((d) => String(d?._id || d?.id || '').trim() !== removeId) : (removeIndex !== null ? oldDocs.filter((_, idx) => idx !== removeIndex) : oldDocs);
                updatedEmployeeData.oldDocuments = updatedOldDocs;
                setEmployee(updatedEmployeeData);

                // Call specialized DELETE endpoint for archived documents (prioritize ID over index)
                const deleteIdentifier = removeId || removeIndex;
                if (deleteIdentifier !== null && deleteIdentifier !== undefined && deleteIdentifier !== "") {
                    response = await axiosInstance.delete(`/Employee/${employeeId}/old-document/${deleteIdentifier}`);
                } else {
                    // Fallback to PATCH if both ID and index are missing
                    response = await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, { oldDocuments: updatedOldDocs });
                }
            } else if (kind === 'additional_old') {
                const docIndex = target.deleteTarget.docIndex;
                if (typeof docIndex !== 'number') throw new Error('Document index is missing');
                updatedEmployeeData.documents = (employee?.documents || []).filter((_, idx) => idx !== docIndex);
                setEmployee(updatedEmployeeData);
                response = await axiosInstance.delete(`/Employee/${employeeId}/document/${docIndex}?skipArchive=true`);
            } else if (kind === 'passport') {
                response = await axiosInstance.delete(`/Employee/passport/${employeeId}`);
            } else if (kind === 'visa' && target?.deleteTarget?.visaType) {
                response = await axiosInstance.delete(`/Employee/visa/${employeeId}/${target.deleteTarget.visaType}`);
            } else if (kind === 'emirates') {
                response = await axiosInstance.delete(`/Employee/emirates-id/${employeeId}`);
            } else if (kind === 'labourCard') {
                response = await axiosInstance.delete(`/Employee/labour-card/${employeeId}`);
            } else if (kind === 'medicalInsurance') {
                response = await axiosInstance.delete(`/Employee/medical-insurance/${employeeId}`);
            } else if (kind === 'drivingLicense') {
                response = await axiosInstance.delete(`/Employee/driving-license/${employeeId}`);
            } else if (kind === 'signature') {
                response = await axiosInstance.delete(`/Employee/${employeeId}/signature`);
            } else if (kind === 'education' && target?.deleteTarget?.educationId) {
                response = await axiosInstance.delete(`/Employee/${employeeId}/education/${target.deleteTarget.educationId}`);
            } else if (kind === 'experience' && target?.deleteTarget?.experienceId) {
                response = await axiosInstance.delete(`/Employee/${employeeId}/experience/${target.deleteTarget.experienceId}`);
            } else if (kind === 'salaryCard') {
                response = await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                    basic: 0, houseRentAllowance: 0, otherAllowance: 0, additionalAllowances: [], salaryHistory: [], offerLetter: null
                });
            } else if (kind === 'salaryHistory' && Number.isInteger(target?.deleteTarget?.salaryIndex)) {
                const updatedHistory = (employee?.salaryHistory || []).filter((_, idx) => idx !== target.deleteTarget.salaryIndex);
                response = await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, { salaryHistory: updatedHistory });
            } else if (kind === 'bank') {
                response = await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                    bankName: "", accountName: "", accountNumber: "", ibanNumber: "", swiftCode: "", bankOtherDetails: "", bankAttachment: null
                });
            } else {
                throw new Error('Delete action is not available for this document.');
            }
            toast({ title: "Deleted", description: "Document removed successfully." });
            if (response?.data?.employee) setEmployee(response.data.employee);
            else fetchEmployee(true).catch(() => { });
        } catch (error) {
            console.error('Delete error:', error);
            toast({ variant: "destructive", title: 'Error', description: error.response?.data?.message || 'Failed to delete document.' });
            fetchEmployee(true);
        } finally {
            setDeletingDocumentIndex(null);
        }
    };

    const handleDeleteEducation = (educationId) => {
        if (!educationId) return;
        if (!isAdmin()) {
            toast({ variant: "destructive", title: "Access denied", description: "Only administrator can delete education records." });
            return;
        }
        setConfirmDeleteEducation({
            open: true,
            educationId: educationId
        });
    };

    const confirmDeleteEducationAction = async () => {
        const educationId = confirmDeleteEducation.educationId;
        if (!educationId) return;

        setConfirmDeleteEducation({ open: false, educationId: null });
        setDeletingEducationId(educationId);
        try {
            const response = await axiosInstance.delete(`/Employee/${employeeId}/education/${educationId}`);
            toast({
                variant: "destructive",
                title: "Education Deleted",
                description: "Education record has been deleted successfully."
            });
            // Optimistically update - use response data if available
            const updatedEmployee = response.data?.employee;
            if (updatedEmployee) {
                setEmployee(updatedEmployee);
            } else {
                // Optimistically remove from local state
                const updatedEducation = (employee?.educationDetails || []).filter(edu =>
                    (edu._id || edu.id) !== educationId
                );
                updateEmployeeOptimistically({ educationDetails: updatedEducation });
            }
        } catch (error) {
            console.error('Failed to delete education:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || error.message || "Failed to delete education record. Please try again."
            });
        } finally {
            setDeletingEducationId(null);
        }
    };

    // Experience Handlers
    const handleOpenExperienceModal = useCallback(() => {
        setExperienceForm(initialExperienceForm);
        setExperienceErrors({});
        setEditingExperienceId(null);
        setShowExperienceModal(true);
    }, []);

    // Validate individual experience field
    const validateExperienceField = (field, value) => {
        const errors = { ...experienceErrors };
        let error = '';

        if (field === 'company' || field === 'designation') {
            if (!value || value.trim() === '') {
                error = `${field === 'company' ? 'Company' : 'Designation'} is required`;
            } else if (!/^[A-Za-z0-9\s]+$/.test(value)) {
                error = 'Only letters, numbers, and spaces are allowed. No special characters.';
            }
        } else if (field === 'startDate') {
            if (!value || value.trim() === '') {
                error = 'Start Date is required';
            } else {
                const date = new Date(value);
                if (isNaN(date.getTime())) {
                    error = 'Start Date must be a valid date';
                } else {
                    // Date is valid, no further checks needed here

                    // Re-validate end date if it exists
                    if (experienceForm.endDate && !error) {
                        validateExperienceField('endDate', experienceForm.endDate);
                    }
                }
            }
        } else if (field === 'endDate') {
            if (!value || value.trim() === '') {
                error = 'End Date is required';
            } else {
                const endDate = new Date(value);
                if (isNaN(endDate.getTime())) {
                    error = 'End Date must be a valid date';
                } else {
                    // Date is valid, no further checks needed here

                    // Check if end date is after start date
                    if (experienceForm.startDate && !error) {
                        const startDate = new Date(experienceForm.startDate);
                        if (!isNaN(startDate.getTime()) && endDate <= startDate) {
                            error = 'End Date must be after Start Date';
                        }
                    }
                }
            }
        }

        if (error) {
            errors[field] = error;
        } else {
            delete errors[field];
        }
        setExperienceErrors(errors);
    };

    const handleExperienceChange = (field, value) => {
        let processedValue = value;

        // Apply input restrictions for text fields (letters, numbers, and spaces only)
        if (field === 'company' || field === 'designation') {
            // Only allow letters, numbers, and spaces
            processedValue = value.replace(/[^A-Za-z0-9\s]/g, '');
        }

        setExperienceForm(prev => ({ ...prev, [field]: processedValue }));

        // Clear error for this field when user starts typing
        if (experienceErrors[field]) {
            setExperienceErrors(prev => {
                const updated = { ...prev };
                delete updated[field];
                return updated;
            });
        }

        // Real-time validation
        validateExperienceField(field, processedValue);
    };

    const handleExperienceFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setExperienceForm(prev => ({
                ...prev,
                certificateName: '',
                certificateData: '',
                certificateMime: ''
            }));
            // Clear certificate error
            if (experienceErrors.certificate) {
                setExperienceErrors(prev => {
                    const updated = { ...prev };
                    delete updated.certificate;
                    return updated;
                });
            }
            return;
        }

        // Validate file type and size
        const allowedTypes = ['application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!allowedTypes.includes(file.type)) {
            setExperienceErrors(prev => ({
                ...prev,
                certificate: 'Only PDF files are allowed.'
            }));
            if (e.target) { e.target.value = ''; }
            setExperienceForm(prev => ({
                ...prev,
                certificateName: '',
                certificateData: '',
                certificateMime: ''
            }));
            return;
        }

        if (file.size > maxSize) {
            setExperienceErrors(prev => ({
                ...prev,
                certificate: 'File size cannot exceed 5MB.'
            }));
            if (e.target) { e.target.value = ''; }
            setExperienceForm(prev => ({
                ...prev,
                certificateName: '',
                certificateData: '',
                certificateMime: ''
            }));
            return;
        }

        // Clear certificate error if file is valid
        if (experienceErrors.certificate) {
            setExperienceErrors(prev => {
                const updated = { ...prev };
                delete updated.certificate;
                return updated;
            });
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            let base64Data = '';
            if (typeof result === 'string') {
                const parts = result.split(',');
                base64Data = parts.length > 1 ? parts[1] : parts[0];
            }
            setExperienceForm(prev => ({
                ...prev,
                certificateName: file.name,
                certificateMime: file.type,
                certificateData: base64Data
            }));
        };
        reader.readAsDataURL(file);
    };

    const validateExperienceForm = () => {
        const errors = {};

        // Validate Company
        if (!experienceForm.company || experienceForm.company.trim() === '') {
            errors.company = 'Company is required';
        } else if (!/^[A-Za-z0-9\s]+$/.test(experienceForm.company)) {
            errors.company = 'Only letters, numbers, and spaces are allowed. No special characters.';
        }

        // Validate Designation
        if (!experienceForm.designation || experienceForm.designation.trim() === '') {
            errors.designation = 'Designation is required';
        } else if (!/^[A-Za-z0-9\s]+$/.test(experienceForm.designation)) {
            errors.designation = 'Only letters, numbers, and spaces are allowed. No special characters.';
        }

        // Validate Start Date
        if (!experienceForm.startDate || experienceForm.startDate.trim() === '') {
            errors.startDate = 'Start Date is required';
        } else {
            const startDate = new Date(experienceForm.startDate);
            if (isNaN(startDate.getTime())) {
                errors.startDate = 'Start Date must be a valid date';
            } else {
                // No validation needed against joining date

            }
        }

        // Validate End Date
        if (!experienceForm.endDate || experienceForm.endDate.trim() === '') {
            errors.endDate = 'End Date is required';
        } else {
            const endDate = new Date(experienceForm.endDate);
            if (isNaN(endDate.getTime())) {
                errors.endDate = 'End Date must be a valid date';
            } else {
                // No validation needed against joining date

                // Check if end date is after start date
                if (experienceForm.startDate && !errors.endDate) {
                    const startDate = new Date(experienceForm.startDate);
                    if (!isNaN(startDate.getTime()) && endDate <= startDate) {
                        errors.endDate = 'End Date must be after Start Date';
                    }
                }
            }
        }

        // Validate Certificate
        if (!experienceForm.certificateName || !experienceForm.certificateData) {
            errors.certificate = 'Certificate file is required';
        } else {
            // Validate file type
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png'];
            const fileExtension = '.' + experienceForm.certificateName.split('.').pop().toLowerCase();
            const isValidMimeType = allowedTypes.includes(experienceForm.certificateMime);
            const isValidExtension = allowedExtensions.includes(fileExtension);

            if (!isValidMimeType || !isValidExtension) {
                errors.certificate = 'Only PDF, JPEG, or PNG file formats are allowed.';
            }
        }

        setExperienceErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSaveExperience = async () => {
        // Validate all fields
        if (!validateExperienceForm()) {
            return;
        }

        setSavingExperience(true);
        try {
            const payload = {
                company: experienceForm.company.trim(),
                designation: experienceForm.designation.trim(),
                startDate: experienceForm.startDate,
                endDate: experienceForm.endDate,
                certificate: experienceForm.certificateName && experienceForm.certificateData
                    ? {
                        name: experienceForm.certificateName,
                        data: experienceForm.certificateData,
                        mimeType: experienceForm.certificateMime || 'application/pdf'
                    }
                    : null
            };

            let response;
            if (editingExperienceId) {
                response = await axiosInstance.patch(`/Employee/${employeeId}/experience/${editingExperienceId}`, payload);
                toast({
                    title: "Experience Updated",
                    description: "Experience details have been updated successfully."
                });
            } else {
                response = await axiosInstance.post(`/Employee/${employeeId}/experience`, payload);
                toast({
                    title: "Experience Added",
                    description: "Experience details have been added successfully."
                });
            }

            // Optimistically update - use response data if available, otherwise refetch
            const updatedEmployee = response.data?.employee;
            if (updatedEmployee) {
                setEmployee(updatedEmployee);
            } else {
                // Only refetch if response doesn't include updated employee
                fetchEmployee(true).catch(err => console.error('Failed to refresh:', err));
            }
            setShowExperienceModal(false);
            setExperienceForm(initialExperienceForm);
            setEditingExperienceId(null);
            setExperienceErrors({});
            if (experienceCertificateFileRef.current) {
                experienceCertificateFileRef.current.value = '';
            }
        } catch (error) {
            console.error('Failed to save experience:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || error.message || "Failed to save experience details. Please try again."
            });
        } finally {
            setSavingExperience(false);
        }
    };

    const handleEditExperience = useCallback((experience) => {
        setExperienceForm({
            company: experience.company || '',
            designation: experience.designation || '',
            startDate: experience.startDate ? (typeof experience.startDate === 'string' ? experience.startDate.substring(0, 10) : new Date(experience.startDate).toISOString().substring(0, 10)) : '',
            endDate: experience.endDate ? (typeof experience.endDate === 'string' ? experience.endDate.substring(0, 10) : new Date(experience.endDate).toISOString().substring(0, 10)) : '',
            certificateName: experience.certificate?.name || '',
            certificateData: experience.certificate?.data || '',
            certificateMime: experience.certificate?.mimeType || ''
        });
        setEditingExperienceId(experience._id || experience.id);
        setExperienceErrors({});
        setShowExperienceModal(true);
    }, []);

    const handleDeleteExperience = (experienceId) => {
        if (!experienceId) return;
        if (!isAdmin()) {
            toast({ variant: "destructive", title: "Access denied", description: "Only administrator can delete experience records." });
            return;
        }
        setConfirmDeleteExperience({
            open: true,
            experienceId: experienceId
        });
    };

    const confirmDeleteExperienceAction = async () => {
        const experienceId = confirmDeleteExperience.experienceId;
        if (!experienceId) return;

        setConfirmDeleteExperience({ open: false, experienceId: null });
        setDeletingExperienceId(experienceId);
        try {
            const response = await axiosInstance.delete(`/Employee/${employeeId}/experience/${experienceId}`);
            toast({
                variant: "default",
                title: "Experience Deleted",
                description: "Experience record has been deleted successfully."
            });
            // Optimistically update - use response data if available
            const updatedEmployee = response.data?.employee;
            if (updatedEmployee) {
                setEmployee(updatedEmployee);
            } else {
                // Optimistically remove from local state
                const updatedExperience = (employee?.experienceDetails || []).filter(exp =>
                    (exp._id || exp.id) !== experienceId
                );
                updateEmployeeOptimistically({ experienceDetails: updatedExperience });
            }
        } catch (error) {
            console.error('Failed to delete experience:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || error.message || "Failed to delete experience record. Please try again."
            });
        } finally {
            setDeletingExperienceId(null);
        }
    };

    // Document Handlers
    const handleDocumentFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setDocumentForm(prev => ({
                ...prev,
                file: null,
                fileBase64: '',
                fileName: '',
                fileMime: ''
            }));
            // Clear file error
            if (documentErrors.file) {
                setDocumentErrors(prev => {
                    const updated = { ...prev };
                    delete updated.file;
                    return updated;
                });
            }
            return;
        }

        // Validate file type and size
        const allowedTypes = ['application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!allowedTypes.includes(file.type)) {
            setDocumentErrors(prev => ({
                ...prev,
                file: 'Only PDF files are allowed.'
            }));
            toast({
                variant: "destructive",
                title: "Invalid file type",
                description: "Only PDF files are allowed."
            });
            if (e.target) { e.target.value = ''; }
            setDocumentForm(prev => ({
                ...prev,
                file: null,
                fileBase64: '',
                fileName: '',
                fileMime: ''
            }));
            return;
        }

        if (file.size > maxSize) {
            setDocumentErrors(prev => ({
                ...prev,
                file: 'File size cannot exceed 5MB.'
            }));
            toast({
                variant: "destructive",
                title: "File too large",
                description: "Attachment size cannot exceed 5MB."
            });
            if (e.target) { e.target.value = ''; }
            setDocumentForm(prev => ({
                ...prev,
                file: null,
                fileBase64: '',
                fileName: '',
                fileMime: ''
            }));
            return;
        }

        // Clear file error if valid
        if (documentErrors.file) {
            setDocumentErrors(prev => {
                const updated = { ...prev };
                delete updated.file;
                return updated;
            });
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            setDocumentForm(prev => ({
                ...prev,
                file: file,
                fileBase64: base64,
                fileName: file.name,
                fileMime: file.type || 'application/pdf'
            }));
        };
        reader.readAsDataURL(file);
    };

    const handleEditDocument = (index) => {
        const doc = employee?.documents?.[index];
        if (doc) {
            const t = (doc.type || '').toLowerCase();
            const looksLikeLabourSalary = t.includes('labour') && (
                doc.basicSalary != null && doc.basicSalary !== '' ||
                doc.houseRentAllowance != null && doc.houseRentAllowance !== '' ||
                doc.totalSalary != null && doc.totalSalary !== ''
            );
            if (looksLikeLabourSalary || (t.includes('labour') && t.includes('salary'))) {
                setDocumentModalMode('labour');
            } else if (doc.expiryDate) {
                setDocumentModalMode('standard');
            } else {
                setDocumentModalMode('standard');
            }
            setDocumentForm({
                type: doc.type || '',
                description: doc.description || doc.discription || '',
                issueDate: doc.issueDate ? String(doc.issueDate).substring(0, 10) : '',
                expiryDate: doc.expiryDate ? String(doc.expiryDate).substring(0, 10) : '',
                hasExpiry: !!doc.expiryDate,
                hasValue: doc.cost !== null && doc.cost !== undefined && doc.cost !== '',
                value: doc.cost ?? '',
                basicSalary: doc.basicSalary ?? '',
                houseRentAllowance: doc.houseRentAllowance ?? '',
                vehicleAllowance: doc.vehicleAllowance ?? '',
                fuelAllowance: doc.fuelAllowance ?? '',
                otherAllowance: doc.otherAllowance ?? '',
                totalSalary: doc.totalSalary ?? '',
                file: null,
                fileBase64: doc.document?.data || '',
                fileName: doc.document?.name || '',
                fileMime: doc.document?.mimeType || '',
                isRenewMode: false
            });
            setEditingDocumentIndex(index);
            setDocumentErrors({});
            setShowDocumentModal(true);
        }
    };

    const handleRenewDocument = (doc) => {
        setDocumentModalMode('standard');
        setDocumentForm({
            type: '',
            description: '',
            issueDate: '',
            expiryDate: '',
            hasExpiry: true,
            hasValue: false,
            value: '',
            basicSalary: '',
            houseRentAllowance: '',
            vehicleAllowance: '',
            fuelAllowance: '',
            otherAllowance: '',
            totalSalary: '',
            file: null,
            fileBase64: '',
            fileName: '',
            fileMime: '',
            isRenewMode: true
        });
        setDocumentErrors({});
        setEditingDocumentIndex(doc?.index ?? null);
        setShowDocumentModal(true);
    };

    // Helper function to convert file to base64
    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64String = reader.result.split(',')[1]; // Remove data:image/jpeg;base64, prefix
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    // Optimistic update helper - updates local state without refetching
    const updateEmployeeOptimistically = useCallback((updates) => {
        setEmployee(prev => prev ? { ...prev, ...updates } : null);
    }, []);



    const confirmDeleteSalaryAction = async () => {
        const { salaryIndex, sortedHistory } = confirmDeleteSalary;
        if (salaryIndex === null || !sortedHistory) return;
        if (!isAdmin()) {
            toast({ variant: "destructive", title: "Access denied", description: "Only administrator can delete salary records." });
            return;
        }

        setConfirmDeleteSalary({ open: false, salaryIndex: null, sortedHistory: null });
        try {
            const updatedHistory = sortedHistory.filter((_, i) => i !== salaryIndex);
            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                salaryHistory: updatedHistory
            });
            await fetchEmployee();
            toast({
                variant: "default",
                title: "Salary record deleted",
                description: "Salary record was deleted successfully."
            });
        } catch (error) {
            console.error('Failed to delete salary record', error);
            toast({
                variant: "destructive",
                title: "Delete failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        }
    };

    const confirmDeleteTrainingAction = async () => {
        const trainingIndex = confirmDeleteTraining.trainingIndex;
        if (trainingIndex === null) return;
        if (!isAdmin()) {
            toast({ variant: "destructive", title: "Access denied", description: "Only administrator can delete training records." });
            return;
        }

        setConfirmDeleteTraining({ open: false, trainingIndex: null });
        setDeletingTrainingIndex(trainingIndex);
        try {
            const updatedTraining = employee.trainingDetails.filter((_, i) => i !== trainingIndex);
            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                trainingDetails: updatedTraining
            });
            await fetchEmployee();
            toast({
                variant: "destructive",
                title: "Training record deleted",
                description: "Training record was deleted successfully."
            });
        } catch (error) {
            console.error('Failed to delete training record', error);
            toast({
                variant: "destructive",
                title: "Delete failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setDeletingTrainingIndex(null);
        }
    };





    // Training Handlers
    const handleTrainingFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setTrainingForm(prev => ({
                ...prev,
                certificate: null,
                certificateBase64: '',
                certificateName: '',
                certificateMime: ''
            }));
            // Clear certificate error
            if (trainingErrors.certificate) {
                setTrainingErrors(prev => {
                    const updated = { ...prev };
                    delete updated.certificate;
                    return updated;
                });
            }
            return;
        }

        // Validate file type and size
        const allowedTypes = ['application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!allowedTypes.includes(file.type)) {
            setTrainingErrors(prev => ({
                ...prev,
                certificate: 'Only PDF files are allowed.'
            }));
            if (e.target) { e.target.value = ''; }
            setTrainingForm(prev => ({
                ...prev,
                certificate: null,
                certificateBase64: '',
                certificateName: '',
                certificateMime: ''
            }));
            return;
        }

        if (file.size > maxSize) {
            setTrainingErrors(prev => ({
                ...prev,
                certificate: 'File size cannot exceed 5MB.'
            }));
            if (e.target) { e.target.value = ''; }
            setTrainingForm(prev => ({
                ...prev,
                certificate: null,
                certificateBase64: '',
                certificateName: '',
                certificateMime: ''
            }));
            return;
        }

        // Clear certificate error if valid
        if (trainingErrors.certificate) {
            setTrainingErrors(prev => {
                const updated = { ...prev };
                delete updated.certificate;
                return updated;
            });
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            setTrainingForm(prev => ({
                ...prev,
                certificate: file,
                certificateBase64: base64,
                certificateName: file.name,
                certificateMime: file.type || 'application/pdf'
            }));
        };
        reader.readAsDataURL(file);
    };

    const handleSaveTraining = useCallback(async () => {
        if (!trainingForm.trainingName || !trainingForm.trainingName.trim()) {
            setTrainingErrors({ trainingName: 'Training name is required' });
            return;
        }
        if (!trainingForm.provider || !trainingForm.provider.trim()) {
            setTrainingErrors({ provider: 'Training provider is required' });
            return;
        }
        if (!trainingForm.trainingDate) {
            setTrainingErrors({ trainingDate: 'Training date is required' });
            return;
        }

        setSavingTraining(true);
        try {
            let certificateUrl = null;
            let certificateName = '';
            let certificateMime = '';

            // Upload certificate to Cloudinary FIRST (if new file provided)
            if (trainingForm.certificate) {
                // New file selected - upload to Cloudinary
                certificateName = trainingForm.certificate.name;
                certificateMime = trainingForm.certificate.type || 'application/pdf';

                try {
                    setUploadingDocument(true);
                    const base64Data = await fileToBase64(trainingForm.certificate);
                    const fullBase64 = `data:${certificateMime};base64,${base64Data}`;

                    const uploadResponse = await axiosInstance.post(`/Employee/upload-document/${employeeId}`, {
                        document: fullBase64,
                        folder: `employee-documents/${employeeId}/training`,
                        fileName: certificateName,
                        resourceType: 'raw'
                    }, {
                        timeout: 30000 // 30 second timeout for large files
                    });

                    if (uploadResponse.data && uploadResponse.data.url) {
                        certificateUrl = uploadResponse.data.url;
                    } else {
                        throw new Error('No URL returned from upload');
                    }
                } catch (uploadError) {
                    console.error('Error uploading training certificate to Cloudinary:', uploadError);
                    setUploadingDocument(false);
                    setSavingTraining(false);
                    toast({
                        variant: "destructive",
                        title: "Upload failed",
                        description: uploadError.response?.data?.message || uploadError.message || "Failed to upload certificate. Please try again."
                    });
                    return;
                } finally {
                    setUploadingDocument(false);
                }
            } else if (trainingForm.certificateBase64) {
                // Existing file from form state (could be Cloudinary URL or base64)
                if (trainingForm.certificateBase64.startsWith('http://') || trainingForm.certificateBase64.startsWith('https://')) {
                    // Already a Cloudinary URL
                    certificateUrl = trainingForm.certificateBase64;
                } else {
                    // Base64 data - upload to Cloudinary
                    certificateName = trainingForm.certificateName || 'certificate.pdf';
                    certificateMime = trainingForm.certificateMime || 'application/pdf';

                    try {
                        setUploadingDocument(true);
                        const fullBase64 = trainingForm.certificateBase64.includes(',')
                            ? trainingForm.certificateBase64
                            : `data:${certificateMime};base64,${trainingForm.certificateBase64}`;

                        const uploadResponse = await axiosInstance.post(`/Employee/upload-document/${employeeId}`, {
                            document: fullBase64,
                            folder: `employee-documents/${employeeId}/training`,
                            fileName: certificateName,
                            resourceType: 'raw'
                        }, {
                            timeout: 30000
                        });

                        if (uploadResponse.data && uploadResponse.data.url) {
                            certificateUrl = uploadResponse.data.url;
                        } else {
                            throw new Error('No URL returned from upload');
                        }
                    } catch (uploadError) {
                        console.error('Error uploading training certificate to Cloudinary:', uploadError);
                        setUploadingDocument(false);
                        setSavingTraining(false);
                        toast({
                            variant: "destructive",
                            title: "Upload failed",
                            description: uploadError.response?.data?.message || uploadError.message || "Failed to upload certificate. Please try again."
                        });
                        return;
                    } finally {
                        setUploadingDocument(false);
                    }
                }
                certificateName = trainingForm.certificateName || 'certificate.pdf';
                certificateMime = trainingForm.certificateMime || 'application/pdf';
            } else if (editingTrainingIndex !== null && employee?.trainingDetails?.[editingTrainingIndex]?.certificate) {
                // Editing existing training - preserve existing certificate data
                const existingCert = employee.trainingDetails[editingTrainingIndex].certificate;
                if (existingCert.url) {
                    certificateUrl = existingCert.url;
                } else if (existingCert.data) {
                    certificateUrl = existingCert.data; // Legacy base64 - will be migrated on next upload
                }
                certificateName = existingCert.name || 'certificate.pdf';
                certificateMime = existingCert.mimeType || 'application/pdf';
            }

            // Build training data with Cloudinary URL (preferred) or legacy data
            const trainingData = {
                trainingName: trainingForm.trainingName.trim(),
                trainingDetails: trainingForm.trainingDetails?.trim() || '',
                provider: trainingForm.provider.trim(),
                trainingDate: trainingForm.trainingDate,
                trainingCost: trainingForm.trainingCost ? parseFloat(trainingForm.trainingCost) : null,
                certificate: certificateUrl ? {
                    url: certificateUrl.startsWith('http://') || certificateUrl.startsWith('https://') ? certificateUrl : undefined,
                    data: (!certificateUrl.startsWith('http://') && !certificateUrl.startsWith('https://')) ? certificateUrl : undefined,
                    name: certificateName,
                    mimeType: certificateMime
                } : undefined
            };

            let updatedTraining = [...(employee?.trainingDetails || [])];
            if (editingTrainingIndex !== null) {
                updatedTraining[editingTrainingIndex] = {
                    ...updatedTraining[editingTrainingIndex],
                    ...trainingData
                };
            } else {
                updatedTraining.push(trainingData);
            }

            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                trainingDetails: updatedTraining
            });

            // Store editing state before resetting
            const wasEditing = editingTrainingIndex !== null;

            // Close modal and reset form immediately for better UX
            setShowTrainingModal(false);
            setTrainingForm({
                trainingName: '',
                trainingDetails: '',
                provider: '',
                trainingDate: '',
                trainingCost: '',
                certificate: null,
                certificateBase64: '',
                certificateName: '',
                certificateMime: ''
            });
            setTrainingErrors({});
            setEditingTrainingIndex(null);
            if (trainingCertificateFileRef.current) {
                trainingCertificateFileRef.current.value = '';
            }

            toast({
                variant: "default",
                title: wasEditing ? "Training Updated" : "Training Added",
                description: wasEditing ? "Training has been updated successfully." : "Training has been added successfully."
            });

            // Fetch employee data in background (non-blocking)
            fetchEmployee().catch(err => {
                console.error('Failed to refresh employee data:', err);
            });
        } catch (error) {
            console.error('Failed to save training:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || error.message || "Failed to save training. Please try again."
            });
        } finally {
            setSavingTraining(false);
        }
    }, [trainingForm, editingTrainingIndex, employee, employeeId, trainingCertificateFileRef, fileToBase64, setUploadingDocument, toast]);

    const handleUpdateWorkDetails = async () => {
        if (!employee) return;

        try {
            setUpdatingWorkDetails(true);

            // Set default probation period to 6 months if status is Probation and not set
            let probationPeriod = workDetailsForm.probationPeriod;
            if (workDetailsForm.status === 'Probation' && !probationPeriod) {
                probationPeriod = 6; // Default 6 months
            }

            // Validate Contract Joining Date
            if (!workDetailsForm.contractJoiningDate) {
                setWorkDetailsErrors(prev => ({
                    ...prev,
                    contractJoiningDate: 'Contract Joining Date is required'
                }));
                setUpdatingWorkDetails(false);
                return;
            } else {
                const contractDate = new Date(workDetailsForm.contractJoiningDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                contractDate.setHours(0, 0, 0, 0);

                if (contractDate > today) {
                    setWorkDetailsErrors(prev => ({
                        ...prev,
                        contractJoiningDate: 'Contract Joining Date cannot be in the future'
                    }));
                    setUpdatingWorkDetails(false);
                    return;
                }
            }

            // Validate Date of Joining if provided
            if (workDetailsForm.dateOfJoining) {
                const joiningDate = new Date(workDetailsForm.dateOfJoining);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                joiningDate.setHours(0, 0, 0, 0);

                if (joiningDate > today) {
                    setWorkDetailsErrors(prev => ({
                        ...prev,
                        dateOfJoining: 'Date of Joining cannot be in the future'
                    }));
                    setUpdatingWorkDetails(false);
                    return;
                }
            }

            // Validate Company is mandatory
            if (!workDetailsForm.company) {
                setWorkDetailsErrors(prev => ({
                    ...prev,
                    company: 'Company is required'
                }));
                setUpdatingWorkDetails(false);
                return;
            }

            // Validate primary reportee is mandatory (unless Management department)
            const isManagement = workDetailsForm.department?.trim().toLowerCase() === 'management';
            if (!isManagement && (!workDetailsForm.primaryReportee || workDetailsForm.primaryReportee.trim() === '')) {
                setWorkDetailsErrors(prev => ({
                    ...prev,
                    primaryReportee: 'Primary Reportee is required'
                }));
                setUpdatingWorkDetails(false);
                return;
            }

            const updatePayload = {
                reportingAuthority: workDetailsForm.reportingAuthority || null,
                overtime: workDetailsForm.overtime || false,
                status: workDetailsForm.status,
                designation: workDetailsForm.designation,
                department: workDetailsForm.department,
                company: workDetailsForm.company || null,
                contractJoiningDate: workDetailsForm.contractJoiningDate,
                dateOfJoining: workDetailsForm.dateOfJoining,
                primaryReportee: workDetailsForm.primaryReportee || null,
                secondaryReportee: workDetailsForm.secondaryReportee || null,
                companyEmail: workDetailsForm.companyEmail
            };

            // Probation Period is required if status is Probation
            if (workDetailsForm.status === 'Probation') {
                updatePayload.probationPeriod = employee.probationPeriod || 6; // Default 6 months if not set

                // Check if probation period has ended based on Contract Joining Date (mandatory)
                if (workDetailsForm.contractJoiningDate) {
                    const contractDate = new Date(workDetailsForm.contractJoiningDate);
                    const probationEndDate = new Date(contractDate);
                    const probMonths = employee.probationPeriod || 6;
                    probationEndDate.setMonth(probationEndDate.getMonth() + probMonths);

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    probationEndDate.setHours(0, 0, 0, 0);

                    // If probation period has ended, automatically change to Permanent
                    if (probationEndDate <= today) {
                        updatePayload.status = 'Permanent';
                        updatePayload.probationPeriod = null;
                    }
                }
            } else {
                updatePayload.probationPeriod = null;
            }

            // MANDATORY RESET: If status is changing to Permanent, reset profile to Inactive/Draft
            // This force a re-approval for the Permanent status
            if (updatePayload.status === 'Permanent' && employee.status !== 'Permanent') {
                updatePayload.profileStatus = 'inactive';
                updatePayload.profileApprovalStatus = 'draft';
            }

            await axiosInstance.patch(`/Employee/work-details/${employeeId}`, updatePayload);
            await fetchEmployee();
            setShowWorkDetailsModal(false);
            setWorkDetailsErrors({});
            toast({
                variant: "default",
                title: "Work details updated",
                description: "Changes were saved successfully."
            });
        } catch (error) {
            console.error('Failed to update work details', error);
            toast({
                variant: "destructive",
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setUpdatingWorkDetails(false);
        }
    };

    const handleOpenPersonalModal = () => {
        if (!employee || activeTab !== 'personal') return;

        // Normalize nationality to match exactly with dropdown options
        const nationalityValue = employee.nationality || employee.country || '';
        let finalNationality = '';
        if (nationalityValue) {
            const trimmedValue = nationalityValue.toString().trim();

            // First try to get country name from code (handles codes like "AE", "IN", etc.)
            const countryName = getCountryName(trimmedValue.toUpperCase());

            // Always try to find exact match in dropdown options to ensure it matches
            const countryOptions = allCountriesOptions;

            // Try multiple matching strategies - check both the original value and converted country name
            let matchedOption = countryOptions.find(
                option => option.value.toLowerCase() === trimmedValue.toLowerCase() ||
                    option.label.toLowerCase() === trimmedValue.toLowerCase()
            );

            // If no match with original value, try with country name
            if (!matchedOption && countryName) {
                matchedOption = countryOptions.find(
                    option => option.value.toLowerCase() === countryName.toLowerCase() ||
                        option.label.toLowerCase() === countryName.toLowerCase()
                );
            }

            // If still no match, try case-insensitive partial match
            if (!matchedOption) {
                matchedOption = countryOptions.find(
                    option => option.value.toLowerCase().includes(trimmedValue.toLowerCase()) ||
                        option.label.toLowerCase().includes(trimmedValue.toLowerCase()) ||
                        trimmedValue.toLowerCase().includes(option.value.toLowerCase()) ||
                        trimmedValue.toLowerCase().includes(option.label.toLowerCase())
                );
            }

            if (matchedOption) {
                finalNationality = matchedOption.value; // Use exact value from dropdown
            } else if (countryName && countryName !== trimmedValue) {
                // Use country name if we got one from code conversion
                finalNationality = countryName;
            } else {
                // Fallback: use the value as-is
                finalNationality = trimmedValue;
            }
        }

        setPersonalForm({
            email: employee.email || employee.workEmail || '',
            contactNumber: formatPhoneForInput(employee.contactNumber || ''),
            dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.substring(0, 10) : '',
            maritalStatus: employee.maritalStatus || '',
            fathersName: employee.fathersName || '',
            nationality: finalNationality,
            numberOfDependents: employee.numberOfDependents ? String(employee.numberOfDependents) : '',
            gender: employee.gender || ''
        });
        setShowPersonalModal(true);
    };

    const handleClosePersonalModal = () => {
        if (savingPersonal) return;
        setShowPersonalModal(false);
        setPersonalForm({
            email: '',
            contactNumber: '',
            dateOfBirth: '',
            maritalStatus: '',
            fathersName: '',
            nationality: '',
            numberOfDependents: ''
        });
        setPersonalFormErrors({});
    };

    const handlePersonalChange = (field, value, country = null) => {
        // For phone numbers, remove non-digits and validate
        if (field === 'contactNumber') {
            const cleanedValue = value.replace(/\D/g, '');
            setPersonalForm(prev => ({ ...prev, [field]: cleanedValue }));

            // Extract and store country code - use ISO country code for libphonenumber-js
            let countryCode = selectedCountryCode;
            if (country) {
                if (country.countryCode) {
                    countryCode = country.countryCode;
                    setSelectedCountryCode(country.countryCode);
                } else if (country.dialCode) {
                    countryCode = country.dialCode;
                    setSelectedCountryCode(country.dialCode);
                }
            } else {
                const extracted = extractCountryCode(cleanedValue);
                if (extracted) {
                    countryCode = extracted;
                    setSelectedCountryCode(extracted);
                }
            }

            const validation = validatePhoneNumber(cleanedValue, countryCode, true);
            setPersonalFormErrors(prev => {
                const updated = { ...prev };
                if (!validation.isValid) {
                    updated.contactNumber = validation.error;
                } else {
                    delete updated.contactNumber;
                }
                return updated;
            });
            return;
        }

        // Apply input restrictions for text fields
        let processedValue = value;
        if (field === 'fathersName') {
            processedValue = value.replace(/[^A-Za-z\s]/g, '');
        } else if (field === 'nationality') {
            processedValue = value.replace(/[^A-Za-z\s'-]/g, '');
        }

        // Normalize date input to YYYY-MM-DD when a time component is present
        if (field === 'dateOfBirth') {
            processedValue = value.includes('T') ? value.split('T')[0] : value;
        }

        setPersonalForm(prev => ({ ...prev, [field]: processedValue }));

        // Real-time validation for personal fields
        let error = '';
        if (field === 'email') {
            const emailValidation = validateEmail(processedValue, true);
            error = emailValidation.isValid ? '' : emailValidation.error;
        } else if (field === 'dateOfBirth') {
            const dobValidation = validateDate(processedValue, true);
            error = dobValidation.isValid ? '' : dobValidation.error;
        } else if (field === 'maritalStatus') {
            const validMaritalStatuses = ['single', 'married', 'divorced', 'widowed'];
            if (!processedValue || processedValue.trim() === '') {
                error = 'Marital Status is required';
            } else if (!validMaritalStatuses.includes(processedValue.toLowerCase())) {
                error = 'Please select a valid marital status option';
            }
        } else if (field === 'fathersName') {
            if (!processedValue || processedValue.trim() === '') {
                error = 'Father\'s Name is required';
            } else {
                const trimmed = processedValue.trim();
                if (trimmed.length < 2) {
                    error = 'Father\'s Name must be at least 2 characters';
                } else if (!/^[A-Za-z\s]+$/.test(trimmed)) {
                    error = 'Father\'s Name must contain only letters and spaces';
                }
            }
        } else if (field === 'nationality') {
            const nationalityValidation = validateRequired(processedValue, 'Nationality');
            if (!nationalityValidation.isValid) {
                error = nationalityValidation.error;
            } else {
                const trimmedNationality = processedValue.trim();
                if (trimmedNationality.length < 2) {
                    error = 'Nationality must be at least 2 characters';
                } else if (!/^[A-Za-z\s\'-]+$/.test(trimmedNationality)) {
                    error = 'Nationality must contain only letters, spaces, hyphens, and apostrophes';
                }
            }
        }

        setPersonalFormErrors(prev => {
            const updated = { ...prev };
            if (error) {
                updated[field] = error;
            } else {
                delete updated[field];
            }
            return updated;
        });
    };

    const handleOpenContactModal = (contactId = null, contactIndex = null) => {
        const contacts = existingContacts || getExistingContacts();
        let selectedContact = null;

        if (contactId) {
            selectedContact = existingContacts.find(contact => contact.id === contactId);
        } else if (contactIndex !== null && existingContacts[contactIndex]) {
            selectedContact = existingContacts[contactIndex];
        }

        if (selectedContact) {
            setContactForms([{
                name: selectedContact.name || '',
                relation: selectedContact.relation || 'Self',
                number: formatPhoneForInput(selectedContact.number || '')
            }]);
            setEditingContactIndex(selectedContact.index ?? contactIndex ?? null);
            setEditingContactId(selectedContact.id);
            setIsEditingExistingContact(true);
        } else {
            setContactForms([{ name: '', relation: 'Self', number: '' }]);
            setEditingContactIndex(null);
            setEditingContactId(null);
            setIsEditingExistingContact(false);
        }
        setShowContactModal(true);
    };

    const handleCloseContactModal = () => {
        if (savingContact) return;
        setShowContactModal(false);
        setContactForms([{ name: '', relation: 'Self', number: '' }]);
        setEditingContactIndex(null);
        setEditingContactId(null);
        setIsEditingExistingContact(false);
        setContactFormErrors({});
    };

    const handleContactChange = (index, field, value, country = null) => {
        if (field === 'number') {
            const cleanedValue = value.replace(/\D/g, '');
            setContactForms(prev => prev.map((contact, i) =>
                (i === index ? { ...contact, [field]: cleanedValue } : contact)
            ));

            let countryCode = contactCountryCode;
            if (country) {
                if (country.countryCode) {
                    countryCode = country.countryCode;
                    setContactCountryCode(country.countryCode);
                } else if (country.dialCode) {
                    countryCode = country.dialCode;
                    setContactCountryCode(country.dialCode);
                }
            } else {
                const extracted = extractCountryCode(cleanedValue);
                if (extracted) {
                    countryCode = extracted;
                    setContactCountryCode(extracted);
                }
            }

            const validation = validatePhoneNumber(cleanedValue, countryCode, true);
            setContactFormErrors(prev => {
                const updated = { ...prev };
                if (!validation.isValid) {
                    updated[`${index}_number`] = validation.error;
                } else {
                    delete updated[`${index}_number`];
                }
                return updated;
            });
            return;
        }

        let processedValue = value;
        if (field === 'name') {
            processedValue = value.replace(/[^A-Za-z\s]/g, '');
        }

        setContactForms(prev => prev.map((contact, i) =>
            (i === index ? { ...contact, [field]: processedValue } : contact)
        ));

        // Real-time validation for non-phone fields
        let error = '';
        if (field === 'name') {
            if (!processedValue || processedValue.trim() === '') {
                error = 'Contact Name is required';
            } else if (!/^[A-Za-z\s]+$/.test(processedValue.trim())) {
                error = 'Contact Name must contain letters and spaces only';
            }
        } else if (field === 'relation') {
            const validRelations = ['Self', 'Father', 'Mother', 'Spouse', 'Friend', 'Other'];
            if (!processedValue || processedValue.trim() === '') {
                error = 'Relation is required';
            } else if (!validRelations.includes(processedValue)) {
                error = 'Please select a valid relation';
            }
        }

        setContactFormErrors(prev => {
            const updated = { ...prev };
            if (error) {
                updated[`${index}_${field}`] = error;
            } else {
                delete updated[`${index}_${field}`];
            }
            return updated;
        });
    };

    const handleAddContactRow = () => {
        setContactForms(prev => [...prev, { name: '', relation: 'Self', number: '' }]);
    };

    const handleRemoveContactRow = (index) => {
        setContactForms(prev => prev.filter((_, i) => i !== index));
    };

    const handleEditChange = (field, value, country = null) => {
        // For phone numbers, remove spaces and validate
        if (field === 'contactNumber') {
            // Keep digits only for contact number entry
            const cleanedValue = value.replace(/\D/g, '');
            setEditForm(prev => ({ ...prev, [field]: cleanedValue }));

            // Extract and store country code - use ISO country code for libphonenumber-js
            let countryCode = editCountryCode; // default
            if (country) {
                // Prefer ISO country code (e.g., 'ae', 'in') for libphonenumber-js
                if (country.countryCode) {
                    countryCode = country.countryCode; // ISO code (e.g., 'ae')
                    setEditCountryCode(country.countryCode);
                } else if (country.dialCode) {
                    // Fallback to dial code if countryCode not available
                    countryCode = country.dialCode;
                    setEditCountryCode(country.dialCode);
                }
            } else {
                // Try to extract from value if country object not provided
                const extracted = extractCountryCode(cleanedValue);
                if (extracted) {
                    countryCode = extracted;
                    setEditCountryCode(extracted);
                }
            }

            // Validate contact number (required, valid international format)
            const validation = validatePhoneNumber(cleanedValue, countryCode, true);
            if (!validation.isValid) {
                setEditFormErrors(prev => ({
                    ...prev,
                    contactNumber: validation.error
                }));
            } else {
                // Clear error if valid
                setEditFormErrors(prev => {
                    const updated = { ...prev };
                    delete updated.contactNumber;
                    return updated;
                });
            }
        } else {
            // Apply input restrictions based on field type
            let processedValue = value;

            // String fields: fathersName, firstName, lastName (letters and spaces only), nationality (letters, spaces, hyphens, apostrophes)
            if (['fathersName', 'firstName', 'lastName'].includes(field)) {
                // Allow only letters and spaces (no numbers or special characters)
                processedValue = value.replace(/[^A-Za-z\s]/g, '');
            } else if (field === 'nationality') {
                // Allow letters, spaces, hyphens, and apostrophes
                processedValue = value.replace(/[^A-Za-z\s'-]/g, '');
            }

            // Date field: ensure proper format
            if (field === 'dateOfBirth') {
                // If it's a full ISO date string, extract just the date part
                if (value.includes('T')) {
                    processedValue = value.split('T')[0];
                } else {
                    processedValue = value;
                }
            }

            setEditForm(prev => {
                const updated = { ...prev, [field]: processedValue };
                // Clear probationPeriod if status changes from Probation to something else
                if (field === 'status' && processedValue !== 'Probation') {
                    updated.probationPeriod = null;
                }
                return updated;
            });

            // Real-time validation for other fields
            let error = '';

            if (field === 'email') {
                const emailValidation = validateEmail(processedValue, true);
                error = emailValidation.isValid ? '' : emailValidation.error;
            } else if (field === 'dateOfBirth') {
                const dobValidation = validateDate(processedValue, true);
                error = dobValidation.isValid ? '' : dobValidation.error;
            } else if (field === 'maritalStatus') {
                // Validate Marital Status: must be from predefined options
                const validMaritalStatuses = ['single', 'married', 'divorced', 'widowed'];
                if (!processedValue || processedValue.trim() === '') {
                    error = 'Marital Status is required';
                } else if (!validMaritalStatuses.includes(processedValue.toLowerCase())) {
                    error = 'Please select a valid marital status option';
                }
            } else if (field === 'fathersName') {
                // Validate Father's Name: letters and spaces only
                if (!processedValue || processedValue.trim() === '') {
                    error = 'Father\'s Name is required';
                } else {
                    const trimmed = processedValue.trim();
                    if (trimmed.length < 2) {
                        error = 'Father\'s Name must be at least 2 characters';
                    } else if (!/^[A-Za-z\s]+$/.test(trimmed)) {
                        error = 'Father\'s Name must contain only letters and spaces';
                    }
                }
            } else if (field === 'gender') {
                if (!processedValue || processedValue.trim() === '') {
                    error = 'Gender is required';
                } else {
                    const validGenders = ['male', 'female', 'other'];
                    if (!validGenders.includes(processedValue.toLowerCase())) {
                        error = 'Please select a valid gender option';
                    }
                }
            } else if (field === 'nationality') {
                const nationalityValidation = validateRequired(processedValue, 'Nationality');
                if (!nationalityValidation.isValid) {
                    error = nationalityValidation.error;
                } else {
                    const trimmedNationality = processedValue.trim();
                    if (trimmedNationality.length < 2) {
                        error = 'Nationality must be at least 2 characters';
                    } else if (!/^[A-Za-z\s'-]+$/.test(trimmedNationality)) {
                        error = 'Nationality must contain only letters, spaces, hyphens, and apostrophes';
                    }
                }
            }

            // Update errors
            setEditFormErrors(prev => {
                const updated = { ...prev };
                if (error) {
                    updated[field] = error;
                } else {
                    delete updated[field];
                }
                return updated;
            });
        }
    };

    // File change handlers
    // Validate Emirates ID date fields
    const validateEmiratesIdDateField = (field, value) => {
        const errors = { ...emiratesIdErrors };
        let error = '';

        if (field === 'issueDate') {
            if (!value || value.trim() === '') {
                error = 'Issue date is required';
            } else {
                const dateValidation = validateDate(value, true);
                if (!dateValidation.isValid) {
                    error = dateValidation.error;
                } else {
                    const issueDate = new Date(value);

                    if (emiratesIdForm.expiryDate) {
                        const expiryDate = new Date(emiratesIdForm.expiryDate);
                        if (expiryDate <= issueDate) {
                            errors.expiryDate = 'Expiry date must be later than the issue date';
                        } else {
                            delete errors.expiryDate;
                        }
                    }
                }
            }
        } else if (field === 'expiryDate') {
            if (!value || value.trim() === '') {
                error = 'Expiry date is required';
            } else {
                const dateValidation = validateDate(value, true);
                if (!dateValidation.isValid) {
                    error = dateValidation.error;
                } else {
                    const expiryDate = new Date(value);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (emiratesIdForm.issueDate) {
                        const issueDate = new Date(emiratesIdForm.issueDate);
                        if (expiryDate <= issueDate) {
                            error = 'Expiry date must be later than the issue date';
                        }
                    }
                }
            }
        }

        if (error) {
            errors[field] = error;
        } else {
            delete errors[field];
        }
        setEmiratesIdErrors(errors);
    };

    const handleEmiratesFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setEmiratesIdForm(prev => ({ ...prev, file: null }));
            setEmiratesIdErrors(prev => ({
                ...prev,
                file: ''
            }));
            return;
        }

        // Validate file type and size
        const allowedTypes = ['application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!allowedTypes.includes(file.type)) {
            setEmiratesIdErrors(prev => ({
                ...prev,
                file: 'Only PDF files are allowed.'
            }));
            if (e.target) {
                e.target.value = '';
            }
            setEmiratesIdForm(prev => ({ ...prev, file: null }));
            return;
        }

        if (file.size > maxSize) {
            setEmiratesIdErrors(prev => ({
                ...prev,
                file: 'File size cannot exceed 5MB.'
            }));
            if (e.target) {
                e.target.value = '';
            }
            setEmiratesIdForm(prev => ({ ...prev, file: null }));
            return;
        }

        // Clear error if valid
        setEmiratesIdErrors(prev => {
            const updated = { ...prev };
            delete updated.file;
            return updated;
        });
        setEmiratesIdForm(prev => ({ ...prev, file }));
    };

    // Validate Labour Card date fields
    const validateLabourCardDateField = (field, value) => {
        const errors = { ...labourCardErrors };
        let error = '';

        if (field === 'issueDate') {
            if (value && value.trim() !== '') {
                const dateValidation = validateDate(value, true);
                if (!dateValidation.isValid) {
                    error = dateValidation.error;
                } else {
                    const issueDate = new Date(value);

                    if (labourCardForm.expiryDate) {

                        const expiryDate = new Date(labourCardForm.expiryDate);
                        if (expiryDate <= issueDate) {
                            errors.expiryDate = 'Expiry date must be later than the issue date';
                        } else {
                            delete errors.expiryDate;
                        }
                    }
                }
            }
        } else if (field === 'expiryDate') {
            if (!value || value.trim() === '') {
                error = 'Expiry date is required';
            } else {
                const dateValidation = validateDate(value, true);
                if (!dateValidation.isValid) {
                    error = dateValidation.error;
                } else {
                    const expiryDate = new Date(value);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (labourCardForm.issueDate) {
                        const issueDate = new Date(labourCardForm.issueDate);
                        if (expiryDate <= issueDate) {
                            error = 'Expiry date must be later than the issue date';
                        }
                    }
                }
            }
        }

        if (error) {
            errors[field] = error;
        } else {
            delete errors[field];
        }
        setLabourCardErrors(errors);
    };

    const handleLabourCardFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setLabourCardForm(prev => ({ ...prev, file: null }));
            setLabourCardErrors(prev => ({
                ...prev,
                file: ''
            }));
            return;
        }

        // Validate file type and size
        const allowedTypes = ['application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!allowedTypes.includes(file.type)) {
            setLabourCardErrors(prev => ({
                ...prev,
                file: 'Only PDF files are allowed.'
            }));
            if (e.target) {
                e.target.value = '';
            }
            setLabourCardForm(prev => ({ ...prev, file: null }));
            return;
        }

        if (file.size > maxSize) {
            setLabourCardErrors(prev => ({
                ...prev,
                file: 'File size cannot exceed 5MB.'
            }));
            if (e.target) {
                e.target.value = '';
            }
            setLabourCardForm(prev => ({ ...prev, file: null }));
            return;
        }

        // Clear error if valid
        setLabourCardErrors(prev => {
            const updated = { ...prev };
            delete updated.file;
            return updated;
        });
        setLabourCardForm(prev => ({ ...prev, file }));
    };

    const handleLabourContractFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setLabourCardForm(prev => ({ ...prev, contractFile: null }));
            setLabourCardErrors(prev => ({
                ...prev,
                contractFile: ''
            }));
            return;
        }

        const allowedTypes = ['application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!allowedTypes.includes(file.type)) {
            setLabourCardErrors(prev => ({
                ...prev,
                contractFile: 'Only PDF files are allowed.'
            }));
            if (e.target) e.target.value = '';
            setLabourCardForm(prev => ({ ...prev, contractFile: null }));
            return;
        }

        if (file.size > maxSize) {
            setLabourCardErrors(prev => ({
                ...prev,
                contractFile: 'File size cannot exceed 5MB.'
            }));
            if (e.target) e.target.value = '';
            setLabourCardForm(prev => ({ ...prev, contractFile: null }));
            return;
        }

        setLabourCardErrors(prev => {
            const updated = { ...prev };
            delete updated.contractFile;
            return updated;
        });
        setLabourCardForm(prev => ({ ...prev, contractFile: file }));
    };

    // Validate Medical Insurance fields
    const validateMedicalInsuranceField = (field, value) => {
        const errors = { ...medicalInsuranceErrors };
        let error = '';

        if (field === 'provider') {
            if (!value || value.trim() === '') {
                error = 'Provider is required';
            } else {
                const providerValidation = validateName(value.trim(), true);
                if (!providerValidation.isValid) {
                    error = providerValidation.error;
                }
            }
        } else if (field === 'issueDate') {
            if (!value || value.trim() === '') {
                error = 'Issue date is required';
            } else {
                const dateValidation = validateDate(value, true);
                if (!dateValidation.isValid) {
                    error = dateValidation.error;
                } else {
                    const issueDate = new Date(value);

                    if (medicalInsuranceForm.expiryDate) {
                        const expiryDate = new Date(medicalInsuranceForm.expiryDate);
                        if (expiryDate <= issueDate) {
                            errors.expiryDate = 'Expiry date must be later than the issue date';
                        } else {
                            delete errors.expiryDate;
                        }
                    }
                }
            }
        } else if (field === 'expiryDate') {
            if (!value || value.trim() === '') {
                error = 'Expiry date is required';
            } else {
                const dateValidation = validateDate(value, true);
                if (!dateValidation.isValid) {
                    error = dateValidation.error;
                } else {
                    const expiryDate = new Date(value);
                    if (medicalInsuranceForm.issueDate) {
                        const issueDate = new Date(medicalInsuranceForm.issueDate);
                        if (expiryDate <= issueDate) {
                            error = 'Expiry date must be later than the issue date';
                        }
                    }
                }
            }
        }

        if (error) {
            errors[field] = error;
        } else {
            delete errors[field];
        }
        setMedicalInsuranceErrors(errors);
    };

    const handleMedicalInsuranceFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setMedicalInsuranceForm(prev => ({ ...prev, file: null }));
            setMedicalInsuranceErrors(prev => ({
                ...prev,
                file: ''
            }));
            return;
        }

        // Validate file type and size
        const allowedTypes = ['application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!allowedTypes.includes(file.type)) {
            setMedicalInsuranceErrors(prev => ({
                ...prev,
                file: 'Only PDF files are allowed.'
            }));
            if (e.target) {
                e.target.value = '';
            }
            setMedicalInsuranceForm(prev => ({ ...prev, file: null }));
            return;
        }

        if (file.size > maxSize) {
            setMedicalInsuranceErrors(prev => ({
                ...prev,
                file: 'File size cannot exceed 5MB.'
            }));
            if (e.target) {
                e.target.value = '';
            }
            setMedicalInsuranceForm(prev => ({ ...prev, file: null }));
            return;
        }

        // Clear error if valid
        setMedicalInsuranceErrors(prev => {
            const updated = { ...prev };
            delete updated.file;
            return updated;
        });
        setMedicalInsuranceForm(prev => ({ ...prev, file }));
    };


    // Emirates ID Handlers
    const handleOpenEmiratesIdModal = useCallback(() => {
        if (employee?.emiratesIdDetails) {
            setEmiratesIdForm({
                number: employee.emiratesIdDetails.number || '',
                issueDate: employee.emiratesIdDetails.issueDate ? employee.emiratesIdDetails.issueDate.substring(0, 10) : '',
                expiryDate: employee.emiratesIdDetails.expiryDate ? employee.emiratesIdDetails.expiryDate.substring(0, 10) : '',
                file: null
            });
            if (employee.emiratesIdDetails.document?.data) {
                const file = base64ToFile(
                    employee.emiratesIdDetails.document.data,
                    employee.emiratesIdDetails.document.name || 'emirates-id.pdf',
                    employee.emiratesIdDetails.document.mimeType || 'application/pdf'
                );
                if (file) {
                    setEmiratesIdForm(prev => ({ ...prev, file }));
                }
            }
        } else {
            setEmiratesIdForm({
                number: '',
                issueDate: '',
                expiryDate: '',
                file: null
            });
        }
        setEmiratesIdErrors({});
        setShowEmiratesIdModal(true);
    }, [employee]);

    const handleCloseEmiratesIdModal = () => {
        if (!savingEmiratesId) {
            setShowEmiratesIdModal(false);
            setEmiratesIdForm({
                number: '',
                issueDate: '',
                expiryDate: '',
                file: null
            });
            setEmiratesIdErrors({});
            if (emiratesIdFileRef.current) {
                emiratesIdFileRef.current.value = '';
            }
        }
    };

    const handleSaveEmiratesId = async () => {
        const errors = {};

        // Validate number
        if (!emiratesIdForm.number || !emiratesIdForm.number.trim()) {
            errors.number = 'Emirates ID number is required';
        }

        // Validate issue date - must be past date
        if (!emiratesIdForm.issueDate) {
            errors.issueDate = 'Issue date is required';
        } else {
            const dateValidation = validateDate(emiratesIdForm.issueDate, true);
            if (!dateValidation.isValid) {
                errors.issueDate = dateValidation.error;
            } else {
                const issueDate = new Date(emiratesIdForm.issueDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (emiratesIdForm.expiryDate) {
                    const expiryDate = new Date(emiratesIdForm.expiryDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    } else {
                        // Clear error if expiry date is valid
                        delete errors.expiryDate;
                    }
                }
            }
        }


        // Validate expiry date
        if (!emiratesIdForm.expiryDate) {
            errors.expiryDate = 'Expiry date is required';
        } else {
            const dateValidation = validateDate(emiratesIdForm.expiryDate, true);
            if (!dateValidation.isValid) {
                errors.expiryDate = dateValidation.error;
            } else {
                const expiryDate = new Date(emiratesIdForm.expiryDate);
                // No strict future check
                if (emiratesIdForm.issueDate) {
                    const issueDate = new Date(emiratesIdForm.issueDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // Validate file
        if (!emiratesIdForm.file && !employee?.emiratesIdDetails?.document?.data) {
            errors.file = 'Document is required';
        }

        if (Object.keys(errors).length > 0) {
            setEmiratesIdErrors(errors);
            return;
        }

        setSavingEmiratesId(true);
        try {
            let upload = null;
            let uploadName = '';
            let uploadMime = '';

            // Upload Emirates ID document to Cloudinary FIRST (if new file provided)
            if (emiratesIdForm.file) {
                uploadName = emiratesIdForm.file.name;
                uploadMime = emiratesIdForm.file.type || 'application/pdf';

                try {
                    setUploadingDocument(true);
                    const base64Data = await fileToBase64(emiratesIdForm.file);
                    const fullBase64 = `data:${uploadMime};base64,${base64Data}`;

                    // Upload to Cloudinary
                    const uploadResponse = await axiosInstance.post(`/Employee/upload-document/${employeeId}`, {
                        document: fullBase64,
                        folder: `employee-documents/${employeeId}/emirates-id`,
                        fileName: uploadName,
                        resourceType: 'raw'
                    }, {
                        timeout: 30000
                    });

                    if (uploadResponse.data && uploadResponse.data.url) {
                        upload = uploadResponse.data.url;
                    } else {
                        throw new Error('No URL returned from upload');
                    }
                } catch (uploadError) {
                    console.error('Error uploading Emirates ID to Cloudinary:', uploadError);
                    setUploadingDocument(false);
                    toast({
                        variant: "destructive",
                        title: "Upload failed",
                        description: uploadError.response?.data?.message || uploadError.message || "Failed to upload document. Please try again."
                    });
                    return;
                } finally {
                    setUploadingDocument(false);
                }
            } else if (employee?.emiratesIdDetails?.document?.url) {
                // Preserve existing Cloudinary URL
                upload = employee.emiratesIdDetails.document.url;
                uploadName = employee.emiratesIdDetails.document.name;
                uploadMime = employee.emiratesIdDetails.document.mimeType;
            } else if (employee?.emiratesIdDetails?.document?.data) {
                // Legacy: existing base64 data
                upload = employee.emiratesIdDetails.document.data;
                uploadName = employee.emiratesIdDetails.document.name;
                uploadMime = employee.emiratesIdDetails.document.mimeType;
            }

            await axiosInstance.patch(`/Employee/emirates-id/${employeeId}`, {
                number: emiratesIdForm.number.trim(),
                issueDate: emiratesIdForm.issueDate,
                expiryDate: emiratesIdForm.expiryDate,
                upload,
                uploadName,
                uploadMime
            });

            // Optimistic update
            updateEmployeeOptimistically({
                emiratesIdDetails: {
                    number: emiratesIdForm.number.trim(),
                    issueDate: emiratesIdForm.issueDate,
                    expiryDate: emiratesIdForm.expiryDate,
                    document: {
                        data: upload || employee?.emiratesIdDetails?.document?.data,
                        name: uploadName || employee?.emiratesIdDetails?.document?.name,
                        mimeType: uploadMime || employee?.emiratesIdDetails?.document?.mimeType
                    }
                }
            });

            handleCloseEmiratesIdModal();
            toast({
                variant: "default",
                title: "Emirates ID updated",
                description: "Emirates ID information has been saved successfully."
            });
        } catch (error) {
            console.error('Failed to save Emirates ID', error);
            toast({
                variant: "destructive",
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setSavingEmiratesId(false);
        }
    };

    // Labour Card Handlers
    const handleOpenLabourCardModal = useCallback(() => {
        if (employee?.labourCardDetails) {
            setLabourCardForm({
                number: employee.labourCardDetails.number || '',
                issueDate: employee.labourCardDetails.issueDate ? employee.labourCardDetails.issueDate.substring(0, 10) : '',
                expiryDate: employee.labourCardDetails.expiryDate ? employee.labourCardDetails.expiryDate.substring(0, 10) : '',
                file: null,
                contractFile: null
            });
            if (employee.labourCardDetails.document?.data) {
                const file = base64ToFile(
                    employee.labourCardDetails.document.data,
                    employee.labourCardDetails.document.name || 'labour-card.pdf',
                    employee.labourCardDetails.document.mimeType || 'application/pdf'
                );
                if (file) {
                    setLabourCardForm(prev => ({ ...prev, file }));
                }
            }
        } else {
            setLabourCardForm({
                number: '',
                issueDate: '',
                expiryDate: '',
                file: null,
                contractFile: null
            });
        }
        setLabourCardErrors({});
        setShowLabourCardModal(true);
    }, [employee]);

    const handleCloseLabourCardModal = () => {
        if (!savingLabourCard) {
            setShowLabourCardModal(false);
            setLabourCardForm({
                number: '',
                issueDate: '',
                expiryDate: '',
                file: null,
                contractFile: null
            });
            setLabourCardErrors({});
            if (labourCardFileRef.current) {
                labourCardFileRef.current.value = '';
            }
            if (labourContractFileRef.current) {
                labourContractFileRef.current.value = '';
            }
        }
    };

    const handleSaveLabourCard = async () => {
        const errors = {};

        // Validate number
        if (!labourCardForm.number || !labourCardForm.number.trim()) {
            errors.number = 'Labour Card number is required';
        }

        if (labourCardForm.issueDate) {
            const dateValidation = validateDate(labourCardForm.issueDate, true);
            if (!dateValidation.isValid) {
                errors.issueDate = dateValidation.error;
            }
        }

        // Validate expiry date - must be future date
        if (!labourCardForm.expiryDate) {
            errors.expiryDate = 'Expiry date is required';
        } else {
            const dateValidation = validateDate(labourCardForm.expiryDate, true);
            if (!dateValidation.isValid) {
                errors.expiryDate = dateValidation.error;
            } else {
                const expiryDate = new Date(labourCardForm.expiryDate);
                if (labourCardForm.issueDate) {
                    const issueDate = new Date(labourCardForm.issueDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // Validate file
        if (!labourCardForm.file && !employee?.labourCardDetails?.document?.data && !employee?.labourCardDetails?.document?.url) {
            errors.file = 'Document is required';
        }
        if (!labourCardForm.contractFile && !employee?.labourCardDetails?.labourContractAttachment?.data && !employee?.labourCardDetails?.labourContractAttachment?.url) {
            errors.contractFile = 'Labour contract attachment is required';
        }

        if (Object.keys(errors).length > 0) {
            setLabourCardErrors(errors);
            return;
        }

        setSavingLabourCard(true);
        try {
            let upload;
            let uploadName = '';
            let uploadMime = '';
            let contractUpload;
            let contractUploadName = '';
            let contractUploadMime = '';

            // Upload Labour Card document to Cloudinary FIRST (if new file provided)
            if (labourCardForm.file) {
                uploadName = labourCardForm.file.name;
                uploadMime = labourCardForm.file.type || 'application/pdf';

                try {
                    setUploadingDocument(true);
                    const base64Data = await fileToBase64(labourCardForm.file);
                    const fullBase64 = `data:${uploadMime};base64,${base64Data}`;

                    // Upload to Cloudinary
                    const uploadResponse = await axiosInstance.post(`/Employee/upload-document/${employeeId}`, {
                        document: fullBase64,
                        folder: `employee-documents/${employeeId}/labour-card`,
                        fileName: uploadName,
                        resourceType: 'raw'
                    }, {
                        timeout: 30000
                    });

                    if (uploadResponse.data && uploadResponse.data.url) {
                        upload = uploadResponse.data.url;
                    } else {
                        throw new Error('No URL returned from upload');
                    }
                } catch (uploadError) {
                    console.error('Error uploading Labour Card to Cloudinary:', uploadError);
                    setUploadingDocument(false);
                    toast({
                        variant: "destructive",
                        title: "Upload failed",
                        description: uploadError.response?.data?.message || uploadError.message || "Failed to upload document. Please try again."
                    });
                    return;
                } finally {
                    setUploadingDocument(false);
                }
            } else if (employee?.labourCardDetails?.document?.url) {
                // Preserve existing Cloudinary URL
                upload = employee.labourCardDetails.document.url;
                uploadName = employee.labourCardDetails.document.name;
                uploadMime = employee.labourCardDetails.document.mimeType;
            } else if (employee?.labourCardDetails?.document?.data) {
                // Legacy: existing base64 data
                upload = employee.labourCardDetails.document.data;
                uploadName = employee.labourCardDetails.document.name;
                uploadMime = employee.labourCardDetails.document.mimeType;
            }

            if (labourCardForm.contractFile) {
                contractUploadName = labourCardForm.contractFile.name;
                contractUploadMime = labourCardForm.contractFile.type || 'application/pdf';
                try {
                    setUploadingDocument(true);
                    const contractBase64Data = await fileToBase64(labourCardForm.contractFile);
                    const contractFullBase64 = `data:${contractUploadMime};base64,${contractBase64Data}`;
                    const contractUploadResponse = await axiosInstance.post(`/Employee/upload-document/${employeeId}`, {
                        document: contractFullBase64,
                        folder: `employee-documents/${employeeId}/labour-contract`,
                        fileName: contractUploadName,
                        resourceType: 'raw'
                    }, {
                        timeout: 30000
                    });
                    if (contractUploadResponse.data && contractUploadResponse.data.url) {
                        contractUpload = contractUploadResponse.data.url;
                    } else {
                        throw new Error('No URL returned from contract upload');
                    }
                } catch (uploadError) {
                    console.error('Error uploading Labour Contract to Cloudinary:', uploadError);
                    setUploadingDocument(false);
                    toast({
                        variant: "destructive",
                        title: "Upload failed",
                        description: uploadError.response?.data?.message || uploadError.message || "Failed to upload labour contract attachment."
                    });
                    return;
                } finally {
                    setUploadingDocument(false);
                }
            } else if (employee?.labourCardDetails?.labourContractAttachment?.url) {
                contractUpload = employee.labourCardDetails.labourContractAttachment.url;
                contractUploadName = employee.labourCardDetails.labourContractAttachment.name;
                contractUploadMime = employee.labourCardDetails.labourContractAttachment.mimeType;
            } else if (employee?.labourCardDetails?.labourContractAttachment?.data) {
                contractUpload = employee.labourCardDetails.labourContractAttachment.data;
                contractUploadName = employee.labourCardDetails.labourContractAttachment.name;
                contractUploadMime = employee.labourCardDetails.labourContractAttachment.mimeType;
            }

            await axiosInstance.patch(`/Employee/labour-card/${employeeId}`, {
                number: labourCardForm.number.trim(),
                issueDate: labourCardForm.issueDate,
                expiryDate: labourCardForm.expiryDate,
                upload,
                uploadName,
                uploadMime,
                contractUpload,
                contractUploadName,
                contractUploadMime
            });

            await fetchEmployee();
            handleCloseLabourCardModal();
            toast({
                variant: "default",
                title: "Labour Card updated",
                description: "Labour Card information has been saved successfully."
            });
        } catch (error) {
            console.error('Failed to save Labour Card', error);
            toast({
                variant: "destructive",
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setSavingLabourCard(false);
        }
    };

    // Medical Insurance Handlers
    const handleOpenMedicalInsuranceModal = useCallback(() => {
        if (employee?.medicalInsuranceDetails) {
            setMedicalInsuranceForm({
                provider: employee.medicalInsuranceDetails.provider || '',
                number: employee.medicalInsuranceDetails.number || '',
                issueDate: employee.medicalInsuranceDetails.issueDate ? employee.medicalInsuranceDetails.issueDate.substring(0, 10) : '',
                expiryDate: employee.medicalInsuranceDetails.expiryDate ? employee.medicalInsuranceDetails.expiryDate.substring(0, 10) : '',
                file: null
            });
            if (employee.medicalInsuranceDetails.document?.data) {
                const file = base64ToFile(
                    employee.medicalInsuranceDetails.document.data,
                    employee.medicalInsuranceDetails.document.name || 'medical-insurance.pdf',
                    employee.medicalInsuranceDetails.document.mimeType || 'application/pdf'
                );
                if (file) {
                    setMedicalInsuranceForm(prev => ({ ...prev, file }));
                }
            }
        } else {
            setMedicalInsuranceForm({
                provider: '',
                number: '',
                issueDate: '',
                expiryDate: '',
                file: null
            });
        }
        setMedicalInsuranceErrors({});
        setShowMedicalInsuranceModal(true);
    }, [employee]);

    const handleCloseMedicalInsuranceModal = () => {
        if (!savingMedicalInsurance) {
            setShowMedicalInsuranceModal(false);
            setMedicalInsuranceForm({
                provider: '',
                number: '',
                issueDate: '',
                expiryDate: '',
                file: null
            });
            setMedicalInsuranceErrors({});
            if (medicalInsuranceFileRef.current) {
                medicalInsuranceFileRef.current.value = '';
            }
        }
    };

    const handleSaveMedicalInsurance = async () => {
        const errors = {};

        // Validate provider - letters and spaces only
        if (!medicalInsuranceForm.provider || !medicalInsuranceForm.provider.trim()) {
            errors.provider = 'Provider is required';
        } else {
            const providerValidation = validateName(medicalInsuranceForm.provider.trim(), true);
            if (!providerValidation.isValid) {
                errors.provider = providerValidation.error;
            }
        }

        // Validate number
        if (!medicalInsuranceForm.number || !medicalInsuranceForm.number.trim()) {
            errors.number = 'Policy number is required';
        }

        // Validate issue date - must be past date
        if (!medicalInsuranceForm.issueDate) {
            errors.issueDate = 'Issue date is required';
        } else {
            const dateValidation = validateDate(medicalInsuranceForm.issueDate, true);
            if (!dateValidation.isValid) {
                errors.issueDate = dateValidation.error;
            } else {
                const issueDate = new Date(medicalInsuranceForm.issueDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (medicalInsuranceForm.expiryDate) {
                    const expiryDate = new Date(medicalInsuranceForm.expiryDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // Validate expiry date
        if (!medicalInsuranceForm.expiryDate) {
            errors.expiryDate = 'Expiry date is required';
        } else {
            const dateValidation = validateDate(medicalInsuranceForm.expiryDate, true);
            if (!dateValidation.isValid) {
                errors.expiryDate = dateValidation.error;
            } else {
                const expiryDate = new Date(medicalInsuranceForm.expiryDate);
                // No strict future check
                if (medicalInsuranceForm.issueDate) {
                    const issueDate = new Date(medicalInsuranceForm.issueDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // Validate file
        if (!medicalInsuranceForm.file && !employee?.medicalInsuranceDetails?.document?.data) {
            errors.file = 'Document is required';
        }

        if (Object.keys(errors).length > 0) {
            setMedicalInsuranceErrors(errors);
            return;
        }

        setSavingMedicalInsurance(true);
        try {
            let upload = null;
            let uploadName = '';
            let uploadMime = '';

            // Upload Medical Insurance document to Cloudinary FIRST (if new file provided)
            if (medicalInsuranceForm.file) {
                uploadName = medicalInsuranceForm.file.name;
                uploadMime = medicalInsuranceForm.file.type || 'application/pdf';

                try {
                    setUploadingDocument(true);
                    const base64Data = await fileToBase64(medicalInsuranceForm.file);
                    const fullBase64 = `data:${uploadMime};base64,${base64Data}`;

                    // Upload to Cloudinary
                    const uploadResponse = await axiosInstance.post(`/Employee/upload-document/${employeeId}`, {
                        document: fullBase64,
                        folder: `employee-documents/${employeeId}/medical-insurance`,
                        fileName: uploadName,
                        resourceType: 'raw'
                    }, {
                        timeout: 30000
                    });

                    if (uploadResponse.data && uploadResponse.data.url) {
                        upload = uploadResponse.data.url;
                    } else {
                        throw new Error('No URL returned from upload');
                    }
                } catch (uploadError) {
                    console.error('Error uploading Medical Insurance to Cloudinary:', uploadError);
                    setUploadingDocument(false);
                    toast({
                        variant: "destructive",
                        title: "Upload failed",
                        description: uploadError.response?.data?.message || uploadError.message || "Failed to upload document. Please try again."
                    });
                    return;
                } finally {
                    setUploadingDocument(false);
                }
            } else if (employee?.medicalInsuranceDetails?.document?.url) {
                // Preserve existing Cloudinary URL
                upload = employee.medicalInsuranceDetails.document.url;
                uploadName = employee.medicalInsuranceDetails.document.name;
                uploadMime = employee.medicalInsuranceDetails.document.mimeType;
            } else if (employee?.medicalInsuranceDetails?.document?.data) {
                // Legacy: existing base64 data
                upload = employee.medicalInsuranceDetails.document.data;
                uploadName = employee.medicalInsuranceDetails.document.name;
                uploadMime = employee.medicalInsuranceDetails.document.mimeType;
            }

            await axiosInstance.patch(`/Employee/medical-insurance/${employeeId}`, {
                provider: medicalInsuranceForm.provider.trim(),
                number: medicalInsuranceForm.number.trim(),
                issueDate: medicalInsuranceForm.issueDate,
                expiryDate: medicalInsuranceForm.expiryDate,
                upload,
                uploadName,
                uploadMime
            });

            await fetchEmployee();
            handleCloseMedicalInsuranceModal();
            toast({
                variant: "default",
                title: "Medical Insurance updated",
                description: "Medical Insurance information has been saved successfully."
            });
        } catch (error) {
            console.error('Failed to save Medical Insurance', error);
            toast({
                variant: "destructive",
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setSavingMedicalInsurance(false);
        }
    };

    // Driving License Handlers
    const handleOpenDrivingLicenseModal = useCallback(() => {
        if (employee?.drivingLicenceDetails) {
            setDrivingLicenseForm({
                number: employee.drivingLicenceDetails.number || '',
                issueDate: employee.drivingLicenceDetails.issueDate ? employee.drivingLicenceDetails.issueDate.substring(0, 10) : '',
                expiryDate: employee.drivingLicenceDetails.expiryDate ? employee.drivingLicenceDetails.expiryDate.substring(0, 10) : '',
                file: null
            });
            if (employee.drivingLicenceDetails.document?.data) {
                const file = base64ToFile(
                    employee.drivingLicenceDetails.document.data,
                    employee.drivingLicenceDetails.document.name || 'driving-license.pdf',
                    employee.drivingLicenceDetails.document.mimeType || 'application/pdf'
                );
                if (file) {
                    setDrivingLicenseForm(prev => ({ ...prev, file }));
                }
            }
        } else {
            setDrivingLicenseForm({
                number: '',
                issueDate: '',
                expiryDate: '',
                file: null
            });
        }
        setDrivingLicenseErrors({});
        setShowDrivingLicenseModal(true);
    }, [employee]);

    const handleCloseDrivingLicenseModal = () => {
        if (!savingDrivingLicense) {
            setShowDrivingLicenseModal(false);
            setDrivingLicenseForm({
                number: '',
                issueDate: '',
                expiryDate: '',
                file: null
            });
            setDrivingLicenseErrors({});
            if (drivingLicenseFileRef.current) {
                drivingLicenseFileRef.current.value = '';
            }
        }
    };

    // Validate Driving License date fields
    const validateDrivingLicenseDateField = (field, value) => {
        const errors = { ...drivingLicenseErrors };
        let error = '';

        if (field === 'issueDate') {
            if (!value || value.trim() === '') {
                error = 'Issue date is required';
            } else {
                const dateValidation = validateDate(value, true);
                if (!dateValidation.isValid) {
                    error = dateValidation.error;
                } else {
                    const issueDate = new Date(value);

                    if (drivingLicenseForm.expiryDate) {
                        const expiryDate = new Date(drivingLicenseForm.expiryDate);
                        if (expiryDate <= issueDate) {
                            errors.expiryDate = 'Expiry date must be later than the issue date';
                        } else {
                            delete errors.expiryDate;
                        }
                    }
                }
            }
        } else if (field === 'expiryDate') {
            if (!value || value.trim() === '') {
                error = 'Expiry date is required';
            } else {
                const dateValidation = validateDate(value, true);
                if (!dateValidation.isValid) {
                    error = dateValidation.error;
                } else {
                    const expiryDate = new Date(value);
                    // No strict future check
                    if (drivingLicenseForm.issueDate) {
                        const issueDate = new Date(drivingLicenseForm.issueDate);
                        if (expiryDate <= issueDate) {
                            error = 'Expiry date must be later than the issue date';
                        }
                    }
                }
            }
        }

        if (error) {
            errors[field] = error;
        } else {
            delete errors[field];
        }
        setDrivingLicenseErrors(errors);
    };

    const handleDrivingLicenseFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setDrivingLicenseForm(prev => ({ ...prev, file: null }));
            setDrivingLicenseErrors(prev => ({
                ...prev,
                file: ''
            }));
            return;
        }

        // Validate file type and size
        const allowedTypes = ['application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!allowedTypes.includes(file.type)) {
            setDrivingLicenseErrors(prev => ({
                ...prev,
                file: 'Only PDF files are allowed.'
            }));
            if (e.target) {
                e.target.value = '';
            }
            setDrivingLicenseForm(prev => ({ ...prev, file: null }));
            return;
        }

        if (file.size > maxSize) {
            setDrivingLicenseErrors(prev => ({
                ...prev,
                file: 'File size cannot exceed 5MB.'
            }));
            if (e.target) {
                e.target.value = '';
            }
            setDrivingLicenseForm(prev => ({ ...prev, file: null }));
            return;
        }

        // Clear error if valid
        setDrivingLicenseErrors(prev => ({
            ...prev,
            file: ''
        }));

        setDrivingLicenseForm(prev => ({ ...prev, file }));
    };

    const handleSaveDrivingLicense = async () => {
        const errors = {};

        // Validate number
        if (!drivingLicenseForm.number || !drivingLicenseForm.number.trim()) {
            errors.number = 'Driving License number is required';
        }

        // Validate issue date - must be past date
        if (!drivingLicenseForm.issueDate) {
            errors.issueDate = 'Issue date is required';
        } else {
            const dateValidation = validateDate(drivingLicenseForm.issueDate, true);
            if (!dateValidation.isValid) {
                errors.issueDate = dateValidation.error;
            } else {
                const issueDate = new Date(drivingLicenseForm.issueDate);

                if (drivingLicenseForm.expiryDate) {
                    const expiryDate = new Date(drivingLicenseForm.expiryDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // Validate expiry date
        if (!drivingLicenseForm.expiryDate) {
            errors.expiryDate = 'Expiry date is required';
        } else {
            const dateValidation = validateDate(drivingLicenseForm.expiryDate, true);
            if (!dateValidation.isValid) {
                errors.expiryDate = dateValidation.error;
            } else {
                const expiryDate = new Date(drivingLicenseForm.expiryDate);
                // No strict future check
                if (drivingLicenseForm.issueDate) {
                    const issueDate = new Date(drivingLicenseForm.issueDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // Validate file
        if (!drivingLicenseForm.file && !employee?.drivingLicenceDetails?.document?.data) {
            errors.file = 'Document is required';
        }

        if (Object.keys(errors).length > 0) {
            setDrivingLicenseErrors(errors);
            return;
        }

        setSavingDrivingLicense(true);
        try {
            let upload = null;
            let uploadName = '';
            let uploadMime = '';

            // Upload Driving License document to Cloudinary FIRST (if new file provided)
            if (drivingLicenseForm.file) {
                uploadName = drivingLicenseForm.file.name;
                uploadMime = drivingLicenseForm.file.type || 'application/pdf';

                try {
                    setUploadingDocument(true);
                    const base64Data = await fileToBase64(drivingLicenseForm.file);
                    const fullBase64 = `data:${uploadMime};base64,${base64Data}`;

                    // Upload to Cloudinary
                    const uploadResponse = await axiosInstance.post(`/Employee/upload-document/${employeeId}`, {
                        document: fullBase64,
                        folder: `employee-documents/${employeeId}/driving-license`,
                        fileName: uploadName,
                        resourceType: 'raw'
                    }, {
                        timeout: 30000
                    });

                    if (uploadResponse.data && uploadResponse.data.url) {
                        upload = uploadResponse.data.url;
                    } else {
                        throw new Error('No URL returned from upload');
                    }
                } catch (uploadError) {
                    console.error('Error uploading Driving License to Cloudinary:', uploadError);
                    setUploadingDocument(false);
                    toast({
                        variant: "destructive",
                        title: "Upload failed",
                        description: uploadError.response?.data?.message || uploadError.message || "Failed to upload document. Please try again."
                    });
                    return;
                } finally {
                    setUploadingDocument(false);
                }
            } else if (employee?.drivingLicenceDetails?.document?.url) {
                // Preserve existing Cloudinary URL
                upload = employee.drivingLicenceDetails.document.url;
                uploadName = employee.drivingLicenceDetails.document.name;
                uploadMime = employee.drivingLicenceDetails.document.mimeType;
            } else if (employee?.drivingLicenceDetails?.document?.data) {
                // Legacy: existing base64 data
                upload = employee.drivingLicenceDetails.document.data;
                uploadName = employee.drivingLicenceDetails.document.name;
                uploadMime = employee.drivingLicenceDetails.document.mimeType;
            }

            const response = await axiosInstance.patch(`/Employee/driving-license/${employeeId}`, {
                number: drivingLicenseForm.number.trim(),
                issueDate: drivingLicenseForm.issueDate,
                expiryDate: drivingLicenseForm.expiryDate,
                document: upload,
                documentName: uploadName,
                documentMime: uploadMime
            });
            const isQueuedApproval = String(response?.data?.message || '').toLowerCase().includes('queued for hr activation approval');

            await fetchEmployee();
            handleCloseDrivingLicenseModal();
            toast({
                variant: "default",
                title: isQueuedApproval ? "Driving License queued" : "Driving License updated",
                description: isQueuedApproval
                    ? "Change is stored for HR activation approval. Live card will update after approval."
                    : "Driving License information has been saved successfully."
            });
        } catch (error) {
            console.error('Failed to save Driving License', error);
            toast({
                variant: "destructive",
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setSavingDrivingLicense(false);
        }
    };

    // Bank Details Modal Handlers
    const handleOpenBankModal = (mode = 'edit') => {
        const hasExistingBankData = Boolean(
            employee?.bankName ||
            employee?.bank ||
            employee?.accountName ||
            employee?.bankAccountName ||
            employee?.accountNumber ||
            employee?.bankAccountNumber ||
            employee?.ibanNumber ||
            employee?.bankAttachment?.url ||
            employee?.bankAttachment?.data
        );
        const resolvedMode = mode === 'edit' && !hasExistingBankData ? 'add' : mode;
        setBankModalMode(resolvedMode);
        if (employee && mode !== 'update') {
            // Extract existing document data (could be Cloudinary URL or base64)
            let fileBase64 = '';
            let fileName = '';
            let fileMime = '';

            if (employee.bankAttachment) {
                // Check if it's a Cloudinary URL or base64 data
                if (employee.bankAttachment.url) {
                    fileBase64 = employee.bankAttachment.url;
                } else if (employee.bankAttachment.data) {
                    fileBase64 = employee.bankAttachment.data;
                }
                fileName = employee.bankAttachment.name || 'bank-attachment.pdf';
                fileMime = employee.bankAttachment.mimeType || 'application/pdf';
            }

            setBankForm({
                bankName: employee.bankName || employee.bank || '',
                accountName: employee.accountName || employee.bankAccountName || '',
                accountNumber: employee.accountNumber || employee.bankAccountNumber || '',
                ibanNumber: employee.ibanNumber || '',
                swiftCode: employee.swiftCode || employee.ifscCode || employee.ifsc || '',
                otherDetails: employee.bankOtherDetails || employee.otherBankDetails || '',
                file: null,
                fileBase64: fileBase64,
                fileName: fileName,
                fileMime: fileMime
            });
        } else {
            setBankForm({
                bankName: '',
                accountName: '',
                accountNumber: '',
                ibanNumber: '',
                swiftCode: '',
                otherDetails: '',
                file: null,
                fileBase64: '',
                fileName: '',
                fileMime: ''
            });
        }
        setBankFormErrors({
            bankName: '',
            accountName: '',
            accountNumber: '',
            ibanNumber: '',
            swiftCode: '',
            otherDetails: '',
            file: ''
        });
        setShowBankModal(true);
    };

    const handleCloseBankModal = () => {
        if (!savingBank) {
            setShowBankModal(false);
            setBankModalMode('edit');
            setBankForm({
                bankName: '',
                accountName: '',
                accountNumber: '',
                ibanNumber: '',
                swiftCode: '',
                otherDetails: '',
                file: null,
                fileBase64: '',
                fileName: '',
                fileMime: ''
            });
            setBankFormErrors({
                bankName: '',
                accountName: '',
                accountNumber: '',
                ibanNumber: '',
                swiftCode: '',
                otherDetails: '',
                file: ''
            });
            if (bankFileRef.current) {
                bankFileRef.current.value = '';
            }
        }
    };

    const handleBankFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setBankForm(prev => ({
                ...prev,
                file: null,
            }));
            setBankFormErrors(prev => ({
                ...prev,
                file: ''
            }));
            return;
        }

        // Validate file type and size
        const allowedTypes = ['application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!allowedTypes.includes(file.type)) {
            setBankFormErrors(prev => ({
                ...prev,
                file: 'Only PDF files are allowed.'
            }));
            if (e.target) {
                e.target.value = '';
            }
            setBankForm(prev => ({
                ...prev,
                file: null,
            }));
            return;
        }

        if (file.size > maxSize) {
            setBankFormErrors(prev => ({
                ...prev,
                file: 'File size cannot exceed 5MB.'
            }));
            if (e.target) {
                e.target.value = '';
            }
            setBankForm(prev => ({
                ...prev,
                file: null,
            }));
            return;
        }

        // Clear error if valid
        setBankFormErrors(prev => ({
            ...prev,
            file: ''
        }));

        // When new file is selected, clear existing document fields
        setBankForm(prev => ({
            ...prev,
            file,
            fileBase64: '',
            fileName: '',
            fileMime: ''
        }));
    };

    const handleBankChange = (field, value) => {
        // Apply input restrictions based on field type
        let sanitizedValue = value;

        switch (field) {
            case 'bankName':
            case 'accountName':
                // Only allow letters and spaces
                sanitizedValue = value.replace(/[^A-Za-z\s]/g, '');
                break;
            case 'accountNumber':
                // Only allow numbers
                sanitizedValue = value.replace(/[^0-9]/g, '');
                break;
            case 'ibanNumber':
                // Allow alphanumeric and spaces (will be validated for IBAN format)
                sanitizedValue = value.replace(/[^A-Za-z0-9\s]/g, '').toUpperCase();
                break;
            case 'swiftCode':
                // Allow alphanumeric (will be validated for SWIFT format)
                sanitizedValue = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                break;
            case 'otherDetails':
                // Free text - no restrictions
                sanitizedValue = value;
                break;
            default:
                sanitizedValue = value;
                break;
        }

        setBankForm(prev => ({ ...prev, [field]: sanitizedValue }));

        // Clear error when user starts typing
        setBankFormErrors(prev => ({ ...prev, [field]: '' }));

        // Validate field on change
        let validationResult = { isValid: true, error: '' };

        switch (field) {
            case 'bankName':
                validationResult = validateBankName(sanitizedValue, true);
                break;
            case 'accountName':
                validationResult = validateAccountName(sanitizedValue, true);
                break;
            case 'accountNumber':
                validationResult = validateAccountNumber(sanitizedValue, true);
                break;
            case 'ibanNumber':
                validationResult = validateIBAN(sanitizedValue, true);
                break;
            case 'swiftCode':
                validationResult = validateSWIFT(sanitizedValue, false);
                break;
            case 'otherDetails':
                if (sanitizedValue && sanitizedValue.trim() !== '') {
                    validationResult = validateTextLength(sanitizedValue, null, 500, false);
                }
                break;
            default:
                break;
        }

        if (!validationResult.isValid) {
            setBankFormErrors(prev => ({ ...prev, [field]: validationResult.error }));
        }
    };

    const handleSaveBank = async () => {
        if (!employeeId) return;

        // Validate all fields
        const errors = {
            bankName: '',
            accountName: '',
            accountNumber: '',
            ibanNumber: '',
            swiftCode: '',
            otherDetails: '',
            file: ''
        };

        let hasErrors = false;

        // Validate Bank Name
        const bankNameValidation = validateBankName(bankForm.bankName, true);
        if (!bankNameValidation.isValid) {
            errors.bankName = bankNameValidation.error;
            hasErrors = true;
        }

        // Validate Account Name
        const accountNameValidation = validateAccountName(bankForm.accountName, true);
        if (!accountNameValidation.isValid) {
            errors.accountName = accountNameValidation.error;
            hasErrors = true;
        }

        // Validate Account Number
        const accountNumberValidation = validateAccountNumber(bankForm.accountNumber, true);
        if (!accountNumberValidation.isValid) {
            errors.accountNumber = accountNumberValidation.error;
            hasErrors = true;
        }

        // Validate IBAN Number
        const ibanValidation = validateIBAN(bankForm.ibanNumber, true);
        if (!ibanValidation.isValid) {
            errors.ibanNumber = ibanValidation.error;
            hasErrors = true;
        }

        // Validate SWIFT Code (optional)
        if (bankForm.swiftCode && bankForm.swiftCode.trim() !== '') {
            const swiftValidation = validateSWIFT(bankForm.swiftCode, false);
            if (!swiftValidation.isValid) {
                errors.swiftCode = swiftValidation.error;
                hasErrors = true;
            }
        }

        // Validate Other Details (optional)
        if (bankForm.otherDetails && bankForm.otherDetails.trim() !== '') {
            const otherDetailsValidation = validateTextLength(bankForm.otherDetails, null, 500, false);
            if (!otherDetailsValidation.isValid) {
                errors.otherDetails = otherDetailsValidation.error;
                hasErrors = true;
            }
        }


        // Set errors and stop if validation fails
        if (hasErrors) {
            setBankFormErrors(errors);
            setSavingBank(false);
            return;
        }

        try {
            setSavingBank(true);

            // Upload bank attachment to Cloudinary FIRST (if new file provided)
            let bankAttachmentCloudinaryUrl = null;
            let bankAttachmentName = '';
            let bankAttachmentMime = '';

            if (bankForm.file) {
                // New file selected - upload to Cloudinary
                const base64Data = await fileToBase64(bankForm.file);
                bankAttachmentName = bankForm.file.name;
                bankAttachmentMime = bankForm.file.type || 'application/pdf';
                const fullBase64 = `data:${bankAttachmentMime};base64,${base64Data}`;

                try {
                    setUploadingDocument(true);
                    // Upload to Cloudinary (this happens before save, so user sees progress)
                    const uploadResponse = await axiosInstance.post(`/Employee/upload-document/${employeeId}`, {
                        document: fullBase64,
                        folder: `employee-documents/${employeeId}/bank`,
                        fileName: bankAttachmentName,
                        resourceType: 'raw'
                    }, {
                        timeout: 30000 // 30 second timeout for large files
                    });

                    if (uploadResponse.data && uploadResponse.data.url) {
                        bankAttachmentCloudinaryUrl = uploadResponse.data.url;
                        // Update form state to show uploaded document
                        setBankForm(prev => ({
                            ...prev,
                            fileBase64: bankAttachmentCloudinaryUrl,
                            fileName: bankAttachmentName,
                            fileMime: bankAttachmentMime
                        }));
                    } else {
                        throw new Error('No URL returned from upload');
                    }
                } catch (uploadError) {
                    console.error('Error uploading bank attachment to Cloudinary:', uploadError);
                    // If upload fails, throw error to stop save process
                    setUploadingDocument(false);
                    toast({
                        variant: "destructive",
                        title: "Upload failed",
                        description: uploadError.response?.data?.message || uploadError.message || "Failed to upload document. Please try again."
                    });
                    return;
                } finally {
                    setUploadingDocument(false);
                }
            } else if (bankForm.fileBase64) {
                // Preserve existing attachment from form state (could be Cloudinary URL or base64)
                bankAttachmentCloudinaryUrl = bankForm.fileBase64;
                bankAttachmentName = bankForm.fileName || 'bank-attachment.pdf';
                bankAttachmentMime = bankForm.fileMime || 'application/pdf';
            } else if (employee?.bankAttachment) {
                // Fallback: preserve existing attachment from employee data
                bankAttachmentCloudinaryUrl = employee.bankAttachment.url || employee.bankAttachment.data;
                bankAttachmentName = employee.bankAttachment.name;
                bankAttachmentMime = employee.bankAttachment.mimeType;
            }

            // Build bank attachment object
            let bankAttachmentObj = undefined;
            if (bankAttachmentCloudinaryUrl) {
                if (bankAttachmentCloudinaryUrl.startsWith('http')) {
                    bankAttachmentObj = {
                        url: bankAttachmentCloudinaryUrl,
                        name: bankAttachmentName,
                        mimeType: bankAttachmentMime
                    };
                } else {
                    bankAttachmentObj = {
                        data: bankAttachmentCloudinaryUrl,
                        name: bankAttachmentName,
                        mimeType: bankAttachmentMime
                    };
                }
            }

            const payload = {
                bankName: bankForm.bankName.trim(),
                accountName: bankForm.accountName.trim(),
                accountNumber: bankForm.accountNumber.trim(),
                ibanNumber: bankForm.ibanNumber.trim().toUpperCase(),
                swiftCode: bankForm.swiftCode.trim().toUpperCase(),
                bankOtherDetails: bankForm.otherDetails.trim(),
                bankAttachment: bankAttachmentObj
            };
            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, payload);

            // Optimistically update employee state with saved bank details
            updateEmployeeOptimistically({
                bankName: bankForm.bankName.trim(),
                accountName: bankForm.accountName.trim(),
                accountNumber: bankForm.accountNumber.trim(),
                ibanNumber: bankForm.ibanNumber.trim().toUpperCase(),
                swiftCode: bankForm.swiftCode.trim().toUpperCase(),
                bankOtherDetails: bankForm.otherDetails.trim(),
                bankAttachment: bankAttachmentObj
            });
            setLocalPendingBankData({
                bankName: bankForm.bankName.trim(),
                accountName: bankForm.accountName.trim(),
                accountNumber: bankForm.accountNumber.trim(),
                ibanNumber: bankForm.ibanNumber.trim().toUpperCase(),
                swiftCode: bankForm.swiftCode.trim().toUpperCase(),
                bankOtherDetails: bankForm.otherDetails.trim(),
                bankAttachment: bankAttachmentObj
            });

            // Close modal and reset form immediately for better UX
            setShowBankModal(false);
            setBankFormErrors({
                bankName: '',
                accountName: '',
                accountNumber: '',
                ibanNumber: '',
                swiftCode: '',
                otherDetails: '',
                file: ''
            });
            if (bankFileRef.current) {
                bankFileRef.current.value = '';
            }

            // Show success toast immediately
            toast({
                variant: "default",
                title: "Salary Bank Account Updated",
                description: "Salary bank account details were saved successfully."
            });

            // Fetch employee data in background (non-blocking)
            fetchEmployee().catch(err => {
                console.error('Error refreshing employee data:', err);
            });
        } catch (error) {
            console.error('Failed to update bank details', error);
            toast({
                variant: "destructive",
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setSavingBank(false);
        }
    };

    // Salary Details Modal Handlers
    // Month options
    const monthOptions = [
        { value: 'January', label: 'January' },
        { value: 'February', label: 'February' },
        { value: 'March', label: 'March' },
        { value: 'April', label: 'April' },
        { value: 'May', label: 'May' },
        { value: 'June', label: 'June' },
        { value: 'July', label: 'July' },
        { value: 'August', label: 'August' },
        { value: 'September', label: 'September' },
        { value: 'October', label: 'October' },
        { value: 'November', label: 'November' },
        { value: 'December', label: 'December' }
    ];

    // Calculate total salary
    const calculateTotalSalary = (basic, houseRentAllowance, vehicleAllowance, fuelAllowance, otherAllowance) => {
        const basicNum = parseFloat(basic) || 0;
        const hraNum = parseFloat(houseRentAllowance) || 0;
        const vehicleNum = parseFloat(vehicleAllowance) || 0;
        const fuelNum = parseFloat(fuelAllowance) || 0;
        const otherNum = parseFloat(otherAllowance) || 0;
        return (basicNum + hraNum + vehicleNum + fuelNum + otherNum).toFixed(2);
    };


    const handleOpenSalaryModal = () => {
        setSalaryMode(hasSalaryDetailsMemo ? 'edit' : 'add');
        if (employee) {
            // If editing initial salary, try to get month and fromDate from active entry in history
            let month = '';
            let fromDate = '';
            const vehicleAllowance = employee.additionalAllowances?.find(a => a.type?.toLowerCase().includes('vehicle'))?.amount || 0;
            const fuelAllowance = employee.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount || 0;

            if (hasSalaryDetailsMemo && employee.salaryHistory && employee.salaryHistory.length > 0) {
                // Find the active entry (one without toDate)
                const activeEntry = employee.salaryHistory.find(entry => !entry.toDate);
                if (activeEntry) {
                    month = activeEntry.month || '';
                    fromDate = activeEntry.fromDate ? new Date(activeEntry.fromDate).toISOString().split('T')[0] : '';
                } else {
                    // If no active entry, find initial entry
                    const initialEntry = employee.salaryHistory.find(entry => {
                        const entryBasic = entry.basic || 0;
                        const entryOther = entry.otherAllowance || 0;
                        const employeeBasic = employee.basic || 0;
                        const employeeOther = employee.otherAllowance || 0;
                        return (entryBasic === employeeBasic && entryOther === employeeOther) || entry.isInitial;
                    });
                    if (initialEntry) {
                        month = initialEntry.month || '';
                        fromDate = initialEntry.fromDate ? new Date(initialEntry.fromDate).toISOString().split('T')[0] : '';
                    }
                }

                if (!month && employee.dateOfJoining) {
                    const dateOfJoining = new Date(employee.dateOfJoining);
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                    month = monthNames[dateOfJoining.getMonth()];
                }
            } else if (employee.dateOfJoining) {
                const dateOfJoining = new Date(employee.dateOfJoining);
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                month = monthNames[dateOfJoining.getMonth()];
                fromDate = dateOfJoining.toISOString().split('T')[0];
            }

            // Get offer letter data from active entry or main employee (check both url and data like passport)
            let offerLetterData = null;
            let offerLetterName = '';
            let offerLetterMime = '';
            if (hasSalaryDetailsMemo && employee.salaryHistory && employee.salaryHistory.length > 0) {
                const activeEntry = employee.salaryHistory.find(entry => !entry.toDate);
                if (activeEntry?.offerLetter) {
                    // Check for Cloudinary URL first, then base64 data (like passport pattern)
                    offerLetterData = activeEntry.offerLetter.url || activeEntry.offerLetter.data || '';
                    offerLetterName = activeEntry.offerLetter.name || 'offer-letter.pdf';
                    offerLetterMime = activeEntry.offerLetter.mimeType || 'application/pdf';
                } else if (employee.offerLetter) {
                    offerLetterData = employee.offerLetter.url || employee.offerLetter.data || '';
                    offerLetterName = employee.offerLetter.name || 'offer-letter.pdf';
                    offerLetterMime = employee.offerLetter.mimeType || 'application/pdf';
                }
            } else if (employee.offerLetter) {
                offerLetterData = employee.offerLetter.url || employee.offerLetter.data || '';
                offerLetterName = employee.offerLetter.name || 'offer-letter.pdf';
                offerLetterMime = employee.offerLetter.mimeType || 'application/pdf';
            }

            setSalaryForm({
                month: month,
                fromDate: fromDate || (employee.dateOfJoining ? new Date(employee.dateOfJoining).toISOString().split('T')[0] : ''),
                basic: employee.basic ? String(employee.basic) : '',
                houseRentAllowance: employee.houseRentAllowance ? String(employee.houseRentAllowance) : '',
                vehicleAllowance: vehicleAllowance ? String(vehicleAllowance) : '',
                fuelAllowance: fuelAllowance ? String(fuelAllowance) : '',
                otherAllowance: employee.otherAllowance ? String(employee.otherAllowance) : '',
                totalSalary: calculateTotalSalary(
                    employee.basic ? String(employee.basic) : '',
                    employee.houseRentAllowance ? String(employee.houseRentAllowance) : '',
                    vehicleAllowance ? String(vehicleAllowance) : '',
                    fuelAllowance ? String(fuelAllowance) : '',
                    employee.otherAllowance ? String(employee.otherAllowance) : ''
                ),
                offerLetterFile: null,
                offerLetterFileBase64: offerLetterData || '',
                offerLetterFileName: offerLetterName,
                offerLetterFileMime: offerLetterMime
            });

            // Set editing index + subdoc id to active salary entry (if exists)
            if (employee.salaryHistory && employee.salaryHistory.length > 0) {
                const activeEntry = employee.salaryHistory.find((entry) => !entry.toDate);
                const activeIndex = employee.salaryHistory.findIndex((entry) => !entry.toDate);
                if (activeEntry?._id) {
                    setEditingSalaryEntryId(String(activeEntry._id));
                } else {
                    setEditingSalaryEntryId(null);
                }
                setEditingSalaryIndex(activeIndex !== -1 ? activeIndex : null);
            } else {
                setEditingSalaryEntryId(null);
                setEditingSalaryIndex(null);
            }
        } else {
            const today = new Date();
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const currentMonth = monthNames[today.getMonth()];
            setSalaryForm({
                month: currentMonth,
                fromDate: today.toISOString().split('T')[0],
                basic: '',
                houseRentAllowance: '',
                vehicleAllowance: '',
                fuelAllowance: '',
                otherAllowance: '',
                totalSalary: '0.00',
                offerLetterFile: null,
                offerLetterFileBase64: '',
                offerLetterFileName: '',
                offerLetterFileMime: ''
            });
            setEditingSalaryIndex(null);
            setEditingSalaryEntryId(null);
        }
        setSalaryFormErrors({
            month: '',
            fromDate: '',
            basic: '',
            houseRentAllowance: '',
            vehicleAllowance: '',
            fuelAllowance: '',
            otherAllowance: ''
        });
        setShowSalaryModal(true);
    };

    const handleOpenIncrementModal = () => {
        setSalaryMode('increment');
        if (employee) {
            // Standardize Allowances
            const vehicleAllowance = employee.additionalAllowances?.find(a => a.type?.toLowerCase().includes('vehicle'))?.amount || 0;
            const fuelAllowance = employee.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount || 0;

            // For increment, we pre-fill with CURRENT salary details but new dates
            setSalaryForm({
                month: '', // User selects new month/date
                fromDate: new Date().toISOString().split('T')[0], // Default to today
                basic: employee.basic ? String(employee.basic) : '',
                houseRentAllowance: employee.houseRentAllowance ? String(employee.houseRentAllowance) : '',
                vehicleAllowance: employee.vehicleAllowance ? String(employee.vehicleAllowance) : '',
                fuelAllowance: employee.fuelAllowance ? String(employee.fuelAllowance) : String(fuelAllowance),
                otherAllowance: employee.otherAllowance ? String(employee.otherAllowance) : '',
                totalSalary: calculateTotalSalary(
                    employee.basic ? String(employee.basic) : '',
                    employee.houseRentAllowance ? String(employee.houseRentAllowance) : '',
                    employee.vehicleAllowance ? String(employee.vehicleAllowance) : '',
                    String(fuelAllowance),
                    employee.otherAllowance ? String(employee.otherAllowance) : ''
                ),
                offerLetterFile: null, // User must upload new letter for increment
                offerLetterFileBase64: '',
                offerLetterFileName: '',
                offerLetterFileMime: ''
            });

            setSalaryFormErrors({
                month: '',
                fromDate: '',
                basic: '',
                houseRentAllowance: '',
                vehicleAllowance: '',
                fuelAllowance: '',
                otherAllowance: '',
                offerLetter: ''
            });
        }
        setEditingSalaryIndex(null); // Increment is a NEW entry, not editing an index
        setEditingSalaryEntryId(null);
        setShowSalaryModal(true);
    };

    const handleCloseSalaryModal = () => {
        if (!savingSalary) {
            setShowSalaryModal(false);
            const today = new Date();
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const currentMonth = monthNames[today.getMonth()];
            setSalaryForm({
                month: currentMonth,
                fromDate: '',
                basic: '',
                houseRentAllowance: '',
                vehicleAllowance: '',
                fuelAllowance: '',
                otherAllowance: '',
                totalSalary: '0.00',
                offerLetterFile: null,
                offerLetterFileBase64: '',
                offerLetterFileName: '',
                offerLetterFileMime: ''
            });
            setSalaryFormErrors({
                month: '',
                fromDate: '',
                basic: '',
                houseRentAllowance: '',
                vehicleAllowance: '',
                fuelAllowance: '',
                otherAllowance: '',
                offerLetter: ''
            });
            setEditingSalaryIndex(null);
            setEditingSalaryEntryId(null);
        }
    };

    const handleOfferLetterFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setSalaryForm(prev => ({
                ...prev,
                offerLetterFile: null,
                offerLetterFileBase64: '',
                offerLetterFileName: '',
                offerLetterFileMime: ''
            }));
            setSalaryFormErrors(prev => ({
                ...prev,
                offerLetter: ''
            }));
            return;
        }

        // Validate file type and size
        const allowedTypes = ['application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!allowedTypes.includes(file.type)) {
            setSalaryFormErrors(prev => ({
                ...prev,
                offerLetter: 'Only PDF files are allowed.'
            }));
            if (e.target) {
                e.target.value = '';
            }
            setSalaryForm(prev => ({
                ...prev,
                offerLetterFile: null,
                offerLetterFileBase64: '',
                offerLetterFileName: '',
                offerLetterFileMime: ''
            }));
            return;
        }

        if (file.size > maxSize) {
            setSalaryFormErrors(prev => ({
                ...prev,
                offerLetter: 'File size cannot exceed 5MB.'
            }));
            if (e.target) {
                e.target.value = '';
            }
            setSalaryForm(prev => ({
                ...prev,
                offerLetterFile: null,
                offerLetterFileBase64: '',
                offerLetterFileName: '',
                offerLetterFileMime: ''
            }));
            return;
        }

        // Clear error if valid
        setSalaryFormErrors(prev => ({
            ...prev,
            offerLetter: ''
        }));

        // Convert file to base64
        const reader = new FileReader();
        reader.onloadend = () => {
            setSalaryForm(prev => ({
                ...prev,
                offerLetterFile: file,
                offerLetterFileBase64: typeof reader.result === 'string' ? reader.result : '',
                offerLetterFileName: file.name,
                offerLetterFileMime: file.type
            }));
        };
        reader.onerror = () => {
            setSalaryFormErrors(prev => ({
                ...prev,
                offerLetter: 'Failed to read file. Please try again.'
            }));
        };
        reader.readAsDataURL(file);
    };

    const handleSalaryChange = (field, value) => {
        let updatedForm = { ...salaryForm };

        if (field === 'month') {
            updatedForm.month = value;
            setSalaryFormErrors(prev => ({ ...prev, month: '' }));
        } else if (field === 'fromDate') {
            updatedForm.fromDate = value;
            // Validate date
            if (!value || value.trim() === '') {
                setSalaryFormErrors(prev => ({ ...prev, fromDate: 'From Date is required' }));
            } else {
                const dateValidation = validateDate(value, true);
                if (!dateValidation.isValid) {
                    setSalaryFormErrors(prev => ({ ...prev, fromDate: dateValidation.error }));
                } else {
                    setSalaryFormErrors(prev => ({ ...prev, fromDate: '' }));
                }
            }
        } else if (field === 'basic' || field === 'houseRentAllowance' || field === 'vehicleAllowance' || field === 'fuelAllowance' || field === 'otherAllowance' || field === 'totalSalary') {
            // Only allow numbers and decimal point
            const numericValue = value.replace(/[^0-9.]/g, '');
            // Prevent multiple decimal points
            const parts = numericValue.split('.');
            const sanitizedValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : numericValue;
            updatedForm[field] = sanitizedValue;

            // Validate numeric field
            if (sanitizedValue && sanitizedValue.trim() !== '') {
                const numValue = parseFloat(sanitizedValue);
                if (isNaN(numValue) || numValue < 0) {
                    setSalaryFormErrors(prev => ({ ...prev, [field]: 'Please enter a valid positive number' }));
                } else if (numValue > 10000000) {
                    setSalaryFormErrors(prev => ({ ...prev, [field]: 'Amount cannot exceed 10,000,000' }));
                } else {
                    setSalaryFormErrors(prev => ({ ...prev, [field]: '' }));
                }
            } else {
                setSalaryFormErrors(prev => ({ ...prev, [field]: '' }));
            }

            // Auto-calculate total salary only if totalSalary field is not being manually edited
            // Allow manual entry of totalSalary - only auto-calculate when other fields change
            if (field !== 'totalSalary') {
                const total = calculateTotalSalary(
                    field === 'basic' ? sanitizedValue : updatedForm.basic,
                    field === 'houseRentAllowance' ? sanitizedValue : updatedForm.houseRentAllowance,
                    field === 'vehicleAllowance' ? sanitizedValue : updatedForm.vehicleAllowance,
                    field === 'fuelAllowance' ? sanitizedValue : updatedForm.fuelAllowance,
                    field === 'otherAllowance' ? sanitizedValue : updatedForm.otherAllowance
                );
                updatedForm.totalSalary = total;
            }
            // If totalSalary is being manually edited, keep the manual value
        }

        setSalaryForm(updatedForm);
    };

    const handleSaveSalary = async (mode = 'save') => {
        if (!employeeId) return;

        /** Map UI row to raw `employee.salaryHistory` index (display list can be deduped / different order). */
        const resolveSalaryHistoryEditIndex = (saveMode) => {
            const raw = Array.isArray(employee?.salaryHistory) ? employee.salaryHistory : [];
            if (saveMode === 'increment') return null;
            if (editingSalaryEntryId) {
                const byId = raw.findIndex((e) => e?._id && String(e._id) === String(editingSalaryEntryId));
                if (byId >= 0) return byId;
            }
            if (editingSalaryIndex != null && editingSalaryIndex >= 0 && editingSalaryIndex < raw.length) {
                return editingSalaryIndex;
            }
            if (salaryMode === 'edit' && raw.length > 0) {
                const active = raw.findIndex((e) => !e.toDate);
                if (active >= 0) return active;
                let bestI = 0;
                let bestT = new Date(raw[0].fromDate || 0).getTime();
                for (let j = 1; j < raw.length; j += 1) {
                    const t = new Date(raw[j].fromDate || 0).getTime();
                    if (!Number.isNaN(t) && (Number.isNaN(bestT) || t >= bestT)) {
                        bestT = t;
                        bestI = j;
                    }
                }
                return bestI;
            }
            return null;
        };

        const editIdxResolved = resolveSalaryHistoryEditIndex(mode);

        // Validate all fields
        const errors = {
            fromDate: '',
            basic: '',
            houseRentAllowance: '',
            vehicleAllowance: '',
            otherAllowance: '',
            offerLetter: ''
        };

        let hasErrors = false;

        // Auto-derive Month from FromDate (if valid)
        // If fromDate is invalid, we can't derive it, but we validate fromDate next.
        // We will set salaryForm.month derived from fromDate for consistency if needed, 
        // but primarily we rely on fromDate.

        // Validate From Date - must be valid date
        if (!salaryForm.fromDate || salaryForm.fromDate.trim() === '') {
            errors.fromDate = 'From Date is required';
            hasErrors = true;
        } else {
            const dateValidation = validateDate(salaryForm.fromDate, true);
            if (!dateValidation.isValid) {
                errors.fromDate = dateValidation.error;
                hasErrors = true;
            } else {
                // Check if From Date is greater than previous salary's From Date
                if (employee?.salaryHistory && employee.salaryHistory.length > 0) {
                    // Logic:
                    // If mode is 'increment', we are adding a NEW salary that supersedes the current active one.
                    // The new fromDate must be > the active salary's fromDate.
                    // The active salary is typically the one with no toDate, or the latest one.
                    // Assuming history is sorted or at least we find the relevant previous one.

                    // If we are 'editing' an existing one, we might need to check against the one *before* it in time, but the user request specifically mentioned "previous from date" likely in the context of increments.
                    // Let's focus on 'increment' or 'add' when history exists.

                    if (mode === 'increment' || (mode === 'add' && employee.salaryHistory.length > 0)) {
                        // Find the latest salary (or the one we are incrementing from)
                        let previousSalary = null;

                        // If incrementing specific entry
                        if (editingSalaryIndex !== null && employee.salaryHistory[editingSalaryIndex]) {
                            previousSalary = employee.salaryHistory[editingSalaryIndex];
                        } else {
                            // Find the one with latest fromDate
                            previousSalary = employee.salaryHistory.reduce((prev, current) => {
                                return (new Date(prev.fromDate) > new Date(current.fromDate)) ? prev : current;
                            }, employee.salaryHistory[0]);
                        }

                        if (previousSalary && previousSalary.fromDate) {
                            const newFromDate = new Date(salaryForm.fromDate);
                            const prevFromDate = new Date(previousSalary.fromDate);

                            // Compare purely dates (reset time just in case, though usually YYYY-MM-DD strings are parsed to UTC 00:00 or local)
                            // Better to compare ISO strings or set hours to 0
                            newFromDate.setHours(0, 0, 0, 0);
                            prevFromDate.setHours(0, 0, 0, 0);

                            if (newFromDate <= prevFromDate) {
                                errors.fromDate = `From Date must be after ${new Date(previousSalary.fromDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
                                hasErrors = true;
                            }
                        }
                    }
                }
            }
        }

        // Helper function to safely get string value
        const getStringValue = (value) => {
            if (value === null || value === undefined) return '';
            return String(value);
        };

        // Validate Basic Salary
        const basicStr = getStringValue(salaryForm.basic);
        if (!basicStr || basicStr.trim() === '') {
            errors.basic = 'Basic salary is required';
            hasErrors = true;
        } else {
            const basicValue = parseFloat(basicStr);
            if (isNaN(basicValue) || basicValue < 0) {
                errors.basic = 'Please enter a valid positive number';
                hasErrors = true;
            } else if (basicValue > 10000000) {
                errors.basic = 'Amount cannot exceed 10,000,000';
                hasErrors = true;
            }
        }

        // Validate House Rent Allowance (optional but must be valid if provided)
        const hraStr = getStringValue(salaryForm.houseRentAllowance);
        if (hraStr && hraStr.trim() !== '') {
            const hraValue = parseFloat(hraStr);
            if (isNaN(hraValue) || hraValue < 0) {
                errors.houseRentAllowance = 'Please enter a valid positive number';
                hasErrors = true;
            } else if (hraValue > 10000000) {
                errors.houseRentAllowance = 'Amount cannot exceed 10,000,000';
                hasErrors = true;
            }
        }

        // Validate Vehicle Allowance (optional but must be valid if provided)
        const vehicleStr = getStringValue(salaryForm.vehicleAllowance);
        if (vehicleStr && vehicleStr.trim() !== '') {
            const vehicleValue = parseFloat(vehicleStr);
            if (isNaN(vehicleValue) || vehicleValue < 0) {
                errors.vehicleAllowance = 'Please enter a valid positive number';
                hasErrors = true;
            } else if (vehicleValue > 10000000) {
                errors.vehicleAllowance = 'Amount cannot exceed 10,000,000';
                hasErrors = true;
            }
        }

        // Validate Fuel Allowance (optional but must be valid if provided)
        const fuelStr = getStringValue(salaryForm.fuelAllowance);
        if (fuelStr && fuelStr.trim() !== '') {
            const fuelValue = parseFloat(fuelStr);
            if (isNaN(fuelValue) || fuelValue < 0) {
                errors.fuelAllowance = 'Please enter a valid positive number';
                hasErrors = true;
            } else if (fuelValue > 10000000) {
                errors.fuelAllowance = 'Amount cannot exceed 10,000,000';
                hasErrors = true;
            }
        }

        // Validate Other Allowance (optional but must be valid if provided)
        const otherStr = getStringValue(salaryForm.otherAllowance);
        if (otherStr && otherStr.trim() !== '') {
            const otherValue = parseFloat(otherStr);
            if (isNaN(otherValue) || otherValue < 0) {
                errors.otherAllowance = 'Please enter a valid positive number';
                hasErrors = true;
            } else if (otherValue > 10000000) {
                errors.otherAllowance = 'Amount cannot exceed 10,000,000';
                hasErrors = true;
            }
        }

        // Validate Salary Letter - Required
        const hasExistingOfferLetter = (() => {
            if (editIdxResolved !== null && employee?.salaryHistory) {
                const sortedHistory = [...employee.salaryHistory];
                const entryToEdit = sortedHistory[editIdxResolved];
                return (entryToEdit?.offerLetter?.url || entryToEdit?.offerLetter?.data) ? true : false;
            } else if (hasSalaryDetailsMemo && employee?.salaryHistory) {
                const activeEntry = employee.salaryHistory.find(entry => !entry.toDate);
                return (activeEntry?.offerLetter?.url || activeEntry?.offerLetter?.data) ? true : false;
            }
            return (employee?.offerLetter?.url || employee?.offerLetter?.data) ? true : false;
        })();

        if (!salaryForm.offerLetterFileBase64 && !salaryForm.offerLetterFile && !hasExistingOfferLetter) {
            errors.offerLetter = 'Salary letter is required';
            hasErrors = true;
        }

        // Set errors and stop if validation fails
        if (hasErrors) {
            setSalaryFormErrors(errors);
            setSavingSalary(false);
            return;
        }

        try {
            setSavingSalary(true);

            // Upload salary letter to Cloudinary FIRST (if new file provided)
            let offerLetterCloudinaryUrl = null;
            let offerLetterName = '';
            let offerLetterMime = '';

            if (salaryForm.offerLetterFile) {
                // New file selected - upload to Cloudinary
                const base64Data = await fileToBase64(salaryForm.offerLetterFile);
                const fileMime = salaryForm.offerLetterFile.type || 'application/pdf';
                const fullBase64 = `data:${fileMime};base64,${base64Data}`;

                try {
                    setUploadingDocument(true);
                    // Upload to Cloudinary (this happens before save, so user sees progress)
                    const uploadResponse = await axiosInstance.post(`/Employee/upload-document/${employeeId}`, {
                        document: fullBase64,
                        folder: `employee-documents/${employeeId}/salary`,
                        fileName: salaryForm.offerLetterFile.name || 'salary-letter',
                        resourceType: 'raw'
                    }, {
                        timeout: 30000 // 30 second timeout for large files
                    });

                    if (uploadResponse.data && uploadResponse.data.url) {
                        offerLetterCloudinaryUrl = uploadResponse.data.url;
                        offerLetterName = salaryForm.offerLetterFile.name || 'salary-letter.pdf';
                        offerLetterMime = fileMime;
                        // Update form state to show uploaded document
                        setSalaryForm(prev => ({
                            ...prev,
                            offerLetterFileBase64: offerLetterCloudinaryUrl,
                            offerLetterFileName: offerLetterName,
                            offerLetterFileMime: offerLetterMime,
                            offerLetterFile: null // Clear file object since we now have Cloudinary URL
                        }));
                    } else {
                        throw new Error('No URL returned from upload');
                    }
                } catch (uploadError) {
                    console.error('Error uploading salary letter to Cloudinary:', uploadError);
                    // If upload fails, throw error to stop save process
                    setUploadingDocument(false);
                    toast({
                        variant: "destructive",
                        title: "Upload failed",
                        description: uploadError.response?.data?.message || uploadError.message || "Failed to upload document. Please try again."
                    });
                    return;
                } finally {
                    setUploadingDocument(false);
                }
            } else if (salaryForm.offerLetterFileBase64 && !salaryForm.offerLetterFileBase64.startsWith('http')) {
                // Base64 data that needs to be uploaded (shouldn't happen often, but handle it)
                try {
                    setUploadingDocument(true);
                    const uploadResponse = await axiosInstance.post(`/Employee/upload-document/${employeeId}`, {
                        document: salaryForm.offerLetterFileBase64,
                        folder: `employee-documents/${employeeId}/salary`,
                        fileName: salaryForm.offerLetterFileName || 'salary-letter',
                        resourceType: 'raw'
                    }, {
                        timeout: 30000
                    });

                    if (uploadResponse.data && uploadResponse.data.url) {
                        offerLetterCloudinaryUrl = uploadResponse.data.url;
                        offerLetterName = salaryForm.offerLetterFileName || 'salary-letter.pdf';
                        offerLetterMime = salaryForm.offerLetterFileMime || 'application/pdf';
                        // Update form state to show uploaded document
                        setSalaryForm(prev => ({
                            ...prev,
                            offerLetterFileBase64: offerLetterCloudinaryUrl,
                            offerLetterFileName: offerLetterName,
                            offerLetterFileMime: offerLetterMime
                        }));
                    } else {
                        throw new Error('No URL returned from upload');
                    }
                } catch (uploadError) {
                    console.error('Error uploading salary letter to Cloudinary:', uploadError);
                    setUploadingDocument(false);
                    toast({
                        variant: "destructive",
                        title: "Upload failed",
                        description: uploadError.response?.data?.message || uploadError.message || "Failed to upload document. Please try again."
                    });
                    return;
                } finally {
                    setUploadingDocument(false);
                }
            } else if (salaryForm.offerLetterFileBase64 && salaryForm.offerLetterFileBase64.startsWith('http')) {
                // Already a Cloudinary URL - preserve it
                offerLetterCloudinaryUrl = salaryForm.offerLetterFileBase64;
                offerLetterName = salaryForm.offerLetterFileName || 'offer-letter.pdf';
                offerLetterMime = salaryForm.offerLetterFileMime || 'application/pdf';
            }

            const basicStr = getStringValue(salaryForm.basic);
            const hraStr = getStringValue(salaryForm.houseRentAllowance);
            const vehicleStr = getStringValue(salaryForm.vehicleAllowance);
            const fuelStr = getStringValue(salaryForm.fuelAllowance);
            const otherStr = getStringValue(salaryForm.otherAllowance);

            const basic = parseFloat(basicStr);
            const houseRentAllowance = hraStr && hraStr.trim() !== '' ? parseFloat(hraStr) : 0;
            const vehicleAllowance = vehicleStr && vehicleStr.trim() !== '' ? parseFloat(vehicleStr) : 0;
            const fuelAllowance = fuelStr && fuelStr.trim() !== '' ? parseFloat(fuelStr) : 0;
            const otherAllowance = otherStr && otherStr.trim() !== '' ? parseFloat(otherStr) : 0;
            // Always recalculate totalSalary to ensure it includes all components (including fuel allowance)
            const totalSalary = parseFloat(calculateTotalSalary(basicStr, hraStr, vehicleStr, fuelStr, otherStr));

            // Prepare salary history
            const salaryHistory = employee?.salaryHistory ? [...employee.salaryHistory] : [];

            // Determine if we are updating an existing record or adding a new one
            // 'increment' mode ALWAYS adds a new record
            if (editIdxResolved !== null && editIdxResolved >= 0 && mode !== 'increment') {
                // Editing existing record from history - keep original dates
                const sortedHistory = [...salaryHistory];
                const entryToEdit = sortedHistory[editIdxResolved];
                if (!entryToEdit) {
                    toast({
                        variant: 'destructive',
                        title: 'Unable to save',
                        description: 'Could not find the salary record to update. Refresh and try again.',
                    });
                    setSavingSalary(false);
                    return;
                }

                // Validate duplicate month/year (excluding current entry)
                const newMonth = salaryForm.month || entryToEdit.month;
                const newFromDate = salaryForm.fromDate ? new Date(salaryForm.fromDate) : (entryToEdit.fromDate ? new Date(entryToEdit.fromDate) : new Date());

                const isDuplicate = salaryHistory.some((entry, idx) => {
                    if (idx === editIdxResolved) return false; // Skip self

                    if (entry.month === newMonth) return true;

                    if (entry.fromDate) {
                        const entryDate = new Date(entry.fromDate);
                        return entryDate.getMonth() === newFromDate.getMonth() &&
                            entryDate.getFullYear() === newFromDate.getFullYear();
                    }
                    return false;
                });

                if (isDuplicate) {
                    toast({
                        variant: "destructive",
                        title: "Duplicate Entry",
                        description: `A salary record for ${newMonth} already exists.`
                    });
                    setSavingSalary(false);
                    return;
                }

                // Update the entry - keep original dates, only update salary amounts
                const updatedEntry = {
                    ...entryToEdit,
                    month: salaryForm.month || entryToEdit.month,
                    basic: basic,
                    houseRentAllowance: houseRentAllowance,
                    vehicleAllowance: vehicleAllowance,
                    fuelAllowance: fuelAllowance,
                    otherAllowance: otherAllowance,
                    totalSalary: totalSalary
                };
                // Update salary letter if provided, otherwise preserve existing
                if (offerLetterCloudinaryUrl) {
                    updatedEntry.offerLetter = {
                        url: offerLetterCloudinaryUrl,
                        name: offerLetterName,
                        mimeType: offerLetterMime
                    };
                } else if (entryToEdit?.offerLetter) {
                    // Preserve existing salary letter if no new file is uploaded
                    updatedEntry.offerLetter = entryToEdit.offerLetter;
                }

                salaryHistory[editIdxResolved] = updatedEntry;
            } else {
                // Adding new record or editing initial salary through "Edit Salary Details"
                // OR Incrementing (mode === 'increment')
                const today = new Date();
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

                // Check if this is editing the initial salary (when employee has basic/otherAllowance)
                const isEditingInitialSalary = hasSalaryDetailsMemo;

                // If incrementing, we skip the "Edit Initial" logic and force add new
                // Never treat "Edit Salary" modal as initial-salary replacement (that path unshifts a duplicate row).
                if (isEditingInitialSalary && mode !== 'increment' && salaryMode !== 'edit') {
                    // Editing initial salary - preserve history by closing old entry and creating new one
                    const fromDate = salaryForm.fromDate ? new Date(salaryForm.fromDate) : today;
                    const month = monthNames[fromDate.getMonth()] + ' ' + fromDate.getFullYear();

                    // Check for duplicates
                    const isDuplicate = salaryHistory.some(entry => {
                        if (entry.month === month) return true;
                        if (entry.fromDate) {
                            const entryDate = new Date(entry.fromDate);
                            return entryDate.getMonth() === fromDate.getMonth() &&
                                entryDate.getFullYear() === fromDate.getFullYear();
                        }
                        return false;
                    });

                    if (isDuplicate) {
                        toast({
                            variant: "destructive",
                            title: "Duplicate Entry",
                            description: `A salary record for ${month} already exists.`
                        });
                        setSavingSalary(false);
                        return;
                    }

                    // Find existing initial salary entry (one that matches the old basic/otherAllowance or has isInitial flag)
                    const oldBasic = employee.basic || 0;
                    const oldOther = employee.otherAllowance || 0;
                    const oldTotal = oldBasic + oldOther;

                    const initialEntryIndex = salaryHistory.findIndex(entry => {
                        const entryBasic = entry.basic || 0;
                        const entryOther = entry.otherAllowance || 0;
                        const entryTotal = entryBasic + entryOther;
                        // Match by current values or isInitial flag, but only if it doesn't have a toDate (is still active)
                        return ((entryBasic === oldBasic && entryOther === oldOther && entryTotal === oldTotal) || entry.isInitial) && !entry.toDate;
                    });

                    if (initialEntryIndex !== -1) {
                        // Close the old initial salary entry by setting its toDate to the new fromDate MINUS 1 DAY? 
                        // Or just fromDate? Usually if new starts on 1st, old ends on last of previous month.
                        // Implemented: Set toDate to 1 month prior to new fromDate (Month/Year precision)
                        const prevDate = new Date(fromDate);
                        prevDate.setMonth(prevDate.getMonth() - 1);
                        const oldEntry = salaryHistory[initialEntryIndex];
                        salaryHistory[initialEntryIndex] = {
                            ...oldEntry,
                            toDate: prevDate
                        };
                    }

                    // Create new initial salary entry with updated values
                    const newInitialSalaryEntry = {
                        month: month,
                        fromDate: fromDate,
                        toDate: null, // Active until next change
                        basic: basic,
                        houseRentAllowance: houseRentAllowance,
                        vehicleAllowance: vehicleAllowance,
                        fuelAllowance: fuelAllowance,
                        otherAllowance: otherAllowance,
                        totalSalary: totalSalary,
                        createdAt: today,
                        isInitial: true
                    };
                    // Add salary letter if provided
                    if (offerLetterCloudinaryUrl) {
                        newInitialSalaryEntry.offerLetter = {
                            url: offerLetterCloudinaryUrl,
                            name: offerLetterName,
                            mimeType: offerLetterMime
                        };
                    }
                    salaryHistory.unshift(newInitialSalaryEntry); // Add new entry at the top (latest first)
                } else {
                    // Adding new salary record (not initial) or Incrementing
                    const fromDate = salaryForm.fromDate ? new Date(salaryForm.fromDate) : today;
                    const month = monthNames[fromDate.getMonth()] + ' ' + fromDate.getFullYear();

                    // Update the previous active entry's toDate 
                    if (salaryHistory.length > 0) {
                        const currentActiveEntry = salaryHistory.find(entry => !entry.toDate);
                        if (currentActiveEntry) {
                            // Check if trying to add salary for the same month/year
                            const isDuplicate = salaryHistory.some(entry => {
                                if (entry.month === month) return true;
                                if (entry.fromDate) {
                                    const entryDate = new Date(entry.fromDate);
                                    return entryDate.getMonth() === fromDate.getMonth() &&
                                        entryDate.getFullYear() === fromDate.getFullYear();
                                }
                                return false;
                            });

                            if (isDuplicate) {
                                toast({
                                    variant: "destructive",
                                    title: "Duplicate Entry",
                                    description: `A salary record for ${month} already exists.`
                                });
                                setSavingSalary(false);
                                return;
                            }

                            // Set toDate to 1 month prior to new fromDate
                            const prevDate = new Date(fromDate);
                            prevDate.setMonth(prevDate.getMonth() - 1);
                            currentActiveEntry.toDate = prevDate;
                        } else {
                            // No active entry found, but still check for duplicates in history
                            const isDuplicate = salaryHistory.some(entry => {
                                if (entry.month === month) return true;
                                if (entry.fromDate) {
                                    const entryDate = new Date(entry.fromDate);
                                    return entryDate.getMonth() === fromDate.getMonth() &&
                                        entryDate.getFullYear() === fromDate.getFullYear();
                                }
                                return false;
                            });

                            if (isDuplicate) {
                                toast({
                                    variant: "destructive",
                                    title: "Duplicate Entry",
                                    description: `A salary record for ${month} already exists.`
                                });
                                setSavingSalary(false);
                                return;
                            }
                        }
                    }

                    // Create new salary history entry
                    const newHistoryEntry = {
                        month: month,
                        fromDate: fromDate,
                        toDate: null, // Will be set when next salary is added
                        basic: basic,
                        houseRentAllowance: houseRentAllowance,
                        vehicleAllowance: vehicleAllowance,
                        fuelAllowance: fuelAllowance,
                        otherAllowance: otherAllowance,
                        totalSalary: totalSalary,
                        createdAt: today
                    };
                    // Add salary letter if provided
                    if (offerLetterCloudinaryUrl) {
                        newHistoryEntry.offerLetter = {
                            url: offerLetterCloudinaryUrl,
                            name: offerLetterName,
                            mimeType: offerLetterMime
                        };
                    }

                    salaryHistory.unshift(newHistoryEntry); // Add new entry at the top (latest first)
                }
            }

            // Update employee's main fields to match the latest active entry (first entry without toDate, or first entry)
            const latestActiveEntry = salaryHistory.find(entry => !entry.toDate) || salaryHistory[0];

            // Prepare additionalAllowances array for vehicle and fuel allowance
            const additionalAllowances = [];
            if (vehicleAllowance > 0) {
                additionalAllowances.push({
                    type: 'Vehicle',
                    amount: vehicleAllowance
                });
            }
            if (fuelAllowance > 0) {
                additionalAllowances.push({
                    type: 'Fuel',
                    amount: fuelAllowance
                });
            }

            const payload = {
                basic: latestActiveEntry?.basic ?? basic,
                houseRentAllowance: latestActiveEntry?.houseRentAllowance ?? houseRentAllowance,
                additionalAllowances: additionalAllowances,
                otherAllowance: latestActiveEntry?.otherAllowance ?? otherAllowance,
                monthlySalary: latestActiveEntry?.totalSalary ?? totalSalary,
                totalSalary: latestActiveEntry?.totalSalary ?? totalSalary,
                salaryHistory: salaryHistory
            };

            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, payload);

            // Optimistically update employee state with saved salary details
            // latestActiveEntry is already declared above
            updateEmployeeOptimistically({
                basic: latestActiveEntry?.basic ?? basic,
                houseRentAllowance: latestActiveEntry?.houseRentAllowance ?? houseRentAllowance,
                vehicleAllowance: latestActiveEntry?.vehicleAllowance ?? vehicleAllowance,
                fuelAllowance: latestActiveEntry?.fuelAllowance ?? fuelAllowance,
                otherAllowance: latestActiveEntry?.otherAllowance ?? otherAllowance,
                monthlySalary: latestActiveEntry?.totalSalary ?? totalSalary,
                totalSalary: latestActiveEntry?.totalSalary ?? totalSalary,
                salaryHistory: salaryHistory,
                // Update salary letter if it was saved
                ...(offerLetterCloudinaryUrl && {
                    offerLetter: {
                        url: offerLetterCloudinaryUrl,
                        name: offerLetterName,
                        mimeType: offerLetterMime
                    }
                })
            });

            // Close modal and reset form immediately for better UX
            setShowSalaryModal(false);
            setEditingSalaryIndex(null);
            setEditingSalaryEntryId(null);
            setSalaryFormErrors({
                month: '',
                fromDate: '',
                basic: '',
                houseRentAllowance: '',
                vehicleAllowance: '',
                fuelAllowance: '',
                otherAllowance: '',
                offerLetter: ''
            });

            // Show success toast immediately
            toast({
                variant: "default",
                title: mode === 'edit' ? "Salary Record Updated" : (mode === 'increment' ? "Salary Incremented" : "Salary Record Added"),
                description: mode === 'edit'
                    ? "Salary record was updated successfully."
                    : (mode === 'increment'
                        ? "Salary has been incremented successfully."
                        : "Salary record was added successfully.")
            });

            // Fetch employee data in background (non-blocking)
            fetchEmployee().catch(err => {
                console.error('Error refreshing employee data:', err);
            });
        } catch (error) {
            console.error('Failed to update salary details', error);
            toast({
                variant: "destructive",
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setSavingSalary(false);
        }
    };

    const hasPermanentAddress = Boolean(
        (employee?.addressLine1 && employee.addressLine1.trim() !== '') ||
        (employee?.addressLine2 && employee.addressLine2.trim() !== '') ||
        (employee?.city && employee.city.trim() !== '') ||
        (employee?.state && employee.state.trim() !== '') ||
        (employee?.country && employee.country.trim() !== '') ||
        (employee?.postalCode && employee.postalCode.trim() !== '')
    );

    const hasCurrentAddress = Boolean(
        (employee?.currentAddressLine1 && employee.currentAddressLine1.trim() !== '') ||
        (employee?.currentAddressLine2 && employee.currentAddressLine2.trim() !== '') ||
        (employee?.currentCity && employee.currentCity.trim() !== '') ||
        (employee?.currentState && employee.currentState.trim() !== '') ||
        (employee?.currentCountry && employee.currentCountry.trim() !== '') ||
        (employee?.currentPostalCode && employee.currentPostalCode.trim() !== '')
    );

    // Check if there are valid emergency contacts (must have both name and number)
    const hasContactDetails = (() => {
        // Check array of contacts
        if (Array.isArray(employee?.emergencyContacts) && employee.emergencyContacts.length > 0) {
            // Verify at least one contact has both name and number
            return employee.emergencyContacts.some(contact =>
                contact?.name?.trim() && contact?.number?.trim()
            );
        }

        // Check legacy fields - must have both name and number
        if (employee?.emergencyContactName?.trim() && employee?.emergencyContactNumber?.trim()) {
            return true;
        }

        return false;
    })();
    const reportingAuthorityValueForDisplay = employee?.reportingAuthority
        ? (reportingAuthorityDisplayName || (reportingAuthorityLoading ? 'Loading...' : '—'))
        : null;

    const getExistingContacts = () => {
        if (Array.isArray(employee?.emergencyContacts) && employee.emergencyContacts.length > 0) {
            return employee.emergencyContacts.map((contact, index) => ({
                id: contact._id?.toString() || null,
                index,
                name: contact.name?.trim() || '',
                relation: contact.relation || 'Self',
                number: contact.number?.trim() || ''
            }));
        }

        if (
            (employee?.emergencyContactName && employee.emergencyContactName.trim() !== '') ||
            (employee?.emergencyContactNumber && employee.emergencyContactNumber.trim() !== '')
        ) {
            return [{
                id: null,
                index: 0,
                name: employee.emergencyContactName?.trim() || '',
                relation: employee.emergencyContactRelation || 'Self',
                number: employee.emergencyContactNumber?.trim() || ''
            }];
        }

        return [];
    };

    const handleOpenAddressModal = (type) => {
        setAddressModalType(type);
        let countryFullName = '';
        let stateFullName = '';
        let countryCode = '';
        let stateCode = '';

        if (type === 'permanent') {
            // Convert state and country codes to full names
            stateCode = employee?.state || '';
            countryCode = employee?.country || '';
            stateFullName = stateCode ? getStateName(countryCode, stateCode) : '';
            countryFullName = countryCode ? getCountryName(countryCode) : '';

            // If getCountryName returns the code (not found), try to find it in the countries list
            if (countryFullName === countryCode && countryCode) {
                const country = Country.getCountryByCode(countryCode);
                countryFullName = country ? country.name : countryCode;
            }

            setAddressForm({
                line1: employee?.addressLine1 || '',
                line2: employee?.addressLine2 || '',
                city: employee?.city || '',
                state: stateFullName || stateCode || '',
                country: countryFullName || '',
                postalCode: employee?.postalCode || ''
            });
        } else {
            // Convert state and country codes to full names
            stateCode = employee?.currentState || '';
            countryCode = employee?.currentCountry || '';
            stateFullName = stateCode ? getStateName(countryCode, stateCode) : '';
            countryFullName = countryCode ? getCountryName(countryCode) : '';

            setAddressForm({
                line1: employee?.currentAddressLine1 || '',
                line2: employee?.currentAddressLine2 || '',
                city: employee?.currentCity || '',
                state: stateFullName || stateCode || '',
                country: countryFullName || '',
                postalCode: employee?.currentPostalCode || ''
            });
        }

        setAddressStateOptions([]);
        setAddressFormErrors({});
        setShowAddressModal(true);
    };

    const handleCloseAddressModal = () => {
        if (savingAddress) return;
        setShowAddressModal(false);
        setAddressForm({
            line1: '',
            line2: '',
            city: '',
            state: '',
            country: '',
            postalCode: ''
        });
        setAddressStateOptions([]);
        setAddressFormErrors({});
    };

    const handleAddressChange = (field, value) => {
        let processedValue = value;

        // If country changes, load states and reset state field
        if (field === 'country') {
            setAddressForm(prev => ({
                ...prev,
                [field]: processedValue,
                state: '' // Reset state when country changes
            }));

            // Validate country
            const requiredCheck = validateRequired(processedValue, 'Country');
            setAddressFormErrors(prev => {
                const updated = { ...prev };
                if (requiredCheck.isValid) {
                    delete updated.country;
                } else {
                    updated.country = requiredCheck.error;
                }
                return updated;
            });
            return;
        }

        // Load states for selected country
        if (processedValue) {
            const country = Country.getAllCountries().find(c => c.name === processedValue);
            if (country) {
                const states = State.getStatesOfCountry(country.isoCode).map(state => ({
                    label: state.name,
                    value: state.name
                }));

                if (states.length === 0) {
                    setAddressStateOptions([]);
                } else {
                    setAddressStateOptions(states);
                }
            } else {
                setAddressStateOptions([]);
            }
        }

        // Input restrictions
        if (field === 'city') {
            processedValue = value.replace(/[^A-Za-z0-9\s]/g, '');
        }

        setAddressForm(prev => ({ ...prev, [field]: processedValue }));

        // Real-time validation
        let error = '';
        if (field === 'line1') {
            const requiredCheck = validateRequired(processedValue, 'Address');
            error = requiredCheck.isValid ? '' : requiredCheck.error;
        } else if (field === 'city') {
            if (!processedValue || processedValue.trim() === '') {
                error = 'City is required';
            } else if (!/^[A-Za-z0-9\s]+$/.test(processedValue.trim())) {
                error = 'City must contain letters, numbers, and spaces only';
            }
        } else if (field === 'state') {
            if (!processedValue || processedValue.trim() === '') {
                error = 'Emirates/State is required';
            } else if (!/^[A-Za-z\s'-]+$/.test(processedValue.trim())) {
                error = 'Emirates/State must contain letters, spaces, hyphens, and apostrophes only';
            }
        } else if (field === 'postalCode') {
            if (processedValue && !/^[A-Za-z0-9\s-]+$/.test(processedValue.trim())) {
                error = 'Postal Code can only include letters, numbers, spaces, and hyphens';
            }
        }

        setAddressFormErrors(prev => {
            const updated = { ...prev };
            if (error) {
                updated[field] = error;
            } else {
                delete updated[field];
            }
            return updated;
        });
    };

    const handleSavePersonalDetails = async () => {
        if (!employeeId) return;
        try {
            setSavingPersonal(true);

            const errors = {};

            // 1. Email (required, valid format)
            const emailValidation = validateEmail(personalForm.email, true);
            if (!emailValidation.isValid) {
                errors.email = emailValidation.error;
            }

            // 2. Contact Number (required, valid international format)
            const contactDigits = (personalForm.contactNumber || '').replace(/\D/g, '');
            const countryCode = extractCountryCode(contactDigits) || selectedCountryCode;
            const phoneValidation = validatePhoneNumber(contactDigits, countryCode, true);
            if (!phoneValidation.isValid) {
                errors.contactNumber = phoneValidation.error;
            }

            // 3. Date of Birth (required, valid date)
            const dobValidation = validateDate(personalForm.dateOfBirth, true);
            if (!dobValidation.isValid) {
                errors.dateOfBirth = dobValidation.error;
            }

            // 4. Marital Status (required, must be from predefined options)
            const validMaritalStatuses = ['single', 'married', 'divorced', 'widowed'];
            if (!personalForm.maritalStatus || personalForm.maritalStatus.trim() === '') {
                errors.maritalStatus = 'Marital Status is required';
            } else if (!validMaritalStatuses.includes(personalForm.maritalStatus.toLowerCase())) {
                errors.maritalStatus = 'Please select a valid marital status option';
            }

            // 5. Father's Name (required, letters only)
            if (!personalForm.fathersName || personalForm.fathersName.trim() === '') {
                errors.fathersName = 'Father\'s Name is required';
            } else {
                const trimmedName = personalForm.fathersName.trim();
                if (trimmedName.length < 2) {
                    errors.fathersName = 'Father\'s Name must be at least 2 characters';
                } else if (!/^[A-Za-z\s]+$/.test(trimmedName)) {
                    errors.fathersName = 'Father\'s Name must contain only letters and spaces';
                }
            }

            // 6. Number of Dependents (optional, but must be valid number if provided and marital status is married)
            if (personalForm.maritalStatus === 'married' && personalForm.numberOfDependents && personalForm.numberOfDependents.trim() !== '') {
                const dependentsValue = parseInt(personalForm.numberOfDependents, 10);
                if (isNaN(dependentsValue) || dependentsValue < 0) {
                    errors.numberOfDependents = 'Number of dependents must be a valid positive number';
                } else if (dependentsValue > 50) {
                    errors.numberOfDependents = 'Number of dependents cannot exceed 50';
                }
            }

            // 7. Gender (required, must be from predefined options)
            if (!personalForm.gender || personalForm.gender.trim() === '') {
                errors.gender = 'Gender is required';
            } else {
                const validGenders = ['male', 'female', 'other'];
                if (!validGenders.includes(personalForm.gender.toLowerCase())) {
                    errors.gender = 'Please select a valid gender option';
                }
            }

            // 7. Nationality (required)
            if (!personalForm.nationality || personalForm.nationality.trim() === '') {
                errors.nationality = 'Nationality is required';
            } else {
                const trimmedNationality = personalForm.nationality.trim();
                if (trimmedNationality.length < 2) {
                    errors.nationality = 'Nationality must be at least 2 characters';
                } else if (!/^[A-Za-z\s\'-]+$/.test(trimmedNationality)) {
                    errors.nationality = 'Nationality must contain only letters, spaces, hyphens, and apostrophes';
                }
            }

            if (Object.keys(errors).length > 0) {
                setPersonalFormErrors(errors);
                setSavingPersonal(false);
                return;
            }

            setPersonalFormErrors({});

            const payload = {
                email: personalForm.email,
                contactNumber: formatPhoneForSave(contactDigits),
                dateOfBirth: personalForm.dateOfBirth || null,
                maritalStatus: personalForm.maritalStatus,
                fathersName: personalForm.fathersName,
                gender: personalForm.gender,
                nationality: personalForm.nationality,
                numberOfDependents: personalForm.numberOfDependents && personalForm.numberOfDependents.trim() !== '' ? parseInt(personalForm.numberOfDependents, 10) : null
            };
            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, payload);
            await fetchEmployee();
            handleClosePersonalModal();
            toast({
                variant: "default",
                title: "Personal details updated",
                description: "Personal information saved successfully."
            });
        } catch (error) {
            console.error('Failed to update personal details', error);
            toast({
                variant: "destructive",
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setSavingPersonal(false);
        }
    };

    const handleSaveAddress = async () => {
        if (!employeeId) return;
        try {
            setSavingAddress(true);

            const errors = {};

            // Shared validations
            if (!addressForm.line1 || addressForm.line1.trim() === '') {
                errors.line1 = 'Address is required';
            }
            if (!addressForm.city || addressForm.city.trim() === '') {
                errors.city = 'City is required';
            } else if (!/^[A-Za-z0-9\s]+$/.test(addressForm.city.trim())) {
                errors.city = 'City must contain letters, numbers, and spaces only';
            }
            if (!addressForm.state || addressForm.state.trim() === '') {
                errors.state = 'Emirates/State is required';
            } else if (!/^[A-Za-z\s'-]+$/.test(addressForm.state.trim())) {
                errors.state = 'Emirates/State must contain letters, spaces, hyphens, and apostrophes only';
            }
            if (!addressForm.country || addressForm.country.trim() === '') {
                errors.country = 'Country is required';
            }
            if (addressForm.postalCode && !/^[A-Za-z0-9\s-]+$/.test(addressForm.postalCode.trim())) {
                errors.postalCode = 'Postal Code can only include letters, numbers, spaces, and hyphens';
            }

            if (Object.keys(errors).length > 0) {
                setAddressFormErrors(errors);
                setSavingAddress(false);
                return;
            }

            setAddressFormErrors({});

            const payload = addressModalType === 'permanent'
                ? {
                    addressLine1: addressForm.line1,
                    addressLine2: addressForm.line2,
                    city: addressForm.city,
                    state: addressForm.state,
                    country: addressForm.country,
                    postalCode: addressForm.postalCode
                }
                : {
                    currentAddressLine1: addressForm.line1,
                    currentAddressLine2: addressForm.line2,
                    currentCity: addressForm.city,
                    currentState: addressForm.state,
                    currentCountry: addressForm.country,
                    currentPostalCode: addressForm.postalCode
                };

            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, payload);
            await fetchEmployee();
            setShowAddressModal(false);
            setAddressForm({
                line1: '',
                line2: '',
                city: '',
                state: '',
                country: '',
                postalCode: ''
            });
            toast({
                variant: "default",
                title: `${addressModalType === 'permanent' ? 'Permanent' : 'Current'} address saved`,
                description: "Address details were saved successfully."
            });
        } catch (error) {
            console.error('Failed to update address', error);
            toast({
                variant: "destructive",
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setSavingAddress(false);
        }
    };

    const persistContacts = async (contacts) => {
        if (!employeeId) return;
        const sanitized = contacts
            .map(sanitizeContact)
            .filter(contact => contact.name && contact.number);

        const legacyContact = sanitized[0] || null;

        await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
            emergencyContacts: sanitized,
            emergencyContactName: legacyContact?.name || '',
            emergencyContactRelation: legacyContact?.relation || 'Self',
            emergencyContactNumber: legacyContact?.number || ''
        });
    };

    const handleDeleteContact = async (contactId = null, contactIndex = null) => {
        if (!employeeId) return;
        const trackerId = contactId || (contactIndex !== null ? `legacy-${contactIndex}` : 'legacy');

        try {
            setDeletingContactId(trackerId);

            if (contactId) {
                await axiosInstance.delete(`/Employee/${employeeId}/emergency-contact/${contactId}`);
            } else {
                const updatedContacts = existingContacts || getExistingContacts()
                    .filter((_, index) => index !== contactIndex)
                    .map(sanitizeContact)
                    .filter(contact => contact.name && contact.number);

                await persistContacts(updatedContacts);
            }

            await fetchEmployee();
            toast({
                variant: "default",
                title: "Contact removed",
                description: "Emergency contact deleted successfully."
            });
        } catch (error) {
            console.error('Failed to delete contact details', error);
            toast({
                variant: "destructive",
                title: "Delete failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setDeletingContactId(null);
        }
    };

    const handleDeleteWorkDetailsCard = async () => {
        if (!isAdmin()) {
            toast({ variant: "destructive", title: "Access denied", description: "Only administrator can delete work details." });
            return;
        }
        try {
            await axiosInstance.delete(`/Employee/work-details/${employeeId}`);
            await fetchEmployee();
            toast({ title: "Work details deleted", description: "Work details card has been cleared." });
        } catch (error) {
            toast({ variant: "destructive", title: "Delete failed", description: error.response?.data?.message || "Failed to delete work details." });
        }
    };

    const handleDeletePersonalCard = async () => {
        if (!isAdmin()) {
            toast({ variant: "destructive", title: "Access denied", description: "Only administrator can delete personal details." });
            return;
        }
        try {
            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                dateOfBirth: null,
                maritalStatus: "",
                numberOfDependents: null,
                fathersName: "",
                gender: "",
                nationality: ""
            });
            await fetchEmployee();
            toast({ title: "Personal details deleted", description: "Personal details card has been cleared." });
        } catch (error) {
            toast({ variant: "destructive", title: "Delete failed", description: error.response?.data?.message || "Failed to delete personal details." });
        }
    };

    const handleDeletePermanentAddressCard = async () => {
        if (!isAdmin()) {
            toast({ variant: "destructive", title: "Access denied", description: "Only administrator can delete permanent address." });
            return;
        }
        try {
            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                addressLine1: "",
                addressLine2: "",
                city: "",
                state: "",
                country: "",
                postalCode: ""
            });
            await fetchEmployee();
            toast({ title: "Permanent address deleted", description: "Permanent address card has been cleared." });
        } catch (error) {
            toast({ variant: "destructive", title: "Delete failed", description: error.response?.data?.message || "Failed to delete permanent address." });
        }
    };

    const handleDeleteCurrentAddressCard = async () => {
        if (!isAdmin()) {
            toast({ variant: "destructive", title: "Access denied", description: "Only administrator can delete current address." });
            return;
        }
        try {
            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                currentAddressLine1: "",
                currentAddressLine2: "",
                currentCity: "",
                currentState: "",
                currentCountry: "",
                currentPostalCode: ""
            });
            await fetchEmployee();
            toast({ title: "Current address deleted", description: "Current address card has been cleared." });
        } catch (error) {
            toast({ variant: "destructive", title: "Delete failed", description: error.response?.data?.message || "Failed to delete current address." });
        }
    };

    const handleDeleteBankCard = async () => {
        if (!isAdmin()) {
            toast({ variant: "destructive", title: "Access denied", description: "Only administrator can delete bank details." });
            return;
        }
        try {
            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                bankName: "",
                accountName: "",
                accountNumber: "",
                ibanNumber: "",
                swiftCode: "",
                bankOtherDetails: "",
                bankAttachment: null
            });
            await fetchEmployee();
            toast({ title: "Bank details deleted", description: "Salary Bank Account card has been cleared." });
        } catch (error) {
            toast({ variant: "destructive", title: "Delete failed", description: error.response?.data?.message || "Failed to delete bank details." });
        }
    };

    const handleDeleteSalaryCard = async () => {
        if (!isAdmin()) {
            toast({ variant: "destructive", title: "Access denied", description: "Only administrator can delete salary details." });
            return;
        }
        try {
            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                basic: 0,
                houseRentAllowance: 0,
                otherAllowance: 0,
                additionalAllowances: [],
                salaryHistory: [],
                offerLetter: null
            });
            await fetchEmployee();
            toast({ title: "Salary details deleted", description: "Salary details card has been cleared." });
        } catch (error) {
            toast({ variant: "destructive", title: "Delete failed", description: error.response?.data?.message || "Failed to delete salary details." });
        }
    };

    const requestCardDelete = (type) => {
        setConfirmDeleteCard({ open: true, type });
    };

    const confirmCardDeleteAction = async () => {
        const { type } = confirmDeleteCard;
        setConfirmDeleteCard({ open: false, type: null });
        if (!type) return;
        if (type === 'work') return handleDeleteWorkDetailsCard();
        if (type === 'personal') return handleDeletePersonalCard();
        if (type === 'permanentAddress') return handleDeletePermanentAddressCard();
        if (type === 'currentAddress') return handleDeleteCurrentAddressCard();
        if (type === 'bank') return handleDeleteBankCard();
        if (type === 'salary') return handleDeleteSalaryCard();
        if (type === 'signature') {
            try {
                await axiosInstance.delete(`/Employee/${employee._id || employee.id}/signature`);
                toast({ title: "Signature deleted", description: "Digital signature removed successfully." });
                await fetchEmployee();
            } catch (error) {
                toast({
                    variant: "destructive",
                    title: "Delete failed",
                    description: error.response?.data?.message || error.message || "Failed to delete signature."
                });
            }
        }
    };

    const handleSaveContactDetails = async () => {
        if (!employeeId) return;
        try {
            setSavingContact(true);

            const errors = {};

            const activeContact = contactForms[0];
            const relationOptions = ['Self', 'Father', 'Mother', 'Spouse', 'Friend', 'Other'];

            // Name
            if (!activeContact?.name || activeContact.name.trim() === '') {
                errors['0_name'] = 'Contact Name is required';
            } else if (!/^[A-Za-z\s]+$/.test(activeContact.name.trim())) {
                errors['0_name'] = 'Contact Name must contain letters and spaces only';
            }

            // Relation
            if (!activeContact?.relation || activeContact.relation.trim() === '') {
                errors['0_relation'] = 'Relation is required';
            } else if (!relationOptions.includes(activeContact.relation)) {
                errors['0_relation'] = 'Please select a valid relation';
            }

            // Phone
            if (!activeContact?.number || activeContact.number.trim() === '') {
                errors['0_number'] = 'Phone number is required';
            } else {
                const countryCode = extractCountryCode(activeContact.number) || contactCountryCode;
                const phoneValidation = validatePhoneNumber(activeContact.number, countryCode, true);
                if (!phoneValidation.isValid) {
                    errors['0_number'] = phoneValidation.error;
                }
            }

            if (Object.keys(errors).length > 0) {
                setContactFormErrors(errors);
                setSavingContact(false);
                return;
            }

            setContactFormErrors({});

            const filteredContacts = contactForms
                .map(sanitizeContact)
                .filter(contact => contact.name && contact.number);

            if (filteredContacts.length === 0) {
                toast({
                    variant: "default",
                    title: "Contact details missing",
                    description: "Please provide at least one contact with a name and phone number."
                });
                setSavingContact(false);
                return;
            }

            const newContact = filteredContacts[0];
            const currentContacts = getExistingContacts()
                .map(contact => ({
                    id: contact.id,
                    index: contact.index,
                    ...sanitizeContact(contact)
                }))
                .filter(contact => contact.name && contact.number);

            if (isEditingExistingContact) {
                if (editingContactId) {
                    await axiosInstance.patch(`/Employee/${employeeId}/emergency-contact/${editingContactId}`, newContact);
                } else {
                    const updatedContacts = [...currentContacts];
                    const targetIndex = editingContactIndex ?? currentContacts.findIndex(contact => contactsAreSame(contact, newContact));

                    if (typeof targetIndex === 'number' && targetIndex >= 0 && updatedContacts[targetIndex]) {
                        updatedContacts[targetIndex] = { ...updatedContacts[targetIndex], ...newContact };
                    } else if (updatedContacts.length) {
                        updatedContacts[0] = { ...updatedContacts[0], ...newContact };
                    } else {
                        updatedContacts.push(newContact);
                    }

                    await persistContacts(updatedContacts);
                }
            } else {
                const duplicateContact = currentContacts.find(contact => contactsAreSame(contact, newContact));

                if (duplicateContact) {
                    if (duplicateContact.id) {
                        await axiosInstance.patch(`/Employee/${employeeId}/emergency-contact/${duplicateContact.id}`, newContact);
                    } else {
                        const updatedContacts = currentContacts.map(contact =>
                            contactsAreSame(contact, duplicateContact) ? { ...contact, ...newContact } : contact
                        );
                        await persistContacts(updatedContacts);
                    }
                } else {
                    await axiosInstance.post(`/Employee/${employeeId}/emergency-contact`, newContact);
                }
            }

            await fetchEmployee();
            handleCloseContactModal();
            toast({
                variant: "default",
                title: "Contact details saved",
                description: "Emergency contact details were saved successfully."
            });
        } catch (error) {
            console.error('Failed to update contact details', error);
            toast({
                variant: "destructive",
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setSavingContact(false);
        }
    };

    const handleSubmitForApproval = (employeeSnapshotOverride = null) => {
        const emp = employeeSnapshotOverride || employee;
        if (!emp || sendingApproval) return;
        if (!isProfileReady) {
            toast({
                variant: 'destructive',
                title: 'Profile incomplete',
                description: 'Complete all required profile fields (100%) before sending for activation.',
            });
            return;
        }
        const status = String(emp.profileApprovalStatus || 'draft').toLowerCase();
        const isSubject = viewerIsEmployeeProfileSubject(emp, currentUser);
        const isActivationSubmitter = viewerIsProfileActivationSubmitter(emp, currentUser);
        if (status === 'draft' || status === 'rejected') {
            /* allow */
        } else if (status === 'submitted' && (isSubject || isActivationSubmitter)) {
            /* Resubmit while awaiting HR (hold fixes): submitter and profile subject must both be able to open the modal — visibility uses submitter eligibility. */
        } else {
            if (status === 'submitted') {
                toast({
                    variant: 'destructive',
                    title: 'Cannot open submission',
                    description:
                        'Only the employee (profile subject) or the user who submitted for activation can send this request.',
                });
            }
            return;
        }
        setApprovalDescription('');
        setApprovalSubmitViewingChange(null);
        setApprovalSubmitViewingAttachment(null);
        setShowApprovalSubmitModal(true);
    };

    const confirmSubmitForApproval = async () => {
        if (!employee || sendingApproval || !isProfileReady) return;

        try {
            setSendingApproval(true);
            // Send activation email which also updates status to 'submitted'
            const submittedDescription = approvalDescription.trim();
            const approvalPayload = {
                // Keep both keys for backward compatibility with backend consumers.
                reason: submittedDescription,
                description: submittedDescription,
            };
            if (approvalSubmitAllEntryIds.length > 0) {
                approvalPayload.selectionProvided = true;
                approvalPayload.includedChangeEntryIds = [...approvalSubmitSelectedEntryIds.map(String)];
            }
            await axiosInstance.post(`/Employee/${employeeId}/send-approval-email`, approvalPayload);
            await fetchEmployee();
            setApprovalSubmitViewingChange(null);
            setApprovalSubmitViewingAttachment(null);
            setShowApprovalSubmitModal(false);
            toast({
                variant: "default",
                title: "Sent for Activation",
                description: "The Flowchart HR contact has been emailed and will see this request on their dashboard for review."
            });
        } catch (error) {
            console.error('Failed to send activation request', error);
            toast({
                variant: "destructive",
                title: "Request failed",
                description: error.response?.data?.message || error.message || "Could not send activation request."
            });
        } finally {
            setSendingApproval(false);
        }
    };

    const handleActivateProfile = async (approvedChangeIds = [], options = {}) => {
        const { directHr = false } = options || {};
        const approvalStatus = employee?.profileApprovalStatus || 'draft';

        if (activatingProfile || !employee) return false;

        // Normal path: only after employee “Send for Activation”. HR direct path skips this.
        if (!directHr && approvalStatus !== 'submitted') {
            toast({
                variant: 'destructive',
                title: 'Cannot activate',
                description: 'Profile must be submitted for HR review before it can be activated.',
            });
            return false;
        }

        try {
            setActivatingProfile(true);
            const ids = Array.isArray(approvedChangeIds) ? approvedChangeIds.map(String) : [];
            await axiosInstance.post(`/Employee/${employeeId}/approve-profile`, {
                approvedChangeIds: directHr ? [] : ids,
                selectionProvided: !directHr,
                directHrBypass: Boolean(directHr),
            });
            await fetchEmployee();
            toast({
                variant: "default",
                title: "Profile activated",
                description: "The employee profile has been activated."
            });
            return true;
        } catch (error) {
            console.error('Failed to activate profile', error);
            toast({
                variant: "destructive",
                title: "Activation failed",
                description: error.response?.data?.message || error.message || "Could not activate profile."
            });
            return false;
        } finally {
            setActivatingProfile(false);
        }
    };

    const handleHoldProfile = async (approvedChangeIds = [], comment = '', rowNotesByEntryId = null) => {
        if (activatingProfile || !employee || (employee.profileApprovalStatus || '') !== 'submitted') return false;
        try {
            setActivatingProfile(true);
            const payload = {
                approvedChangeIds: Array.isArray(approvedChangeIds) ? approvedChangeIds.map(String) : [],
                selectionProvided: true,
                comment: comment || '',
            };
            if (rowNotesByEntryId && typeof rowNotesByEntryId === 'object' && Object.keys(rowNotesByEntryId).length) {
                payload.rowNotesByEntryId = rowNotesByEntryId;
            }
            const { data } = await axiosInstance.post(`/Employee/${employeeId}/hold-profile`, payload);
            if (data?.employee) {
                const next = { ...data.employee };
                if (next.password) delete next.password;
                setEmployee(next);
            }
            await fetchEmployee();
            toast({
                variant: 'default',
                title: 'Activation on hold',
                description:
                    'Checked changes were saved to the profile and removed from the queue. Unchecked items stay pending — the employee was told what still needs fixing.',
            });
            return true;
        } catch (error) {
            console.error('Failed to hold profile activation', error);
            toast({
                variant: 'destructive',
                title: 'Hold failed',
                description: error.response?.data?.message || error.message || 'Could not place activation on hold.',
            });
            return false;
        } finally {
            setActivatingProfile(false);
        }
    };

    const handleRejectProfile = async (reason) => {
        if (activatingProfile || !employee) return false;

        try {
            setActivatingProfile(true);
            await axiosInstance.post(`/Employee/${employeeId}/reject-profile`, { reason });
            await fetchEmployee();
            toast({
                variant: "default",
                title: "Profile activation rejected",
                description: "The employee profile activation request has been rejected."
            });
            return true;
        } catch (error) {
            console.error('Failed to reject profile', error);
            toast({
                variant: "destructive",
                title: "Rejection failed",
                description: error.response?.data?.message || error.message || "Could not reject profile."
            });
            return false;
        } finally {
            setActivatingProfile(false);
        }
    };

    const handleViewRequestedChange = (cardLabel = '') => {
        const label = String(cardLabel || '').toLowerCase();
        if (label.includes('basic')) return setActiveTab('basic');
        if (label.includes('work')) return setActiveTab('work-details');
        if (label.includes('passport') || label.includes('visa') || label.includes('emirates') || label.includes('labour') || label.includes('medical') || label.includes('driving')) {
            return setActiveTab('passport');
        }
        if (label.includes('document')) return setActiveTab('documents');
        if (label.includes('education')) return setActiveTab('education');
        if (label.includes('experience')) return setActiveTab('experience');
        if (label.includes('training')) return setActiveTab('training');
        return setActiveTab('basic');
    };

    const [togglingPortalAccess, setTogglingPortalAccess] = useState(false);

    const handleTogglePortalAccess = async (newValue) => {
        if (togglingPortalAccess || !employee) return;
        try {
            setTogglingPortalAccess(true);
            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                enablePortalAccess: newValue
            });

            // Update local state immediately
            setEmployee(prev => ({ ...prev, enablePortalAccess: newValue }));

            toast({
                variant: "default",
                title: "Portal Access Updated",
                description: `Portal access has been ${newValue ? 'enabled' : 'disabled'}.`
            });
        } catch (error) {
            console.error('Failed to toggle portal access', error);
            toast({
                variant: "destructive",
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Failed to update portal access."
            });
        } finally {
            setTogglingPortalAccess(false);
        }
    };

    // Check if employee nationality is UAE (handles both code and full name)
    // Memoize the function so it can be passed to components
    const isUAENationality = useCallback(() => {
        if (!employee) return false;

        // Prefer employee master nationality first; fallback to passport nationality.
        // Passport data can be incomplete or mapped from issuance-country flows.
        const nationalityValue = (
            employee.nationality ||
            employee.country ||
            employee.passportDetails?.nationality ||
            ''
        ).toString().trim();
        if (!nationalityValue) return false;

        // Normalize: remove extra spaces, convert to lowercase
        const normalized = nationalityValue.toLowerCase().replace(/\s+/g, ' ').trim();

        // Direct matches
        if (normalized === 'uae' ||
            normalized === 'ae' ||
            normalized === 'united arab emirates' ||
            normalized === 'united arab emirate' ||
            normalized === 'unitedarabemirates' ||
            normalized === 'unitedarabemirate') {
            return true;
        }

        // Check if it's a country code that converts to UAE
        try {
            // Try uppercase for country code lookup
            const countryCode = normalized.toUpperCase();
            if (countryCode.length === 2) {
                const countryName = getCountryName(countryCode);
                if (countryName) {
                    const normalizedCountryName = countryName.toLowerCase().replace(/\s+/g, ' ').trim();
                    if (normalizedCountryName === 'united arab emirates' ||
                        normalizedCountryName === 'united arab emirate' ||
                        normalizedCountryName === 'unitedarabemirates' ||
                        normalizedCountryName === 'unitedarabemirate') {
                        return true;
                    }
                }
            }

            // Also try the original value as uppercase
            const countryNameFromValue = getCountryName(nationalityValue.toUpperCase());
            if (countryNameFromValue && countryNameFromValue !== nationalityValue) {
                const normalizedCountryName = countryNameFromValue.toLowerCase().replace(/\s+/g, ' ').trim();
                if (normalizedCountryName === 'united arab emirates' ||
                    normalizedCountryName === 'united arab emirate' ||
                    normalizedCountryName === 'unitedarabemirates' ||
                    normalizedCountryName === 'unitedarabemirate') {
                    return true;
                }
            }
        } catch (e) {
            // If getCountryName fails, continue
        }

        return false;
    }, [employee?.nationality, employee?.country, employee?.passportDetails?.nationality, getCountryName]);

    const handleVisaButtonClick = () => {
        if (isUAENational) {
            toast({
                variant: "default",
                title: "Visa Not Required",
                description: "Visa details are only required for employees whose nationality is not UAE."
            });
            return;
        }
        setShowVisaDropdown(prev => !prev);
    };

    // Open visa modal and populate with existing data

    const handleUpdateEmployee = async () => {
        if (!employee) return;
        try {
            setUpdating(true);

            // Validate required fields
            const errors = {};

            // 1. Employee ID - Auto-generated, Read-only, Cannot be edited (no validation needed)

            // 2. Validate First Name (required)
            if (!editForm.firstName || editForm.firstName.trim() === '') {
                errors.firstName = 'First Name is required';
            } else if (!/^[A-Za-z\s]+$/.test(editForm.firstName.trim())) {
                errors.firstName = 'First Name must contain only letters and spaces';
            }

            // 3. Validate Last Name (required)
            if (!editForm.lastName || editForm.lastName.trim() === '') {
                errors.lastName = 'Last Name is required';
            } else if (!/^[A-Za-z\s]+$/.test(editForm.lastName.trim())) {
                errors.lastName = 'Last Name must contain only letters and spaces';
            }

            // 4. Validate Email (required, valid email format)
            const emailValidation = validateEmail(editForm.email, true);
            if (!emailValidation.isValid) {
                errors.email = emailValidation.error;
            }

            // 5. Validate Contact Number (required, valid international format)
            const contactDigits = (editForm.contactNumber || '').replace(/\D/g, '');
            const contactValidation = validatePhoneNumber(contactDigits, editCountryCode, true);
            if (!contactValidation.isValid) {
                errors.contactNumber = contactValidation.error;
            }

            // 6. Validate Date of Birth (required, valid date)
            const dobValidation = validateDate(editForm.dateOfBirth, true);
            if (!dobValidation.isValid) {
                errors.dateOfBirth = dobValidation.error;
            }

            // 7. Validate Marital Status (required, must be from predefined options)
            const validMaritalStatuses = ['single', 'married', 'divorced', 'widowed'];
            if (!editForm.maritalStatus || editForm.maritalStatus.trim() === '') {
                errors.maritalStatus = 'Marital Status is required';
            } else if (!validMaritalStatuses.includes(editForm.maritalStatus.toLowerCase())) {
                errors.maritalStatus = 'Please select a valid marital status option';
            }

            // 8. Validate Number of Dependents (optional, but must be valid number if provided and marital status is married)
            if (editForm.maritalStatus === 'married' && editForm.numberOfDependents && editForm.numberOfDependents.trim() !== '') {
                const dependentsValue = parseInt(editForm.numberOfDependents, 10);
                if (isNaN(dependentsValue) || dependentsValue < 0) {
                    errors.numberOfDependents = 'Number of dependents must be a valid positive number';
                } else if (dependentsValue > 50) {
                    errors.numberOfDependents = 'Number of dependents cannot exceed 50';
                }
            }

            // 9. Validate Father's Name (required, letters and spaces only - no numbers or special characters)
            if (!editForm.fathersName || editForm.fathersName.trim() === '') {
                errors.fathersName = 'Father\'s Name is required';
            } else {
                const trimmedName = editForm.fathersName.trim();
                if (trimmedName.length < 2) {
                    errors.fathersName = 'Father\'s Name must be at least 2 characters';
                } else if (!/^[A-Za-z\s]+$/.test(trimmedName)) {
                    errors.fathersName = 'Father\'s Name must contain only letters and spaces';
                }
            }



            // 11. Validate Nationality (required, must be from country list or valid text)
            if (!editForm.nationality || editForm.nationality.trim() === '') {
                errors.nationality = 'Nationality is required';
            } else {
                const trimmedNationality = editForm.nationality.trim();
                if (trimmedNationality.length < 2) {
                    errors.nationality = 'Nationality must be at least 2 characters';
                } else if (!/^[A-Za-z\s'-]+$/.test(trimmedNationality)) {
                    errors.nationality = 'Nationality must contain only letters, spaces, hyphens, and apostrophes';
                }
            }

            // If there are errors, set them and stop
            if (Object.keys(errors).length > 0) {
                setEditFormErrors(errors);
                setUpdating(false);
                return;
            }

            // Format contact number to ensure it has + prefix if needed
            const formattedContactNumber = formatPhoneForSave(contactDigits);

            const updatePayload = {
                employeeId: editForm.employeeId,
                firstName: editForm.firstName.trim(),
                lastName: editForm.lastName.trim(),
                email: editForm.email,
                contactNumber: formattedContactNumber,
                dateOfBirth: editForm.dateOfBirth || null,
                maritalStatus: editForm.maritalStatus,
                fathersName: editForm.fathersName,

                nationality: editForm.nationality,
                country: editForm.nationality,
                numberOfDependents: editForm.numberOfDependents && editForm.numberOfDependents.trim() !== '' ? parseInt(editForm.numberOfDependents, 10) : null
            };

            const response = await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, updatePayload);
            // Optimistically update - use response data if available
            const updatedEmployee = response.data?.employee;
            if (updatedEmployee) {
                setEmployee(updatedEmployee);
            } else {
                // Only refetch if response doesn't include updated employee
                fetchEmployee(true).catch(err => console.error('Failed to refresh:', err));
            }
            setShowEditModal(false);
            setEditFormErrors({});
            toast({
                variant: "default",
                title: "Basic details updated",
                description: "Changes were saved successfully."
            });
        } catch (error) {
            console.error('Failed to update employee', error);
            toast({
                variant: "destructive",
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setUpdating(false);
        }
    };

    // Image upload and crop states
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imageScale, setImageScale] = useState(1);
    const [uploading, setUploading] = useState(false);
    const avatarEditorRef = useRef(null);

    // Request deduplication - prevent multiple simultaneous calls
    const fetchingEmployeeRef = useRef(false);



    // Optimized fetchEmployee with memoization and reduced refetches - MUST be defined before useEffects that use it
    const fetchEmployee = useCallback(async (skipProbationCheck = false) => {
        // Prevent duplicate calls
        if (fetchingEmployeeRef.current) {
            return undefined;
        }

        // Explicit check for token presence
        if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
            console.warn('No authentication token found, redirecting to login');
            const currentPath = window.location.pathname;
            router.push(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
            return undefined;
        }

        try {
            fetchingEmployeeRef.current = true;
            setLoading(true);
            setError('');

            const response = await axiosInstance.get(`/Employee/${employeeId}`, {
                timeout: 60000 // 60 seconds timeout for employee detail fetch (may include large data)
            });
            let data = response.data?.employee || response.data;

            // Probation status changes are handled by dedicated workflow approvals.
            // Keep a default probation period for display consistency when empty.
            if (!skipProbationCheck && data?.status === 'Probation' && !data.probationPeriod) {
                data = { ...data, probationPeriod: 6 };
            }

            setEmployee(data);
            setViewerIsDesignatedFlowchartHr(!!response.data?.viewerIsDesignatedFlowchartHr);
            setImageError(false); // Reset image error when employee data changes

            // URL Masking Logic: update URL to emp/ID.name format if it's not already (keep ?tab=… deep-link params)
            if (typeof window !== 'undefined' && data) {
                const firstName = (data.firstName || '').toLowerCase().trim();
                const lastName = (data.lastName || '').toLowerCase().trim();
                const nameSlug = `${firstName}-${lastName}`.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                const displayId = data.employeeId || data._id;
                const basePath = `/emp/${displayId}.${nameSlug}`;
                const qs = window.location.search || '';
                const newUrl = `${basePath}${qs}`;

                if (window.location.pathname !== basePath) {
                    window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
                }
            }

            return data ?? null;
        } catch (err) {
            console.error('Error fetching employee:', err);
            // Handle timeout errors
            if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
                setError('Request timed out. The server is taking too long to respond. Please try again or contact support if the issue persists.');
            }
            // Handle 403 Forbidden - user doesn't have permission
            else if (err.response?.status === 403) {
                setError('You do not have permission to view this employee profile.');
                // Redirect to employee list after a short delay
                setTimeout(() => {
                    router.push('/emp');
                }, 2000);
            } else {
                setError(err.response?.data?.message || err.message || 'Unable to load employee details');
            }
            return null;
        } finally {
            setLoading(false);
            fetchingEmployeeRef.current = false;
        }
    }, [employeeId, router]);

    // Memoize fetchReportingAuthorities - lazy load only when needed (work details modal opens)
    const fetchReportingAuthorities = useCallback(async () => {
        try {
            setReportingAuthorityLoading(true);
            setReportingAuthorityError('');
            const response = await axiosInstance.get('/Employee/reportee-options', {
                params: { excludeEmployeeId: employeeId }
            });
            const options = Array.isArray(response.data?.options) ? response.data.options : [];
            setReportingAuthorityOptions(options);
        } catch (error) {
            setReportingAuthorityError(error.response?.data?.message || error.message || 'Failed to load reporting authorities.');
        } finally {
            setReportingAuthorityLoading(false);
        }
    }, [employeeId]);

    // useEffect hooks - must come after function definitions
    // Use ref to prevent duplicate calls in React Strict Mode
    const hasFetchedRef = useRef(false);

    useEffect(() => {
        if (employeeId && !hasFetchedRef.current) {
            hasFetchedRef.current = true;
            fetchEmployee(false); // Initial load, check probation status
        }
        // Reset ref when employeeId changes
        return () => {
            hasFetchedRef.current = false;
        };
    }, [employeeId]); // Removed fetchEmployee from deps to prevent loops

    useEffect(() => {
        const queuedChanges = Array.isArray(employee?.pendingReactivationChanges)
            ? employee.pendingReactivationChanges
            : [];

        const queuedEducation = queuedChanges
            .filter((c) => {
                if (!c || typeof c !== 'object') return false;
                return String(c.section || '').toLowerCase() === 'education' &&
                    String(c.changeType || '').toLowerCase() === 'add' &&
                    c.proposedData;
            })
            .map((c, idx) => ({
                ...c.proposedData,
                _id: `queued-edu-${idx}`,
                __queued: true
            }));

        const queuedExperience = queuedChanges
            .filter((c) => {
                if (!c || typeof c !== 'object') return false;
                return String(c.section || '').toLowerCase() === 'experience' &&
                    String(c.changeType || '').toLowerCase() === 'add' &&
                    c.proposedData;
            })
            .map((c, idx) => ({
                ...c.proposedData,
                _id: `queued-exp-${idx}`,
                __queued: true
            }));

        setEducationDetails([...(employee?.educationDetails || []), ...queuedEducation]);
        setExperienceDetails([...(employee?.experienceDetails || []), ...queuedExperience]);
    }, [employee]);

    /** Matches ProfileHeader / HR review: one row per section + change type, with merged edit counts. */
    const approvalSubmitPendingEntries = useMemo(() => {
        const list = Array.isArray(employee?.pendingReactivationChanges)
            ? employee.pendingReactivationChanges
            : [];
        return list.map((entry, idx) => ({
            ...entry,
            _id: String(entry?._id || idx),
            card: String(entry?.card || '').trim() || 'Profile change',
            changeType: String(entry?.changeType || '').trim(),
            section: String(entry?.section || '').trim(),
        }));
    }, [employee?.pendingReactivationChanges]);

    const approvalSubmitPendingDisplayGroups = useMemo(() => {
        const byKey = new Map();
        for (const entry of approvalSubmitPendingEntries) {
            const sec = String(entry.section || '').toLowerCase().trim();
            const ct = String(entry.changeType || '').toLowerCase().trim();
            const cardSlug = String(entry.card || '').trim().toLowerCase();
            const key = sec ? `${sec}::${ct}` : `card::${cardSlug}::${ct}`;
            if (!byKey.has(key)) byKey.set(key, { key, ids: [], entries: [] });
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
    }, [approvalSubmitPendingEntries]);

    const approvalSubmitAllEntryIds = useMemo(
        () => approvalSubmitPendingDisplayGroups.flatMap((g) => g.ids.map(String)),
        [approvalSubmitPendingDisplayGroups],
    );

    useEffect(() => {
        if (!showApprovalSubmitModal) return;
        setApprovalSubmitSelectedEntryIds([...approvalSubmitAllEntryIds]);
    }, [showApprovalSubmitModal, approvalSubmitAllEntryIds]);

    const approvalSubmitAllRowsSelected =
        approvalSubmitAllEntryIds.length > 0 &&
        approvalSubmitAllEntryIds.every((id) => approvalSubmitSelectedEntryIds.includes(id));

    const toggleApprovalSubmitSelectAll = () => {
        if (approvalSubmitAllRowsSelected) {
            setApprovalSubmitSelectedEntryIds([]);
            return;
        }
        setApprovalSubmitSelectedEntryIds([...approvalSubmitAllEntryIds]);
    };

    const toggleApprovalSubmitGroupSelection = (groupIds) => {
        if (!Array.isArray(groupIds) || groupIds.length === 0) return;
        const strIds = groupIds.map(String);
        setApprovalSubmitSelectedEntryIds((prev) => {
            const allIn = strIds.every((id) => prev.includes(id));
            if (allIn) return prev.filter((x) => !strIds.includes(x));
            return [...new Set([...prev, ...strIds])];
        });
    };

    // Lazy load reporting authorities only when work details modal opens (performance optimization)
    useEffect(() => {
        if (showWorkDetailsModal && reportingAuthorityOptions.length === 0 && !reportingAuthorityLoading) {
            fetchReportingAuthorities();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showWorkDetailsModal]); // Only trigger when modal opens - prevents loading on initial page load

    const handleDelete = async () => {
        if (!employee) return;
        try {
            setDeleting(true);
            await axiosInstance.delete(`/Employee/${employeeId}`);
            router.push('/emp');
        } catch (err) {
            console.error('Error deleting employee:', err);
            setError(err.response?.data?.message || err.message || 'Failed to delete employee');
        } finally {
            setDeleting(false);
        }
    };

    const basicDetailsCompleted = () => Boolean(employee);
    const hasPersonalDetailsSection = () => Boolean(employee);
    const hasPassportSection = () => Boolean(
        employee?.passportDetails &&
        (employee.passportDetails.number ||
            employee.passportDetails.issueDate ||
            employee.passportDetails.expiryDate ||
            employee.passportDetails.placeOfIssue ||
            employee.passportDetails.document?.data)
    );

    const normalizeSectionKey = (value) =>
        String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const isBankPendingEntry = (entry) => {
        const sectionKey = normalizeSectionKey(entry?.section);
        const cardKey = normalizeSectionKey(entry?.card);
        return sectionKey.includes('bank') || cardKey.includes('bank');
    };
    const extractBankProposalData = (entry) => {
        const proposed = resolveActivationSnapshot(entry, 'proposed');
        if (!proposed || typeof proposed !== 'object') return null;
        return proposed.bankDetails || proposed.bankAccount || proposed.bank || proposed;
    };

    const pendingBankSectionData = useMemo(() => {
        const list = Array.isArray(employee?.pendingReactivationChanges)
            ? [...employee.pendingReactivationChanges]
            : [];
        list.sort((a, b) => new Date(b?.requestedAt || 0) - new Date(a?.requestedAt || 0));
        const row = list.find(
            (x) => isBankPendingEntry(x) && x?.proposedData && typeof x.proposedData === 'object',
        );
        return extractBankProposalData(row);
    }, [employee?.pendingReactivationChanges]);

    const employeeEffectiveBankData = useMemo(() => ({
        bankName:
            localPendingBankData?.bankName ??
            pendingBankSectionData?.bankName ??
            pendingBankSectionData?.bank ??
            employee?.bankName ??
            employee?.bank,
        accountName:
            localPendingBankData?.accountName ??
            pendingBankSectionData?.accountName ??
            pendingBankSectionData?.bankAccountName ??
            employee?.accountName ??
            employee?.bankAccountName,
        accountNumber:
            localPendingBankData?.accountNumber ??
            pendingBankSectionData?.accountNumber ??
            pendingBankSectionData?.bankAccountNumber ??
            employee?.accountNumber ??
            employee?.bankAccountNumber,
        ibanNumber:
            localPendingBankData?.ibanNumber ??
            pendingBankSectionData?.ibanNumber ??
            employee?.ibanNumber,
        swiftCode:
            localPendingBankData?.swiftCode ??
            pendingBankSectionData?.swiftCode ??
            pendingBankSectionData?.ifscCode ??
            pendingBankSectionData?.ifsc ??
            employee?.swiftCode ??
            employee?.ifscCode ??
            employee?.ifsc,
        bankOtherDetails:
            localPendingBankData?.bankOtherDetails ??
            pendingBankSectionData?.bankOtherDetails ??
            pendingBankSectionData?.otherBankDetails ??
            employee?.bankOtherDetails ??
            employee?.otherBankDetails,
        bankAttachment:
            localPendingBankData?.bankAttachment ??
            pendingBankSectionData?.bankAttachment ??
            employee?.bankAttachment
    }), [employee, pendingBankSectionData, localPendingBankData]);

    const salaryTabEmployee = useMemo(() => ({
        ...employee,
        ...employeeEffectiveBankData
    }), [employee, employeeEffectiveBankData]);

    const hasSalaryDetails = () => {
        if (!employee) return false;

        // Always return true to show salary card for all employees
        // The card will show "Add Salary" button if no data exists
        return true;
    };

    const hasBankDetailsSection = () => {
        if (!employee) return false;
        const bankFields = [
            employeeEffectiveBankData.bankName,
            employeeEffectiveBankData.accountName,
            employeeEffectiveBankData.accountNumber,
            employeeEffectiveBankData.ibanNumber,
            employeeEffectiveBankData.swiftCode,
            employeeEffectiveBankData.bankOtherDetails
        ];
        return bankFields.some(field => field && field.toString().trim() !== '');
    };

    const hasVisaSection = () => {
        const visaDetails = employee?.visaDetails;
        if (!visaDetails) return false;
        return ['employment', 'visit', 'spouse'].some((type) => {
            const visa = visaDetails[type];
            if (!visa) return false;
            return Boolean(
                visa.number ||
                visa.issueDate ||
                visa.expiryDate ||
                visa.sponsor ||
                visa.document?.data
            );
        });
    };
    const hasEmergencyContactSection = () => {
        if (Array.isArray(employee?.emergencyContacts) && employee.emergencyContacts.length > 0) {
            return true;
        }
        return Boolean(
            employee?.emergencyContactName ||
            employee?.emergencyContactNumber
        );
    };
    const isPermanentAddressComplete = () => Boolean(
        employee &&
        (employee.addressLine1 ||
            employee.addressLine2 ||
            employee.city ||
            employee.state ||
            employee.country ||
            employee.postalCode)
    );
    const isCurrentAddressComplete = () => Boolean(
        employee &&
        (employee.currentAddressLine1 ||
            employee.currentAddressLine2 ||
            employee.currentCity ||
            employee.currentState ||
            employee.currentCountry ||
            employee.currentPostalCode)
    );


    // Calculate profile completion percentage with pending fields tracking
    const calculateProfileCompletion = () => {
        if (!employee) return { percentage: 0, pendingFields: [] };

        const pendingFields = [];
        const sectionPendingMap = new Map(); // To group by section

        // Helper to check field and add to pending if missing (grouped by section)
        const checkField = (value, fieldName, sectionName) => {
            if (!value || (typeof value === 'string' && value.trim() === '')) {
                if (!sectionPendingMap.has(sectionName)) {
                    sectionPendingMap.set(sectionName, []);
                }
                sectionPendingMap.get(sectionName).push(fieldName);
                return false;
            }
            return true;
        };

        // Expiry should not affect completion progress or pending list.
        const isExpired = (dateString, label, sectionName) => {
            if (!dateString) return false; // Missing date handled by checkField
            return false;
        };

        let totalFields = 0;
        let completedFields = 0;
        const pendingChanges = Array.isArray(employee?.pendingReactivationChanges)
            ? [...employee.pendingReactivationChanges]
            : [];
        pendingChanges.sort((a, b) => new Date(b?.requestedAt || 0) - new Date(a?.requestedAt || 0));
        const getPendingSectionData = (sectionName) => {
            const sec = normalizeSectionKey(sectionName);
            const row = pendingChanges.find((x) => normalizeSectionKey(x?.section) === sec);
            const proposed = resolveActivationSnapshot(row, 'proposed');
            return proposed && typeof proposed === 'object' ? proposed : null;
        };

        // Define employee status early for usage in Visa logic
        const isPermanentEmployee = employee.status === 'Permanent';

        // Basic Details fields (from modal)
        const basicFields = [
            { value: employee.employeeId, name: 'Employee ID' },
            { value: employee.firstName, name: 'First Name' },
            { value: employee.lastName, name: 'Last Name' },
            { value: employee.contactNumber, name: 'Contact Number' },
            { value: employee.gender, name: 'Gender' },
            { value: employee.email || employee.workEmail, name: 'Personal Email' },
            { value: employee.nationality, name: 'Nationality' },
            { value: employee.status, name: 'Status' },
            { value: employee.maritalStatus, name: 'Marital Status' },
            { value: employee.profilePicture || employee.profilePic || employee.avatar, name: 'Profile Picture' }
        ];

        basicFields.forEach(({ value, name }) => {
            totalFields++;
            if (checkField(value, name, 'Basic Details')) completedFields++;
        });

        // Probation Period (if status is Probation)
        if (employee.status === 'Probation') {
            totalFields++;
            if (checkField(employee.probationPeriod, 'Probation Period', 'Basic Details')) {
                completedFields++;
            }
        }

        // Passport fields
        const pendingPassport = getPendingSectionData('passport');
        const effectivePassport = employee.passportDetails || pendingPassport;
        if (effectivePassport) {
            const passportFields = [
                { value: effectivePassport.number, name: 'Passport Number' },
                { value: effectivePassport.issueDate, name: 'Passport Issue Date' },
                { value: effectivePassport.expiryDate, name: 'Passport Expiry Date' },
                { value: effectivePassport.placeOfIssue, name: 'Place of Issue' }
            ];
            passportFields.forEach(({ value, name }) => {
                totalFields++;
                const isFieldPresent = checkField(value, name, 'Passport');

                // If present and it's the expiry date, check if expired
                if (isFieldPresent && name === 'Passport Expiry Date') {
                    if (isExpired(value, 'Renew Passport', 'Passport')) {
                        // Field is present but expired -> It counts as totalFields but NOT as completed
                    } else {
                        completedFields++;
                    }
                } else if (isFieldPresent) {
                    completedFields++;
                }
            });
        } else {
            // Passport not added - add all fields to pending
            ['Passport Number', 'Passport Issue Date', 'Passport Expiry Date', 'Place of Issue'].forEach(name => {
                totalFields++;
                if (!sectionPendingMap.has('Passport')) {
                    sectionPendingMap.set('Passport', []);
                }
                sectionPendingMap.get('Passport').push(name);
            });
        }

        // Visa fields (only if not UAE nationality)
        const nationality = employee?.nationality?.toLowerCase()?.trim() || '';
        const isUAE = nationality === 'uae' || nationality === 'ae' || nationality === 'united arab emirates' || nationality === 'united arab emirate';
        const isVisaRequired = !nationality || !isUAE;
        const requiresEmiratesIdAndLabourCard = isPermanentEmployee || isUAE;

        if (isVisaRequired) {
            const visaTypes = ['visit', 'employment', 'spouse'];
            const pendingVisa = getPendingSectionData('visa');
            const pendingVisaType = String(pendingVisa?.type || pendingVisa?.visaType || '').toLowerCase();
            const hasPendingVisa = !!pendingVisa?.number;
            const hasAnyVisa = visaTypes.some(type => employee.visaDetails?.[type]?.number) || hasPendingVisa;

            if (hasAnyVisa) {
                // Find the best visa to count:
                // 1. Any Valid (Not Expired) Visa
                // 2. If no valid visa, use the most relevant expired one (Employment > Spouse > Visit)

                let targetType = null;

                const isValid = (visa) => {
                    if (!visa?.expiryDate) return false;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return new Date(visa.expiryDate) >= today;
                };

                // Check for valid visas
                if (isValid(employee.visaDetails?.employment)) targetType = 'employment';
                else if (isValid(employee.visaDetails?.spouse)) targetType = 'spouse';
                else if (isValid(employee.visaDetails?.visit)) targetType = 'visit';
                else if (hasPendingVisa && visaTypes.includes(pendingVisaType)) targetType = pendingVisaType;

                // If no valid visa, pick an expired one to flag
                if (!targetType) {
                    if (employee.visaDetails?.employment?.number) targetType = 'employment';
                    else if (employee.visaDetails?.spouse?.number) targetType = 'spouse';
                    else if (employee.visaDetails?.visit?.number) targetType = 'visit';
                    else if (hasPendingVisa) targetType = visaTypes.includes(pendingVisaType) ? pendingVisaType : 'employment';
                }

                if (targetType) {
                    const visa =
                        (hasPendingVisa && (!employee.visaDetails?.[targetType]?.number || pendingVisaType === targetType))
                            ? pendingVisa
                            : (employee.visaDetails?.[targetType] || pendingVisa || {});
                    const visaLabel = targetType.charAt(0).toUpperCase() + targetType.slice(1);
                    const visaFields = [
                        { value: visa.number, name: `${visaLabel} Visa Number` },
                        { value: visa.issueDate, name: `${visaLabel} Visa Issue Date` },
                        { value: visa.expiryDate, name: `${visaLabel} Visa Expiry Date` }
                    ];

                    // Sponsor is required only for Employment and Spouse visas, not for Visit visa
                    if (targetType === 'employment' || targetType === 'spouse') {
                        visaFields.push({ value: visa.sponsor, name: `${visaLabel} Visa Sponsor` });
                    }

                    visaFields.forEach(({ value, name }) => {
                        totalFields++;
                        const isFieldPresent = checkField(value, name, 'Visa');

                        // If present and it's the expiry date, check if expired
                        if (isFieldPresent && name === `${visaLabel} Visa Expiry Date`) {
                            if (isExpired(value, `Renew ${visaLabel} Visa`, 'Visa')) {
                                // Field is present but expired -> NOT completed
                            } else {
                                completedFields++;
                            }
                        } else if (isFieldPresent) {
                            completedFields++;
                        }
                    });
                }

            } else {
                // No visa added yet - require at least one visa type
                totalFields += 4; // One visa type with 4 fields
                if (!sectionPendingMap.has('Visa')) {
                    sectionPendingMap.set('Visa', []);
                }
                sectionPendingMap.get('Visa').push('Add at least one visa (Visit/Employment/Spouse)');
            }
        }




        // Emirates ID fields (required for permanent employees OR UAE nationals)
        if (requiresEmiratesIdAndLabourCard) {
            const pendingEmiratesId = getPendingSectionData('emiratesid');
            const effectiveEmiratesId = employee.emiratesIdDetails || pendingEmiratesId;
            if (effectiveEmiratesId) {
                const emiratesIdFields = [
                    { value: effectiveEmiratesId.number, name: 'Emirates ID Number' },
                    { value: effectiveEmiratesId.issueDate, name: 'Emirates ID Issue Date' },
                    { value: effectiveEmiratesId.expiryDate, name: 'Emirates ID Expiry Date' },
                    { value: effectiveEmiratesId.lastUpdated || effectiveEmiratesId.issueDate, name: 'Emirates ID Last Updated' }
                ];
                emiratesIdFields.forEach(({ value, name }) => {
                    totalFields++;
                    const isFieldPresent = checkField(value, name, 'Emirates ID');

                    // If present and it's the expiry date, check if expired
                    if (isFieldPresent && name === 'Emirates ID Expiry Date') {
                        if (isExpired(value, 'Renew Emirates ID', 'Emirates ID')) {
                            // Expired -> NOT completed
                        } else {
                            completedFields++;
                        }
                    } else if (isFieldPresent) {
                        completedFields++;
                    }
                });
            } else {
                // Emirates ID not added - add all fields to pending
                ['Emirates ID Number', 'Emirates ID Issue Date', 'Emirates ID Expiry Date', 'Emirates ID Last Updated'].forEach(name => {
                    totalFields++;
                    if (!sectionPendingMap.has('Emirates ID')) {
                        sectionPendingMap.set('Emirates ID', []);
                    }
                    sectionPendingMap.get('Emirates ID').push(name);
                });
            }
        }

        // Medical Insurance fields (Excluding from mandatory check as per user request)
        /*
        if (isPermanentEmployee) {
            if (employee.medicalInsuranceDetails) {
                 // ... (logic commented out)
            } else {
                 // ...
            }
        }
        */

        // Labour Card fields (required for permanent employees OR UAE nationals)
        if (requiresEmiratesIdAndLabourCard) {
            const pendingLabourCard = getPendingSectionData('labourcard');
            const effectiveLabourCard = employee.labourCardDetails || pendingLabourCard;
            if (effectiveLabourCard) {
                const labourCardFields = [
                    { value: effectiveLabourCard.number, name: 'Labour Card Number' },

                    { value: effectiveLabourCard.expiryDate, name: 'Labour Card Expiry Date' },
                    { value: effectiveLabourCard.lastUpdated || effectiveLabourCard.issueDate, name: 'Labour Card Last Updated' }
                ];
                labourCardFields.forEach(({ value, name }) => {
                    totalFields++;
                    const isFieldPresent = checkField(value, name, 'Labour Card');

                    // If present and it's the expiry date, check if expired
                    if (isFieldPresent && name === 'Labour Card Expiry Date') {
                        if (isExpired(value, 'Renew Labour Card', 'Labour Card')) {
                            // Expired -> NOT completed
                        } else {
                            completedFields++;
                        }
                    } else if (isFieldPresent) {
                        completedFields++;
                    }
                });
            } else {
                // Labour Card not added - add all fields to pending
                ['Labour Card Number', 'Labour Card Expiry Date', 'Labour Card Last Updated'].forEach(name => {
                    totalFields++;
                    if (!sectionPendingMap.has('Labour Card')) {
                        sectionPendingMap.set('Labour Card', []);
                    }
                    sectionPendingMap.get('Labour Card').push(name);
                });
            }
        }

        // Driving License fields (Excluding from mandatory check as per user request)
        /*
        if (isPermanentEmployee) {
            if (employee.drivingLicenceDetails) {
                // ... (logic commented out)
            } else {
                // ...
            }
        }
        */

        const personalFields = [
            { value: employee.dateOfBirth, name: 'Date of Birth' },
            { value: employee.fathersName, name: 'Father\'s Name' }
        ];
        personalFields.forEach(({ value, name }) => {
            totalFields++;
            if (checkField(value, name, 'Personal Details')) completedFields++;
        });

        /*
        // Permanent Address (check if at least some fields filled)
        const permanentAddressFields = [
            { value: employee.addressLine1, name: 'Address Line 1' },
            { value: employee.city, name: 'City' },
            { value: getCountryName(employee.country), name: 'Country' },
            { value: getStateName(employee.country, employee.state), name: 'Emirates/State' }
        ];
        const permanentFilled = permanentAddressFields.filter(f => f.value && f.value.trim() !== '').length;
        permanentAddressFields.forEach(({ value, name }) => {
            totalFields++;
            if (checkField(value, name, 'Permanent Address')) completedFields++;
        });
     
        // Current Address (check if at least some fields filled)
        const currentAddressFields = [
            { value: employee.currentAddressLine1, name: 'Address Line 1' },
            { value: employee.currentCity, name: 'City' },
            { value: getCountryName(employee.currentCountry), name: 'Country' },
            { value: getStateName(employee.currentCountry, employee.currentState), name: 'Emirates/State' }
        ];
        currentAddressFields.forEach(({ value, name }) => {
            totalFields++;
            if (checkField(value, name, 'Current Address')) completedFields++;
        });
        */

        // Salary Details (Attachment) - Required for Permanent
        if (isPermanentEmployee) {
            // Check for offer letter in latest salary history or main employee
            let hasSalaryAttachment = false;

            // Check main employee field
            if (employee.offerLetter && (employee.offerLetter.url || employee.offerLetter.data)) {
                hasSalaryAttachment = true;
            }

            // If not found, check salary history
            if (!hasSalaryAttachment && employee.salaryHistory && Array.isArray(employee.salaryHistory)) {
                hasSalaryAttachment = employee.salaryHistory.some(entry =>
                    entry.offerLetter && (entry.offerLetter.url || entry.offerLetter.data)
                );
            }

            totalFields++;
            if (checkField(hasSalaryAttachment ? 'Uploaded' : null, 'Salary Attachment', 'Salary Details')) completedFields++;
        }

        const pendingBankEntry = pendingChanges.find((x) => isBankPendingEntry(x));
        const pendingBankProposal = extractBankProposalData(pendingBankEntry) || getPendingSectionData('bankdetails');
        const effectiveBankData = {
            bankName:
                localPendingBankData?.bankName ??
                pendingBankProposal?.bankName ??
                pendingBankProposal?.bank ??
                employee.bankName ??
                employee.bank,
            accountName:
                localPendingBankData?.accountName ??
                pendingBankProposal?.accountName ??
                pendingBankProposal?.bankAccountName ??
                employee.accountName ??
                employee.bankAccountName,
            accountNumber:
                localPendingBankData?.accountNumber ??
                pendingBankProposal?.accountNumber ??
                pendingBankProposal?.bankAccountNumber ??
                employee.accountNumber ??
                employee.bankAccountNumber,
            ibanNumber:
                localPendingBankData?.ibanNumber ??
                pendingBankProposal?.ibanNumber ??
                employee.ibanNumber,
            bankAttachment:
                localPendingBankData?.bankAttachment ??
                pendingBankProposal?.bankAttachment ??
                employee.bankAttachment
        };

        // Bank Details - Mandatory for profile completion (all employees)
        totalFields++;
        const bankName = effectiveBankData.bankName;
        if (checkField(bankName, 'Bank Name', 'Bank Details')) completedFields++;

        totalFields++;
        const accountName = effectiveBankData.accountName;
        if (checkField(accountName, 'Account Name', 'Bank Details')) completedFields++;

        // Check for Account Number OR IBAN (core identifier)
        totalFields++;
        const accountId = effectiveBankData.accountNumber || effectiveBankData.ibanNumber;
        if (checkField(accountId, 'Account Number / IBAN', 'Bank Details')) completedFields++;

        // Check for Bank Attachment
        const hasBankAttachment = effectiveBankData.bankAttachment?.url || effectiveBankData.bankAttachment?.data;
        totalFields++;
        if (checkField(hasBankAttachment ? 'Uploaded' : null, 'Bank Attachment', 'Bank Details')) completedFields++;

        // Emergency Contact (at least one with name and number)
        // Use memoized contacts if available, otherwise calculate
        const contacts = existingContacts || getExistingContacts();
        if (contacts.length > 0) {
            // Check first contact fields
            const firstContact = contacts[0];
            const contactFields = [
                { value: firstContact.name, name: 'Contact Name' },
                { value: firstContact.number, name: 'Contact Number' }
            ];
            contactFields.forEach(({ value, name }) => {
                totalFields++;
                if (checkField(value, name, 'Emergency Contact')) completedFields++;
            });
        } else {
            totalFields += 2;
            if (!sectionPendingMap.has('Emergency Contact')) {
                sectionPendingMap.set('Emergency Contact', []);
            }
            sectionPendingMap.get('Emergency Contact').push('Add at least one emergency contact with name and number');
        }

        const pendingWorkProposal = Array.isArray(employee?.pendingReactivationChanges)
            ? [...employee.pendingReactivationChanges]
                .reverse()
                .find((c) =>
                    c &&
                    typeof c === 'object' &&
                    String(c.section || '').toLowerCase() === 'workdetails' &&
                    ['update', 'edit'].includes(String(c.changeType || '').toLowerCase()) &&
                    c.proposedData &&
                    typeof c.proposedData === 'object'
                )
            : null;
        const workData = {
            company: pendingWorkProposal?.proposedData?.company ?? employee.company,
            companyEmail: pendingWorkProposal?.proposedData?.companyEmail ?? employee.companyEmail,
            dateOfJoining: pendingWorkProposal?.proposedData?.dateOfJoining ?? employee.dateOfJoining,
            contractJoiningDate: pendingWorkProposal?.proposedData?.contractJoiningDate ?? employee.contractJoiningDate,
            primaryReportee: pendingWorkProposal?.proposedData?.primaryReportee ?? employee.primaryReportee
        };

        // Work Details fields
        totalFields++;
        if (checkField(workData.company, 'Company', 'Work Details')) completedFields++;

        /*
        totalFields++;
        if (checkField(employee.companyEmail, 'Company Email', 'Work Details')) completedFields++;
        */

        totalFields++;
        if (checkField(workData.dateOfJoining, 'Date of Joining', 'Work Details')) completedFields++;

        totalFields++;
        if (checkField(workData.contractJoiningDate, 'Contract Joining Date', 'Work Details')) completedFields++;

        const primaryReporteeValue = (() => {
            if (!workData?.primaryReportee) return null;
            // Handle populated object
            if (typeof workData.primaryReportee === 'object' && workData.primaryReportee !== null) {
                return `${workData.primaryReportee.firstName || ''} ${workData.primaryReportee.lastName || ''}`.trim() || workData.primaryReportee.employeeId || null;
            }
            // Handle string/ID
            const match = reportingAuthorityOptions.find(opt => opt.value === workData.primaryReportee);
            return match?.label || workData.primaryReportee || null;
        })();

        // Skip Primary Reportee check for General Manager or CEO (Management)
        const isManagementExempt = (employee.department && /management/i.test(employee.department)) &&
            ['ceo', 'c.e.o', 'c.e.o.', 'chief executive officer', 'director', 'managing director', 'general manager', 'gm', 'g.m', 'g.m.'].includes(employee.designation?.toLowerCase());

        if (!isManagementExempt) {
            totalFields++;
            if (checkField(primaryReporteeValue, 'Primary Reportee', 'Work Details')) completedFields++;
        }

        // Digital Signature
        totalFields++;
        if (checkField(employee?.signature?.url || employee?.signature?.data || employee?.signature?.name, 'Digital Signature', 'Work Details')) {
            completedFields++;
        }

        // Convert grouped pending fields to flat list for display (limit to avoid overwhelming)
        sectionPendingMap.forEach((fields, section) => {
            // If section has many fields, summarize; otherwise list individually
            if (fields.length > 3) {
                pendingFields.push({ section, field: `${fields.length} fields incomplete` });
            } else {
                fields.forEach(field => {
                    pendingFields.push({ section, field });
                });
            }
        });

        const percentage = totalFields === 0 ? 0 : Math.round((completedFields / totalFields) * 100);
        return { percentage, pendingFields };
    };

    // Helper function to convert base64 string to File object
    const base64ToFile = (base64String, fileName, mimeType) => {
        try {
            if (!base64String || typeof base64String !== 'string') {
                console.warn('Invalid base64 string provided to base64ToFile');
                return null;
            }

            // Remove data URL prefix if present (e.g., "data:application/pdf;base64,")
            let base64Data = base64String;
            if (base64String.includes(',')) {
                base64Data = base64String.split(',')[1];
            }
            // Remove any whitespace
            base64Data = base64Data.trim();

            if (!base64Data) {
                console.warn('Empty base64 data after processing');
                return null;
            }

            // Decode base64
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType || 'application/pdf' });
            const file = new File([blob], fileName || 'document.pdf', {
                type: mimeType || 'application/pdf',
                lastModified: Date.now()
            });

            return file;
        } catch (error) {
            console.error('Error converting base64 to file:', error);
            return null;
        }
    };

    // Calculate years and months in company
    // Calculate tenure using helper function
    // Handle file selection
    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Please select a valid image file');
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                setSelectedImage(event.target.result);
                setShowImageModal(true);
                setImageScale(1);
            };
            reader.readAsDataURL(file);
        }
    };

    // Crop and convert image to base64 using AvatarEditor
    const cropImage = () => {
        return new Promise((resolve, reject) => {
            try {
                if (!avatarEditorRef.current) {
                    reject(new Error('Avatar editor not initialized'));
                    return;
                }

                // Get the canvas from AvatarEditor (already cropped to circle)
                const canvas = avatarEditorRef.current.getImageScaledToCanvas();

                // Convert to base64
                const base64Image = canvas.toDataURL('image/png', 1.0);

                if (!base64Image || base64Image === 'data:,') {
                    reject(new Error('Failed to convert image to base64'));
                    return;
                }

                resolve(base64Image);
            } catch (error) {
                reject(error);
            }
        });
    };

    // Upload cropped image
    const handleUploadImage = async () => {
        if (!selectedImage) {
            setError('Please select an image first');
            return;
        }

        try {
            setUploading(true);
            setError('');

            const croppedImage = await cropImage();

            if (!croppedImage || typeof croppedImage !== 'string') {
                setError('Failed to process image. Please try again.');
                setUploading(false);
                return;
            }

            // Verify the image is a valid base64 string
            if (!croppedImage.startsWith('data:image/')) {
                setError('Invalid image format. Please try again.');
                setUploading(false);
                return;
            }

            console.log('Uploading profile picture to Cloudinary, length:', croppedImage.length);

            // Upload to Cloudinary via backend endpoint
            const response = await axiosInstance.post(`/Employee/upload-profile-picture/${employeeId}`, {
                image: croppedImage
            });

            console.log('Upload response:', response.data);

            // Refresh employee data
            await fetchEmployee();
            setShowImageModal(false);
            setSelectedImage(null);
            setImageError(false);
            setImageScale(1);

            toast({
                variant: "default",
                title: "Profile Picture Updated",
                description: "Your profile picture has been updated successfully."
            });
        } catch (err) {
            console.error('Error uploading image:', err);
            setError(err.response?.data?.message || err.message || 'Failed to upload image');
            toast({
                variant: "destructive",
                title: "Upload Failed",
                description: err.response?.data?.message || err.message || 'Failed to upload image. Please try again.'
            });
        } finally {
            setUploading(false);
        }
    };

    // Tenure Calculation: Prefer contractJoiningDate for "Joining date from contract"
    const tenure = calculateTenure(employee?.contractJoiningDate || employee?.dateOfJoining);

    // Memoize expensive calculations FIRST (before they're used)
    // Also memoize the boolean result for use in this component
    const isUAENational = useMemo(() => {
        return isUAENationality();
    }, [isUAENationality]);

    const existingContacts = useMemo(() => {
        return getExistingContacts();
    }, [employee?.emergencyContacts, employee?.emergencyContactName, employee?.emergencyContactNumber]);

    const hasSalaryDetailsMemo = useMemo(() => {
        return hasSalaryDetails();
    }, [employee?.basic, employee?.houseRentAllowance, employee?.otherAllowance, employee?.salaryHistory]);

    // Memoize expensive profile completion calculation (uses existingContacts internally)
    const profileCompletionData = useMemo(() => {
        return calculateProfileCompletion();
    }, [employee, reportingAuthorityOptions, existingContacts]);

    const profileCompletion = profileCompletionData.percentage;
    const pendingFields = profileCompletionData.pendingFields;



    const currentApprovalStatus = employee?.profileApprovalStatus || 'draft';

    // Effect to automatically downgrade status to 'draft' if profile is active but completion drops below 100%
    useEffect(() => {
        if (currentApprovalStatus === 'active' && profileCompletion < 100 && employeeId) {
            console.log('Profile completion dropped below 100% for active profile. Downgrading status to draft.');

            // Optimistic update
            updateEmployeeOptimistically({
                profileApprovalStatus: 'draft',
                profileStatus: 'inactive'
            });

            // Backend update
            axiosInstance.patch(`/Employee/${employeeId}/profile-status`, { status: 'draft' })
                .then(() => {
                    toast({
                        title: "Profile Status Updated",
                        description: "Profile status reverted to inactive due to incomplete details.",
                    });
                })
                .catch(err => {
                    console.error('Failed to auto-downgrade profile status:', err);
                    // Revert optimistic update if needed or just let next fetch handle it
                });
        }
    }, [currentApprovalStatus, profileCompletion, employeeId, updateEmployeeOptimistically]);

    const isProfileReady = profileCompletion >= 100;

    // Strict Check: Profile is ONLY considered 'active'/'approved' if backend says so AND completion is 100%
    const profileApproved = currentApprovalStatus === 'active' && isProfileReady;

    const awaitingApproval = currentApprovalStatus === 'submitted';
    const canSendForApproval =
        isProfileReady &&
        (currentApprovalStatus === 'draft' ||
            currentApprovalStatus === 'rejected' ||
            activationHoldResubmitEligible(employee, currentUser));



    const isPrimaryReportee = useMemo(() => {
        if (!currentUser || !employee?.primaryReportee) return false;

        // Current User Identity
        const currentUserId = currentUser._id || currentUser.id;
        const currentEmpId = currentUser.employeeId;
        const currentEmpObjectId = currentUser.employeeObjectId;

        // Targeted Reportee (Manager) Identity from Employee record
        const reportee = employee.primaryReportee;

        // Extract the ID from primaryReportee (could be string, ObjectId, or populated object)
        const reporteeId = (() => {
            if (typeof reportee === 'object' && reportee !== null) {
                return String(reportee._id || reportee.id || reportee.$oid || reportee);
            }
            return String(reportee);
        })();

        // 1. Check by Database ID (EmployeeBasic _id) - most accurate
        if (currentEmpObjectId && String(currentEmpObjectId) === reporteeId) return true;

        // 2. Population Check (if populated, check emails and custom IDs)
        if (typeof reportee === 'object' && reportee !== null && reportee.employeeId) {
            // Check by custom employeeId (e.g. VEGA-HR-00001)
            if (currentEmpId && reportee.employeeId && currentEmpId === reportee.employeeId) return true;

            // Check by email as fallback
            const currentEmail = (currentUser.email || '').toLowerCase();
            const reporteeEmail = (reportee.email || reportee.workEmail || reportee.companyEmail || '').toLowerCase();
            if (currentEmail && reporteeEmail && currentEmail === reporteeEmail) return true;
        }

        // 3. Fallback for ID string match: Check if the ID string matches User ID or Emp ID
        if (reporteeId === String(currentUserId) || reporteeId === String(currentEmpId)) return true;

        const ne = (e) => String(e || '').toLowerCase().trim().replace(/\s+/g, '');
        const currentEmails = [currentUser.companyEmail, currentUser.workEmail, currentUser.email]
            .map(ne)
            .filter(Boolean);
        if (typeof reportee === 'object' && reportee !== null && currentEmails.length) {
            const reEmails = [
                reportee.companyEmail,
                reportee.workEmail,
                reportee.email,
                reportee.personalEmail,
            ]
                .map(ne)
                .filter(Boolean);
            if (currentEmails.some((ce) => reEmails.includes(ce))) return true;
        }

        return false;
    }, [currentUser, employee?.primaryReportee]);

    const canReviewProfileActivation = useMemo(() => {
        if (!currentUser) return false;
        if (isAdmin()) return true;
        if (currentUser?.role === "Admin" || currentUser?.role === "ROOT" || currentUser?.isAdmin === true) return true;

        const myObj = currentUser.employeeObjectId || currentUser.empObjectId;
        // Prefer the backend-assigned HR for THIS specific profile activation request.
        // This avoids mismatches if the "active-holder/hr" flowchart changes.
        const submittedToId = employee?.profileSubmittedTo;
        if (submittedToId && myObj && String(submittedToId) === String(myObj)) return true;

        const submittedStep = Array.isArray(employee?.profileWorkflow)
            ? [...employee.profileWorkflow].reverse().find((w) => w?.status === 'submitted')
            : null;
        if (submittedStep?.assignedTo && myObj && String(submittedStep.assignedTo) === String(myObj)) return true;

        // Fallback to the current flowchart holder (in case profileSubmittedTo isn't set yet).
        if (flowchartHrEmpObjectId && myObj && String(myObj) === String(flowchartHrEmpObjectId)) return true;

        const myEid = currentUser.employeeId;
        if (flowchartHrEmployeeId && myEid && String(flowchartHrEmployeeId).trim() === String(myEid).trim()) return true;

        return false;
    }, [currentUser, employee?.profileSubmittedTo, employee?.profileWorkflow, flowchartHrEmpObjectId, flowchartHrEmployeeId]);

    const canReviewHeldPendingsAsHod = false;

    const hodHeldPendingIdsSerialized = useMemo(() => {
        if (!employee?.profileActivationHold?.unapprovedEntryIds?.length) return '';
        return [...employee.profileActivationHold.unapprovedEntryIds].map(String).sort().join('\u0001');
    }, [employee?.profileActivationHold?.unapprovedEntryIds]);

    useEffect(() => {
        const empId = employee?.employeeId ? String(employee.employeeId) : '';
        if (!empId) return;
        const ids = hodHeldPendingIdsSerialized ? hodHeldPendingIdsSerialized.split('\u0001') : [];
        setHeldPendingsCheckByKey((prev) => {
            const otherEmployees = {};
            for (const [k, v] of Object.entries(prev)) {
                if (!k.startsWith(`${empId}:`)) otherEmployees[k] = v;
            }
            if (ids.length === 0) {
                return otherEmployees;
            }
            const next = { ...otherEmployees };
            for (const id of ids) {
                const key = `${empId}:${id}`;
                if (Object.prototype.hasOwnProperty.call(prev, key)) next[key] = prev[key];
                else next[key] = false;
            }
            for (const k of Object.keys(next)) {
                if (!k.startsWith(`${empId}:`)) continue;
                const rowId = k.slice(empId.length + 1);
                if (!ids.includes(rowId)) delete next[k];
            }
            return next;
        });
    }, [employee?.employeeId, hodHeldPendingIdsSerialized]);

    const hodHeldPendingRowCheckedMap = useMemo(() => {
        const empId = employee?.employeeId ? String(employee.employeeId) : '';
        const ids = hodHeldPendingIdsSerialized ? hodHeldPendingIdsSerialized.split('\u0001') : [];
        const m = {};
        if (!empId) return m;
        for (const id of ids) {
            m[id] = !!heldPendingsCheckByKey[`${empId}:${id}`];
        }
        return m;
    }, [employee?.employeeId, hodHeldPendingIdsSerialized, heldPendingsCheckByKey]);

    const toggleHeldPendingRowCheck = useCallback((rowId) => {
        if (!employee?.employeeId || rowId == null || rowId === '') return;
        const empId = String(employee.employeeId);
        const key = `${empId}:${String(rowId)}`;
        setHeldPendingsCheckByKey((prev) => ({ ...prev, [key]: !prev[key] }));
    }, [employee?.employeeId]);

    const heldPendingsHoldResubmitEligible = useMemo(
        () => activationHoldResubmitEligible(employee, currentUser),
        [employee, currentUser],
    );

    const heldPendingsActivationSubmitLabel = useMemo(
        () => (heldPendingsHoldResubmitEligible ? 'Submit for Activation' : 'Submit for Approval'),
        [heldPendingsHoldResubmitEligible],
    );

    const handleHeldPendingsConfirmReview = useCallback(() => {
        setShowHeldPendingsHodModal(false);
        toast({
            variant: 'default',
            title: 'Review acknowledged',
            description: 'You confirmed review of every held pending item on this list.',
        });
    }, []);

    const handleHeldPendingsResubmitAfterHold = useCallback(async () => {
        setShowHeldPendingsHodModal(false);
        const fresh = await fetchEmployee(true);
        const snap = fresh ?? employee;
        handleSubmitForApproval(snap);
    }, [employee, fetchEmployee, handleSubmitForApproval]);

    const canReviewNoticeRequest = useMemo(() => {
        if (!currentUser || employee?.noticeRequest?.status !== 'Pending') return false;
        if (isAdmin()) return true;
        if (currentUser?.role === "Admin" || currentUser?.role === "ROOT" || currentUser?.isAdmin === true) return true;
        if (isPrimaryReportee) return true;

        const myObj = currentUser.employeeObjectId || currentUser.empObjectId || currentUser._id || currentUser.id;
        const submittedToId = employee?.noticeRequest?.submittedTo;
        if (submittedToId && myObj && String(submittedToId) === String(myObj)) return true;

        const pendingStep = Array.isArray(employee?.noticeRequest?.workflow)
            ? employee.noticeRequest.workflow.find((w) => w?.status === 'Pending')
            : null;
        if (pendingStep?.assignedTo && myObj && String(pendingStep.assignedTo) === String(myObj)) return true;

        if (flowchartHrEmpObjectId && myObj && String(myObj) === String(flowchartHrEmpObjectId)) return true;

        const myEid = currentUser.employeeId;
        if (flowchartHrEmployeeId && myEid && String(flowchartHrEmployeeId).trim() === String(myEid).trim()) return true;

        return false;
    }, [
        currentUser,
        employee?.noticeRequest?.status,
        employee?.noticeRequest?.submittedTo,
        employee?.noticeRequest?.workflow,
        isPrimaryReportee,
        flowchartHrEmpObjectId,
        flowchartHrEmployeeId
    ]);

    const probationWorkflowAction = useMemo(() => {
        if (!employee || !isPrimaryReportee) return { canAct: false, action: null, label: '' };
        if (String(employee?.status || '').trim() !== 'Probation') return { canAct: false, action: null, label: '' };

        const reqStatus = String(employee?.probationChangeRequest?.status || 'none').trim().toLowerCase();
        const startRef = employee?.contractJoiningDate || employee?.dateOfJoining;
        const months = Number(employee?.probationPeriod || 6);
        let probationExpired = false;
        if (startRef && Number.isFinite(months) && months > 0) {
            const end = new Date(startRef);
            end.setMonth(end.getMonth() + months);
            end.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            probationExpired = today >= end;
        }

        if (reqStatus === 'pending_hod') {
            return { canAct: true, action: 'confirm_hod', label: 'Make Permanent' };
        }
        if (probationExpired && ['none', 'rejected', ''].includes(reqStatus)) {
            return { canAct: true, action: 'create_request', label: 'Start Permanent Request' };
        }
        return { canAct: false, action: null, label: '' };
    }, [
        employee,
        employee?.status,
        employee?.probationPeriod,
        employee?.contractJoiningDate,
        employee?.dateOfJoining,
        employee?.probationChangeRequest?.status,
        isPrimaryReportee,
    ]);

    const handleProbationWorkflowAction = useCallback(async () => {
        if (!employeeId || !probationWorkflowAction?.canAct || !probationWorkflowAction?.action) return;
        try {
            setProbationActionLoading(true);
            if (probationWorkflowAction.action === 'confirm_hod') {
                const { data } = await axiosInstance.post(`/Employee/${employeeId}/probation/hod-confirm`);
                toast({
                    title: 'Probation confirmed',
                    description: data?.message || 'Sent to next step for HR review.',
                });
            } else {
                const { data } = await axiosInstance.post(`/Employee/${employeeId}/probation/request`);
                toast({
                    title: 'Probation request created',
                    description: data?.message || 'Dashboard task and notifications are now available for the primary reportee.',
                });
            }
            await fetchEmployee(true);
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Action failed',
                description: err?.response?.data?.message || err?.message || 'Could not process probation action.',
            });
        } finally {
            setProbationActionLoading(false);
        }
    }, [employeeId, probationWorkflowAction, fetchEmployee]);

    const isVisaRequirementApplicable = useMemo(() => {
        return !isUAENational;
    }, [isUAENational]);

    // Memoize onViewDocument callback to prevent unnecessary re-renders
    const handleViewDocument = useCallback((doc) => {
        if (doc === null) {
            setShowDocumentViewer(false);
            setViewingDocument({ data: '', name: '', mimeType: '' });
        } else {
            const moduleId = doc?.moduleId;
            const allowDownload =
                doc?.allowDownload !== undefined && doc?.allowDownload !== null
                    ? doc.allowDownload
                    : moduleId == null || moduleId === undefined
                        ? true
                        : isAdmin() || hasPermission(moduleId, 'isDownload');
            setViewingDocument({ ...doc, allowDownload });
            setShowDocumentViewer(true);
        }
    }, [hasPermission]);

    // Calculate visa expiry days from visaDetails (check all visa types and find earliest expiry)
    // Only calculate for non-UAE nationals
    let visaDays = null;
    if (!isUAENational && employee?.visaDetails) {
        const visaTypes = ['visit', 'employment', 'spouse'];
        let earliestExpiryDate = null;

        visaTypes.forEach(type => {
            const visa = employee.visaDetails[type];
            if (visa?.expiryDate) {
                const expiryDate = visa.expiryDate;
                if (!earliestExpiryDate || new Date(expiryDate) < new Date(earliestExpiryDate)) {
                    earliestExpiryDate = expiryDate;
                }
            }
        });

        if (earliestExpiryDate) {
            visaDays = calculateDaysUntilExpiry(earliestExpiryDate);
        }
    }

    // Calculate EID and Medical expiry days (only if they exist)
    const eidDays = employee?.emiratesIdDetails?.expiryDate ? calculateDaysUntilExpiry(employee.emiratesIdDetails.expiryDate) : null;
    const medDays = employee?.medicalInsuranceDetails?.expiryDate ? calculateDaysUntilExpiry(employee.medicalInsuranceDetails.expiryDate) : null;

    // Calculate Passport expiry days (only if it exists)
    const passportDays = employee?.passportDetails?.expiryDate ? calculateDaysUntilExpiry(employee.passportDetails.expiryDate) : null;

    // Calculate Labour Card expiry days (only if it exists)
    const labourCardDays = employee?.labourCardDetails?.expiryDate ? calculateDaysUntilExpiry(employee.labourCardDetails.expiryDate) : null;

    // Calculate Driving License expiry days (only if it exists)
    const drivingLicenseDays = employee?.drivingLicenceDetails?.expiryDate ? calculateDaysUntilExpiry(employee.drivingLicenceDetails.expiryDate) : null;

    // Status color function for Employment Summary
    const getStatusColor = (type) => {
        if (type === 'tenure') return 'bg-green-400';
        if (type === 'visa') {
            if (visaDays < 60) return 'bg-red-400';
            if (visaDays < 180) return 'bg-orange-400';
            return 'bg-green-400';
        }
        if (type === 'medical') {
            if (medDays < 30) return 'bg-red-400';
            if (medDays < 90) return 'bg-orange-400';
            return 'bg-green-400';
        }
        if (type === 'eid') {
            if (eidDays < 30) return 'bg-red-400';
            return 'bg-orange-400';
        }
        if (type === 'passport') {
            if (passportDays < 60) return 'bg-red-400';
            if (passportDays < 180) return 'bg-orange-400';
            return 'bg-green-400';
        }
        if (type === 'labourCard') {
            if (labourCardDays < 60) return 'bg-red-400';
            if (labourCardDays < 180) return 'bg-orange-400';
            return 'bg-green-400';
        }
        if (type === 'drivingLicense') {
            if (drivingLicenseDays < 60) return 'bg-red-400';
            if (drivingLicenseDays < 180) return 'bg-orange-400';
            return 'bg-green-400';
        }
        // Salary Tab Status Colors
        if (type === 'salary') return 'bg-green-500';
        if (type === 'fine') return 'bg-red-500';
        if (type === 'reward') return 'bg-yellow-500';
        if (type === 'loan') return 'bg-red-500';
        if (type === 'bank-updated') return 'bg-green-500';
        if (type === 'bank-pending') return 'bg-red-500';

        return 'bg-gray-400';
    };

    // Helper to format expiry text
    const getExpiryText = (label, days) => {
        if (days < 0) {
            return `${label} Expired ${Math.abs(days)} days ago`;
        }
        return `${label} Expires in ${days} days`;
    };

    // Status items for Employment Summary
    const statusItems = [];

    if (activeTab === 'salary') {
        // 1. Last Month Salary (Latest entry from history or monthlySalary)
        const lastSalary = employee?.salaryHistory && employee.salaryHistory.length > 0
            ? employee.salaryHistory[0].totalSalary // Assuming latest first, or check sort
            : (employee?.monthlySalary || 0);

        // Note: salaryHistory in page.jsx might not be sorted. getEmployeeById returns it.
        // Let's use the one from props or employee object safely.
        // Actually, backend returns sorted { createdAt: -1 } for fines/rewards, 
        // but employee.salaryHistory usually pushed chronologically? 
        // SalaryTab logic sorts it? "const sortedHistory = selectedSalaryAction === 'Salary History' ? [...salaryHistoryData] : [];"
        // It seems `salaryHistory` is usually chronological.
        // Let's take the LAST element if we assume chronological push.
        // Or better, find the one with `toDate: null` (active).

        let activeSalary = 0;
        if (employee?.salaryHistory && employee.salaryHistory.length > 0) {
            const activeEntry = employee.salaryHistory.find(s => s.toDate === null) || employee.salaryHistory[employee.salaryHistory.length - 1];
            activeSalary = activeEntry.totalSalary || 0;
        } else {
            activeSalary = employee?.monthlySalary || 0;
        }

        statusItems.push({
            type: 'salary',
            text: `Last Salary: AED ${activeSalary.toLocaleString()}`
        });

        // 2. Total Fines
        const fineCount = employee?.fines?.length || 0;
        statusItems.push({
            type: 'fine',
            text: `Total Fines: ${fineCount}`
        });

        // 3. Total Rewards
        const rewardCount = employee?.rewards?.length || 0;
        statusItems.push({
            type: 'reward',
            text: `Total Rewards: ${rewardCount}`
        });

        // 4. Loan Amount
        const loanAmount = employee?.loanAmount || 0;
        statusItems.push({
            type: 'loan',
            text: `Loan Amount: AED ${loanAmount.toLocaleString()}`
        });

        // 5. Bank Account
        const hasBank = employee?.bankName || employee?.accountNumber;
        statusItems.push({
            type: hasBank ? 'bank-updated' : 'bank-pending',
            text: hasBank ? 'Bank: Updated' : 'Bank: Pending'
        });

    } else {
        // Standard Employment Summary (Tenure + Expiry)
        if (tenure) {
            statusItems.push({
                type: 'tenure',
                text: `${tenure.years} Years ${tenure.months} Months in VITS`
            });
        }
        if (visaDays !== null && visaDays !== undefined) {
            statusItems.push({
                type: 'visa',
                text: getExpiryText('Visa', visaDays)
            });
        }
        if (passportDays !== null && passportDays !== undefined) {
            statusItems.push({
                type: 'passport',
                text: getExpiryText('Passport', passportDays)
            });
        }
        if (eidDays !== null && eidDays !== undefined) {
            statusItems.push({
                type: 'eid',
                text: getExpiryText('Emirates ID', eidDays)
            });
        }
        if (labourCardDays !== null && labourCardDays !== undefined) {
            statusItems.push({
                type: 'labourCard',
                text: getExpiryText('Labour Card', labourCardDays)
            });
        }
        if (medDays !== null && medDays !== undefined) {
            statusItems.push({
                type: 'medical',
                text: getExpiryText('Medical Insurance', medDays)
            });
        }
        if (drivingLicenseDays !== null && drivingLicenseDays !== undefined) {
            statusItems.push({
                type: 'drivingLicense',
                text: getExpiryText('Driving License', drivingLicenseDays)
            });
        }
    }

    const InfoRow = ({ label, value }) => (
        <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</span>
            <span className="text-sm text-gray-900">{value || '—'}</span>
        </div>
    );

    const isCompanyProfile = employee?.employeeId === 'VEGA-HR-0000';

    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                <Navbar />
                <div className="p-8">
                    {/* Header Controls */}
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={handleBackNavigation}
                            className="bg-white p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                        >
                            <ChevronLeft size={20} />
                        </button>
                    </div>

                    {loading && (
                        <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">Loading employee profile...</div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 mb-4">
                            {error}
                        </div>
                    )}

                    {!loading && !error && employee && (
                        <div className="space-y-6">
                            {/* Profile Card and Employment Summary */}
                            <div className={`grid grid-cols-1 ${isCompanyProfile ? 'lg:grid-cols-1' : 'lg:grid-cols-2'} gap-6 items-stretch`}>
                                {/* Profile Card */}
                                <div className="flex flex-col overflow-y-auto" style={{ height: '320px' }}>
                                    <ProfileHeader
                                        employmentStyleBackground={false}
                                        employee={employee}
                                        imageError={imageError}
                                        setImageError={setImageError}
                                        handleFileSelect={handleFileSelect}
                                        profileCompletion={profileCompletion}
                                        showProgressTooltip={showProgressTooltip}
                                        setShowProgressTooltip={setShowProgressTooltip}
                                        pendingFields={pendingFields}
                                        canSendForApproval={canSendForApproval}
                                        handleSubmitForApproval={handleSubmitForApproval}
                                        sendingApproval={sendingApproval}
                                        awaitingApproval={awaitingApproval}
                                        handleActivateProfile={handleActivateProfile}
                                        handleHoldProfile={handleHoldProfile}
                                        handleRejectProfile={handleRejectProfile}
                                        activatingProfile={activatingProfile}
                                        profileApproved={profileApproved}
                                        isPrimaryReportee={isPrimaryReportee}
                                        canReviewNoticeRequest={canReviewNoticeRequest}
                                        canReviewProbationRequest={probationWorkflowAction.canAct}
                                        probationActionLabel={probationWorkflowAction.label}
                                        probationActionLoading={probationActionLoading}
                                        onReviewProbation={handleProbationWorkflowAction}
                                        canReviewProfileActivation={canReviewProfileActivation}
                                        onViewRequestedChange={handleViewRequestedChange}
                                        onReviewNotice={() => setShowNoticeApprovalModal(true)}
                                        onTogglePortalAccess={handleTogglePortalAccess}
                                        canTogglePortal={!isCompanyProfile && (isAdmin || hasPermission('hrm_employees_edit'))}
                                        togglingPortalAccess={togglingPortalAccess}
                                        hideStatusToggle={isCompanyProfile}
                                        hideProgressBar={isCompanyProfile}
                                        hideRole={isCompanyProfile}
                                        hideContactNumber={isCompanyProfile}
                                        hideEmail={isCompanyProfile}
                                        viewerIsProfileSubject={viewerIsEmployeeProfileSubject(employee, currentUser)}
                                        viewerCanFixActivationHold={viewerIsProfileActivationSubmitter(
                                            employee,
                                            currentUser,
                                        )}
                                        hasProfileActivationHoldPending={hasProfileActivationHoldPending(employee)}
                                        onOpenActivationHoldReview={() => setShowActivationHoldReview(true)}
                                        activationHoldResubmitEligible={
                                            activationHoldResubmitEligible(employee, currentUser)
                                        }
                                        canReviewHeldPendingsAsHod={canReviewHeldPendingsAsHod}
                                        onOpenHeldPendingsReview={() => setShowHeldPendingsHodModal(true)}
                                    />
                                </div>

                                {/* Employment Summary Card */}
                                {!isCompanyProfile && (
                                    <div className="flex flex-col overflow-hidden" style={{ height: '320px' }}>
                                        <EmploymentSummary
                                            statusItems={statusItems}
                                            getStatusColor={getStatusColor}
                                            activeTab={activeTab}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Main Tabs */}
                            <div className="rounded-lg shadow-sm">
                                <TabNavigation
                                    activeTab={activeTab}
                                    setActiveTab={setActiveTab}
                                    setActiveSubTab={setActiveSubTab}
                                    isCompanyProfile={isCompanyProfile}
                                    employee={employee}
                                    hasDocuments={(() => {
                                        // Check if any documents exist (manually added or attachments)
                                        // Check for manually added documents
                                        if (employee?.documents && employee.documents.length > 0) return true;

                                        // Check passport document (url or data)
                                        if (employee?.passportDetails?.document?.url || employee?.passportDetails?.document?.data || employee?.passportDetails?.document?.name) return true;

                                        // Check visa documents (visit, employment, spouse) - url or data
                                        if (employee?.visaDetails?.visit?.document?.url || employee?.visaDetails?.visit?.document?.data || employee?.visaDetails?.visit?.document?.name) return true;
                                        if (employee?.visaDetails?.employment?.document?.url || employee?.visaDetails?.employment?.document?.data || employee?.visaDetails?.employment?.document?.name) return true;
                                        if (employee?.visaDetails?.spouse?.document?.url || employee?.visaDetails?.spouse?.document?.data || employee?.visaDetails?.spouse?.document?.name) return true;

                                        // Check Emirates ID document (url or data)
                                        if (employee?.emiratesIdDetails?.document?.url || employee?.emiratesIdDetails?.document?.data || employee?.emiratesIdDetails?.document?.name) return true;

                                        // Check Labour Card document (url or data)
                                        if (employee?.labourCardDetails?.document?.url || employee?.labourCardDetails?.document?.data || employee?.labourCardDetails?.document?.name) return true;

                                        // Check Medical Insurance document (url or data)
                                        if (employee?.medicalInsuranceDetails?.document?.url || employee?.medicalInsuranceDetails?.document?.data || employee?.medicalInsuranceDetails?.document?.name) return true;

                                        // Check Driving License document (url or data)
                                        if (employee?.drivingLicenceDetails?.document?.url || employee?.drivingLicenceDetails?.document?.data || employee?.drivingLicenceDetails?.document?.name) return true;

                                        // Check Bank Attachment (url or data)
                                        if (employee?.bankAttachment?.url || employee?.bankAttachment?.data || employee?.bankAttachment?.name) return true;

                                        // Check Salary Offer Letter (url or data)
                                        if (employee?.offerLetter?.url || employee?.offerLetter?.data || employee?.offerLetter?.name) return true;

                                        // Check Salary History offer letters and attachments
                                        if (employee?.salaryHistory && Array.isArray(employee.salaryHistory)) {
                                            if (employee.salaryHistory.some(entry => (entry?.offerLetter && (entry.offerLetter.url || entry.offerLetter.data || entry.offerLetter.name)) || (entry?.attachment && (entry.attachment.url || entry.attachment.data || entry.attachment.name)))) return true;
                                        }

                                        // Check Fine attachments
                                        if (employee?.fines && Array.isArray(employee.fines)) {
                                            if (employee.fines.some(fine => fine.attachment?.url || fine.attachment?.data || fine.attachment?.name)) return true;
                                        }

                                        // Check Reward attachments
                                        if (employee?.rewards && Array.isArray(employee.rewards)) {
                                            if (employee.rewards.some(reward => reward.attachment?.url || reward.attachment?.data || reward.attachment?.name)) return true;
                                        }

                                        // Check Loan & Advance attachments
                                        if (employee?.loans && Array.isArray(employee.loans)) {
                                            if (employee.loans.some(loan => loan.attachment?.url || loan.attachment?.data || loan.attachment?.name)) return true;
                                        }

                                        // Check Notice Request attachment
                                        if (employee?.noticeRequest?.attachment?.url || employee?.noticeRequest?.attachment?.data || employee?.noticeRequest?.attachment?.name) return true;

                                        // Check Digital Signature
                                        if (employee?.signature?.url || employee?.signature?.data || employee?.signature?.name) return true;

                                        // Check Education certificates (url or data)
                                        if (employee?.educationDetails && Array.isArray(employee.educationDetails)) {
                                            if (employee.educationDetails.some(edu => edu.certificate?.url || edu.certificate?.data || edu.certificate?.name)) return true;
                                        }

                                        // Check Experience certificates (url or data)
                                        if (employee?.experienceDetails && Array.isArray(employee.experienceDetails)) {
                                            if (employee.experienceDetails.some(exp => exp.certificate?.url || exp.certificate?.data || exp.certificate?.name)) return true;
                                        }

                                        // Check Training certificates (url or data)
                                        const allTraining = [
                                            ...(employee?.trainingDetails || []),
                                            ...(employee?.trainingDetailsFromTraining || [])
                                        ];
                                        if (allTraining.length > 0) {
                                            if (allTraining.some(training => training.certificate?.url || training.certificate?.data || training.certificate?.name)) return true;
                                        }

                                        return false;
                                    })()}
                                    hasTraining={(employee?.trainingDetails && employee.trainingDetails.length > 0) || (employee?.trainingDetailsFromTraining && employee.trainingDetailsFromTraining.length > 0)}
                                    onTrainingClick={() => setShowTrainingModal(true)}
                                    onDocumentsClick={() => {
                                        setDocumentModalMode('standard');
                                        setDocumentForm({
                                            type: '',
                                            description: '',
                                            issueDate: '',
                                            expiryDate: '',
                                            hasExpiry: true,
                                            hasValue: false,
                                            value: '',
                                            basicSalary: '',
                                            houseRentAllowance: '',
                                            vehicleAllowance: '',
                                            fuelAllowance: '',
                                            otherAllowance: '',
                                            totalSalary: '',
                                            file: null,
                                            fileBase64: '',
                                            fileName: '',
                                            fileMime: ''
                                        });
                                        setDocumentErrors({});
                                        setEditingDocumentIndex(null);
                                        setShowDocumentModal(true);
                                    }}
                                />

                                {/* Tab Content */}
                                <div className="p-6">
                                    {activeTab === 'basic' && (
                                        <BasicTab
                                            employee={employee}
                                            employeeId={employeeId}
                                            fetchEmployee={fetchEmployee}
                                            updateEmployeeOptimistically={updateEmployeeOptimistically}
                                            getCountryName={getCountryName}
                                            formatDate={formatDate}
                                            isUAENationality={isUAENationality}
                                            isVisaRequirementApplicable={isVisaRequirementApplicable}
                                            onEditBasic={() => openEditModal()}
                                            onViewDocument={handleViewDocument}
                                            onRequestNotRenew={requestEmployeeCardNotRenew}
                                            viewerIsDesignatedFlowchartHr={viewerIsDesignatedFlowchartHr}
                                            onHrApproveNotRenew={handleCardHrApproveNotRenew}
                                            onHrRejectNotRenewOpen={handleCardHrRejectNotRenewOpen}
                                            setViewingDocument={setViewingDocument}
                                            setShowDocumentViewer={setShowDocumentViewer}
                                            isCompanyProfile={isCompanyProfile}
                                            cardApisRef={basicTabCardApisRef}
                                        />
                                    )}

                                    {/* OLD BASIC TAB CODE REMOVED - Now using BasicTab component */}

                                    {activeTab === 'work-details' && (
                                        <WorkDetailsTab
                                            employee={employee}
                                            formatDate={formatDate}
                                            departmentOptions={departmentOptions}
                                            reportingAuthorityOptions={reportingAuthorityOptions}
                                            reportingAuthorityValueForDisplay={reportingAuthorityValueForDisplay}
                                            onEdit={() => openWorkDetailsModal()}
                                            onDeleteWorkDetails={() => requestCardDelete('work')}
                                            onDeleteSignature={() => requestCardDelete('signature')}
                                            onViewDocument={handleViewDocument}
                                            isCompanyProfile={isCompanyProfile}
                                            fetchEmployee={fetchEmployee}
                                        />
                                    )}

                                    {/* OLD WORK DETAILS TAB CODE REMOVED - Now using WorkDetailsTab component */}

                                    {activeTab === 'salary' && !isCompanyProfile && (
                                        <SalaryTab
                                            searchParams={searchParams}
                                            employee={salaryTabEmployee}
                                            isAdmin={isAdmin}
                                            hasPermission={hasPermission}
                                            hasSalaryDetails={hasSalaryDetailsMemo}
                                            hasBankDetailsSection={hasBankDetailsSection}
                                            formatDate={formatDate}
                                            selectedSalaryAction={selectedSalaryAction}
                                            setSelectedSalaryAction={setSelectedSalaryAction}
                                            salaryHistoryPage={salaryHistoryPage}
                                            setSalaryHistoryPage={setSalaryHistoryPage}
                                            salaryHistoryItemsPerPage={salaryHistoryItemsPerPage}
                                            setSalaryHistoryItemsPerPage={setSalaryHistoryItemsPerPage}
                                            calculateTotalSalary={calculateTotalSalary}
                                            onOpenSalaryModal={handleOpenSalaryModal}
                                            onIncrementSalary={handleOpenIncrementModal}
                                            fines={employee?.fines || []}
                                            rewards={employee?.rewards || []}
                                            loans={employee?.loans || []}
                                            employeeOptions={reportingAuthorityOptions}
                                            onOpenBankModal={handleOpenBankModal}
                                            onViewDocument={handleViewDocument}
                                            onDeleteSalaryCard={() => requestCardDelete('salary')}
                                            onDeleteBankCard={() => requestCardDelete('bank')}
                                            currentUser={currentUser}
                                            onEditSalary={(entry, index) => {
                                                setSalaryMode('edit');
                                                setEditingSalaryIndex(index);
                                                setEditingSalaryEntryId(entry?._id ? String(entry._id) : null);
                                                const entryFuelAllowance = entry.fuelAllowance !== undefined && entry.fuelAllowance !== null
                                                    ? entry.fuelAllowance
                                                    : (entry.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount || 0);
                                                setSalaryForm({
                                                    month: entry.month || '',
                                                    fromDate: entry.fromDate ? new Date(entry.fromDate).toISOString().split('T')[0] : '',
                                                    basic: entry.basic ? String(entry.basic) : '',
                                                    houseRentAllowance: entry.houseRentAllowance ? String(entry.houseRentAllowance) : '',
                                                    vehicleAllowance: entry.vehicleAllowance ? String(entry.vehicleAllowance) : '',
                                                    fuelAllowance: entryFuelAllowance ? String(entryFuelAllowance) : '',
                                                    otherAllowance: entry.otherAllowance ? String(entry.otherAllowance) : '',
                                                    totalSalary: entry.totalSalary ? String(entry.totalSalary) : calculateTotalSalary(
                                                        entry.basic ? String(entry.basic) : '',
                                                        entry.houseRentAllowance ? String(entry.houseRentAllowance) : '',
                                                        entry.vehicleAllowance ? String(entry.vehicleAllowance) : '',
                                                        entryFuelAllowance ? String(entryFuelAllowance) : '',
                                                        entry.otherAllowance ? String(entry.otherAllowance) : ''
                                                    ),
                                                    offerLetterFile: null,
                                                    offerLetterFileBase64: entry.offerLetter?.url || entry.offerLetter?.data || '',
                                                    offerLetterFileName: entry.offerLetter?.name || '',
                                                    offerLetterFileMime: entry.offerLetter?.mimeType || ''
                                                });
                                                setSalaryFormErrors({
                                                    month: '',
                                                    fromDate: '',
                                                    basic: '',
                                                    houseRentAllowance: '',
                                                    vehicleAllowance: '',
                                                    fuelAllowance: '',
                                                    otherAllowance: '',
                                                    offerLetter: ''
                                                });
                                                setShowSalaryModal(true);
                                            }}
                                            onDeleteSalary={(actualIndex, sortedHistory) => {
                                                setConfirmDeleteSalary({
                                                    open: true,
                                                    salaryIndex: actualIndex,
                                                    sortedHistory: sortedHistory
                                                });
                                            }}
                                            editingSalaryIndex={editingSalaryIndex}
                                            setEditingSalaryIndex={setEditingSalaryIndex}
                                            setSalaryForm={setSalaryForm}
                                            setSalaryFormErrors={setSalaryFormErrors}
                                            setShowSalaryModal={setShowSalaryModal}
                                            employeeId={employeeId}
                                            fetchEmployee={fetchEmployee}
                                            onOpenCertificateModal={handleOpenCertificateModal}
                                            onEditCertificate={handleEditCertificate}
                                            onDeleteDocument={handleDeleteDocument}
                                        />
                                    )}


                                    {activeTab === 'personal' && !isCompanyProfile && canViewAnyOf(EMPLOYEE_MAIN_TAB_MODULES.personal || []) && (
                                        <PersonalTab
                                            employee={employee}
                                            activeSubTab={activeSubTab}
                                            setActiveSubTab={setActiveSubTab}
                                            getCountryName={getCountryName}
                                            getStateName={getStateName}
                                            formatDate={formatDate}
                                            hasPermanentAddress={hasPermanentAddress}
                                            hasCurrentAddress={hasCurrentAddress}
                                            hasContactDetails={hasContactDetails}
                                            getExistingContacts={getExistingContacts}
                                            deletingContactId={deletingContactId}
                                            onEditPersonal={handleOpenPersonalModal}
                                            onOpenAddressModal={handleOpenAddressModal}
                                            onOpenContactModal={handleOpenContactModal}
                                            onEditContact={(contactId, contactIndex) => handleOpenContactModal(contactId, contactIndex)}
                                            onDeleteContact={(contactId, contactIndex) => handleDeleteContact(contactId, contactIndex)}
                                            onDeletePersonal={() => requestCardDelete('personal')}
                                            onDeletePermanentAddress={() => requestCardDelete('permanentAddress')}
                                            onDeleteCurrentAddress={() => requestCardDelete('currentAddress')}
                                            educationDetails={educationDetails}
                                            experienceDetails={experienceDetails}
                                            onOpenEducationModal={handleOpenEducationModal}
                                            onOpenExperienceModal={handleOpenExperienceModal}
                                            onEditEducation={handleEditEducation}
                                            onEditExperience={handleEditExperience}
                                            onDeleteEducation={handleDeleteEducation}
                                            onDeleteExperience={handleDeleteExperience}
                                            deletingEducationId={deletingEducationId}
                                            deletingExperienceId={deletingExperienceId}
                                            onViewDocument={handleViewDocument}
                                            onOpenCertificateModal={handleOpenCertificateModal}
                                            onEditCertificate={handleEditCertificate}
                                            onDeleteDocument={handleDeleteDocument}
                                            fetchEmployee={fetchEmployee}
                                        />
                                    )}

                                    {activeTab === 'documents' && !isCompanyProfile && (() => {
                                        if (isAdmin() || canViewAnyOf(EMPLOYEE_MAIN_TAB_MODULES.documents || []) || hasPermission('hrm_employees_view', 'isView')) return true;
                                        // Own profile: normalize employeeId (spaces can differ: "VEGA -HR- 00001" vs "VEGA-HR-00001")
                                        const urlId = (params.employeeId || '').split('.')[0].trim().replace(/\s+/g, ' ');
                                        const empId = (employee?.employeeId || '').trim().replace(/\s+/g, ' ');
                                        return urlId && empId && (urlId === empId || urlId.replace(/\s/g, '') === empId.replace(/\s/g, ''));
                                    })() && (
                                            <DocumentsTab
                                                employee={employee}
                                                formatDate={formatDate}
                                                onOpenDocumentModal={() => {
                                                    setDocumentModalMode('standard');
                                                    setDocumentForm({
                                                        type: '',
                                                        description: '',
                                                        issueDate: '',
                                                        expiryDate: '',
                                                        hasExpiry: true,
                                                        hasValue: false,
                                                        value: '',
                                                        basicSalary: '',
                                                        houseRentAllowance: '',
                                                        vehicleAllowance: '',
                                                        fuelAllowance: '',
                                                        otherAllowance: '',
                                                        totalSalary: '',
                                                        file: null,
                                                        fileBase64: '',
                                                        fileName: '',
                                                        fileMime: ''
                                                    });
                                                    setDocumentErrors({});
                                                    setEditingDocumentIndex(null);
                                                    setShowDocumentModal(true);
                                                }}
                                                onOpenLabourCardModal={() => {
                                                    setDocumentModalMode('labour');
                                                    const pre = getSalaryPrefillForLabourModal();
                                                    setDocumentForm({
                                                        type: 'Labour Card Salary',
                                                        description: '',
                                                        issueDate: '',
                                                        expiryDate: '',
                                                        hasExpiry: true,
                                                        hasValue: false,
                                                        value: '',
                                                        basicSalary: pre.basicSalary,
                                                        houseRentAllowance: pre.houseRentAllowance,
                                                        vehicleAllowance: pre.vehicleAllowance,
                                                        fuelAllowance: pre.fuelAllowance,
                                                        otherAllowance: pre.otherAllowance,
                                                        totalSalary: pre.totalSalary,
                                                        file: null,
                                                        fileBase64: '',
                                                        fileName: '',
                                                        fileMime: ''
                                                    });
                                                    setDocumentErrors({});
                                                    setEditingDocumentIndex(null);
                                                    setShowDocumentModal(true);
                                                }}
                                                onOpenLabourRow={(doc) => {
                                                    const idx = doc.index;
                                                    if (typeof idx === 'number' && !doc.isSystem) {
                                                        handleEditDocument(idx);
                                                        return;
                                                    }
                                                    setDocumentModalMode('labour');
                                                    setEditingDocumentIndex(null);
                                                    setDocumentErrors({});
                                                    const pre = getSalaryPrefillForLabourModal();
                                                    const pick = (rowVal, preVal) => {
                                                        if (rowVal !== null && rowVal !== undefined && rowVal !== '') return String(rowVal);
                                                        return preVal || '';
                                                    };
                                                    const att = doc.document;
                                                    const hasData = att && typeof att === 'object' && att.data;
                                                    setDocumentForm({
                                                        type: 'Labour Card Salary',
                                                        description: '',
                                                        issueDate: '',
                                                        expiryDate: '',
                                                        hasExpiry: true,
                                                        hasValue: false,
                                                        value: '',
                                                        basicSalary: pick(doc.basicSalary, pre.basicSalary),
                                                        houseRentAllowance: pick(doc.houseRentAllowance, pre.houseRentAllowance),
                                                        vehicleAllowance: pick(doc.vehicleAllowance, pre.vehicleAllowance),
                                                        fuelAllowance: pick(doc.fuelAllowance, pre.fuelAllowance),
                                                        otherAllowance: pick(doc.otherAllowance, pre.otherAllowance),
                                                        totalSalary: pick(doc.totalSalary, pre.totalSalary),
                                                        file: null,
                                                        fileBase64: hasData ? (att.data || '') : '',
                                                        fileName: hasData ? (att.name || '') : '',
                                                        fileMime: hasData ? (att.mimeType || '') : ''
                                                    });
                                                    setShowDocumentModal(true);
                                                }}
                                                onViewDocument={(doc) => {
                                                    setViewingDocument(doc);
                                                    setShowDocumentViewer(true);
                                                }}
                                                onEditDocument={(index) => handleEditDocument(index)}
                                                onRenewDocument={(doc) => handleRenewDocument(doc)}
                                                onNotRenewDocument={(doc) => handleNotRenewDocument(doc)}
                                                onDeleteDocument={(index) => handleDeleteDocument(index)}
                                                viewerIsDesignatedFlowchartHr={viewerIsDesignatedFlowchartHr}
                                                empHrRespondSubmitting={empHrRespondSubmitting}
                                                onHrApproveEmpManualNotRenew={handleHrApproveEmpManualDocNotRenew}
                                                onHrRejectEmpManualNotRenewOpen={(rid) => {
                                                    setHrRejectEmpDocRequestId(rid);
                                                    setHrRejectEmpDocComment('');
                                                }}
                                            />
                                        )}


                                    {activeTab === 'training' && !isCompanyProfile && (() => {
                                        if (isAdmin() || canViewAnyOf(EMPLOYEE_MAIN_TAB_MODULES.training || [])) return true;
                                        const urlId = (params.employeeId || '').split('.')[0].trim().replace(/\s+/g, ' ');
                                        const empId = (employee?.employeeId || '').trim().replace(/\s+/g, ' ');
                                        return urlId && empId && (urlId === empId || urlId.replace(/\s/g, '') === empId.replace(/\s/g, ''));
                                    })() && (
                                            <TrainingTab
                                                employee={employee}
                                                formatDate={formatDate}
                                                deletingTrainingIndex={deletingTrainingIndex}
                                                onOpenTrainingModal={() => {
                                                    setTrainingForm({
                                                        trainingName: '',
                                                        trainingDetails: '',
                                                        provider: '',
                                                        trainingDate: '',
                                                        trainingCost: '',
                                                        certificate: null,
                                                        certificateBase64: '',
                                                        certificateName: '',
                                                        certificateMime: ''
                                                    });
                                                    setTrainingErrors({});
                                                    setEditingTrainingIndex(null);
                                                    setShowTrainingModal(true);
                                                }}
                                                onViewDocument={handleViewDocument}
                                                onEditTraining={(training, index) => {
                                                    setTrainingForm({
                                                        trainingName: training.trainingName || '',
                                                        trainingDetails: training.trainingDetails || '',
                                                        provider: training.provider || training.trainingFrom || '',
                                                        trainingDate: training.trainingDate ? new Date(training.trainingDate).toISOString().split('T')[0] : '',
                                                        trainingCost: training.trainingCost ? String(training.trainingCost) : '',
                                                        certificate: null,
                                                        certificateBase64: training.certificate?.data || training.certificate?.url || '',
                                                        certificateName: training.certificate?.name || '',
                                                        certificateMime: training.certificate?.mimeType || ''
                                                    });
                                                    setTrainingErrors({});
                                                    setEditingTrainingIndex(index);
                                                    setShowTrainingModal(true);
                                                }}
                                                onDeleteTraining={(index) => {
                                                    setConfirmDeleteTraining({
                                                        open: true,
                                                        trainingIndex: index
                                                    });
                                                }}
                                            />
                                        )}


                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Image Upload and Crop Modal - Only render when open */}
            {showImageModal && (
                <ImageUploadModal
                    isOpen={true}
                    onClose={() => {
                        if (!uploading) {
                            setShowImageModal(false);
                            setSelectedImage(null);
                            setImageScale(1);
                            setError('');
                        }
                    }}
                    selectedImage={selectedImage}
                    imageScale={imageScale}
                    setImageScale={setImageScale}
                    uploading={uploading}
                    error={error}
                    avatarEditorRef={avatarEditorRef}
                    onFileSelect={handleFileSelect}
                    onUpload={handleUploadImage}
                />
            )}

            {/* Edit Basic Details Modal - Only show when on Basic Details tab */}
            {showEditModal && activeTab === 'basic' && (
                <BasicDetailsModal
                    isOpen={showEditModal}
                    onClose={() => {
                        setShowEditModal(false);
                        setEditFormErrors({});
                    }}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    editFormErrors={editFormErrors}
                    setEditFormErrors={setEditFormErrors}
                    updating={updating}
                    editCountryCode={editCountryCode}
                    setEditCountryCode={setEditCountryCode}
                    allCountriesOptions={allCountriesOptions}
                    DEFAULT_PHONE_COUNTRY={DEFAULT_PHONE_COUNTRY}
                    onEditChange={handleEditChange}
                    onUpdate={handleUpdateEmployee}
                    confirmUpdateOpen={confirmUpdateOpen}
                    setConfirmUpdateOpen={setConfirmUpdateOpen}
                />
            )}

            {/* Delete Education Confirmation Dialog */}
            <AlertDialog open={confirmDeleteEducation.open} onOpenChange={(open) => setConfirmDeleteEducation((prev) => ({ ...prev, open }))}>
                <AlertDialogContent className="sm:max-w-[425px] rounded-[22px] border-gray-300 bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-[22px] font-semibold text-gray-900">Delete Education Record?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-gray-600 mt-2">
                            Are you sure you want to delete this education record? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4 flex-row gap-3">
                        <AlertDialogCancel
                            onClick={() => setConfirmDeleteEducation({ open: false, educationId: null })}
                            className="px-6 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteEducationAction}
                            disabled={deletingEducationId !== null}
                            className="px-6 py-2 rounded-lg bg-gray-800 text-white font-semibold text-sm hover:bg-gray-900 transition-colors disabled:opacity-50"
                        >
                            {deletingEducationId !== null ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Experience Confirmation Dialog */}
            <AlertDialog open={confirmDeleteExperience.open} onOpenChange={(open) => setConfirmDeleteExperience((prev) => ({ ...prev, open }))}>
                <AlertDialogContent className="sm:max-w-[425px] rounded-[22px] border-gray-300 bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-[22px] font-semibold text-gray-900">Delete Experience Record?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-gray-600 mt-2">
                            Are you sure you want to delete this experience record? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4 flex-row gap-3">
                        <AlertDialogCancel
                            onClick={() => setConfirmDeleteExperience({ open: false, experienceId: null })}
                            className="px-6 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteExperienceAction}
                            disabled={deletingExperienceId !== null}
                            className="px-6 py-2 rounded-lg bg-gray-800 text-white font-semibold text-sm hover:bg-gray-900 transition-colors disabled:opacity-50"
                        >
                            {deletingExperienceId !== null ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>



            {/* Notice Approval Modal triggered from URL */}
            <NoticeApprovalModal
                isOpen={showNoticeApprovalModal}
                onClose={() => {
                    setShowNoticeApprovalModal(false);
                    // Clear the action from URL if it's there
                    if (searchParams.get('action') === 'review_notice') {
                        router.replace(`/emp/${employeeId}`);
                    }
                }}
                employeeId={employeeId}
                employee={employee}
                currentUser={currentUser}
                noticeRequest={employee?.noticeRequest}
                onViewDocument={handleViewDocument}
                onSuccess={() => {
                    fetchEmployee(true); // Refetch to update status
                    setShowNoticeApprovalModal(false);
                    router.replace(`/emp/${employeeId}`);
                }}
            />



            {/* Delete Salary Confirmation Dialog */}
            <AlertDialog open={confirmDeleteSalary.open} onOpenChange={(open) => setConfirmDeleteSalary((prev) => ({ ...prev, open }))}>
                <AlertDialogContent className="sm:max-w-[425px] rounded-[22px] border-gray-300 bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-[22px] font-semibold text-gray-900">Delete Salary Record?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-gray-600 mt-2">
                            Are you sure you want to delete this salary record? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4 flex-row gap-3">
                        <AlertDialogCancel
                            onClick={() => setConfirmDeleteSalary({ open: false, salaryIndex: null, sortedHistory: null })}
                            className="px-6 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteSalaryAction}
                            className="px-6 py-2 rounded-lg bg-gray-800 text-white font-semibold text-sm hover:bg-gray-900 transition-colors"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Training Confirmation Dialog */}
            <AlertDialog open={confirmDeleteTraining.open} onOpenChange={(open) => setConfirmDeleteTraining((prev) => ({ ...prev, open }))}>
                <AlertDialogContent className="sm:max-w-[425px] rounded-[22px] border-gray-300 bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-[22px] font-semibold text-gray-900">Delete Training Record?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-gray-600 mt-2">
                            Are you sure you want to delete this training record? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4 flex-row gap-3">
                        <AlertDialogCancel
                            onClick={() => setConfirmDeleteTraining({ open: false, trainingIndex: null })}
                            className="px-6 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteTrainingAction}
                            disabled={deletingTrainingIndex !== null}
                            className="px-6 py-2 rounded-lg bg-gray-800 text-white font-semibold text-sm hover:bg-gray-900 transition-colors disabled:opacity-50"
                        >
                            {deletingTrainingIndex !== null ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Document Confirmation Dialog */}
            <AlertDialog open={confirmDeleteDocument.open} onOpenChange={(open) => setConfirmDeleteDocument((prev) => ({ ...prev, open }))}>
                <AlertDialogContent className="sm:max-w-[425px] rounded-[22px] border-gray-200">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-[22px] font-semibold text-gray-800">Delete Document?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-[#6B6B6B] mt-2">
                            Are you sure you want to delete this document? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4 flex-row gap-3">
                        <AlertDialogCancel
                            onClick={() => setConfirmDeleteDocument({ open: false, index: null })}
                            className="px-6 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteDocumentAction}
                            disabled={deletingDocumentIndex !== null}
                            className="px-6 py-2 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                            {deletingDocumentIndex !== null ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={empDocNotRenewTarget !== null}
                onOpenChange={(open) => {
                    if (!open && !empDocNotRenewSubmitting) setEmpDocNotRenewTarget(null);
                }}
            >
                <AlertDialogContent className="bg-white rounded-3xl border-gray-100 shadow-2xl p-8 max-w-lg">
                    <AlertDialogHeader className="mb-4">
                        <AlertDialogTitle className="text-xl font-bold text-gray-800">Request document not renew</AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-500 font-medium">
                            Designated HR will review this request. The current {empDocNotRenewTarget?.type || 'document'} remains on the profile until HR approves.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="text-sm font-semibold text-gray-700 block mb-1">Reason (required)</label>
                            <textarea
                                value={empDocNotRenewReason}
                                onChange={(e) => setEmpDocNotRenewReason(e.target.value)}
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
                                onChange={(e) => setEmpDocNotRenewFile(e.target.files?.[0] || null)}
                                className="text-sm w-full"
                            />
                        </div>
                    </div>
                    <AlertDialogFooter className="gap-3">
                        <AlertDialogCancel
                            disabled={empDocNotRenewSubmitting}
                            className="rounded-xl border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all px-6"
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleEmpDocNotRenewSubmit();
                            }}
                            disabled={empDocNotRenewSubmitting}
                            className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all shadow-lg shadow-amber-100 px-8"
                        >
                            {empDocNotRenewSubmitting ? 'Submitting...' : 'Submit for HR approval'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={hrRejectEmpDocRequestId !== null}
                onOpenChange={(open) => {
                    if (!open && !empHrRespondSubmitting) {
                        setHrRejectEmpDocRequestId(null);
                        setHrRejectEmpDocComment('');
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
                        value={hrRejectEmpDocComment}
                        onChange={(e) => setHrRejectEmpDocComment(e.target.value)}
                        rows={4}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
                        placeholder="Rejection reason (min. 3 characters)"
                    />
                    <AlertDialogFooter className="gap-3">
                        <AlertDialogCancel
                            className="rounded-xl border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all px-6"
                            disabled={empHrRespondSubmitting}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold px-8"
                            disabled={empHrRespondSubmitting || hrRejectEmpDocComment.trim().length < 3}
                            onClick={(e) => {
                                e.preventDefault();
                                handleHrRejectEmpManualDocNotRenew();
                            }}
                        >
                            {empHrRespondSubmitting ? 'Sending...' : 'Confirm reject'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <DeleteConfirmDialog
                open={confirmDeleteCard.open}
                onOpenChange={(open) => setConfirmDeleteCard((prev) => ({ ...prev, open }))}
                title={
                    confirmDeleteCard.type === 'work' ? 'Delete Work Details card?' :
                        confirmDeleteCard.type === 'personal' ? 'Delete Personal Details card?' :
                            confirmDeleteCard.type === 'permanentAddress' ? 'Delete Permanent Address card?' :
                                confirmDeleteCard.type === 'currentAddress' ? 'Delete Current Address card?' :
                                    confirmDeleteCard.type === 'bank' ? 'Delete Salary Bank Account card?' :
                                        confirmDeleteCard.type === 'salary' ? 'Delete Salary Details card?' :
                                            confirmDeleteCard.type === 'signature' ? 'Delete Signature card?' :
                                                'Delete card?'
                }
                description="This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={confirmCardDeleteAction}
            />

            {/* Work Details Modal - Only render when open */}
            {showWorkDetailsModal && (
                <WorkDetailsModal
                    isOpen={true}
                    onClose={() => setShowWorkDetailsModal(false)}
                    workDetailsForm={workDetailsForm}
                    setWorkDetailsForm={setWorkDetailsForm}
                    workDetailsErrors={workDetailsErrors}
                    setWorkDetailsErrors={setWorkDetailsErrors}
                    updatingWorkDetails={updatingWorkDetails}
                    onUpdate={handleUpdateWorkDetails}
                    employee={employee}
                    reportingAuthorityOptions={reportingAuthorityOptions}
                    reportingAuthorityLoading={reportingAuthorityLoading}
                    reportingAuthorityError={reportingAuthorityError}
                />
            )}

            {/* Emirates ID Modal - Only render when open */}
            {showEmiratesIdModal && (
                <EmiratesIdModal
                    isOpen={true}
                    onClose={handleCloseEmiratesIdModal}
                    emiratesIdForm={emiratesIdForm}
                    setEmiratesIdForm={setEmiratesIdForm}
                    emiratesIdErrors={emiratesIdErrors}
                    setEmiratesIdErrors={setEmiratesIdErrors}
                    savingEmiratesId={savingEmiratesId}
                    emiratesIdFileRef={emiratesIdFileRef}
                    employee={employee}
                    onEmiratesIdFileChange={handleEmiratesFileChange}
                    onSaveEmiratesId={handleSaveEmiratesId}
                    validateEmiratesIdDateField={validateEmiratesIdDateField}
                    setViewingDocument={setViewingDocument}
                    setShowDocumentViewer={setShowDocumentViewer}
                />
            )}

            {/* Labour Card Modal - Only render when open */}
            {showLabourCardModal && (
                <LabourCardModal
                    isOpen={true}
                    onClose={handleCloseLabourCardModal}
                    labourCardForm={labourCardForm}
                    setLabourCardForm={setLabourCardForm}
                    labourCardErrors={labourCardErrors}
                    setLabourCardErrors={setLabourCardErrors}
                    savingLabourCard={savingLabourCard}
                    labourCardFileRef={labourCardFileRef}
                    labourContractFileRef={labourContractFileRef}
                    employee={employee}
                    onLabourCardFileChange={handleLabourCardFileChange}
                    onLabourContractFileChange={handleLabourContractFileChange}
                    onSaveLabourCard={handleSaveLabourCard}
                    validateLabourCardDateField={validateLabourCardDateField}
                    setViewingDocument={setViewingDocument}
                    setShowDocumentViewer={setShowDocumentViewer}
                />
            )}

            {/* Medical Insurance Modal - Only render when open */}
            {showMedicalInsuranceModal && (
                <MedicalInsuranceModal
                    isOpen={true}
                    onClose={handleCloseMedicalInsuranceModal}
                    medicalInsuranceForm={medicalInsuranceForm}
                    setMedicalInsuranceForm={setMedicalInsuranceForm}
                    medicalInsuranceErrors={medicalInsuranceErrors}
                    setMedicalInsuranceErrors={setMedicalInsuranceErrors}
                    savingMedicalInsurance={savingMedicalInsurance}
                    medicalInsuranceFileRef={medicalInsuranceFileRef}
                    employee={employee}
                    onMedicalInsuranceFileChange={handleMedicalInsuranceFileChange}
                    onSaveMedicalInsurance={handleSaveMedicalInsurance}
                    validateMedicalInsuranceField={validateMedicalInsuranceField}
                    setViewingDocument={setViewingDocument}
                    setShowDocumentViewer={setShowDocumentViewer}
                />
            )}

            {/* Driving License Modal - Only render when open */}
            {showDrivingLicenseModal && (
                <DrivingLicenseModal
                    isOpen={true}
                    onClose={handleCloseDrivingLicenseModal}
                    drivingLicenseForm={drivingLicenseForm}
                    setDrivingLicenseForm={setDrivingLicenseForm}
                    drivingLicenseErrors={drivingLicenseErrors}
                    setDrivingLicenseErrors={setDrivingLicenseErrors}
                    savingDrivingLicense={savingDrivingLicense}
                    drivingLicenseFileRef={drivingLicenseFileRef}
                    employee={employee}
                    onDrivingLicenseFileChange={handleDrivingLicenseFileChange}
                    onSaveDrivingLicense={handleSaveDrivingLicense}
                    validateDrivingLicenseDateField={validateDrivingLicenseDateField}
                    setViewingDocument={setViewingDocument}
                    setShowDocumentViewer={setShowDocumentViewer}
                />
            )}

            {/* Bank Details Modal - Only render when open */}
            {showBankModal && (
                <BankDetailsModal
                    isOpen={true}
                    onClose={handleCloseBankModal}
                    bankForm={bankForm}
                    setBankForm={setBankForm}
                    bankFormErrors={bankFormErrors}
                    setBankFormErrors={setBankFormErrors}
                    savingBank={savingBank}
                    uploadingDocument={uploadingDocument}
                    onBankChange={handleBankChange}
                    onBankFileChange={handleBankFileChange}
                    onSaveBank={handleSaveBank}
                    mode={bankModalMode}
                    employee={employee}
                    setViewingDocument={setViewingDocument}
                    setShowDocumentViewer={setShowDocumentViewer}
                />
            )}

            {/* Salary Details Modal - Only render when open */}
            {showSalaryModal && (
                <SalaryModal
                    isOpen={true}
                    onClose={handleCloseSalaryModal}
                    mode={salaryMode}
                    salaryForm={salaryForm}
                    setSalaryForm={setSalaryForm}
                    salaryFormErrors={salaryFormErrors}
                    setSalaryFormErrors={setSalaryFormErrors}
                    savingSalary={savingSalary}
                    uploadingDocument={uploadingDocument}
                    editingSalaryIndex={editingSalaryIndex}
                    hasSalaryDetails={hasSalaryDetails}
                    monthOptions={monthOptions}
                    employee={employee}
                    onSalaryChange={handleSalaryChange}
                    onOfferLetterFileChange={handleOfferLetterFileChange}
                    onSaveSalary={handleSaveSalary}
                    setViewingDocument={setViewingDocument}
                    setShowDocumentViewer={setShowDocumentViewer}
                />
            )}

            {/* Contact Details Modal - Only render when open */}
            {showContactModal && (
                <ContactModal
                    isOpen={true}
                    onClose={handleCloseContactModal}
                    contactForms={contactForms}
                    setContactForms={setContactForms}
                    contactFormErrors={contactFormErrors}
                    setContactFormErrors={setContactFormErrors}
                    savingContact={savingContact}
                    activeContactForm={activeContactForm}
                    DEFAULT_PHONE_COUNTRY={DEFAULT_PHONE_COUNTRY}
                    onContactChange={handleContactChange}
                    onSaveContactDetails={handleSaveContactDetails}
                />
            )}

            {/* Personal Details Modal - Only render when open */}
            {showPersonalModal && (
                <PersonalDetailsModal
                    isOpen={true}
                    onClose={handleClosePersonalModal}
                    personalForm={personalForm}
                    setPersonalForm={setPersonalForm}
                    personalFormErrors={personalFormErrors}
                    setPersonalFormErrors={setPersonalFormErrors}
                    savingPersonal={savingPersonal}
                    activeTab={activeTab}
                    allCountriesOptions={allCountriesOptions}
                    DEFAULT_PHONE_COUNTRY={DEFAULT_PHONE_COUNTRY}
                    onPersonalChange={handlePersonalChange}
                    onSavePersonalDetails={handleSavePersonalDetails}
                />
            )}

            {/* Address Modal - Only render when open */}
            {showAddressModal && (
                <AddressModal
                    isOpen={true}
                    onClose={handleCloseAddressModal}
                    addressForm={addressForm}
                    setAddressForm={setAddressForm}
                    addressFormErrors={addressFormErrors}
                    setAddressFormErrors={setAddressFormErrors}
                    savingAddress={savingAddress}
                    addressModalType={addressModalType}
                    addressStateOptions={addressStateOptions}
                    allCountriesOptions={allCountriesOptions}
                    onAddressChange={handleAddressChange}
                    onSaveAddress={handleSaveAddress}
                />
            )}

            {/* Add Education Modal - Only render when open */}
            {showEducationModal && (
                <EducationModal
                    isOpen={true}
                    onClose={() => {
                        setShowEducationModal(false);
                    }}
                    educationForm={educationForm}
                    setEducationForm={setEducationForm}
                    educationErrors={educationErrors}
                    setEducationErrors={setEducationErrors}
                    savingEducation={savingEducation}
                    editingEducationId={editingEducationId}
                    setEditingEducationId={setEditingEducationId}
                    onEducationChange={handleEducationChange}
                    onEducationFileChange={handleEducationFileChange}
                    onSaveEducation={handleSaveEducation}
                    setViewingDocument={setViewingDocument}
                    setShowDocumentViewer={setShowDocumentViewer}
                    employee={employee}
                />
            )}

            {/* Add Experience Modal - Only render when open */}
            {showExperienceModal && (
                <ExperienceModal
                    isOpen={true}
                    onClose={() => {
                        setShowExperienceModal(false);
                    }}
                    experienceForm={experienceForm}
                    setExperienceForm={setExperienceForm}
                    experienceErrors={experienceErrors}
                    setExperienceErrors={setExperienceErrors}
                    savingExperience={savingExperience}
                    editingExperienceId={editingExperienceId}
                    setEditingExperienceId={setEditingExperienceId}
                    onExperienceChange={handleExperienceChange}
                    onExperienceFileChange={handleExperienceFileChange}
                    onSaveExperience={handleSaveExperience}
                    setViewingDocument={setViewingDocument}
                    setShowDocumentViewer={setShowDocumentViewer}
                    employee={employee}
                />
            )}

            {/* Document Modal - Only render when open */}
            {showDocumentModal && (
                <DocumentModal
                    isOpen={true}
                    onClose={() => {
                        setShowDocumentModal(false);
                        setDocumentModalMode('standard');
                    }}
                    documentForm={documentForm}
                    setDocumentForm={setDocumentForm}
                    documentErrors={documentErrors}
                    setDocumentErrors={setDocumentErrors}
                    savingDocument={savingDocument}
                    documentFileRef={documentFileRef}
                    editingDocumentIndex={editingDocumentIndex}
                    onDocumentFileChange={handleDocumentFileChange}
                    onSaveDocument={handleSaveDocument}
                    modalMode={documentModalMode}
                />
            )}

            {/* Training Modal - Only render when open */}
            {showTrainingModal && (
                <TrainingModal
                    isOpen={true}
                    onClose={() => {
                        setShowTrainingModal(false);
                    }}
                    trainingForm={trainingForm}
                    setTrainingForm={setTrainingForm}
                    trainingErrors={trainingErrors}
                    setTrainingErrors={setTrainingErrors}
                    savingTraining={savingTraining}
                    trainingCertificateFileRef={trainingCertificateFileRef}
                    editingTrainingIndex={editingTrainingIndex}
                    onTrainingFileChange={handleTrainingFileChange}
                    onSaveTraining={handleSaveTraining}
                    employee={employee}
                />
            )}

            {showApprovalSubmitModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h3 className="text-xl font-bold text-gray-800">Submit for Approval</h3>
                            <p className="text-sm text-gray-500 mt-1">Description is optional.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            {approvalSubmitPendingDisplayGroups.length > 0 ? (
                                <div className="space-y-2">
                                    <p className="text-xs text-gray-500 leading-snug">
                                        Check a row to send it to HR with this request. Unchecked rows are removed from the
                                        reactivation queue when you submit. Use View to compare current versus edited
                                        fields.
                                    </p>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-xs font-semibold text-gray-700">Requested Changes</div>
                                        <label className="inline-flex items-center gap-2 text-xs text-gray-600 shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={approvalSubmitAllRowsSelected}
                                                onChange={toggleApprovalSubmitSelectAll}
                                            />
                                            Select all
                                        </label>
                                    </div>
                                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                                        {approvalSubmitPendingDisplayGroups.map((group) => {
                                            const groupFullySelected =
                                                group.ids.length > 0 &&
                                                group.ids.every((id) =>
                                                    approvalSubmitSelectedEntryIds.includes(String(id)),
                                                );
                                            return (
                                                <div
                                                    key={group.key}
                                                    className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm"
                                                >
                                                    <div className="flex items-center justify-between px-3 py-2.5 gap-2">
                                                        <label className="inline-flex items-center gap-2 flex-1 min-w-0">
                                                            <input
                                                                type="checkbox"
                                                                checked={groupFullySelected}
                                                                onChange={() =>
                                                                    toggleApprovalSubmitGroupSelection(group.ids)
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
                                                            onClick={() =>
                                                                setApprovalSubmitViewingChange(group.representativeEntry)
                                                            }
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
                                <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                                    No change rows are in the HR queue yet. If you edited profile sections, save each card so edits are listed here before submitting.
                                </p>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Description</label>
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all text-sm min-h-[90px]"
                                    placeholder="Enter description (optional)..."
                                    value={approvalDescription}
                                    onChange={(e) => setApprovalDescription(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    if (sendingApproval) return;
                                    setApprovalSubmitViewingChange(null);
                                    setApprovalSubmitViewingAttachment(null);
                                    setShowApprovalSubmitModal(false);
                                }}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmSubmitForApproval}
                                disabled={sendingApproval}
                                className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {sendingApproval
                                    ? 'Submitting...'
                                    : activationHoldResubmitEligible(employee, currentUser)
                                        ? 'Submit for Activation'
                                        : 'Submit for Approval'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {approvalSubmitViewingChange && (() => {
                const { previousRows: diffPrevRows, proposedRows: diffPropRows } =
                    filterSnapshotRowsToChangesOnly(approvalSubmitViewingChange);
                return (
                    <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-800">
                                    {approvalSubmitViewingChange.card}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setApprovalSubmitViewingChange(null)}
                                    className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700"
                                >
                                    Close
                                </button>
                            </div>
                            <div className="p-6 space-y-4 max-h-[70vh] overflow-auto">
                                <div>
                                    <div className="text-xs font-semibold text-gray-600 uppercase mb-1">
                                        Current Card
                                    </div>
                                    <div className="rounded-lg border bg-gray-50 overflow-hidden">
                                        {diffPrevRows.length > 0 ? (
                                            diffPrevRows.map((row, idx) => (
                                                <div
                                                    key={`old-${idx}`}
                                                    className="grid grid-cols-12 gap-3 px-3 py-2 border-b border-gray-200 last:border-b-0"
                                                >
                                                    <div className="col-span-4 text-sm font-semibold text-gray-700">
                                                        {row.label}
                                                    </div>
                                                    <div className="col-span-8 text-sm text-gray-800 break-all flex items-center justify-between gap-3">
                                                        <span>{row.value}</span>
                                                        {row.url ? (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setApprovalSubmitViewingAttachment({
                                                                        url: row.url,
                                                                        label: row.label,
                                                                    })
                                                                }
                                                                className="shrink-0 text-xs font-semibold text-blue-700 hover:underline"
                                                            >
                                                                View
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-3 py-2 text-sm text-gray-500">No current data.</div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-gray-600 uppercase mb-1">
                                        Edited Card
                                    </div>
                                    <div className="rounded-lg border border-blue-100 bg-blue-50 overflow-hidden">
                                        {diffPropRows.length > 0 ? (
                                            diffPropRows.map((row, idx) => (
                                                <div
                                                    key={`new-${idx}`}
                                                    className="grid grid-cols-12 gap-3 px-3 py-2 border-b border-blue-100 last:border-b-0"
                                                >
                                                    <div className="col-span-4 text-sm font-semibold text-blue-800">
                                                        {row.label}
                                                    </div>
                                                    <div className="col-span-8 text-sm text-blue-900 break-all flex items-center justify-between gap-3">
                                                        <span>{row.value}</span>
                                                        {row.url ? (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setApprovalSubmitViewingAttachment({
                                                                        url: row.url,
                                                                        label: row.label,
                                                                    })
                                                                }
                                                                className="shrink-0 text-xs font-semibold text-blue-700 hover:underline"
                                                            >
                                                                View
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-3 py-2 text-sm text-blue-700">No edited data.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {approvalSubmitViewingAttachment ? (
                <div className="fixed inset-0 z-[116] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-800">
                                {approvalSubmitViewingAttachment.label || 'Attachment'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setApprovalSubmitViewingAttachment(null)}
                                className="text-sm text-gray-500 hover:text-gray-700"
                            >
                                Close
                            </button>
                        </div>
                        <div className="flex-1 bg-gray-50">
                            <iframe
                                src={approvalSubmitViewingAttachment.url}
                                title={approvalSubmitViewingAttachment.label || 'Attachment preview'}
                                className="w-full h-full border-0"
                            />
                        </div>
                    </div>
                </div>
            ) : null}

            {employee && (
                <ActivationHoldReviewModal
                    isOpen={showActivationHoldReview}
                    onClose={() => setShowActivationHoldReview(false)}
                    employee={employee}
                    onEditHeldEntry={handleHeldActivationEdit}
                    onSubmitForActivation={() => handleSubmitForApproval()}
                />
            )}

            {employee && (
                <HeldPendingsReviewModal
                    isOpen={showHeldPendingsHodModal}
                    onClose={() => setShowHeldPendingsHodModal(false)}
                    employee={employee}
                    rowCheckedById={hodHeldPendingRowCheckedMap}
                    onToggleRowChecked={toggleHeldPendingRowCheck}
                    holdResubmitEligible={heldPendingsHoldResubmitEligible}
                    activationSubmitLabel={heldPendingsActivationSubmitLabel}
                    onConfirmReviewAck={handleHeldPendingsConfirmReview}
                    onOpenSubmitForActivation={handleHeldPendingsResubmitAfterHold}
                />
            )}

            {/* Document Viewer Modal - Only render when open */}
            {showDocumentViewer && (
                <DocumentViewerModal
                    isOpen={true}
                    onClose={() => setShowDocumentViewer(false)}
                    viewingDocument={viewingDocument}
                />
            )}

            {showCertificateModal && (
                <CertificateModal
                    isOpen={showCertificateModal}
                    onClose={() => {
                        setShowCertificateModal(false);
                        setCertificateEditData(null);
                        setCertificateEditIndex(null);
                    }}
                    onSuccess={fetchEmployee}
                    targetType={certificateEditSource.startsWith('company') ? 'company' : 'employee'}
                    targetId={certificateEditSource.startsWith('company') ? employee?.company?._id : employeeId}
                    targetName={certificateEditSource.startsWith('company') ? employee?.company?.name : `${employee?.firstName} ${employee?.lastName}`}
                    isEdit={!!certificateEditData}
                    editData={certificateEditData}
                    editIndex={certificateEditIndex}
                />
            )}

        </div>
    );
}

function EmployeeProfilePageGate() {
    const params = useParams();
    const raw = params?.employeeId;
    const id = raw ? String(raw).split('.')[0] : '';
    const moduleId = id === 'VEGA-HR-0000' ? 'hrm_company_view' : 'hrm_employees_view';
    return (
        <PermissionGuard moduleId={moduleId} redirectTo="/dashboard">
            <EmployeeProfilePageContent />
        </PermissionGuard>
    );
}

export default function EmployeeProfilePage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading Profile...</div>}>
            <EmployeeProfilePageGate />
        </Suspense>
    );
}

// Helper Component for Company Profile View
function DetailItem({ icon, label, value }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                {icon}
                {label}
            </span>
            <span className="text-base font-semibold text-gray-800 break-words">{value || '-'}</span>
        </div>
    );
}


