'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import { useToast } from "@/hooks/use-toast";
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
import EmploymentSummary from '../../../emp/[employeeId]/components/EmploymentSummary';
import { calculateDaysUntilExpiry, calculateTenure, getExpiryColor } from '../../../emp/[employeeId]/utils/helpers';
import { Download, Check, X, Edit, Loader2, ChevronDown, Award, FileText, Lock } from 'lucide-react';
import CertificateEditModal from '../components/CertificateEditModal';

export default function RewardDetailsPage({ params }) {
    const { id } = use(params);
    const router = useRouter();
    const { toast } = useToast();

    const [reward, setReward] = useState(null);
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [allEmployees, setAllEmployees] = useState([]); // Needed for Edit Modal

    // New State for Certificate Edit
    const [showCertEditModal, setShowCertEditModal] = useState(false);
    const [showEditDropdown, setShowEditDropdown] = useState(false);
    // Ref for dropdown click outside
    const dropdownRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowEditDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
                                    lastName: emp.lastName
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
        certificateCount: 0
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
                            const type = (r.rewardType || '').toLowerCase();
                            if (type === 'cash') acc.cashCount++;
                            else if (type === 'gift') acc.giftCount++;
                            else if (type === 'certificate' || type === 'appreciation') acc.certificateCount++;
                            return acc;
                        }, { totalCount: 0, cashCount: 0, giftCount: 0, certificateCount: 0 });
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

    const canPerformAction = () => {
        if (!currentUser || !employee || !reward) return false;

        const isAdmin = currentUser.role === 'Admin' || currentUser.isAdmin || (currentUser.permissions && currentUser.permissions.HRM?.Reward?.edit);
        const dept = (currentUser.department || '').toLowerCase();
        const desig = (currentUser.designation || '').toLowerCase();

        // CEO/Management Matches
        const isCEO = dept === 'management' && ['ceo', 'c.e.o', 'c.e.o.', 'director', 'managing director', 'general manager'].includes(desig);

        const status = reward.rewardStatus;
        const currentUserId = currentUser._id || currentUser.id;
        const assignedUserId = reward.submittedTo;

        console.log(`[PermissionDebug] User: ${currentUser.firstName}, Status: ${status}, AssignedTo: ${assignedUserId}`);

        // Handle Draft State: Creator can edit/cancel
        if (status === 'Draft') {
            const creatorId = typeof reward.createdBy === 'object' ? reward.createdBy._id : reward.createdBy;
            // Creator or Admin
            return currentUserId === creatorId || (currentUser.employeeId && reward.employeeId === currentUser.employeeId) || isAdmin;
        }

        if (status === 'Pending') {
            // STRICT: Must match assigned user
            if (assignedUserId) {
                return assignedUserId === currentUserId;
            }

            // Fallback: Reportee Check
            const reportee = employee.primaryReportee;
            const userEmail = (currentUser.companyEmail || currentUser.email || '').trim().toLowerCase();
            if (reportee && typeof reportee === 'object' && reportee.companyEmail) {
                return reportee.companyEmail.trim().toLowerCase() === userEmail;
            }
        }

        if (status === 'Pending Authorization') {
            // STRICT: Must match assigned user
            if (assignedUserId) {
                return assignedUserId === currentUserId;
            }

            // Fallback: CEO Role
            return isCEO;
        }

        return false;
    };

    const getBtnLabel = () => {
        if (!reward) return "";
        const status = reward.rewardStatus;
        if (status === 'Draft') return "Send for Approval";
        if (status === 'Pending') return "Send to CEO";
        if (status === 'Pending Authorization') return "CEO Authorize";
        return "Approve";
    };

    const getTargetStatus = () => {
        if (!reward) return "Approved";
        const status = reward.rewardStatus;
        if (status === 'Draft') return "Pending";
        if (status === 'Pending') return "Pending Authorization";
        if (status === 'Pending Authorization') return "Approved";
        return "Approved";
    };


    const generateCertificatePDF = async () => {
        const certificateElement = document.getElementById('certificate-container');
        if (!certificateElement) return null;

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

            // Use html2canvas
            const canvas = await html2canvas(certificateElement, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc) => {
                    // Inject sanitized CSS
                    const styleTag = clonedDoc.createElement('style');
                    styleTag.innerHTML = safeCss;
                    clonedDoc.head.appendChild(styleTag);
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

            // Logic Upgrade: Simplified Flow (Draft -> Pending -> Pending Authorization -> Approved)
            if (status === 'Approved') {
                if (currentStatus === 'Pending') {
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

            let certificatePdf = null;

            // Generate PDF only if finally approving
            if (finalStatus === 'Approved') {
                console.log("DEBUG: Status is Approved. Generating PDF...");
                const pdf = await generateCertificatePDF();
                if (pdf) {
                    // Get base64 string without data URI prefix
                    certificatePdf = pdf.output('datauristring').split(',')[1];
                    console.log("DEBUG: PDF Generated successfully. Length:", certificatePdf.length);
                } else {
                    console.warn("DEBUG: PDF generation failed or returned null.");
                }
            }

            console.log("DEBUG: Sending payload to backend with certificatePdf:", !!certificatePdf);

            const updatePayload = {
                ...reward,
                rewardStatus: finalStatus,
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
        setIsAlertOpen(true);
    };



    // Name formatting logic
    const rawName = reward?.employeeName || (employee ? `${employee.firstName} ${employee.lastName}` : '');
    const formattedName = rawName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    const prefix = employee?.gender?.toLowerCase() === 'male' ? 'Mr. ' : (employee?.gender?.toLowerCase() === 'female' ? 'Ms. ' : '');

    // Helper function for consistent Title Case
    const toTitleCase = (str) => {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    // Sync state with fetching data
    // Sync state with fetching data
    useEffect(() => {
        const updateSigners = async () => {
            if (reward) {
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

                /* Removed setEditableName logic as it's no longer editable inline
                if (reward.employeeName) {
                    setEditableName(toTitleCase(reward.employeeName));
                } else if (rawName) {
                    setEditableName(`${prefix}${toTitleCase(rawName)}`);
                }
                */
            }
        };

        updateSigners();
    }, [reward, employee, rawName, prefix]);

    const handleDownloadCertificate = async () => {
        try {
            const pdf = await generateCertificatePDF();
            if (pdf) {
                pdf.save(`${reward?.employeeName || 'Certificate'}.pdf`);
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
            text: `${tenure.years} Years ${tenure.months} Months in VITS`
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

    if (loading) {
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

                <div className="p-6 md:p-8 w-full mx-auto space-y-6">
                    {/* Profile Cards */}
                    {employee && (
                        <div className="flex flex-row gap-6 mb-8 print:hidden w-full items-stretch">
                            <div className="flex-1">
                                <ProfileHeader
                                    employee={employee}
                                    hideProgressBar={true}
                                    hideStatusToggle={true}
                                    hideRole={true}
                                    hideContactNumber={true}
                                    hideEmail={true}
                                    enlargeProfilePic={false}
                                    showNameUnderProfilePic={true}
                                    extraContent={(
                                        <div className="mt-4 grid grid-cols-2 gap-3">
                                            <div className="bg-blue-50 p-2 rounded-lg border border-blue-100 text-center flex items-center justify-between px-4">
                                                <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide truncate">Total</p>
                                                <p className="text-lg font-bold text-blue-800">{rewardStats?.totalCount || 0}</p>
                                            </div>
                                            <div className="bg-green-50 p-2 rounded-lg border border-green-100 text-center flex items-center justify-between px-4">
                                                <p className="text-[10px] text-green-600 font-medium uppercase tracking-wide truncate">Cash</p>
                                                <p className="text-lg font-bold text-green-800">{rewardStats?.cashCount || 0}</p>
                                            </div>
                                            <div className="bg-purple-50 p-2 rounded-lg border border-purple-100 text-center flex items-center justify-between px-4">
                                                <p className="text-[10px] text-purple-600 font-medium uppercase tracking-wide truncate">Gift</p>
                                                <p className="text-lg font-bold text-purple-800">{rewardStats?.giftCount || 0}</p>
                                            </div>
                                            <div className="bg-orange-50 p-2 rounded-lg border border-orange-100 text-center flex items-center justify-between px-4">
                                                <p className="text-[10px] text-orange-600 font-medium uppercase tracking-wide truncate">Cert</p>
                                                <p className="text-lg font-bold text-orange-800">{rewardStats?.certificateCount || 0}</p>
                                            </div>
                                        </div>
                                    )}
                                />
                            </div>

                            <div className="flex-1 h-full">
                                {/* Reward Action Card */}
                                <div className="bg-white rounded-lg shadow-sm p-6 h-full flex flex-col relative overflow-hidden">
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        {/* 1. Status Box */}
                                        <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center gap-2 ${reward?.rewardStatus === 'Approved' ? 'bg-green-50 border-green-100 text-green-700' :
                                            reward?.rewardStatus === 'Rejected' ? 'bg-red-50 border-red-100 text-red-700' :
                                                reward?.rewardStatus === 'Cancelled' ? 'bg-gray-50 border-gray-100 text-gray-700' :
                                                    'bg-yellow-50 border-yellow-100 text-yellow-700'
                                            }`}>
                                            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Current Status</span>
                                            <span className="text-lg font-bold">{reward?.rewardStatus || 'Unknown'}</span>
                                        </div>

                                        {/* 2. Download Action */}
                                        <button
                                            onClick={handleDownloadCertificate}
                                            className="p-4 rounded-xl border border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all flex flex-col items-center justify-center gap-2"
                                        >
                                            <Download className="w-6 h-6" />
                                            <span className="text-sm font-bold">Download PDF</span>
                                        </button>

                                        {/* 3. Approve/Action Button & 4. Reject/Cancel Button */}
                                        {(() => {
                                            const status = reward?.rewardStatus;
                                            if (status === 'Approved' || status === 'Rejected' || status === 'Cancelled') {
                                                return (
                                                    <>
                                                        <div className="p-4 rounded-xl border bg-gray-50 border-gray-100 text-gray-400 flex flex-col items-center justify-center gap-2 opacity-60 cursor-not-allowed">
                                                            <Check className="w-6 h-6" />
                                                            <span className="text-sm font-bold">Completed</span>
                                                        </div>
                                                        <div className="p-4 rounded-xl border bg-gray-50 border-gray-100 text-gray-400 flex flex-col items-center justify-center gap-2 opacity-50">
                                                            <X className="w-6 h-6" />
                                                            <span className="text-sm font-bold">{status}</span>
                                                        </div>
                                                    </>
                                                );
                                            }

                                            if (canPerformAction()) {
                                                const isDraft = status === 'Draft';
                                                const btnLabel = getBtnLabel();
                                                const targetStatus = getTargetStatus();

                                                return (
                                                    <>
                                                        <button
                                                            onClick={() => handleUpdateStatus(targetStatus)}
                                                            disabled={actionLoading}
                                                            className="p-4 rounded-xl border transition-all flex flex-col items-center justify-center gap-2 bg-green-50 border-green-100 text-green-600 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <Check className="w-6 h-6" />
                                                            <span className="text-sm font-bold">{btnLabel}</span>
                                                        </button>

                                                        <button
                                                            onClick={() => handleUpdateStatus(isDraft ? 'Cancelled' : 'Rejected')}
                                                            disabled={actionLoading}
                                                            className="p-4 rounded-xl border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 transition-all flex flex-col items-center justify-center gap-2 disabled:opacity-50"
                                                        >
                                                            <X className="w-6 h-6" />
                                                            <span className="text-sm font-bold">{isDraft ? 'Cancel Request' : 'Reject'}</span>
                                                        </button>
                                                    </>
                                                );
                                            }

                                            return (
                                                <>
                                                    <div className="p-4 rounded-xl border bg-gray-50 border-gray-100 text-gray-400 flex flex-col items-center justify-center gap-2 opacity-60">
                                                        <Lock className="w-6 h-6" />
                                                        <span className="text-sm font-bold">Locked</span>
                                                    </div>
                                                    <div className="p-4 rounded-xl border bg-gray-50 border-gray-100 text-gray-400 flex flex-col items-center justify-center gap-2 opacity-50">
                                                        <X className="w-6 h-6" />
                                                        <span className="text-sm font-bold">No Action</span>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>

                                    {/* Edit Dropdown - Full Width */}
                                    {(canPerformAction()) && (
                                        <div className="mt-auto relative" ref={dropdownRef}>
                                            <button
                                                onClick={() => setShowEditDropdown(!showEditDropdown)}
                                                className="w-full py-3 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Edit className="w-5 h-5" />
                                                <span className="font-bold">Edit Options</span>
                                                <ChevronDown className={`w-4 h-4 transition-transform ${showEditDropdown ? 'rotate-180' : ''}`} />
                                            </button>

                                            {/* Dropdown Menu */}
                                            {showEditDropdown && (
                                                <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
                                                    <button
                                                        onClick={() => {
                                                            setShowEditModal(true);
                                                            setShowEditDropdown(false);
                                                        }}
                                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-gray-700 transition-colors text-left border-b border-gray-50"
                                                    >
                                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                                            <Award size={18} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold">Edit Reward Details</p>
                                                            <p className="text-xs text-gray-500">Update amount, title, type</p>
                                                        </div>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setShowCertEditModal(true);
                                                            setShowEditDropdown(false);
                                                        }}
                                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-gray-700 transition-colors text-left"
                                                    >
                                                        <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                                                            <FileText size={18} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold">Edit Certificate</p>
                                                            <p className="text-xs text-gray-500">Update signers & designations</p>
                                                        </div>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Tracking Timeline */}
                                    {reward && (
                                        <div className="mt-auto pt-6 border-t border-gray-100">
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-6">Tracking History</h3>

                                            {(() => {
                                                // Helper to calculate duration
                                                const getDuration = (start, end) => {
                                                    if (!start || !end) return '';
                                                    const diff = new Date(end) - new Date(start);
                                                    const minutes = Math.floor(diff / 60000);
                                                    const hours = Math.floor(minutes / 60);
                                                    const days = Math.floor(hours / 24);

                                                    if (days > 0) return `${days}d`;
                                                    if (hours > 0) return `${hours}h`;
                                                    if (minutes > 0) return `${minutes}m`;
                                                    return '< 1m';
                                                };

                                                // Helper to safely get user name
                                                const getUserName = (user, fallback) => {
                                                    if (!user) return fallback;
                                                    if (user.name) return user.name;
                                                    if (user.firstName) return `${user.firstName} ${user.lastName || ''}`;
                                                    return fallback;
                                                };

                                                // Find Department Heads for Fallback
                                                const hrHead = allEmployees.find(e =>
                                                    (e.department?.toLowerCase().includes('hr') || e.department?.toLowerCase().includes('human')) &&
                                                    (e.designation?.toLowerCase().includes('manager') || e.designation?.toLowerCase().includes('head') || e.designation?.toLowerCase().includes('director'))
                                                ) || allEmployees.find(e => e.department?.toLowerCase().includes('hr') || e.department?.toLowerCase().includes('human'));

                                                const accountsHead = allEmployees.find(e =>
                                                    (e.department?.toLowerCase().includes('finance') || e.department?.toLowerCase().includes('account')) &&
                                                    (e.designation?.toLowerCase().includes('manager') || e.designation?.toLowerCase().includes('head') || e.designation?.toLowerCase().includes('director'))
                                                ) || allEmployees.find(e => e.department?.toLowerCase().includes('finance') || e.department?.toLowerCase().includes('account'));

                                                // Find CEO dynamically
                                                const ceoEmployee = allEmployees.find(e =>
                                                    e.department?.toLowerCase() === 'management' &&
                                                    ['ceo', 'c.e.o', 'c.e.o.', 'director', 'managing director', 'general manager'].includes(e.designation?.toLowerCase())
                                                );
                                                const defaultCeoName = ceoEmployee ? `${ceoEmployee.firstName} ${ceoEmployee.lastName}` : 'CEO';

                                                // Define Steps (Modified: Removed HR & Accounts)
                                                const steps = [
                                                    { id: 'request', label: 'Requester', name: getUserName(reward.createdBy, 'System / Creator'), date: reward.createdAt },
                                                    { id: 'reportee', label: 'Reportee', name: employee?.primaryReportee?.firstName ? `${employee.primaryReportee.firstName} ${employee.primaryReportee.lastName || ''}` : 'Manager', role: 'Reporting Manager' },
                                                    { id: 'ceo', label: 'CEO', name: getUserName(reward.approvedBy, defaultCeoName), role: 'CEO' }
                                                ];

                                                const currentStatus = reward.rewardStatus;
                                                const workflow = reward.workflow || [];
                                                const timeline = [];
                                                let isBlocked = false;

                                                // Helper to find workflow step
                                                const findWorkflowStep = (role) => workflow.find(w => w.role === role);

                                                steps.forEach((step, index) => {
                                                    let status = 'pending';
                                                    let duration = '';
                                                    let isRejected = false;

                                                    if (isBlocked) {
                                                        status = 'blocked';
                                                    } else {
                                                        if (index === 0) {
                                                            status = 'completed';
                                                        }
                                                        else if (currentStatus === 'Rejected' && index > 0) {
                                                            // Check if rejected at this specific stage
                                                            const isCurrentStageRejected = (currentStatus === 'Rejected' && index === 1);
                                                            if (isCurrentStageRejected) {
                                                                status = 'rejected';
                                                                isRejected = true;
                                                                isBlocked = true;
                                                            }
                                                        }
                                                        else if (index === 1) { // Reportee
                                                            const wfStep = findWorkflowStep('Manager') || findWorkflowStep('Reportee');

                                                            if (['Pending Authorization', 'Approved'].includes(currentStatus)) {
                                                                status = 'completed';
                                                                // Duration: CreatedAt -> Manager ActionedAt
                                                                if (wfStep && wfStep.actionedAt) {
                                                                    duration = getDuration(reward.createdAt, wfStep.actionedAt);
                                                                } else {
                                                                    // Fallback if legacy data
                                                                    duration = getDuration(reward.createdAt, reward.updatedAt);
                                                                }
                                                            } else if (currentStatus === 'Pending') {
                                                                status = 'current';
                                                                // Show time elapsed since request
                                                                duration = getDuration(reward.createdAt, new Date());
                                                            }
                                                        }
                                                        else if (index === 2) { // CEO
                                                            const wfStep = findWorkflowStep('CEO');
                                                            const prevStep = findWorkflowStep('Manager') || findWorkflowStep('Reportee');

                                                            if (currentStatus === 'Approved') {
                                                                status = 'completed';
                                                                // Duration: Manager ActionedAt -> CEO ActionedAt
                                                                if (wfStep && wfStep.actionedAt && prevStep && prevStep.actionedAt) {
                                                                    duration = getDuration(prevStep.actionedAt, wfStep.actionedAt);
                                                                } else if (wfStep && wfStep.actionedAt && wfStep.assignedAt) {
                                                                    duration = getDuration(wfStep.assignedAt, wfStep.actionedAt);
                                                                } else {
                                                                    duration = getDuration(reward.createdAt, reward.updatedAt);
                                                                }
                                                            } else if (currentStatus === 'Pending Authorization') {
                                                                status = 'current';
                                                                // Show time elapsed since assignment
                                                                if (wfStep && wfStep.assignedAt) {
                                                                    duration = getDuration(wfStep.assignedAt, new Date());
                                                                } else if (prevStep && prevStep.actionedAt) {
                                                                    duration = getDuration(prevStep.actionedAt, new Date());
                                                                }
                                                            }
                                                        }
                                                    }

                                                    timeline.push({ ...step, status, duration, isRejected });
                                                });

                                                return (
                                                    <div className="relative pb-2">
                                                        <div className="absolute top-[15px] left-0 w-[calc(100%+3rem)] -ml-6 h-0.5 bg-gray-100 z-0">
                                                            <div className="h-full bg-green-500 transition-all duration-500" style={{
                                                                width: currentStatus === 'Draft' ? '0%' : `${(timeline.filter(t => t.status === 'completed').length / (steps.length - 1)) * 100}%`
                                                            }}></div>
                                                        </div>

                                                        <div className="flex justify-between relative z-10 w-full">
                                                            {timeline.map((step, idx) => (
                                                                <div key={step.id} className="flex flex-col items-center gap-2 flex-1 relative group">
                                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 transition-all ${step.status === 'completed' ? 'bg-green-500 border-green-500 text-white shadow-md scale-110' :
                                                                        step.status === 'rejected' ? 'bg-red-500 border-red-500 text-white shadow-md scale-110' :
                                                                            step.status === 'current' ? 'bg-white border-blue-500 text-blue-500 animate-pulse' :
                                                                                'bg-white border-gray-300 text-gray-300'
                                                                        }`}>
                                                                        {step.status === 'completed' ? <Check size={14} strokeWidth={3} /> :
                                                                            step.status === 'rejected' ? <X size={14} strokeWidth={3} /> :
                                                                                <span className="text-[10px] font-bold">{idx + 1}</span>
                                                                        }
                                                                    </div>

                                                                    <div className="flex flex-col items-center text-center">
                                                                        <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${step.status === 'current' ? 'text-blue-600' : 'text-gray-400'}`}>{step.label}</span>
                                                                        <span className="text-[10px] font-medium text-gray-600 max-w-[80px] truncate">{step.name}</span>
                                                                        {step.duration && <span className="text-[9px] text-gray-400 mt-0.5 font-mono">{step.duration}</span>}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Certificate Section */}
                    <div className="pt-10">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => router.back()}
                                    className="p-2 rounded-full bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-gray-100 shadow-sm transition-all"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M19 12H5M12 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <h1 className="text-2xl font-bold text-gray-900">Reward Certificate</h1>
                            </div>
                        </div>

                        <div className="flex justify-center overflow-auto pb-10">
                            <div
                                id="certificate-container"
                                className="bg-white relative w-full max-w-[900px] aspect-[1.414] shadow-2xl overflow-hidden flex flex-col justify-between"
                            >
                                <button
                                    onClick={handleDownloadCertificate}
                                    disabled={actionLoading}
                                    className="absolute top-6 right-6 z-50 p-3 bg-white/90 text-gray-700 border border-gray-200/50 rounded-full hover:bg-white hover:text-blue-600 hover:shadow-md transition-all backdrop-blur-sm print:hidden"
                                    title="Download PDF"
                                    data-html2canvas-ignore="true"
                                >
                                    <Download className="w-5 h-5" />
                                </button>

                                <div className="absolute inset-0 z-0">
                                    <img
                                        src="/assets/certificate-bg-new.png"
                                        alt="Certificate Background"
                                        className="w-full h-full object-fill"
                                    />
                                </div>

                                <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-24 pt-20 pb-0 text-center">
                                    <h1 className="text-4xl md:text-5xl font-semibold text-[#1a2e35] tracking-[0.1em] mb-2 uppercase font-sans" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                        {headerText}
                                    </h1>
                                    <h2 className="text-xl md:text-2xl text-[#1a2e35] font-normal mb-4 tracking-wide" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                        {subHeaderText}
                                    </h2>
                                    <p className="text-xs text-black uppercase tracking-widest mb-4" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                        {presentationText}
                                    </p>
                                    <div className="mb-6 w-full">
                                        <h3 className="text-4xl md:text-5xl text-[#1a2e35] font-normal" style={{ fontFamily: '"Great Vibes", cursive' }}>
                                            {toTitleCase(reward?.employeeName || (employee ? `${prefix}${rawName}` : ''))}
                                        </h3>
                                    </div>
                                    <div className="max-w-xl mx-auto space-y-3">
                                        <p className="text-sm md:text-base text-gray-600 leading-relaxed px-4" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                            {reward?.title || ''}
                                        </p>
                                        <div className="mt-2 space-y-1">
                                            {reward?.rewardType === 'Gift' && reward?.giftName && (
                                                <p className="text-lg font-medium text-[#1a2e35]" style={{ fontFamily: '"Montserrat", sans-serif' }}>Gift: {reward.giftName}</p>
                                            )}
                                            {(reward?.rewardType === 'Cash' || reward?.rewardType === 'Gift') && reward?.amount && (
                                                <p className="text-lg font-medium text-[#1a2e35]" style={{ fontFamily: '"Montserrat", sans-serif' }}>Amount: {reward.currency} {reward.amount}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="relative z-20 flex items-end justify-between px-36 pb-28 w-full">
                                    <div className="text-center">
                                        <p className="text-lg font-semibold text-[#1a2e35] mb-1" style={{ fontFamily: '"Playfair Display", serif' }}>{signer1Name}</p>
                                        <p className="text-lg font-medium uppercase tracking-wider text-[#1a2e35]" style={{ fontFamily: '"Playfair Display", serif' }}>{signer1Title}</p>
                                    </div>
                                    <div className="flex items-center justify-center -mb-4">
                                        <img src="/assets/certificate-logo-v2.png" alt="Company Seal" className="w-60 h-32 object-contain" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-semibold text-[#1a2e35] mb-1" style={{ fontFamily: '"Playfair Display", serif' }}>{signer2Name}</p>
                                        <p className="text-lg uppercase tracking-wider text-[#1a2e35]" style={{ fontFamily: '"Playfair Display", serif' }}>{signer2Title}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            <AddRewardModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                onSuccess={() => fetchData()}
                employees={allEmployees}
                initialData={reward}
                isEditing={true}
            />

            {/* Certificate Edit Modal */}
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
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => executeStatusUpdate(pendingStatus)}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
