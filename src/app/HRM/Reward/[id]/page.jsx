'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import AddRewardModal from '../components/AddRewardModal'; // Import the Modal

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

    // Inline Editing State
    const [isEditing, setIsEditing] = useState(false);
    const [headerText, setHeaderText] = useState('Certificate');
    const [subHeaderText, setSubHeaderText] = useState('Of Appreciation');
    const [presentationText, setPresentationText] = useState('This certificate is presented to');
    const [editableName, setEditableName] = useState('');
    const [editableTitle, setEditableTitle] = useState('');
    const [signer1Name, setSigner1Name] = useState('Nivil Ali');
    const [signer1Title, setSigner1Title] = useState('Managing Director');
    const [signer2Name, setSigner2Name] = useState('Raseel Muhammad');
    const [signer2Title, setSigner2Title] = useState('CEO');

    // Fetch Current User
    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                setCurrentUser(JSON.parse(userStr));
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
        if (!currentUser || !employee) return false;

        const reportee = employee.primaryReportee;
        const reporteeName = reportee && typeof reportee === 'object' ? `${reportee.firstName} ${reportee.lastName}` : 'N/A';
        const currentUserName = `${currentUser.firstName} ${currentUser.lastName}`;

        console.log('DEBUG: Checking Permissions by Email');
        console.log('Logged-in User Name:', currentUserName);
        console.log('Primary Reportee User Name:', reporteeName);
        console.log('Logged-in User Email:', currentUser.companyEmail);
        console.log('Primary Reportee Email:', reportee?.companyEmail);

        // Admin check
        if (currentUser.role === 'Admin' || currentUser.isAdmin) {
            console.log('DEBUG: User is Admin');
            return true;
        }

        // Email check
        const userEmail = currentUser.companyEmail || currentUser.email;
        if (reportee && typeof reportee === 'object' && reportee.companyEmail && userEmail) {
            if (reportee.companyEmail.trim().toLowerCase() === userEmail.trim().toLowerCase()) {
                console.log('DEBUG: Company Email match found!');
                return true;
            }
        }

        console.log('DEBUG: No match');
        return false;
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


    const handleUpdateStatus = async (status) => {
        if (!confirm(`Are you sure you want to ${status} this reward?`)) return;

        try {
            setActionLoading(true);

            let certificatePdf = null;

            // Generate PDF only if approving
            if (status === 'Approved') {
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

            await axiosInstance.put(`/Reward/${reward._id}`, {
                ...reward,
                rewardStatus: status,
                approvedBy: currentUser.employeeId,
                certificatePdf // Send Base64 PDF to backend
            });
            toast({
                title: "Success",
                description: `Reward ${status} successfully`,
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
        }
    };



    // Name formatting logic
    const rawName = reward?.employeeName || (employee ? `${employee.firstName} ${employee.lastName}` : '');
    const formattedName = rawName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    const prefix = employee?.gender?.toLowerCase() === 'male' ? 'Mr. ' : (employee?.gender?.toLowerCase() === 'female' ? 'Ms. ' : '');

    // Sync state with fetching data
    useEffect(() => {
        if (reward) {
            setEditableTitle(reward.title || '');
        }
        if (rawName) {
            // Initialize with the formatted display name
            setEditableName(`${prefix}${formattedName}`);
        }
    }, [reward, employee, rawName, prefix, formattedName]);

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

    const handleSaveInline = async () => {
        try {
            setActionLoading(true);
            const payload = {
                ...reward,
                title: editableTitle,
                // We'll try to save the name if the backend allows it (e.g. manual override)
                // If not, it might just be ignored, which is fine for session-based printing
                employeeName: editableName,
                // Note: We are NOT saving headerText/subHeaderText/presentationText to DB as schema likely doesn't support it.
                // They will persist in session for printing.
            };

            await axiosInstance.put(`/Reward/${reward._id}`, payload);

            toast({
                title: "Success",
                description: "Certificate updated successfully",
            });
            setIsEditing(false);
            fetchData(); // Refresh to ensure data consistency
        } catch (error) {
            toast({
                variant: 'destructive',
                title: "Error",
                description: "Failed to save changes",
            });
        } finally {
            setActionLoading(false);
        }
    };

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

                <div className="p-6 md:p-8 w-full max-w-5xl mx-auto space-y-6">
                    {/* Header with Back Button */}
                    <div className="flex items-center justify-between mb-2">
                        <button
                            onClick={() => router.back()}
                            className="p-2 rounded-full bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-gray-100 shadow-sm transition-all"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900 flex-1 text-center pr-10">Reward Certificate</h1>
                    </div>



                    {/* Certificate Container */}
                    <div className="flex justify-center overflow-auto pb-10">
                        {/* Aspect Ratio Box for A4 Landscape (approx 297mm x 210mm ~ 1.414 ratio) */}
                        <div
                            id="certificate-container"
                            className="bg-white relative w-full max-w-[900px] aspect-[1.414] shadow-2xl overflow-hidden flex flex-col justify-between"
                        >
                            {/* Background Image */}
                            <div className="absolute inset-0 z-0">
                                <img
                                    src="/assets/certificate-bg-new.png"
                                    alt="Certificate Background"
                                    className="w-full h-full object-fill"
                                />
                            </div>

                            {/* Content Wrapper */}
                            <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-24 pt-20 pb-0 text-center">

                                {/* Header */}
                                <h1 className="text-4xl md:text-5xl font-semibold text-[#1a2e35] tracking-[0.1em] mb-2 uppercase font-sans" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                    Certificate
                                </h1>
                                <h2 className="text-xl md:text-2xl text-[#1a2e35] font-normal mb-4 tracking-wide" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                    Of Appreciation
                                </h2>

                                {/* Presented To */}
                                <p className="text-xs text-black uppercase tracking-widest mb-4" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                    This certificate is presented to
                                </p>

                                {/* Name */}
                                <div className="mb-6 w-full">
                                    <h3 className="text-4xl md:text-5xl text-[#1a2e35] font-normal" style={{ fontFamily: '"Great Vibes", cursive' }}>
                                        {prefix}{formattedName}
                                    </h3>

                                </div>

                                {/* Description / Title */}
                                <div className="max-w-xl mx-auto space-y-3">
                                    {/* {reward?.title && (
                                        <p className="text-lg md:text-xl font-medium text-[#1a2e35]" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                            {reward.title}
                                        </p>
                                    )} */}
                                    {/* Title / Description Area - Editable */}
                                    {isEditing ? (
                                        <textarea
                                            value={editableTitle}
                                            onChange={(e) => setEditableTitle(e.target.value)}
                                            className="text-sm md:text-base text-gray-600 leading-relaxed px-4 text-center bg-transparent border border-dashed border-gray-300 rounded w-full focus:outline-none focus:border-blue-500 resize-none overflow-hidden"
                                            style={{ fontFamily: '"Montserrat", sans-serif' }}
                                            rows={2}
                                            onInput={(e) => {
                                                e.target.style.height = 'auto';
                                                e.target.style.height = e.target.scrollHeight + 'px';
                                            }}
                                        />
                                    ) : (
                                        <p className="text-sm md:text-base text-gray-600 leading-relaxed px-4" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                            {editableTitle}
                                        </p>
                                    )}

                                    {/* Additional Reward Details based on Type */}
                                    {!isEditing && (
                                        <div className="mt-2 space-y-1">
                                            {reward?.rewardType === 'Gift' && reward?.giftName && (
                                                <p className="text-lg font-medium text-[#1a2e35]" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                                    Gift: {reward.giftName}
                                                </p>
                                            )}
                                            {(reward?.rewardType === 'Cash' || reward?.rewardType === 'Gift') && reward?.amount && (
                                                <p className="text-lg font-medium text-[#1a2e35]" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                                    Amount: {reward.currency} {reward.amount}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer / Signatures - Absolute or Flex layout at bottom */}
                            <div className="relative z-20 flex items-end justify-between px-36 pb-28 w-full">
                                {/* Left Signature */}
                                <div className="text-center">
                                    <p className="text-lg font-semibold text-[#1a2e35] mb-1" style={{ fontFamily: '"Playfair Display", serif' }}>Nivil Ali</p>
                                    <p className="text-lg font-medium uppercase tracking-wider text-[#1a2e35]" style={{ fontFamily: '"Playfair Display", serif' }}>Managing Director</p>
                                </div>

                                {/* Center Badge/Logo */}
                                <div className="flex items-center justify-center -mb-4">
                                    <img
                                        src="/assets/certificate-logo-v2.png"
                                        alt="Company Seal"
                                        className="w-60 h-32 object-contain"
                                    />
                                </div>

                                {/* Right Signature */}
                                <div className="text-center">
                                    <p className="text-lg font-semibold text-[#1a2e35] mb-1" style={{ fontFamily: '"Playfair Display", serif' }}>Raseel Muhammad</p>
                                    <p className="text-lg  uppercase tracking-wider text-[#1a2e35]" style={{ fontFamily: '"Playfair Display", serif' }}>CEO</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {canPerformAction() && reward?.rewardStatus !== 'Approved' && (
                    <div className="flex justify-center gap-4 mt-8 pb-10 print:hidden">

                        {/* Modal Edit Button */}
                        {!isEditing && (
                            <button
                                onClick={() => setShowEditModal(true)}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                Edit Reward Details
                            </button>
                        )}

                        {/* Inline Edit Button */}
                        {isEditing ? (
                            <>
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors shadow-sm font-medium flex items-center gap-2"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveInline}
                                    disabled={actionLoading}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                >
                                    {actionLoading ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                    Save Changes
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit Text
                            </button>
                        )}

                        {reward?.rewardStatus !== 'Approved' && (
                            <button
                                onClick={() => handleUpdateStatus('Approved')}
                                disabled={actionLoading || isEditing}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium disabled:opacity-50 flex items-center gap-2"
                            >
                                {actionLoading ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                                Approve
                            </button>
                        )}

                        {reward?.rewardStatus !== 'Rejected' && (
                            <button
                                onClick={() => handleUpdateStatus('Rejected')}
                                disabled={actionLoading || isEditing}
                                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm font-medium disabled:opacity-50 flex items-center gap-2"
                            >
                                {actionLoading ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                                Reject
                            </button>
                        )}

                        <button
                            onClick={handleDownloadCertificate}
                            disabled={actionLoading || isEditing}
                            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-sm font-medium disabled:opacity-50 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download PDF (Test)
                        </button>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            <AddRewardModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                onSuccess={() => {
                    fetchData(); // Refresh data
                }}
                employees={allEmployees}
                initialData={reward}
                isEditing={true}
            />
        </div>
    );
}
