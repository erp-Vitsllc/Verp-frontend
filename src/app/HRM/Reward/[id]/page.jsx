'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useListReturnBack } from '@/hooks/useListReturnBack';
import ListReturnBackButton from '@/components/ListReturnBackButton';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import { useToast } from "@/hooks/use-toast";
import { isAdmin } from '@/utils/permissions';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import AddRewardModal from '../components/AddRewardModal'; // Import the Modal
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
import ProfileHeader from '../../../emp/[employeeId]/components/ProfileHeader';
import { calculateDaysUntilExpiry, calculateTenure, formatDurationParts, getExpiryColor } from '../../../emp/[employeeId]/utils/helpers';
import { Download, Check, X, Edit, Loader2, Lock, Send, Trash2, FileText, Paperclip } from 'lucide-react';
import CertificateEditModal from '../components/CertificateEditModal';
import RewardFormCards from '../components/RewardFormCards';
import RewardAttachmentTab from '../components/RewardAttachmentTab';
import { formatRewardStatusLabel, isRewardPaymentEligible, formatRewardPaymentLabel } from '../utils/rewardStatusDisplay';
import { HEADER_PAIR_CARD_FIXED } from '@/utils/headerPairLayout';

export default function RewardDetailsPage({ params }) {
    const { id } = use(params);
    const router = useRouter();
    const handleListReturnBack = useListReturnBack();
    const { toast } = useToast();

    const [reward, setReward] = useState(null);
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [allEmployees, setAllEmployees] = useState([]);
    const [certLoading, setCertLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('rewardDetails'); // 'rewardDetails' | 'attachments'
    const [showCertEditModal, setShowCertEditModal] = useState(false);
    const [isResubmittingModal, setIsResubmittingModal] = useState(false);

    // Inline Editing State - Initialized from Reward object
    // Inline Editing State - Initialized from Reward object
    // Removed inline editing state
    const [headerText, setHeaderText] = useState('Certificate');
    const [subHeaderText, setSubHeaderText] = useState('Of Appreciation');
    const [presentationText, setPresentationText] = useState('This certificate is presented to');
    const [signer1Name, setSigner1Name] = useState('Nivil Ali');
    const [signer1Title, setSigner1Title] = useState('Managing Director');
    const [signer2Name, setSigner2Name] = useState('Raseel Muhammad');
    const [signer2Title, setSigner2Title] = useState('CEO');

    // Alert Dialog State
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // Fetch Current User
    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                setCurrentUser(user);

                // Fetch full employee profile to ensure Dept/Desig exist for permissions
                if (user.employeeId) {
                    console.log("🔍 [Debug/Reward] Fetching full profile for:", user.employeeId);
                    axiosInstance.get(`/Employee/${user.employeeId}`)
                        .then(res => {
                            const emp = res.data.employee || res.data;
                            if (emp) {
                                console.log("✅ [Debug/Reward] Full Profile Fetched:", {
                                    dept: emp.department,
                                    desig: emp.designation,
                                    email: emp.companyEmail
                                });
                                setCurrentUser(prev => ({
                                    ...prev,
                                    department: emp.department,
                                    designation: emp.designation,
                                    companyEmail: emp.companyEmail,
                                    firstName: emp.firstName,
                                    lastName: emp.lastName,
                                    employeeObjectId: emp._id
                                }));
                            }
                        })
                        .catch(err => {
                            if (err.response && err.response.status === 404) {
                                console.warn("⚠️ [Debug/Reward] Employee profile context not found (User might be Admin without linked Employee ID). Continuing.");
                            } else {
                                console.error("❌ [Debug/Reward] Failed to fetch employee context:", err);
                            }
                        });
                }
            } catch (e) {
                console.error("Error parsing user data", e);
            }
        }
    }, []);

    // Fetch Employees for Edit Modal
    useEffect(() => {
        const fetchEmployees = async () => {
            // Only fetch if admin or needed
            // Simple fetch for now, can be optimized
            try {
                const res = await axiosInstance.get('/Employee');
                setAllEmployees(res.data.employees || res.data);
            } catch (e) {
                console.error("Failed to fetch employees", e);
            }
        }
        fetchEmployees();
    }, []);


    // Reward Stats State
    const [rewardStats, setRewardStats] = useState({
        totalCount: 0,
        cashCount: 0,
        giftCount: 0,
        certificateCount: 0,
        otherCount: 0,
        totalAmount: 0,
    });

    // Fetch Data
    const fetchData = async () => {
        if (!id) return;

        try {
            setLoading(true);
            const rewardRes = await axiosInstance.get(`/Reward/${id}`);
            const rewardData = rewardRes.data.reward || rewardRes.data;
            setReward(rewardData);

            if (rewardData.employeeId) {
                try {
                    const empRes = await axiosInstance.get(`/Employee/${rewardData.employeeId}`);
                    setEmployee(empRes.data.employee || empRes.data);

                    // Fetch All Rewards for Stats
                    const allRewardsRes = await axiosInstance.get(`/Reward?employeeId=${rewardData.employeeId}`);
                    const allRewards = allRewardsRes.data.rewards || allRewardsRes.data;

                    if (Array.isArray(allRewards)) {
                        const stats = allRewards.reduce((acc, r) => {
                            acc.totalCount++;
                            acc.totalAmount += Number(r.amount) || 0;
                            const type = (r.rewardType || '').toLowerCase();
                            if (type.includes('cash') || type.includes('bonus')) acc.cashCount++;
                            else if (type.includes('gift')) acc.giftCount++;
                            else if (type.includes('certificate') || type.includes('appreciation')) acc.certificateCount++;
                            else acc.otherCount++;
                            return acc;
                        }, { totalCount: 0, cashCount: 0, giftCount: 0, certificateCount: 0, otherCount: 0, totalAmount: 0 });
                        setRewardStats(stats);
                    }

                } catch (empErr) {
                    console.warn("Could not fetch employee details:", empErr);
                }
            }
        } catch (err) {
            console.error("Error fetching details:", err);
            setError(err.response?.data?.message || "Failed to load details");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const waitingForName = useMemo(() => {
        if (!reward) return null;
        if (['Approved', 'Approved (Paid)', 'Rejected', 'Completed', 'Draft', 'Cancelled', 'Withdrawn'].includes(reward.rewardStatus)) return null;

        const workflow = reward.workflow || [];
        const type = (reward.rewardType || '').toLowerCase();
        const isCashOrGift = type.includes('cash') || type.includes('gift');

        // 1. Check submittedTo snapshot from Reward
        if (reward.submittedTo && typeof reward.submittedTo === 'object') {
            const name = `${reward.submittedTo.firstName || ''} ${reward.submittedTo.lastName || ''}`.trim();
            if (name) return name;
            if (reward.submittedTo.name) return reward.submittedTo.name;
        }

        // 2. Check current workflow step if submittedTo is missing
        const activeStep = workflow.find(w => w.status === 'Pending');
        if (activeStep?.assignedTo && typeof activeStep.assignedTo === 'object') {
            const name = `${activeStep.assignedTo.firstName || ''} ${activeStep.assignedTo.lastName || ''}`.trim();
            if (name) return name;
        }

        // 3. Fallback for stages
        const s = reward.rewardStatus;
        if (['Pending', 'Pending HR'].includes(s)) {
            // Find manager in workflow history or fallback to employee profile
            const managerStep = workflow.find(w => w.role === 'Manager');
            if (managerStep?.assignedTo?.firstName) return `${managerStep.assignedTo.firstName} ${managerStep.assignedTo.lastName || ''}`.trim();
            if (employee?.primaryReportee?.firstName) return `${employee.primaryReportee.firstName} ${employee.primaryReportee.lastName || ''}`.trim();
            return 'Reportee';
        }
        if (s === 'Pending Accounts') {
            const accStep = workflow.find(w => w.role === 'Accounts');
            if (accStep?.assignedTo?.firstName) return `${accStep.assignedTo.firstName} ${accStep.assignedTo.lastName || ''}`.trim();
            return reward.accountsHODName || 'Accounts Department';
        }
        if (s === 'Pending Authorization') {
            const mgtStep = workflow.find(w => w.role === 'Management' || w.role === 'CEO');
            if (mgtStep?.assignedTo?.firstName) return `${mgtStep.assignedTo.firstName} ${mgtStep.assignedTo.lastName || ''}`.trim();
            return reward.ceoName || 'Management';
        }

        return null;
    }, [reward, employee]);

    const canResubmit = useMemo(() => {
        if (!currentUser || !reward || reward.rewardStatus !== 'Rejected') return false;

        const workflow = reward.workflow || [];
        const currentUserId = String(currentUser._id || currentUser.id);

        // Find the most recent approved step
        const approvedSteps = workflow.filter(w => w.status === 'Approved');
        if (approvedSteps.length > 0) {
            const lastApprovedStep = approvedSteps[approvedSteps.length - 1];
            const lastApproverId = lastApprovedStep.assignedTo?._id || lastApprovedStep.assignedTo;
            return String(lastApproverId) === currentUserId;
        } else {
            // Rejected at first stage (Draft -> Pending -> Rejected)
            const creatorId = typeof reward.createdBy === 'object' ? reward.createdBy._id : reward.createdBy;
            return String(creatorId) === currentUserId;
        }
    }, [currentUser, reward]);

    const canPerformAction = () => {
        if (!currentUser || !employee || !reward) return false;

        // Portal super user only — Create Reward must NOT unlock Approve for every stage.
        const isPortalAdmin = isAdmin();
        const dept = (currentUser.department || '').toLowerCase();
        const desig = (currentUser.designation || '').toLowerCase();

        // CEO/Management Matches
        const isCEO = dept === 'management' && ['ceo', 'c.e.o', 'c.e.o.', 'director', 'managing director', 'general manager'].includes(desig);

        const status = reward.rewardStatus;
        const currentUserId = String(currentUser._id || currentUser.id);
        const assignedUserId = reward.submittedTo ? String(reward.submittedTo._id || reward.submittedTo) : null;
        const currentEmpObjectId = currentUser.employeeObjectId ? String(currentUser.employeeObjectId) : null;

        // Draft: creator (or portal admin) can send / edit — not every Create Reward user.
        if (status === 'Draft') {
            const creatorId = typeof reward.createdBy === 'object' ? reward.createdBy._id : reward.createdBy;
            return (
                isPortalAdmin ||
                currentUserId === String(creatorId) ||
                (currentUser.employeeId && reward.employeeId === currentUser.employeeId)
            );
        }

        if (isPortalAdmin) return true;

        // 1. Strict Assignment Check (current submittedTo)
        if (assignedUserId) {
            if (assignedUserId === currentUserId || (currentEmpObjectId && assignedUserId === currentEmpObjectId)) {
                return true;
            }
            // Someone else is assigned — do not fall through to role shortcuts.
            return false;
        }

        // 2. Strict Workflow Check
        if (reward.workflow && Array.isArray(reward.workflow)) {
            const pendingStep = reward.workflow.find(w => w.status === 'Pending');
            if (pendingStep && pendingStep.assignedTo) {
                const assignedWfId = String(pendingStep.assignedTo._id || pendingStep.assignedTo);
                if (assignedWfId === currentUserId || (currentEmpObjectId && assignedWfId === currentEmpObjectId)) {
                    return true;
                }
                return false;
            }
        }

        // 3. Status/Role Fallbacks only when no explicit assignee is set
        if (status === 'Pending') {
            const reportee = employee.primaryReportee;
            const userEmail = (currentUser.companyEmail || currentUser.email || '').trim().toLowerCase();

            if (reportee) {
                if (typeof reportee === 'object' && reportee.companyEmail) {
                    if (reportee.companyEmail.trim().toLowerCase() === userEmail) return true;
                } else if (typeof reportee === 'string') {
                    if (currentEmpObjectId && String(reportee) === currentEmpObjectId) return true;
                }
            }
        }

        if (status === 'Pending Authorization') {
            return isCEO;
        }

        if (status === 'Pending Accounts') {
            const deptLower = (currentUser.department || '').toLowerCase();
            return deptLower === 'finance' || deptLower === 'account' || deptLower === 'accounts';
        }

        return false;
    };

    const isRewardFullyApproved = () => {
        const status = String(reward?.rewardStatus || '').trim();
        return ['Approved', 'Approved (Paid)', 'Paid', 'Completed', 'Active'].includes(status);
    };

    /** After approval, only portal super user / system admin may edit the certificate. */
    const canEditCertificate = () => {
        if (!reward) return false;
        if (isRewardFullyApproved()) return isAdmin();
        return canPerformAction();
    };

    const getBtnLabel = () => {
        if (!reward) return "";
        const status = reward.rewardStatus;
        if (status === 'Draft') return "Send for Approval";
        return "Approve";
    };

    const getTargetStatus = () => {
        if (!reward) return "Approved";
        const status = reward.rewardStatus;
        const type = (reward.rewardType || '').toLowerCase();
        const isCashOrGift = type.includes('cash') || type.includes('gift');

        if (status === 'Draft') return "Pending";
        if (status === 'Pending') return isCashOrGift ? "Pending Accounts" : "Pending Authorization";
        if (status === 'Pending Accounts') return "Pending Authorization";
        if (status === 'Pending Authorization') return "Approved";
        return "Approved";
    };


    const generateCertificatePDF = async () => {
        const certificateElement = document.getElementById('certificate-container');
        if (!certificateElement) {
            console.error("DEBUG: Certificate element 'certificate-container' NOT FOUND in DOM");
            return null;
        }
        console.log("DEBUG: Certificate element found:", certificateElement.tagName, certificateElement.clientWidth, "x", certificateElement.clientHeight);

        try {
            // Collect all stylesheets
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

            // Use html2canvas with improved options
            const canvas = await html2canvas(certificateElement, {
                scale: 2,
                useCORS: true,
                logging: true, // Enable logging to see capture progress in console
                backgroundColor: '#ffffff',
                scrollY: -window.scrollY, // FIx for potential scrolling offset issues
                onclone: (clonedDoc) => {
                    // Inject sanitized CSS
                    const styleTag = clonedDoc.createElement('style');
                    styleTag.innerHTML = safeCss;
                    clonedDoc.head.appendChild(styleTag);

                    // Ensure clone is visible
                    const clonedElement = clonedDoc.getElementById('certificate-container');
                    if (clonedElement) {
                        clonedElement.style.display = 'flex';
                    }
                },
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', 'a4');
            pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
            return pdf;

        } catch (err) {
            console.error("PDF generation error:", err);
            toast({
                variant: 'destructive',
                title: "Error",
                description: "Failed to generate certificate PDF",
            });
            return null;
        }
    };


    const executeStatusUpdate = async (status) => {
        try {
            setActionLoading(true);

            let finalStatus = status;
            const currentStatus = reward?.rewardStatus;

            const type = (reward?.rewardType || '').toLowerCase();
            const isCashOrGift = type.includes('cash') || type.includes('gift');

            // Logic Upgrade: Simplified Flow (Draft -> Pending -> Pending Authorization -> Approved)
            if (status === 'Approved') {
                if (currentStatus === 'Pending') {
                    if (isCashOrGift) {
                        finalStatus = 'Pending Accounts';
                    } else {
                        finalStatus = 'Pending Authorization';
                    }
                } else if (currentStatus === 'Pending Accounts') {
                    finalStatus = 'Pending Authorization';
                } else if (currentStatus === 'Pending Authorization') {
                    finalStatus = 'Approved';
                }
            } else if (status === 'Rejected') {
                finalStatus = 'Rejected';
            } else if (status === 'Cancelled') {
                finalStatus = 'Cancelled';
            }

            console.log(`DEBUG: executing status update: ${currentStatus} -> ${finalStatus}`);

            // Determine if we should generate PDF
            // Legacy Logic Removed for Backend Puppeteer Generation
            const isSuperUser = isAdmin();
            const dept = (currentUser?.department || '').toLowerCase();
            const desig = (currentUser?.designation || '').toLowerCase();
            const isCEO = dept === 'management' && ['ceo', 'c.e.o', 'c.e.o.', 'director', 'managing director', 'general manager'].includes(desig);

            const shouldGeneratePDF = finalStatus === 'Approved' || (status === 'Approved' && (isSuperUser || isCEO));

            console.log(`DEBUG: Status Update. Action: ${status}, Current: ${currentStatus}, Target: ${finalStatus}`);

            let certificatePdf = null;

            if (shouldGeneratePDF) {
                console.log("DEBUG: Generating PDF for approval...");
                try {
                    // Introduce a small delay to ensure rendering
                    await new Promise(resolve => setTimeout(resolve, 500));

                    const pdf = await generateCertificatePDF();
                    if (pdf) {
                        certificatePdf = pdf.output('datauristring').split(',')[1];
                        console.log("DEBUG: PDF Generated successfully. Length:", certificatePdf.length);
                    } else {
                        throw new Error("PDF object is null");
                    }
                } catch (genErr) {
                    console.error("DEBUG: Critical PDF Generation Error:", genErr);
                    toast({
                        variant: 'destructive',
                        title: "Error",
                        description: "Failed to generate certificate PDF. Status update aborted. Please check console."
                    });
                    setActionLoading(false);
                    return; // STOP EXECUTION - Do not update status without PDF
                }
            }

            if (status === 'Rejected' && (!rejectionReason || rejectionReason.trim().length === 0)) {
                toast({
                    variant: 'destructive',
                    title: "Reason Required",
                    description: "Please provide a reason for rejection."
                });
                setActionLoading(false);
                return;
            }

            console.log("DEBUG: Sending payload to backend with certificatePdf:", !!certificatePdf);

            const updatePayload = {
                ...reward,
                rewardStatus: finalStatus,
                remarks: finalStatus === 'Rejected' ? rejectionReason : reward.remarks,
                certificatePdf // Send Base64 PDF to backend
            };

            const approverId = currentUser.id || currentUser._id;
            if (approverId) {
                if (status === 'Approved') {
                    // Approving logic based on current status
                    if (currentStatus === 'Pending Authorization') {
                        updatePayload.approvedBy = approverId;
                    }
                }
            }

            await axiosInstance.put(`/Reward/${reward._id}`, updatePayload);
            toast({
                title: "Success",
                description: `Reward ${finalStatus === 'Pending Authorization' ? 'authorized' : finalStatus.toLowerCase()} successfully`,
            });
            fetchData();
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: "Error",
                description: "Failed to update status",
            });
        } finally {
            setActionLoading(false);
            setIsAlertOpen(false); // Close alert
        }
    };

    const handleUpdateStatus = (status) => {
        setPendingStatus(status);
        setRejectionReason('');
        setIsAlertOpen(true);
    };



    // Name formatting logic
    const rawName = (employee ? `${employee.firstName} ${employee.lastName}` : '') || reward?.employeeName || '';
    const formattedName = rawName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    const prefix = employee?.gender?.toLowerCase() === 'male' ? 'Mr. ' : (employee?.gender?.toLowerCase() === 'female' ? 'Ms. ' : '');

    // Helper function for consistent Title Case
    const toTitleCase = (str) => {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const formatDate = (value) => {
        if (!value) return '—';
        try {
            return format(new Date(value), 'dd MMM yyyy');
        } catch {
            return '—';
        }
    };

    // Sync state with fetching data
    // Sync state with fetching data
    useEffect(() => {
        const updateSigners = async () => {
            if (reward) {
                setCertLoading(true);
                // Remove editableTitle and editableName state management
                // setEditableTitle(reward.title || '');
                setHeaderText(reward.certHeader || 'Certificate');
                setSubHeaderText(reward.certSubHeader || 'Of Appreciation');
                setPresentationText(reward.certPresentationText || 'This certificate is presented to');

                // Dynamic Signer 1: Prefer Primary Reportee (Manager)
                let defaultSignerName = 'Nivil Ali';
                let defaultSignerTitle = 'Managing Director';

                if (employee?.primaryReportee) {
                    let rep = employee.primaryReportee;

                    // If it's just an ID, we need to fetch the details
                    if (typeof rep === 'string') {
                        try {
                            const repRes = await axiosInstance.get(`/Employee/${rep}`);
                            rep = repRes.data.employee || repRes.data;
                        } catch (err) {
                            console.warn("Failed to fetch primary reportee details:", err);
                            rep = null;
                        }
                    }

                    if (rep) {
                        const repName = `${rep.firstName || ''} ${rep.lastName || ''}`.trim();
                        if (repName) defaultSignerName = toTitleCase(repName);
                        if (rep.designation) defaultSignerTitle = rep.designation;
                    }
                }

                setSigner1Name((reward.certSigner1Name && reward.certSigner1Name !== 'Nivil Ali') ? reward.certSigner1Name : defaultSignerName);
                setSigner1Title((reward.certSigner1Title && reward.certSigner1Title !== 'Managing Director') ? reward.certSigner1Title : defaultSignerTitle);

                setSigner2Name(reward.certSigner2Name || 'Raseel Muhammad');
                setSigner2Title(reward.certSigner2Title || 'CEO');

                setCertLoading(false);
            }
        };

        updateSigners();
    }, [reward, employee, rawName, prefix]);

    const handleDownloadCertificate = async () => {
        try {
            const pdf = await generateCertificatePDF();
            if (pdf) {
                pdf.save(`${rawName || 'Certificate'}.pdf`);
                toast({
                    title: "Success",
                    description: "Certificate downloaded successfully",
                });
            }
        } catch (error) {
            console.error("Download Error:", error);
        }
    };

    // --- Profile Cards Logic ---
    const tenure = calculateTenure(employee?.dateOfJoining || employee?.contractJoiningDate);
    // Calculate expiry days for status items
    const visaDays = calculateDaysUntilExpiry(employee?.visaDetails?.employment?.expiryDate || employee?.visaDetails?.spouse?.expiryDate || employee?.visaDetails?.visit?.expiryDate);
    const passportDays = calculateDaysUntilExpiry(employee?.passportDetails?.expiryDate);
    const eidDays = calculateDaysUntilExpiry(employee?.emiratesIdDetails?.expiryDate);
    const labourCardDays = calculateDaysUntilExpiry(employee?.labourCardDetails?.expiryDate);
    const medDays = calculateDaysUntilExpiry(employee?.medicalInsuranceDetails?.expiryDate);
    const drivingLicenseDays = calculateDaysUntilExpiry(employee?.drivingLicenseDetails?.expiryDate);

    // Helper to format expiry text
    const getExpiryText = (label, days) => {
        if (days < 0) {
            return `${label} Expired ${Math.abs(days)} days ago`;
        }
        return `${label} Expires in ${days} days`;
    };

    const statusItems = [];
    if (tenure) {
        statusItems.push({
            type: 'tenure',
            text: `${formatDurationParts(tenure)} in VITS`
        });
    }
    if (visaDays !== null && visaDays !== undefined) {
        statusItems.push({ type: 'visa', text: getExpiryText('Visa', visaDays), color: getExpiryColor(visaDays) });
    }
    if (passportDays !== null && passportDays !== undefined) {
        statusItems.push({ type: 'passport', text: getExpiryText('Passport', passportDays), color: getExpiryColor(passportDays) });
    }
    if (eidDays !== null && eidDays !== undefined) {
        statusItems.push({ type: 'eid', text: getExpiryText('Emirates ID', eidDays), color: getExpiryColor(eidDays, 30) });
    }
    if (labourCardDays !== null && labourCardDays !== undefined) {
        statusItems.push({ type: 'labourCard', text: getExpiryText('Labour Card', labourCardDays), color: getExpiryColor(labourCardDays) });
    }
    if (medDays !== null && medDays !== undefined) {
        statusItems.push({ type: 'medical', text: getExpiryText('Medical Insurance', medDays), color: getExpiryColor(medDays) });
    }
    if (drivingLicenseDays !== null && drivingLicenseDays !== undefined) {
        statusItems.push({ type: 'drivingLicense', text: getExpiryText('Driving License', drivingLicenseDays), color: getExpiryColor(drivingLicenseDays) });
    }

    // Removed handleSaveInline as it is no longer needed

    if (loading || (reward && certLoading)) {
        return (
            <div className="flex min-h-screen w-full bg-[#F2F6F9] items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen w-full bg-[#F2F6F9] p-8">
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200 w-full text-center">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#F2F6F9]">
            {/* Font Import for Certificate */}
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&display=swap');
                

            `}</style>

            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 w-full max-w-full print:hidden">
                <Navbar />

                <div className="p-3 sm:p-5 lg:p-8 w-full mx-auto space-y-4 sm:space-y-6">
                    {/* Back Button Header */}
                    <div className="w-full flex items-center justify-between mb-2 print:hidden">
                        <ListReturnBackButton onNavigate={handleListReturnBack} />
                    </div>

                    {/* Top Grid: Profile + Action Card — Fine-style header */}
                    <div className="flex flex-col xl:flex-row gap-3 sm:gap-4 lg:gap-6 w-full mb-4 sm:mb-6 lg:mb-8 print:hidden items-stretch">
                        {/* Left Column: Profile & Stats */}
                        <div className={`flex-1 min-w-0 ${HEADER_PAIR_CARD_FIXED}`}>
                    {employee && (
                                <div className="w-full h-full min-h-0">
                                    <ProfileHeader
                                        employee={employee}
                                        hideProgressBar={true}
                                        hideStatusToggle={true}
                                        hideRole={true}
                                        hideContactNumber={true}
                                        hideEmail={true}
                                        enlargeProfilePic={false}
                                        showNameUnderProfilePic={true}
                                        hideEmployeeStatus={true}
                                        imageError={imageError}
                                        setImageError={setImageError}
                                        subtitle={reward?.rewardId}
                                        statusLabel={null}
                                        stackProfileWithExtra={false}
                                        extraContent={(
                                            <div className="mt-3 space-y-3 w-full">
                                                <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full min-w-0">
                                                    <div className="bg-blue-50 p-2 rounded-lg border border-blue-100 flex items-center justify-between gap-1 px-2 sm:px-3 min-w-0">
                                                        <span className="text-[10px] text-blue-600 font-medium uppercase tracking-wide break-words leading-tight min-w-0">Total Count</span>
                                                        <span className="text-sm sm:text-lg font-bold text-blue-800 shrink-0 tabular-nums">{rewardStats.totalCount || 0}</span>
                                                    </div>
                                                    <div className="bg-green-50 p-2 rounded-lg border border-green-100 flex items-center justify-between gap-1 px-2 sm:px-3 min-w-0">
                                                        <span className="text-[10px] text-green-600 font-medium uppercase tracking-wide break-words leading-tight min-w-0">Cash</span>
                                                        <span className="text-sm sm:text-lg font-bold text-green-800 shrink-0 tabular-nums">{rewardStats.cashCount || 0}</span>
                                            </div>
                                                    <div className="bg-purple-50 p-2 rounded-lg border border-purple-100 flex items-center justify-between gap-1 px-2 sm:px-3 min-w-0">
                                                        <span className="text-[10px] text-purple-600 font-medium uppercase tracking-wide break-words leading-tight min-w-0">Gift</span>
                                                        <span className="text-sm sm:text-lg font-bold text-purple-800 shrink-0 tabular-nums">{rewardStats.giftCount || 0}</span>
                                        </div>
                                                    <div className="bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-center justify-between gap-1 px-2 sm:px-3 min-w-0">
                                                        <span className="text-[10px] text-amber-600 font-medium uppercase tracking-wide break-words leading-tight min-w-0">Certificate</span>
                                                        <span className="text-sm sm:text-lg font-bold text-amber-800 shrink-0 tabular-nums">{rewardStats.certificateCount || 0}</span>
                                                    </div>
                                                    <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 flex items-center justify-between gap-1 px-2 sm:px-3 min-w-0">
                                                        <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wide break-words leading-tight min-w-0">Other</span>
                                                        <span className="text-sm sm:text-lg font-bold text-gray-800 shrink-0 tabular-nums">{rewardStats.otherCount || 0}</span>
                                                    </div>
                                                    <div className="bg-teal-50 p-2 rounded-lg border border-teal-100 flex items-center justify-between gap-1 px-2 sm:px-3 min-w-0">
                                                        <span className="text-[10px] text-teal-600 font-medium uppercase tracking-wide break-words leading-tight min-w-0">Total Amount</span>
                                                        <span className="text-sm sm:text-lg font-bold text-teal-800 shrink-0 tabular-nums">{(rewardStats.totalAmount || 0).toLocaleString()}</span>
                                                    </div>
                                            </div>

                                            {(() => {
                                                const s = reward?.rewardStatus;
                                                    if (['Approved', 'Approved (Paid)', 'Rejected', 'Cancelled'].includes(s)) return null;

                                                let label = '';
                                                if (s === 'Draft') label = 'Waiting for Requester';
                                                    else if (waitingForName) label = `Waiting for ${waitingForName}`;
                                                    else if (s) label = `Waiting for ${s}`;

                                                if (!label) return null;

                                                return (
                                                        <div className="w-full">
                                                            <span className="text-[11px] font-black uppercase tracking-wider px-4 py-2.5 rounded-lg border shadow-sm w-full block text-center bg-amber-50 text-amber-700 border-amber-200">
                                                            {label}
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        )}
                                    />
                                </div>
                            )}
                                    </div>

                        {/* Right Column: Action Card — Fine-style compact boxes */}
                        <div className={`flex-1 min-w-0 ${HEADER_PAIR_CARD_FIXED}`}>
                            <div className="bg-white rounded-lg shadow-sm p-4 w-full h-full flex flex-col overflow-hidden">
                                                {(() => {
                                    const status = reward?.rewardStatus;
                                    const isDraft = status === 'Draft';
                                    const isApprovedState = ['Approved', 'Approved (Paid)', 'Paid', 'Completed'].includes(status);
                                    const isFinalized = isApprovedState || status === 'Rejected' || status === 'Cancelled';
                                    const totalAmount = Number(reward?.amount || 0);
                                    const paidAmount = Number(reward?.paidAmount || 0);
                                    const remainingAmount = Math.max(0, totalAmount - paidAmount);
                                    const awaitingPay = isRewardPaymentEligible(reward);
                                    const compactBox = 'p-2 rounded-lg border flex items-center justify-between px-4 min-h-[44px] transition-all break-words gap-2';
                                    const statusLabel = formatRewardStatusLabel(status, reward?.rewardType);
                                    const paymentLabel = formatRewardPaymentLabel(reward);

                                    const statusBoxClass =
                                        isApprovedState ? 'bg-green-50 border-green-100 text-green-700' :
                                        status === 'Rejected' ? 'bg-red-50 border-red-100 text-red-700' :
                                        status === 'Cancelled' ? 'bg-gray-50 border-gray-100 text-gray-700' :
                                        'bg-yellow-50 border-yellow-100 text-yellow-700';

                                    const cells = [];

                                    if (!isApprovedState) {
                                        cells.push(
                                            <div key="status" className={`${compactBox} ${statusBoxClass}`}>
                                                <span className="text-[10px] font-medium uppercase tracking-wide truncate opacity-80">Current Status</span>
                                                <span className="text-sm font-bold truncate ml-2">{statusLabel || 'Unknown'}</span>
                                            </div>
                                        );
                                    }

                                    cells.push(
                                        <button
                                            key="download"
                                            type="button"
                                            onClick={handleDownloadCertificate}
                                            className={`${compactBox} border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100`}
                                        >
                                            <span className="text-[10px] font-medium uppercase tracking-wide truncate">Download PDF</span>
                                            <Download className="w-5 h-5 shrink-0" />
                                        </button>
                                    );

                                    if (isApprovedState) {
                                        if (totalAmount > 0) {
                                            cells.push(
                                                <div key="total" className={`${compactBox} bg-red-50 border-red-100`}>
                                                    <span className="text-[10px] text-red-600 font-medium uppercase tracking-wide truncate">Total</span>
                                                    <span className="text-lg font-bold text-red-800 tabular-nums ml-2">{totalAmount.toLocaleString()}</span>
                                                </div>,
                                                <div key="paid" className={`${compactBox} bg-green-50 border-green-100`}>
                                                    <span className="text-[10px] text-green-600 font-medium uppercase tracking-wide truncate">Paid</span>
                                                    <span className="text-lg font-bold text-green-800 tabular-nums ml-2">{paidAmount.toLocaleString()}</span>
                                                </div>,
                                                <div key="remaining" className={`${compactBox} bg-amber-50 border-amber-100`}>
                                                    <span className="text-[10px] text-amber-600 font-medium uppercase tracking-wide truncate">Remaining</span>
                                                    <span className="text-lg font-bold text-amber-800 tabular-nums ml-2">{remainingAmount.toLocaleString()}</span>
                                                                            </div>
                                            );
                                        }
                                        cells.push(
                                            <div key="done" className={`${compactBox} bg-gray-50 border-gray-100 text-gray-400 opacity-70`}>
                                                <span className="text-[10px] font-medium uppercase tracking-wide truncate">Workflow</span>
                                                <span className="text-sm font-bold flex items-center gap-1 ml-2">
                                                    <Check className="w-4 h-4" /> {awaitingPay ? 'Awaiting Pay' : 'Completed'}
                                                                                                </span>
                                                                                            </div>
                                        );
                                        if (paymentLabel !== '—') {
                                            const paymentPaid = paymentLabel === 'Paid';
                                            cells.push(
                                                <div
                                                    key="payment-status"
                                                    className={`${compactBox} ${paymentPaid ? 'bg-green-50 border-green-100 text-green-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}
                                                >
                                                    <span className="text-[10px] font-medium uppercase tracking-wide truncate opacity-80">Payment</span>
                                                    <span className="text-sm font-bold truncate ml-2">{paymentLabel}</span>
                                                </div>
                                            );
                                        }
                                    } else if (status === 'Rejected' && canResubmit) {
                                        cells.push(
                                            <button key="resubmit" type="button" onClick={() => setIsResubmittingModal(true)} className={`${compactBox} border-orange-100 bg-orange-50 text-orange-600 hover:bg-orange-100`}>
                                                <span className="text-[10px] font-medium uppercase tracking-wide">Edit & Resubmit</span>
                                                <Edit className="w-5 h-5 shrink-0" />
                                            </button>
                                        );
                                    } else if (canPerformAction()) {
                                        if (isDraft) {
                                            cells.push(
                                                <button key="submit" type="button" onClick={() => handleUpdateStatus(getTargetStatus())} className={`${compactBox} border-green-100 bg-green-50 text-green-600 hover:bg-green-100`}>
                                                    <span className="text-[10px] font-medium uppercase tracking-wide truncate">Send for Approval</span>
                                                    <Send className="w-5 h-5 shrink-0" />
                                                </button>,
                                                <button key="cancel" type="button" onClick={() => handleUpdateStatus('Cancelled')} className={`${compactBox} border-red-100 bg-red-50 text-red-600 hover:bg-red-100`}>
                                                    <span className="text-[10px] font-medium uppercase tracking-wide truncate">Cancel</span>
                                                    <Trash2 className="w-5 h-5 shrink-0" />
                                                </button>
                                            );
                                        } else {
                                            cells.push(
                                                <button key="approve" type="button" onClick={() => handleUpdateStatus(getTargetStatus())} className={`${compactBox} border-green-100 bg-green-50 text-green-600 hover:bg-green-100`}>
                                                    <span className="text-[10px] font-medium uppercase tracking-wide truncate">{getBtnLabel()}</span>
                                                    <Check className="w-5 h-5 shrink-0" />
                                                </button>,
                                                <button key="reject" type="button" onClick={() => handleUpdateStatus('Rejected')} className={`${compactBox} border-red-100 bg-red-50 text-red-600 hover:bg-red-100`}>
                                                    <span className="text-[10px] font-medium uppercase tracking-wide truncate">Reject</span>
                                                    <X className="w-5 h-5 shrink-0" />
                                                </button>
                                            );
                                        }
                                        while (cells.length < 6) {
                                            cells.push(
                                                <div key={`lock-${cells.length}`} className={`${compactBox} bg-gray-50 border-gray-100 text-gray-400 opacity-50`}>
                                                    <span className="text-[10px] font-medium uppercase tracking-wide truncate">Pending</span>
                                                    <Lock className="w-4 h-4 shrink-0" />
                                                                    </div>
                                                                );
                                        }
                                    } else if (isFinalized) {
                                        cells.push(
                                            <div key="done-a" className={`${compactBox} bg-gray-50 border-gray-100 text-gray-400 opacity-70`}>
                                                <span className="text-[10px] font-medium uppercase tracking-wide">Workflow</span>
                                                <span className="text-sm font-bold flex items-center gap-1"><Check className="w-4 h-4" /> Completed</span>
                                                        </div>
                                                    );
                                    } else {
                                        while (cells.length < 6) {
                                            cells.push(
                                                <div key={`lock-all-${cells.length}`} className={`${compactBox} bg-gray-50 border-gray-100 text-gray-400 opacity-50`}>
                                                    <span className="text-[10px] font-medium uppercase tracking-wide truncate">Locked</span>
                                                    <Lock className="w-4 h-4 shrink-0" />
                                            </div>
                                            );
                                        }
                                    }

                                    while (cells.length < 6) {
                                        cells.push(
                                            <div key={`pad-${cells.length}`} className={`${compactBox} bg-gray-50 border-gray-100 text-gray-300 opacity-40`}>
                                                <span className="text-[10px]">—</span>
                                                <span>—</span>
                                            </div>
                                                );
                                            }

                                            return (
                                        <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full min-w-0 shrink-0">
                                            {cells.slice(0, 6)}
                                                    </div>
                                            );
                                        })()}
                            </div>
                        </div>
                                    </div>

                    {/* Tabs: Reward Details | Edit Certificate | Attachment */}
                    <div className="w-full flex items-center border-b border-gray-200 mb-6 print:hidden">
                                            <button
                            type="button"
                            onClick={() => setActiveTab('rewardDetails')}
                            className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all duration-200 ${
                                activeTab === 'rewardDetails'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            Reward Details
                                            </button>
                        {canEditCertificate() && (
                                                    <button
                                type="button"
                                onClick={() => setShowCertEditModal(true)}
                                className="py-3 px-6 text-sm font-semibold border-b-2 border-transparent text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all duration-200 flex items-center gap-1.5"
                            >
                                <FileText className="w-4 h-4" />
                                Edit Certificate
                                                    </button>
                        )}
                                                    <button
                            type="button"
                            onClick={() => setActiveTab('attachments')}
                            className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all duration-200 flex items-center gap-1.5 ${
                                activeTab === 'attachments'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <Paperclip className="w-4 h-4" />
                            Attachment
                                                    </button>
                                                </div>

                    <div className={`w-full ${activeTab === 'rewardDetails' ? 'block' : 'hidden'}`}>
                        <RewardFormCards
                            reward={reward}
                            employee={employee}
                            formatDate={formatDate}
                            onPaymentSuccess={() => fetchData()}
                        />
                                </div>

                    <div
                        className={
                            activeTab === 'attachments'
                                ? 'w-full block'
                                : 'fixed -left-[9999px] top-0 opacity-0 pointer-events-none w-[900px]'
                        }
                        aria-hidden={activeTab !== 'attachments'}
                    >
                        <RewardAttachmentTab
                            reward={reward}
                            employeeDisplayName={toTitleCase(`${prefix}${rawName}`)}
                            headerText={headerText}
                            subHeaderText={subHeaderText}
                            presentationText={presentationText}
                            signer1Name={signer1Name}
                            signer1Title={signer1Title}
                            signer2Name={signer2Name}
                            signer2Title={signer2Title}
                            onDownloadCertificate={handleDownloadCertificate}
                            downloading={actionLoading}
                                    />
                                </div>
                                    </div>
                                </div>

            {/* Edit Modal (resubmit from header) */}
            <AddRewardModal
                isOpen={showEditModal || isResubmittingModal}
                onClose={() => { setShowEditModal(false); setIsResubmittingModal(false); }}
                onSuccess={() => fetchData()}
                employees={allEmployees}
                initialData={reward}
                isEditing={showEditModal}
                isResubmitting={isResubmittingModal}
            />

            <CertificateEditModal
                isOpen={showCertEditModal}
                onClose={() => setShowCertEditModal(false)}
                onSuccess={() => fetchData()}
                initialData={reward}
                employees={allEmployees}
            />

            {/* Confirmation Alert */}
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingStatus === 'Pending'
                                ? "Are you sure you want to submit for approval to reportee?"
                                : pendingStatus === 'Approved' && reward?.rewardStatus === 'Pending'
                                    ? "This will verify the reward and send it to Management for final authorization."
                                    : pendingStatus === 'Approved' && reward?.rewardStatus === 'Pending Authorization'
                                        ? "This will finalize and approve the reward. A certificate will be generated."
                                        : pendingStatus === 'Rejected'
                                            ? "This will permanently reject the reward request."
                                            : `Are you sure you want to ${pendingStatus?.toLowerCase()} this reward?`
                            }
                        </AlertDialogDescription>
                        {pendingStatus === 'Rejected' && (
                            <div className="mt-4 space-y-2 text-left">
                                <label className="text-sm font-semibold text-gray-700">Rejection Reason <span className="text-red-500">*</span></label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Please provide a reason for rejection (Remarks)..."
                                    className="w-full min-h-[100px] p-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                    required
                                />
                            </div>
                        )}
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                if (pendingStatus === 'Rejected' && (!rejectionReason || rejectionReason.trim().length === 0)) {
                                    e.preventDefault();
                                    toast({
                                        variant: 'destructive',
                                        title: "Reason Required",
                                        description: "Please enter a reason for rejection.",
                                    });
                                    return;
                                }
                                executeStatusUpdate(pendingStatus);
                            }}
                            className={pendingStatus === 'Rejected' ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'}
                        >
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Continue
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
