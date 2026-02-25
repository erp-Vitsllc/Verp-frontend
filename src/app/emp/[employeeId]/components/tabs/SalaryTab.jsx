'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { isAdmin } from '@/utils/permissions';
import Select from 'react-select';
// Import cards directly to test if DynamicCards re-exports are causing issues
import SalaryDetailsCard from '../cards/SalaryDetailsCard';
import BankAccountCard from '../cards/BankAccountCard';

import {
    Download, Award, X, Undo2, ArrowRightLeft, User, Clock, CheckCircle2, UserPlus,
    Monitor, Smartphone, Hammer, Wrench, Car, Truck, MoreHorizontal, History, XCircle, ChevronDown, ChevronRight, FileText, ClipboardList, PenTool
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import AddLossDamageModal from '@/app/HRM/Fine/components/AddLossDamageModal';
import AssignAssetModal from '@/app/HRM/Asset/components/AssignAssetModal';
import HandoverFormModal from '@/app/HRM/Asset/components/HandoverFormModal';
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

export default function SalaryTab({
    searchParams,
    employee,
    isAdmin,
    hasPermission,
    hasSalaryDetails,
    hasBankDetailsSection,
    formatDate,
    selectedSalaryAction,
    setSelectedSalaryAction,
    salaryHistoryPage,
    setSalaryHistoryPage,
    salaryHistoryItemsPerPage,
    setSalaryHistoryItemsPerPage,
    calculateTotalSalary,
    onOpenSalaryModal,
    onOpenBankModal,
    onViewDocument,
    onEditSalary,
    onDeleteSalary,
    editingSalaryIndex,
    setEditingSalaryIndex,
    setSalaryForm,
    setSalaryFormErrors,
    setShowSalaryModal,
    employeeId,
    fetchEmployee,
    fines = [],
    rewards = [],
    loans = [],
    assets = [],
    employeeOptions = [],
    onIncrementSalary,
    currentUser
}) {
    const { toast } = useToast();
    const [showCertificate, setShowCertificate] = useState(false);
    const [selectedCertificate, setSelectedCertificate] = useState(null);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [selectedReturnAsset, setSelectedReturnAsset] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [assignmentData, setAssignmentData] = useState({
        reassignTo: '',
        assignmentType: 'Permanent',
        assignedDays: ''
    });
    const [isReturning, setIsReturning] = useState(false);
    const [showDamageModal, setShowDamageModal] = useState(false);
    const [selectedDamageAsset, setSelectedDamageAsset] = useState(null);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedAssignAsset, setSelectedAssignAsset] = useState(null);

    // New states for Asset Management
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedHistoryAsset, setSelectedHistoryAsset] = useState(null);
    const [assetHistory, setAssetHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [respondingToAsset, setRespondingToAsset] = useState(null);
    const [responseComments, setResponseComments] = useState('');
    const [showHandoverModal, setShowHandoverModal] = useState(false);
    const [selectedHandoverAsset, setSelectedHandoverAsset] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, asset: null, action: null });
    const certificateRef = useRef(null);

    const executeRespondToAsset = async () => {
        const { asset, action } = confirmDialog;
        if (!asset || !action) return;

        try {
            setRespondingToAsset(asset._id);
            await axiosInstance.put(`/AssetItem/${asset._id}/respond`, {
                action: action,
                comments: ''
            });
            toast({
                title: "Success",
                description: `Asset assignment ${action === 'Accept' ? 'accepted' : 'rejected'} successfully.`
            });
            if (fetchEmployee) fetchEmployee();
        } catch (error) {
            console.error('Error responding to asset:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || "Failed to respond to assignment"
            });
        } finally {
            setRespondingToAsset(null);
            setConfirmDialog({ isOpen: false, asset: null, action: null });
        }
    };

    // Check for Handover User (e.g. Manager who received notice request)
    const handoverTarget = employee?.noticeRequest?.submittedTo;
    const handoverUserId = typeof handoverTarget === 'object' ? handoverTarget?._id : handoverTarget;

    // Helpers for Asset Management permissions
    const loggedInEmployeeId = currentUser?.employeeObjectId;
    const isProfileOwner = loggedInEmployeeId === employee?._id;
    const isManager = employee?.primaryReportee === loggedInEmployeeId || employee?.primaryReportee?._id === loggedInEmployeeId;
    const assigneeHasNoAccess = !employee?.companyEmail || !employee?.enablePortalAccess;

    useEffect(() => {
        if (showReturnModal) {
            fetchEmployees();
            // Auto-select Handover User if exists
            if (handoverUserId) {
                setAssignmentData(prev => ({ ...prev, reassignTo: handoverUserId }));
            }
        }
    }, [showReturnModal, handoverUserId]);

    // Track if we've already handled the deep link to avoid re-opening
    const [deepLinkHandled, setDeepLinkHandled] = useState(false);

    useEffect(() => {
        if (!deepLinkHandled && searchParams && employee?.assets?.length > 0) {
            const assetIdParam = searchParams.get('assetId');
            if (assetIdParam) {
                // Find the asset in the employee's asset list to act on it
                // The dashboard 'requestId' matches the AssetItem._id
                const targetAsset = employee.assets.find(a =>
                    (a._id || a.id)?.toString() === assetIdParam
                );

                if (targetAsset && targetAsset.status === 'Pending') {
                    // Check if the current user can act on this asset
                    const canAct = (isProfileOwner || (isManager && (assigneeHasNoAccess || targetAsset.actionRequiredBy === loggedInEmployeeId)));

                    if (canAct) {
                        setRespondingToAsset(targetAsset._id || targetAsset.id);
                        setResponseComments('');
                        setDeepLinkHandled(true);
                    }
                }
            }
        }
    }, [searchParams, employee?.assets, deepLinkHandled, isProfileOwner, isManager, assigneeHasNoAccess, loggedInEmployeeId]);

    const fetchEmployees = async () => {
        try {
            const response = await axiosInstance.get('/Employee', { params: { limit: 1000 } });
            const empList = response.data.employees || response.data || [];
            setEmployees(Array.isArray(empList) ? empList : []);
        } catch (error) {
            console.error('Failed to fetch employees:', error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load employees" });
        }
    };

    const handleReportDamage = (asset) => {
        setSelectedDamageAsset(asset);
        setShowDamageModal(true);
    };

    const handleReturnAsset = (asset) => {
        if (!asset) return;
        setSelectedReturnAsset(asset);
        setAssignmentData({
            reassignTo: '',
            assignmentType: 'Permanent',
            assignedDays: ''
        });
        setShowReturnModal(true);
    };

    const submitReturnAsset = async () => {
        if (!selectedReturnAsset) return;

        setIsReturning(true);
        try {
            const payload = {};
            if (assignmentData.reassignTo) {
                payload.reassignTo = assignmentData.reassignTo;
                payload.assignmentType = assignmentData.assignmentType;
                if (assignmentData.assignmentType === 'Temporary') {
                    payload.assignedDays = assignmentData.assignedDays;
                }
            }

            await axiosInstance.put(`/AssetItem/${selectedReturnAsset._id || selectedReturnAsset.id || selectedReturnAsset.assetId}/return`, payload);
            toast({
                title: "Success",
                description: "Asset returned/reassigned successfully."
            });
            if (fetchEmployee) fetchEmployee();
            setShowReturnModal(false);
            setSelectedReturnAsset(null);
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

    // Helper function for consistent Title Case
    const toTitleCase = (str) => {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const handleDownloadCertificate = async () => {
        if (!certificateRef.current) return;

        try {
            // Collect all stylesheets for html2canvas to ensure fonts/styles are captured
            const styleSheets = Array.from(document.styleSheets);
            let safeCss = '';

            styleSheets.forEach(sheet => {
                try {
                    const rules = sheet.cssRules || [];
                    for (let rule of rules) {
                        let cssText = rule.cssText;
                        // Replace unsupported lab() or oklch() colors
                        cssText = cssText.replace(/lab\([^)]+\)/gi, '#000');
                        cssText = cssText.replace(/oklch\([^)]+\)/gi, '#000000ff');
                        safeCss += cssText + '\n';
                    }
                } catch (e) {
                    // Ignore cross-origin stylesheets
                }
            });

            const canvas = await html2canvas(certificateRef.current, {
                scale: 2, // Higher quality
                logging: false,
                useCORS: true,
                backgroundColor: '#ffffff',
                scrollY: -window.scrollY, // Fix for scrolling issues
                onclone: (clonedDoc) => {
                    // Inject sanitized CSS
                    const styleTag = clonedDoc.createElement('style');
                    styleTag.innerHTML = safeCss;
                    clonedDoc.head.appendChild(styleTag);
                }
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape, A4
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${selectedCertificate?.title || 'Certificate'}.pdf`);

            toast({
                title: "Success",
                description: "Certificate downloaded successfully"
            });
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to download certificate"
            });
        }
    };

    // Helper to get Signer 1 Name with fallback to Primary Reportee
    const getSigner1Name = () => {
        if (selectedCertificate?.certSigner1Name && selectedCertificate.certSigner1Name !== 'Nivil Ali') {
            return selectedCertificate.certSigner1Name;
        }
        if (employee?.primaryReportee) {
            const rep = employee.primaryReportee;
            // Handle if populated object
            if (typeof rep === 'object' && rep.firstName) {
                return toTitleCase(`${rep.firstName} ${rep.lastName || ''}`);
            }
        }
        return 'Nivil Ali';
    };

    const getSigner1Title = () => {
        if (selectedCertificate?.certSigner1Title && selectedCertificate.certSigner1Title !== 'Managing Director') {
            return selectedCertificate.certSigner1Title;
        }
        if (employee?.primaryReportee) {
            const rep = employee.primaryReportee;
            if (typeof rep === 'object' && rep.designation) {
                return rep.designation;
            }
        }
        return 'Managing Director';
    };

    // Prepare salary history data
    let salaryHistoryData = employee?.salaryHistory || [];

    // Deduplicate salary history based on fromDate (keep the first occurrence)
    // This handles potential data inconsistencies where duplicate entries might exist
    if (Array.isArray(salaryHistoryData) && salaryHistoryData.length > 0) {
        const seenMonths = new Set();
        salaryHistoryData = salaryHistoryData.filter(entry => {
            let dateObj = null;

            // Try to get date from fromDate first
            if (entry.fromDate) {
                dateObj = new Date(entry.fromDate);
            }
            // Fallback to month string parsing if needed
            else if (entry.month) {
                try {
                    dateObj = new Date(entry.month);
                } catch (e) { dateObj = null; }
            }

            // Keep entries where date can't be determined or is invalid
            if (!dateObj || isNaN(dateObj.getTime())) return true;

            // Create key based on Year-Month (e.g. "2026-2" for March 2026)
            const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}`;

            if (seenMonths.has(key)) {
                return false; // Duplicate month found
            }

            seenMonths.add(key);
            return true;
        });
    }

    // Logic for injecting initial salary if missing has been removed to prevent duplicates.
    // The backend now guarantees creation of initial salary history.


    // Display salary history in insertion order (latest first, no sorting)

    // Helper to generate month sequence for fine duration boxes
    const getMonthSequence = (startMonth, duration, fineDate) => {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        let startIndex = -1;

        // 1. Determine Start Index
        if (startMonth) {
            // Check if YYYY-MM format (e.g., "2026-07")
            if (startMonth.match(/^\d{4}-\d{2}$/)) {
                startIndex = parseInt(startMonth.split('-')[1], 10) - 1; // 0-indexed
            } else {
                // Assume Month Name (e.g., "March")
                startIndex = months.findIndex(m => m.toLowerCase() === startMonth.toLowerCase());
            }
        }

        // 2. LOGIC: If explicit start set -> Use Duration. Else -> Next Month (1 box).
        if (startIndex !== -1) {
            // Valid explicit schedule found
            const count = duration && duration > 0 ? duration : 1;
            const sequence = [];
            for (let i = 0; i < count; i++) {
                const monthIndex = (startIndex + i) % 12;
                sequence.push(months[monthIndex]);
            }
            return sequence;
        }

        // Default Fallback: Next Month relative to fine date
        const date = fineDate ? new Date(fineDate) : new Date();
        const calculatedStartIndex = (date.getMonth() + 1) % 12;

        const count = duration && duration > 0 ? duration : 1;
        const sequence = [];
        for (let i = 0; i < count; i++) {
            const monthIndex = (calculatedStartIndex + i) % 12;
            sequence.push(months[monthIndex]);
        }
        return sequence;
    };

    const sortedHistory = selectedSalaryAction === 'Salary History'
        ? [...salaryHistoryData]
        : [];
    const totalItems = sortedHistory.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / salaryHistoryItemsPerPage));
    const startIndex = (salaryHistoryPage - 1) * salaryHistoryItemsPerPage;
    const endIndex = startIndex + salaryHistoryItemsPerPage;
    const currentPageData = sortedHistory.slice(startIndex, endIndex);

    // Generate page numbers
    const getPageNumbers = () => {
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
        if (pages.length === 0) {
            pages.push(1);
        }
        return pages;
    };

    const pageNumbers = getPageNumbers();

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <SalaryDetailsCard
                    employee={employee}
                    isAdmin={isAdmin}
                    hasPermission={hasPermission}
                    hasSalaryDetails={hasSalaryDetails}
                    onEdit={onOpenSalaryModal}
                    onIncrement={onIncrementSalary}
                    onViewOfferLetter={async () => {
                        // Quick check first
                        let offerLetter = null;
                        let offerLetterSource = null;

                        // Check salary history first
                        if (employee?.salaryHistory && Array.isArray(employee.salaryHistory) && employee.salaryHistory.length > 0) {
                            const sortedHistory = [...employee.salaryHistory];
                            for (const entry of sortedHistory) {
                                if (entry.offerLetter) {
                                    offerLetter = entry.offerLetter;
                                    offerLetterSource = { type: 'salaryOfferLetter', docId: entry._id };
                                    break;
                                }
                            }
                        }

                        // Check main employee offer letter
                        if (!offerLetter && employee?.offerLetter) {
                            offerLetter = employee.offerLetter;
                            offerLetterSource = { type: 'offerLetter' };
                        }

                        if (!offerLetter) {
                            toast({
                                variant: "default",
                                title: "No salary letter found",
                                description: "No salary letter is available for this salary record."
                            });
                            return;
                        }

                        // Check if it's a Cloudinary URL or base64 data
                        const isCloudinaryUrl = offerLetter.url || (offerLetter.data && (offerLetter.data.startsWith('http://') || offerLetter.data.startsWith('https://')));
                        const documentData = offerLetter.url || offerLetter.data;

                        // If document is directly available (Cloudinary URL or base64), open immediately
                        if (documentData) {
                            if (isCloudinaryUrl) {
                                // Cloudinary URL - use directly (much faster!)
                                onViewDocument({
                                    data: documentData,
                                    name: offerLetter.name || 'Salary Letter.pdf',
                                    mimeType: offerLetter.mimeType || 'application/pdf',
                                    moduleId: offerLetterSource?.type === 'salaryOfferLetter' ? 'hrm_employees_view_salary_history' : 'hrm_employees_view_salary'
                                });
                            } else {
                                // Base64 data - clean and use
                                let cleanData = documentData;
                                if (cleanData.includes(',')) {
                                    cleanData = cleanData.split(',')[1];
                                }

                                onViewDocument({
                                    data: cleanData,
                                    name: offerLetter.name || 'Salary Letter.pdf',
                                    mimeType: offerLetter.mimeType || 'application/pdf',
                                    moduleId: offerLetterSource?.type === 'salaryOfferLetter' ? 'hrm_employees_view_salary_history' : 'hrm_employees_view_salary'
                                });
                            }
                        } else if (offerLetterSource && employeeId) {
                            // Open modal with loading state immediately
                            onViewDocument({
                                data: null, // Signal loading
                                name: offerLetter.name || 'Salary Letter.pdf',
                                mimeType: offerLetter.mimeType || 'application/pdf',
                                loading: true,
                                moduleId: offerLetterSource?.type === 'salaryOfferLetter' ? 'hrm_employees_view_salary_history' : 'hrm_employees_view_salary'
                            });

                            // Fetch in background
                            try {
                                const axiosInstance = (await import('@/utils/axios')).default;
                                const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                                    params: offerLetterSource.docId
                                        ? { type: offerLetterSource.type, docId: offerLetterSource.docId }
                                        : { type: offerLetterSource.type }
                                });

                                if (response.data && response.data.data) {
                                    const isCloudinaryUrl = response.data.isCloudinaryUrl ||
                                        (response.data.data && (response.data.data.startsWith('http://') || response.data.data.startsWith('https://')));

                                    if (isCloudinaryUrl) {
                                        // Cloudinary URL - use directly
                                        onViewDocument({
                                            data: response.data.data,
                                            name: response.data.name || offerLetter.name || 'Salary Letter.pdf',
                                            mimeType: response.data.mimeType || offerLetter.mimeType || 'application/pdf',
                                            moduleId: offerLetterSource?.type === 'salaryOfferLetter' ? 'hrm_employees_view_salary_history' : 'hrm_employees_view_salary'
                                        });
                                    } else {
                                        // Base64 data - clean and use
                                        let cleanData = response.data.data;
                                        if (cleanData.includes(',')) {
                                            cleanData = cleanData.split(',')[1];
                                        }

                                        onViewDocument({
                                            data: cleanData,
                                            name: response.data.name || offerLetter.name || 'Salary Letter.pdf',
                                            mimeType: response.data.mimeType || offerLetter.mimeType || 'application/pdf',
                                            moduleId: offerLetterSource?.type === 'salaryOfferLetter' ? 'hrm_employees_view_salary_history' : 'hrm_employees_view_salary'
                                        });
                                    }
                                } else {
                                    onViewDocument(null); // Close modal
                                    toast({
                                        variant: "destructive",
                                        title: "Failed to load salary letter",
                                        description: "Unable to load the salary letter. Please try again."
                                    });
                                }
                            } catch (err) {
                                console.error('Error fetching salary letter:', err);
                                onViewDocument(null); // Close modal
                                toast({
                                    variant: "destructive",
                                    title: "Error fetching salary letter",
                                    description: "Please try again."
                                });
                            }
                        } else {
                            toast({
                                title: "Salary letter data not available",
                                description: "The salary letter data is not available."
                            });
                        }
                    }}
                />

                <BankAccountCard
                    employee={employee}
                    isAdmin={isAdmin}
                    hasPermission={hasPermission}
                    hasBankDetailsSection={hasBankDetailsSection}
                    onEdit={onOpenBankModal}
                    onViewDocument={async () => {
                        if (!employee.bankAttachment) {
                            toast({
                                title: "No bank attachment found",
                                description: "No bank attachment is available."
                            });
                            return;
                        }

                        // Check if it's a Cloudinary URL or base64 data
                        const isCloudinaryUrl = employee.bankAttachment.url ||
                            (employee.bankAttachment.data && (employee.bankAttachment.data.startsWith('http://') || employee.bankAttachment.data.startsWith('https://')));
                        const documentData = employee.bankAttachment.url || employee.bankAttachment.data;

                        // If document is directly available (Cloudinary URL or base64), open immediately
                        if (documentData) {
                            if (isCloudinaryUrl) {
                                // Cloudinary URL - use directly (much faster!)
                                onViewDocument({
                                    data: documentData,
                                    name: employee.bankAttachment.name || 'Bank Attachment.pdf',
                                    mimeType: employee.bankAttachment.mimeType || 'application/pdf',
                                    moduleId: 'hrm_employees_view_bank'
                                });
                            } else {
                                // Base64 data - clean and use
                                let cleanData = documentData;
                                if (cleanData.includes(',')) {
                                    cleanData = cleanData.split(',')[1];
                                }

                                onViewDocument({
                                    data: cleanData,
                                    name: employee.bankAttachment.name || 'Bank Attachment.pdf',
                                    mimeType: employee.bankAttachment.mimeType || 'application/pdf',
                                    moduleId: 'hrm_employees_view_bank'
                                });
                            }
                        } else if (employeeId) {
                            // Open modal with loading state immediately
                            onViewDocument({
                                data: null, // Signal loading
                                name: employee.bankAttachment.name || 'Bank Attachment.pdf',
                                mimeType: employee.bankAttachment.mimeType || 'application/pdf',
                                loading: true,
                                moduleId: 'hrm_employees_view_bank'
                            });

                            // Fetch in background
                            try {
                                const axiosInstance = (await import('@/utils/axios')).default;
                                const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                                    params: { type: 'bankAttachment' }
                                });

                                if (response.data && response.data.data) {
                                    const isCloudinaryUrl = response.data.isCloudinaryUrl ||
                                        (response.data.data && (response.data.data.startsWith('http://') || response.data.data.startsWith('https://')));

                                    if (isCloudinaryUrl) {
                                        // Cloudinary URL - use directly
                                        onViewDocument({
                                            data: response.data.data,
                                            name: response.data.name || employee.bankAttachment.name || 'Bank Attachment.pdf',
                                            mimeType: response.data.mimeType || employee.bankAttachment.mimeType || 'application/pdf',
                                            moduleId: 'hrm_employees_view_bank'
                                        });
                                    } else {
                                        // Base64 data - clean and use
                                        let cleanData = response.data.data;
                                        if (cleanData.includes(',')) {
                                            cleanData = cleanData.split(',')[1];
                                        }

                                        onViewDocument({
                                            data: cleanData,
                                            name: response.data.name || employee.bankAttachment.name || 'Bank Attachment.pdf',
                                            mimeType: response.data.mimeType || employee.bankAttachment.mimeType || 'application/pdf',
                                            moduleId: 'hrm_employees_view_bank'
                                        });
                                    }
                                } else {
                                    onViewDocument(null); // Close modal
                                    toast({
                                        variant: "destructive",
                                        title: "Failed to load bank attachment",
                                        description: "Unable to load the bank attachment. Please try again."
                                    });
                                }
                            } catch (err) {
                                console.error('Error fetching bank attachment:', err);
                                onViewDocument(null); // Close modal
                                toast({
                                    variant: "destructive",
                                    title: "Error fetching bank attachment",
                                    description: "Please try again."
                                });
                            }
                        }
                    }}
                />
            </div>

            {/* Action Buttons - Tab Style */}
            <div className="flex flex-wrap gap-3 mt-6">
                {['Salary History', 'Fine', 'Rewards', 'NCR', 'Loans', 'Advance', 'Assets', 'CTC'].map((action) => {
                    if (action === 'Salary History' && !isAdmin() && !hasPermission('hrm_employees_view_salary_history', 'isView') && !hasPermission('hrm_employees_view_salary', 'isView')) {
                        return null;
                    }
                    return (
                        <button
                            key={action}
                            onClick={() => {
                                setSelectedSalaryAction(action);
                                setSalaryHistoryPage(1);
                            }}
                            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors border-2 ${selectedSalaryAction === action
                                ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                                }`}
                        >
                            {action}
                        </button>
                    );
                })}
            </div>

            {/* Salary Action Card */}
            <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">{selectedSalaryAction}</h3>
                    <div className="flex items-center gap-4">
                        {selectedSalaryAction === 'Salary History' && (isAdmin() || hasPermission('hrm_employees_view_salary', 'isView') || hasPermission('hrm_employees_view_salary_history', 'isView')) && (
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">Items per page</span>
                                    <select
                                        value={salaryHistoryItemsPerPage}
                                        onChange={(e) => {
                                            setSalaryHistoryItemsPerPage(Number(e.target.value));
                                            setSalaryHistoryPage(1);
                                        }}
                                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setSalaryHistoryPage(prev => Math.max(1, prev - 1))}
                                        disabled={salaryHistoryPage === 1 || totalItems === 0}
                                        className={`px-3 py-1 rounded-lg text-sm bg-gray-200 text-blue-600 ${salaryHistoryPage === 1 || totalItems === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'
                                            }`}
                                    >
                                        &lt;
                                    </button>
                                    {pageNumbers.map((pageNum) => (
                                        <button
                                            key={pageNum}
                                            onClick={() => setSalaryHistoryPage(pageNum)}
                                            disabled={totalItems === 0}
                                            className={`px-3 py-1 rounded-lg text-sm bg-white border border-gray-300 text-gray-700 ${totalItems === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                                        >
                                            {pageNum}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setSalaryHistoryPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={salaryHistoryPage === totalPages || totalItems === 0 || totalItems <= salaryHistoryItemsPerPage}
                                        className={`px-3 py-1 rounded-lg text-sm bg-gray-200 text-blue-600 ${salaryHistoryPage === totalPages || totalItems === 0 || totalItems <= salaryHistoryItemsPerPage
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:bg-gray-300'
                                            }`}
                                    >
                                        &gt;
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto w-full max-w-full">
                    <table className="w-full min-w-0 table-auto">
                        <thead>
                            <tr className="border-b border-gray-200">
                                {selectedSalaryAction === 'Salary History' && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">From Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">To Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Basic Salary</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Other Allowance</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Home Rent Allowance</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Vehicle Allowance</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Fuel Allowance</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total Salary</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Salary Letter</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                                    </>
                                )}
                                {selectedSalaryAction === 'Rewards' && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Month</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Attachment</th>
                                    </>
                                )}
                                {selectedSalaryAction === 'Fine' && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Fine Type</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total Amount</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Deduction</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Payment Schedule</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Document</th>
                                    </>
                                )}
                                {selectedSalaryAction === 'NCR' && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Month</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                                    </>
                                )}
                                {['Loans', 'Advance'].includes(selectedSalaryAction) && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total Amount</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Deduction</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Payment Schedule</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Document</th>
                                    </>
                                )}
                                {selectedSalaryAction === 'CTC' && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Year</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Basic</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Allowances</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total CTC</th>
                                    </>
                                )}
                                {selectedSalaryAction === 'Assets' && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Asset Name</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Asset ID</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type / Category</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Value (AED)</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Assigned Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Attachment</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Action</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {selectedSalaryAction === 'Salary History' && (
                                currentPageData.length > 0 ? (
                                    currentPageData.map((entry, index) => {
                                        const actualIndex = startIndex + index;
                                        return (
                                            <tr key={actualIndex} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {entry.fromDate ? new Date(entry.fromDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {entry.toDate ? new Date(entry.toDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Present'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">AED {entry.basic?.toFixed(2) || '0.00'}</td>
                                                <td className="py-3 px-4 text-sm text-gray-500">AED {entry.otherAllowance?.toFixed(2) || '0.00'}</td>
                                                <td className="py-3 px-4 text-sm text-gray-500">AED {entry.houseRentAllowance?.toFixed(2) || '0.00'}</td>
                                                <td className="py-3 px-4 text-sm text-gray-500">AED {entry.vehicleAllowance?.toFixed(2) || '0.00'}</td>
                                                <td className="py-3 px-4 text-sm text-gray-500">AED {(() => {
                                                    if (entry.fuelAllowance !== undefined && entry.fuelAllowance !== null) {
                                                        return entry.fuelAllowance.toFixed(2);
                                                    }
                                                    const fuelFromAdditional = entry.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount || 0;
                                                    return fuelFromAdditional.toFixed(2);
                                                })()}</td>
                                                <td className="py-3 px-4 text-sm font-semibold text-gray-500">AED {(() => {
                                                    const basic = entry.basic || 0;
                                                    const hra = entry.houseRentAllowance || 0;
                                                    const vehicle = entry.vehicleAllowance || 0;
                                                    const other = entry.otherAllowance || 0;
                                                    const fuel = entry.fuelAllowance !== undefined && entry.fuelAllowance !== null
                                                        ? entry.fuelAllowance
                                                        : (entry.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount || 0);
                                                    const recalculatedTotal = basic + hra + vehicle + fuel + other;
                                                    return recalculatedTotal.toFixed(2);
                                                })()}</td>
                                                <td className="py-3 px-4 text-sm">
                                                    {(() => {
                                                        const hasOfferLetter = !!(entry.offerLetter &&
                                                            (entry.offerLetter.url || entry.offerLetter.data));

                                                        if (!hasOfferLetter) {
                                                            return <span className="text-gray-400">—</span>;
                                                        }

                                                        const offerLetterName = entry.offerLetter?.name || 'Salary Letter.pdf';

                                                        return (
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();

                                                                    const offerLetter = entry.offerLetter;

                                                                    if (!offerLetter) {
                                                                        toast({
                                                                            title: "No salary letter found",
                                                                            description: "No salary letter is available for this salary record."
                                                                        });
                                                                        return;
                                                                    }

                                                                    const documentData = offerLetter.url || offerLetter.data;

                                                                    if (documentData) {
                                                                        const isCloudinaryUrl = offerLetter.url ||
                                                                            (offerLetter.data && (offerLetter.data.startsWith('http://') || offerLetter.data.startsWith('https://')));

                                                                        if (isCloudinaryUrl) {
                                                                            onViewDocument({
                                                                                data: documentData,
                                                                                name: offerLetterName,
                                                                                mimeType: offerLetter.mimeType || 'application/pdf',
                                                                                moduleId: 'hrm_employees_view_salary_history'
                                                                            });
                                                                        } else {
                                                                            let cleanData = documentData;
                                                                            if (cleanData.includes(',')) {
                                                                                cleanData = cleanData.split(',')[1];
                                                                            }
                                                                            onViewDocument({
                                                                                data: cleanData,
                                                                                name: offerLetterName,
                                                                                mimeType: offerLetter.mimeType || 'application/pdf',
                                                                                moduleId: 'hrm_employees_view_salary_history'
                                                                            });
                                                                        }
                                                                    } else {
                                                                        if (entry._id && employeeId) {
                                                                            try {
                                                                                const axiosInstance = (await import('@/utils/axios')).default;
                                                                                const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                                                                                    params: { type: 'salaryOfferLetter', docId: entry._id }
                                                                                });

                                                                                if (response.data && response.data.data) {
                                                                                    const isCloudinaryUrl = response.data.isCloudinaryUrl ||
                                                                                        (response.data.data && (response.data.data.startsWith('http://') || response.data.data.startsWith('https://')));

                                                                                    if (isCloudinaryUrl) {
                                                                                        onViewDocument({
                                                                                            data: response.data.data,
                                                                                            name: response.data.name || offerLetterName,
                                                                                            mimeType: response.data.mimeType || offerLetter.mimeType || 'application/pdf',
                                                                                            moduleId: 'hrm_employees_view_salary_history'
                                                                                        });
                                                                                    } else {
                                                                                        let cleanData = response.data.data;
                                                                                        if (cleanData.includes(',')) {
                                                                                            cleanData = cleanData.split(',')[1];
                                                                                        }
                                                                                        onViewDocument({
                                                                                            data: cleanData,
                                                                                            name: response.data.name || offerLetterName,
                                                                                            mimeType: response.data.mimeType || offerLetter.mimeType || 'application/pdf',
                                                                                            moduleId: 'hrm_employees_view_salary_history'
                                                                                        });
                                                                                    }
                                                                                } else {
                                                                                    toast({
                                                                                        variant: "destructive",
                                                                                        title: "Failed to load salary letter",
                                                                                        description: "Unable to load the salary letter."
                                                                                    });
                                                                                }
                                                                            } catch (err) {
                                                                                if (err.response?.status === 404) {
                                                                                    toast({
                                                                                        variant: "destructive",
                                                                                        title: "Salary letter not found",
                                                                                        description: "No salary letter is available for this salary record."
                                                                                    });
                                                                                } else {
                                                                                    toast({
                                                                                        variant: "destructive",
                                                                                        title: "Error loading salary letter",
                                                                                        description: "Please try again."
                                                                                    });
                                                                                }
                                                                            }
                                                                        } else {
                                                                            toast({
                                                                                variant: "destructive",
                                                                                title: "Salary letter data not available",
                                                                                description: "The salary letter data is not available."
                                                                            });
                                                                        }
                                                                    }
                                                                }}
                                                                className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1.5 font-medium"
                                                                title="View Salary Letter"
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                                    <polyline points="14 2 14 8 20 8"></polyline>
                                                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                                                    <polyline points="10 9 9 9 8 9"></polyline>
                                                                </svg>
                                                                <span className="truncate max-w-[150px]" title={offerLetterName}>
                                                                    {offerLetterName}
                                                                </span>
                                                            </button>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="py-3 px-4 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        {(isAdmin() || hasPermission('hrm_employees_view_salary', 'isEdit')) && (
                                                            <button
                                                                onClick={() => {
                                                                    const entryToEdit = sortedHistory[actualIndex];
                                                                    if (onEditSalary) {
                                                                        onEditSalary(entryToEdit, actualIndex);
                                                                    }
                                                                }}
                                                                className="text-blue-600 hover:text-blue-700"
                                                                title="Edit"
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                </svg>
                                                            </button>
                                                        )}
                                                        {(isAdmin() || hasPermission('hrm_employees_view_salary', 'isDelete')) && (
                                                            <button
                                                                onClick={() => onDeleteSalary(actualIndex, sortedHistory)}
                                                                className="text-red-600 hover:text-red-700"
                                                                title="Delete"
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={11} className="py-16 text-center text-gray-400 text-sm">
                                            No Salary History
                                        </td>
                                    </tr>
                                )
                            )}

                            {selectedSalaryAction === 'Fine' && (
                                fines && fines.filter(f => ['Approved', 'Completed', 'Active'].includes(f.fineStatus)).length > 0 ? (
                                    fines.filter(f => ['Approved', 'Completed', 'Active'].includes(f.fineStatus)).map((fine, index) => (
                                        <tr key={fine._id || index} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                {fine.fineType || fine.category || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                {fine.createdAt ? formatDate(fine.createdAt) : (fine.fineDate || '—')}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                AED {fine.fineAmount?.toFixed(2) || '0.00'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                AED {(() => {
                                                    const totalEmployeeAmount = fine.employeeAmount || 0;
                                                    const employeeCount = fine.assignedEmployees?.length || 1;
                                                    return (totalEmployeeAmount / employeeCount).toFixed(2);
                                                })()}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                <div className="flex flex-wrap gap-2">
                                                    {(() => {
                                                        const boxes = getMonthSequence(fine.monthStart, fine.payableDuration, fine.createdAt || fine.fineDate);
                                                        return boxes.map((month, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md border border-blue-200"
                                                            >
                                                                {month}
                                                            </span>
                                                        ));
                                                    })()}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                {fine.attachment ? (
                                                    <button
                                                        onClick={() => onViewDocument(fine.attachment)}
                                                        className="text-green-600 hover:text-green-700 transition-colors p-1 hover:bg-green-50 rounded"
                                                        title="View Document"
                                                    >
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                            <polyline points="7 10 12 15 17 10"></polyline>
                                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                                        </svg>
                                                    </button>
                                                ) : '—'}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="py-16 text-center text-gray-400 text-sm">
                                            No Fines to display
                                        </td>
                                    </tr>
                                )
                            )}

                            {selectedSalaryAction === 'Rewards' && (
                                rewards && rewards.filter(r => r.rewardStatus === 'Approved').length > 0 ? (
                                    rewards.filter(r => r.rewardStatus === 'Approved').map((reward, index) => (
                                        <tr key={reward._id || index} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                {reward.awardedDate ? formatDate(reward.awardedDate) : '—'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                {reward.awardedDate ? new Date(reward.awardedDate).toLocaleString('default', { month: 'long' }) : '—'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                {reward.title || reward.description || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                AED {reward.amount?.toFixed(2) || '0.00'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                <button
                                                    onClick={() => {
                                                        setSelectedCertificate(reward);
                                                        setShowCertificate(true);
                                                    }}
                                                    className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium transition-colors p-1.5 hover:bg-blue-50 rounded-lg"
                                                >
                                                    <Download size={16} />
                                                    <span className="text-xs">Download</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="py-16 text-center text-gray-400 text-sm">
                                            No Rewards to display
                                        </td>
                                    </tr>
                                )
                            )}

                            {/* Handling other tabs that are not yet implemented with data */}
                            {selectedSalaryAction === 'Loans' && (
                                (() => {
                                    const actualLoans = loans.filter(l => (l.type || 'Loan') === 'Loan' && l.status === 'Approved');
                                    return actualLoans.length > 0 ? (
                                        actualLoans.map((loan, index) => (
                                            <tr key={loan._id || index} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {loan.loanId || 'Loan'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {loan.createdAt ? formatDate(loan.createdAt) : (loan.appliedDate ? formatDate(loan.appliedDate) : '—')}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    AED {loan.amount?.toFixed(2) || '0.00'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    AED {loan.duration ? (loan.amount / loan.duration).toFixed(2) : '0.00'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    <div className="flex flex-wrap gap-2">
                                                        {(() => {
                                                            const boxes = getMonthSequence(loan.monthStart, loan.duration, loan.createdAt || loan.appliedDate);
                                                            return boxes.map((month, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md border border-blue-200"
                                                                >
                                                                    {month}
                                                                </span>
                                                            ));
                                                        })()}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {loan.attachment ? (
                                                        <button
                                                            onClick={() => onViewDocument(loan.attachment)}
                                                            className="text-green-600 hover:text-green-700 transition-colors p-1 hover:bg-green-50 rounded"
                                                            title="View Document"
                                                        >
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                <polyline points="7 10 12 15 17 10"></polyline>
                                                                <line x1="12" y1="15" x2="12" y2="3"></line>
                                                            </svg>
                                                        </button>
                                                    ) : '—'}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="py-16 text-center text-gray-400 text-sm">
                                                No Loans to display
                                            </td>
                                        </tr>
                                    );
                                })()
                            )}

                            {selectedSalaryAction === 'Advance' && (
                                (() => {
                                    const advances = loans.filter(l => l.type === 'Advance' && l.status === 'Approved');
                                    return advances.length > 0 ? (
                                        advances.map((advance, index) => (
                                            <tr key={advance._id || index} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {advance.loanId || 'Advance'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {advance.createdAt ? formatDate(advance.createdAt) : (advance.appliedDate ? formatDate(advance.appliedDate) : '—')}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    AED {advance.amount?.toFixed(2) || '0.00'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    AED {advance.duration ? (advance.amount / advance.duration).toFixed(2) : '0.00'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    <div className="flex flex-wrap gap-2">
                                                        {(() => {
                                                            const boxes = getMonthSequence(advance.monthStart, advance.duration, advance.createdAt || advance.appliedDate);
                                                            return boxes.map((month, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md border border-blue-200"
                                                                >
                                                                    {month}
                                                                </span>
                                                            ));
                                                        })()}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {advance.attachment ? (
                                                        <button
                                                            onClick={() => onViewDocument(advance.attachment)}
                                                            className="text-green-600 hover:text-green-700 transition-colors p-1 hover:bg-green-50 rounded"
                                                            title="View Document"
                                                        >
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                <polyline points="7 10 12 15 17 10"></polyline>
                                                                <line x1="12" y1="15" x2="12" y2="3"></line>
                                                            </svg>
                                                        </button>
                                                    ) : '—'}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="py-16 text-center text-gray-400 text-sm">
                                                No Advances to display
                                            </td>
                                        </tr>
                                    );
                                })()
                            )}

                            {selectedSalaryAction === 'NCR' && (
                                <tr>
                                    <td colSpan={4} className="py-16 text-center text-gray-400 text-sm">
                                        No NCR Records Found
                                    </td>
                                </tr>
                            )}

                            {selectedSalaryAction === 'CTC' && (
                                <tr>
                                    <td colSpan={4} className="py-16 text-center text-gray-400 text-sm">
                                        No CTC History Found
                                    </td>
                                </tr>
                            )}

                            {selectedSalaryAction === 'Assets' && (
                                (() => {
                                    const initialAssetsList = assets && assets.length > 0 ? assets : (employee?.assets || []);

                                    // Helper to categorize assets
                                    const categorizeAsset = (asset) => {
                                        const typeName = (asset.typeId?.name || asset.typeId || asset.type || '').toLowerCase();
                                        const categoryName = (asset.categoryId?.name || asset.categoryId || asset.category || '').toLowerCase();
                                        const assetName = (asset.name || '').toLowerCase();

                                        if (typeName.includes('car') || typeName.includes('van') || typeName.includes('truck') || typeName.includes('pickup') || typeName.includes('bus') || typeName.includes('vehicle') || assetName.includes('vehicle')) {
                                            return 'Vehicle Asset';
                                        }
                                        if (typeName.includes('mobile') || typeName.includes('sim') || typeName.includes('laptop') || typeName.includes('ipad') || typeName.includes('tablet') || typeName.includes('phone') || typeName.includes('macbook')) {
                                            return 'Telecommunication';
                                        }
                                        if (typeName.includes('drill') || typeName.includes('saw') || typeName.includes('kit') || typeName.includes('tool') || typeName.includes('hammer') || typeName.includes('wrench')) {
                                            return 'Tool';
                                        }
                                        return 'Other';
                                    };

                                    const assetsList = initialAssetsList;

                                    const getCategoryIcon = (category) => {
                                        switch (category) {
                                            case 'Vehicle Asset': return <Car size={16} />;
                                            case 'Telecommunication': return <Smartphone size={16} />;
                                            case 'Tool': return <Hammer size={16} />;
                                            default: return <Monitor size={16} />;
                                        }
                                    };

                                    const getCategoryColor = (category) => {
                                        switch (category) {
                                            case 'Vehicle Asset': return 'bg-blue-50 text-blue-600 border-blue-100';
                                            case 'Telecommunication': return 'bg-purple-50 text-purple-600 border-purple-100';
                                            case 'Tool': return 'bg-orange-50 text-orange-600 border-orange-100';
                                            default: return 'bg-slate-50 text-slate-600 border-slate-100';
                                        }
                                    };

                                    // Grouping logic
                                    const groupedAssets = assetsList.reduce((acc, asset) => {
                                        const category = categorizeAsset(asset);
                                        if (!acc[category]) acc[category] = [];
                                        acc[category].push(asset);
                                        return acc;
                                    }, {});

                                    const sortedCategories = ['Vehicle Asset', 'Telecommunication', 'Tool', 'Other'];

                                    const handleRespondToAsset = async (asset, action) => {
                                        setConfirmDialog({ isOpen: true, asset, action });
                                    };

                                    const viewAssetHistory = async (asset) => {
                                        try {
                                            setSelectedHistoryAsset(asset);
                                            setShowHistoryModal(true);
                                            setLoadingHistory(true);
                                            const response = await axiosInstance.get(`/AssetItem/${asset._id}/history`);
                                            setAssetHistory(response.data);
                                        } catch (error) {
                                            console.error('Error fetching asset history:', error);
                                            toast({
                                                variant: "destructive",
                                                title: "Error",
                                                description: "Failed to fetch asset history"
                                            });
                                        } finally {
                                            setLoadingHistory(false);
                                        }
                                    };

                                    if (assetsList.length === 0) {
                                        return (
                                            <tr>
                                                <td colSpan={8} className="py-16 text-center text-gray-400 text-sm">
                                                    No Assets assigned
                                                </td>
                                            </tr>
                                        );
                                    }

                                    return sortedCategories.map(category => {
                                        const assetsInCategory = groupedAssets[category];
                                        if (!assetsInCategory || assetsInCategory.length === 0) return null;

                                        return (
                                            <React.Fragment key={category}>
                                                <tr className="bg-slate-50/50">
                                                    <td colSpan={8} className="py-2 px-4">
                                                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${getCategoryColor(category)}`}>
                                                            {getCategoryIcon(category)}
                                                            {category}
                                                            <span className="ml-1 opacity-60">({assetsInCategory.length})</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {assetsInCategory.map((asset, index) => (
                                                    <tr key={asset._id || index} className="border-b border-gray-100 hover:bg-gray-50 group">
                                                        <td className="py-3 px-4 text-sm text-gray-500 font-medium">
                                                            <div className="flex flex-col">
                                                                <span className="text-slate-900 font-bold">{asset.name || '—'}</span>
                                                                {asset.status === 'Returned' && asset.assignedBy && (
                                                                    <span className="text-[10px] text-blue-500 font-bold uppercase tracking-tight">
                                                                        Returned By: {asset.assignedBy.firstName} {asset.assignedBy.lastName}
                                                                    </span>
                                                                )}
                                                                {(asset.status === 'Assigned' || asset.status === 'Pending') && asset.assignedBy && (
                                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                                                                        Assigned By: {asset.assignedBy.firstName} {asset.assignedBy.lastName}
                                                                    </span>
                                                                )}
                                                                {asset.status === 'Assigned' && asset.acceptedBy &&
                                                                    (asset.acceptedBy._id || asset.acceptedBy).toString() !== (asset.assignedTo?._id || asset.assignedTo).toString() && (
                                                                        <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-tight">
                                                                            Accepted By: {asset.acceptedBy.firstName} {asset.acceptedBy.lastName} (Manager)
                                                                        </span>
                                                                    )}
                                                                {handoverTarget && (asset.status === 'Assigned' || asset.status === 'Pending') && (
                                                                    <span className="text-[10px] text-amber-500 font-bold uppercase tracking-tight">
                                                                        Handover Target: {handoverTarget.firstName} {handoverTarget.lastName}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                            {asset.assetId || '—'}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                            <div className="flex flex-col">
                                                                <span>{asset.typeId?.name || asset.typeId || '—'}</span>
                                                                <span className="text-xs text-gray-400">{asset.categoryId?.name || asset.categoryId || ''}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                            AED {asset.assetValue ? Number(asset.assetValue).toFixed(2) : '0.00'}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                            {asset.status === 'Returned' ? formatDate(asset.updatedAt) :
                                                                (asset.assignedDate ? formatDate(asset.assignedDate) :
                                                                    (asset.updatedAt ? formatDate(asset.updatedAt) : '—'))}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm">
                                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${asset.status === 'Assigned' ? 'bg-indigo-100 text-indigo-700' :
                                                                asset.status === 'Unassigned' ? 'bg-emerald-100 text-emerald-700' :
                                                                    asset.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                                                                        asset.status === 'Service' ? 'bg-rose-100 text-rose-700' :
                                                                            asset.status === 'Returned' ? 'bg-blue-100 text-blue-700' :
                                                                                'bg-slate-100 text-slate-700'
                                                                }`}>
                                                                {asset.status || 'Assigned'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedHandoverAsset(asset);
                                                                        setShowHandoverModal(true);
                                                                    }}
                                                                    className="text-indigo-600 hover:text-indigo-700 transition-colors p-1 hover:bg-indigo-50 rounded"
                                                                    title="View Handover Form"
                                                                >
                                                                    <ClipboardList size={18} />
                                                                </button>
                                                                {(asset.file || asset.handoverForm) && (
                                                                    <button
                                                                        onClick={() => onViewDocument({
                                                                            data: asset.file || asset.handoverForm,
                                                                            name: `HandoverForm_${asset.assetId}.pdf`,
                                                                            mimeType: 'application/pdf',
                                                                            moduleId: 'hrm_employees_view_asset_form'
                                                                        })}
                                                                        className="text-blue-600 hover:text-blue-700 transition-colors p-1 hover:bg-blue-50 rounded"
                                                                        title="View Signed Document"
                                                                    >
                                                                        <FileText size={18} />
                                                                    </button>
                                                                )}
                                                                {asset.invoiceFile && (
                                                                    <button
                                                                        onClick={() => onViewDocument({
                                                                            data: asset.invoiceFile,
                                                                            name: `Invoice_${asset.assetId}.pdf`,
                                                                            mimeType: 'application/pdf',
                                                                            moduleId: 'hrm_employees_view_asset_invoice'
                                                                        })}
                                                                        className="text-green-600 hover:text-green-700 transition-colors p-1 hover:bg-green-50 rounded"
                                                                        title="View Invoice"
                                                                    >
                                                                        <Download size={18} />
                                                                    </button>
                                                                )}
                                                                {!asset.handoverForm && !asset.file && !asset.invoiceFile && !asset && '—'}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                            <div className="flex items-center gap-1">
                                                                {asset.status === 'Pending' && (isProfileOwner || (isManager && (assigneeHasNoAccess || asset.actionRequiredBy === loggedInEmployeeId))) && (
                                                                    <div className="flex items-center gap-1 mr-2 bg-amber-50 p-1 rounded-lg border border-amber-100">
                                                                        <button
                                                                            onClick={() => handleRespondToAsset(asset, 'Accept')}
                                                                            disabled={respondingToAsset === asset._id}
                                                                            className="p-1 text-emerald-600 hover:bg-emerald-100 rounded transition-all"
                                                                            title="Accept Assignment"
                                                                        >
                                                                            <CheckCircle2 size={18} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleRespondToAsset(asset, 'Reject')}
                                                                            disabled={respondingToAsset === asset._id}
                                                                            className="p-1 text-rose-600 hover:bg-rose-100 rounded transition-all"
                                                                            title="Reject Assignment"
                                                                        >
                                                                            <XCircle size={18} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                <button
                                                                    onClick={() => viewAssetHistory(asset)}
                                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                    title="View Detailed History"
                                                                >
                                                                    <History size={18} />
                                                                </button>
                                                                {asset.status !== 'Returned' ? (
                                                                    <button
                                                                        onClick={() => handleReturnAsset(asset)}
                                                                        className="text-amber-500 hover:text-amber-700 transition-colors p-1.5 hover:bg-amber-50 rounded-lg"
                                                                        title="Reassign / Return Asset"
                                                                    >
                                                                        <ArrowRightLeft size={18} />
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedAssignAsset(asset);
                                                                            setShowAssignModal(true);
                                                                        }}
                                                                        className="text-blue-500 hover:text-blue-700 transition-colors p-1.5 hover:bg-blue-50 rounded-lg"
                                                                        title="Reassign Asset"
                                                                    >
                                                                        <UserPlus size={18} />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleReportDamage(asset)}
                                                                    className="text-red-500 hover:text-red-700 transition-colors p-1.5 hover:bg-red-50 rounded-lg"
                                                                    title="Report Loss/Damage"
                                                                >
                                                                    <X size={18} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        );
                                    });
                                })()
                            )}

                        </tbody>
                    </table>
                </div>
            </div>

            {/* Certificate Modal */}
            {
                showCertificate && selectedCertificate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        {/* Font Import for Certificate */}
                        <style jsx global>{`
                        @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Montserrat:wght@300;400;500;600&display=swap');
                    `}</style>

                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <Award className="text-amber-500" size={20} />
                                    Reward Certificate
                                </h3>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleDownloadCertificate}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <Download size={16} />
                                        Download PDF
                                    </button>
                                    <button
                                        onClick={() => setShowCertificate(false)}
                                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body - Scrollable */}
                            <div className="flex-1 overflow-auto p-8 bg-gray-100 flex items-center justify-center">
                                {/* Certificate Reference Div for PDF Generation - Exact Replica of Reward Details Page */}
                                <div
                                    ref={certificateRef}
                                    id="certificate-container"
                                    className="bg-white relative w-[900px] h-[636px] shadow-2xl overflow-hidden flex flex-col justify-between shrink-0"
                                >
                                    <div className="absolute inset-0 z-0">
                                        <img
                                            src="/assets/certificate-bg-new.png"
                                            alt="Certificate Background"
                                            className="w-full h-full object-fill"
                                            crossOrigin="anonymous"
                                        />
                                    </div>

                                    <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-24 pt-20 pb-0 text-center">
                                        <h1 className="text-5xl font-semibold text-[#1a2e35] tracking-[0.1em] mb-2 uppercase font-sans" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                            {selectedCertificate.certHeader || 'Certificate'}
                                        </h1>
                                        <h2 className="text-2xl text-[#1a2e35] font-normal mb-4 tracking-wide" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                            {selectedCertificate.certSubHeader || 'Of Appreciation'}
                                        </h2>
                                        <p className="text-xs text-black uppercase tracking-widest mb-4" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                            {selectedCertificate.certPresentationText || 'This certificate is presented to'}
                                        </p>
                                        <div className="mb-6 w-full">
                                            <h3 className="text-5xl text-[#1a2e35] font-normal" style={{ fontFamily: '"Great Vibes", cursive' }}>
                                                {toTitleCase(selectedCertificate.employeeName || (employee ? `${employee.firstName} ${employee.lastName}` : ''))}
                                            </h3>
                                        </div>
                                        <div className="max-w-xl mx-auto space-y-3">
                                            <p className="text-base text-gray-600 leading-relaxed px-4" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                                {selectedCertificate.title || ''}
                                            </p>
                                            <div className="mt-2 space-y-1">
                                                {selectedCertificate.rewardType === 'Gift' && selectedCertificate.giftName && (
                                                    <p className="text-lg font-medium text-[#1a2e35]" style={{ fontFamily: '"Montserrat", sans-serif' }}>Gift: {selectedCertificate.giftName}</p>
                                                )}
                                                {/* Logic for amount if needed, though usually hidden on generic certs unless specific */}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative z-20 flex items-end justify-between px-36 pb-28 w-full">
                                        <div className="text-center">
                                            <p className="text-lg font-semibold text-[#1a2e35] mb-1" style={{ fontFamily: '"Playfair Display", serif' }}>
                                                {getSigner1Name()}
                                            </p>
                                            <p className="text-lg font-medium uppercase tracking-wider text-[#1a2e35]" style={{ fontFamily: '"Playfair Display", serif' }}>
                                                {getSigner1Title()}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-center -mb-4">
                                            <img src="/assets/certificate-logo-v2.png" alt="Company Seal" className="w-60 h-32 object-contain" crossOrigin="anonymous" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-semibold text-[#1a2e35] mb-1" style={{ fontFamily: '"Playfair Display", serif' }}>
                                                {selectedCertificate.certSigner2Name || 'Raseel Muhammad'}
                                            </p>
                                            <p className="text-lg uppercase tracking-wider text-[#1a2e35]" style={{ fontFamily: '"Playfair Display", serif' }}>
                                                {selectedCertificate.certSigner2Title || 'CEO'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Return Asset Modal */}
            {showReturnModal && selectedReturnAsset && (
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
                                        Asset: {selectedReturnAsset.assetId} - {selectedReturnAsset.name}
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
                                        {selectedReturnAsset.typeId?.name || selectedReturnAsset.typeId || '-'}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Category</label>
                                    <div className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 uppercase tracking-tight shadow-sm min-h-[48px] flex items-center">
                                        {selectedReturnAsset.categoryId?.name || selectedReturnAsset.categoryId || '-'}
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
                                            {handoverTarget
                                                ? `${handoverTarget.firstName} ${handoverTarget.lastName} (Handover User)`
                                                : (selectedReturnAsset.assignedBy?.firstName
                                                    ? `${selectedReturnAsset.assignedBy.firstName} ${selectedReturnAsset.assignedBy.lastName} (Original Issuer)`
                                                    : "Asset Store / Admin")}
                                        </p>
                                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                            {handoverTarget
                                                ? "Asset will be handed over to the designated successor."
                                                : "Asset will be returned to the store or original issuer."}
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
                                        Confirm
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loss & Damage Modal */}
            <AddLossDamageModal
                isOpen={showDamageModal}
                onClose={() => {
                    setShowDamageModal(false);
                    setSelectedDamageAsset(null);
                }}
                onSuccess={() => {
                    // Refresh data - fetchEmployee will refresh all tabs including Assets and Fines
                    if (fetchEmployee) fetchEmployee();
                    setShowDamageModal(false);
                    setSelectedDamageAsset(null);
                }}
                employees={[employee]} // Pass current employee as the only option
                initialData={selectedDamageAsset ? {
                    assetId: selectedDamageAsset.assetId,
                    employeeId: employee.employeeId,
                    assignedEmployees: [{ employeeId: employee.employeeId }],
                    fineAmount: selectedDamageAsset.assetValue
                } : null}
            />

            {showAssignModal && selectedAssignAsset && (
                <AssignAssetModal
                    isOpen={showAssignModal}
                    onClose={() => {
                        setShowAssignModal(false);
                        setSelectedAssignAsset(null);
                    }}
                    asset={selectedAssignAsset}
                    onUpdate={fetchEmployee}
                />
            )}

            {/* Asset History Modal */}
            {showHistoryModal && selectedHistoryAsset && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-gray-50/30">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100">
                                    <History size={24} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">Asset History</h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        ID: {selectedHistoryAsset.assetId} - {selectedHistoryAsset.name}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowHistoryModal(false)} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-8 overflow-y-auto flex-1 bg-slate-50/30">
                            {loadingHistory ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading history...</p>
                                </div>
                            ) : assetHistory.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
                                        <History size={32} />
                                    </div>
                                    <p className="text-sm font-bold text-slate-400">No history records found for this asset.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {assetHistory.map((entry, idx) => (
                                        <div key={idx} className="relative pl-10">
                                            {/* Timeline Line */}
                                            {idx !== assetHistory.length - 1 && (
                                                <div className="absolute left-[19px] top-10 bottom-[-24px] w-0.5 bg-slate-200"></div>
                                            )}

                                            {/* Timeline Node */}
                                            <div className={`absolute left-0 top-1 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm z-10 ${entry.action?.toLowerCase().includes('assign') ? 'bg-indigo-600 text-white' :
                                                entry.action?.toLowerCase().includes('accept') ? 'bg-emerald-500 text-white' :
                                                    entry.action?.toLowerCase().includes('return') ? 'bg-amber-500 text-white' :
                                                        entry.action?.toLowerCase().includes('reject') ? 'bg-rose-500 text-white' :
                                                            'bg-slate-600 text-white'
                                                }`}>
                                                {entry.action?.toLowerCase().includes('assign') ? <UserPlus size={20} /> :
                                                    entry.action?.toLowerCase().includes('accept') ? <CheckCircle2 size={20} /> :
                                                        entry.action?.toLowerCase().includes('return') ? <ArrowRightLeft size={20} /> :
                                                            entry.action?.toLowerCase().includes('reject') ? <XCircle size={20} /> :
                                                                <Clock size={20} />}
                                            </div>

                                            {/* Content Card */}
                                            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:border-blue-200 transition-all">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                        {formatDate(entry.createdAt)}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${entry.action?.toLowerCase().includes('assign') ? 'bg-indigo-50 text-indigo-600' :
                                                        entry.action?.toLowerCase().includes('accept') ? 'bg-emerald-50 text-emerald-600' :
                                                            entry.action?.toLowerCase().includes('return') ? 'bg-amber-50 text-amber-600' :
                                                                entry.action?.toLowerCase().includes('reject') ? 'bg-rose-50 text-rose-600' :
                                                                    'bg-slate-50 text-slate-600'
                                                        }`}>
                                                        {entry.action}
                                                    </span>
                                                </div>
                                                <h4 className="text-sm font-bold text-slate-800 mb-1">
                                                    {entry.message}
                                                </h4>
                                                {entry.performedBy && (
                                                    <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                                                        <User size={12} className="text-slate-400" />
                                                        By: <span className="text-slate-700 font-bold">{entry.performedBy.firstName} {entry.performedBy.lastName}</span>
                                                    </p>
                                                )}
                                                {entry.comments && (
                                                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 italic text-xs text-slate-600">
                                                        "{entry.comments}"
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="px-8 py-3 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Handover Form Modal */}
            <HandoverFormModal
                isOpen={showHandoverModal}
                onClose={() => {
                    setShowHandoverModal(false);
                    setSelectedHandoverAsset(null);
                }}
                asset={selectedHandoverAsset}
                employee={employee}
            />

            {/* Confirmation Dialog */}
            <AlertDialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && setConfirmDialog({ ...confirmDialog, isOpen: false })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to {confirmDialog.action === 'Accept' ? 'accept' : 'reject'} this asset assignment?
                            {confirmDialog.action === 'Accept' && " By accepting, you acknowledge receipt and responsibility for this asset."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                executeRespondToAsset();
                            }}
                            className={confirmDialog.action === 'Accept' ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"}
                        >
                            {confirmDialog.action === 'Accept' ? 'Accept' : 'Reject'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}



