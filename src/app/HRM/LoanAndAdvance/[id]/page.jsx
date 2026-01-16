'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

import axiosInstance from '@/utils/axios';
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
import { Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import AddLoanModal from '../components/AddLoanModal';
import { useToast } from '@/hooks/use-toast';

export default function LoanRequestDetails() {
    const { id } = useParams();
    const router = useRouter();
    const [loan, setLoan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editEmployeeData, setEditEmployeeData] = useState([]);
    const [employee, setEmployee] = useState(null);
    const [previousLoanAmount, setPreviousLoanAmount] = useState(0);

    useEffect(() => {
        if (loan && loan.employeeId) {
            fetchEmployeeDetails(loan.employeeId);
            fetchPreviousLoans(loan.employeeId);
        }
    }, [loan]);

    const fetchPreviousLoans = async (empId) => {
        try {
            // Fetch all loans for this employee
            // We need an endpoint for this. Assuming there's a way to filter loans by employee.
            // Looking at existing routes... '/Employee/loans' returns all loans (if admin?) or my loans.
            // Is there a query param? or filter?
            // If I am admin/manager, I can see all?
            // Safer: Add a specific call or helper. If not available, we might skip or rely on `employee.loanAmount` IF it was there.
            // Since `employee` object doesn't carry it, we must query Loans.

            // Assuming we have an endpoint that accepts query params or we filter client side if list is small?
            // But `/Employee/loans` might return pagination.
            // Let's try fetching `/Employee/loans` and filter client side for now if it returns array.

            const response = await axiosInstance.get('/Employee/loans');
            if (response.data && Array.isArray(response.data.loans)) {
                // Filter for this employee + Status Approved + NOT this current loan ID
                const otherLoans = response.data.loans.filter(l =>
                    (l.employeeId === empId || l.employeeId === loan.employeeId) &&
                    l._id !== id &&
                    l.status === 'Approved'
                    // And ideally check if it's not fully paid? But we don't have 'paid' status.
                    // Assuming all approved past loans are 'previous advance' for now.
                );

                const totalPrevious = otherLoans.reduce((sum, l) => sum + (l.amount || 0), 0);
                setPreviousLoanAmount(totalPrevious);
            }
        } catch (err) {
            console.error("Failed to fetch previous loans", err);
        }
    };

    const fetchEmployeeDetails = async (empId) => {
        try {
            let targetId = loan.employeeObjectId?._id || loan.employeeObjectId || loan.employeeId;
            if (targetId) {
                const response = await axiosInstance.get(`/Employee/${targetId}`);
                if (response.data) {
                    setEmployee(response.data.employee || response.data);
                }
            }
        } catch (err) {
            console.error("Failed to fetch employee details for PDF", err);
        }
    };

    const calculateServiceYears = (joiningDate) => {
        if (!joiningDate) return '';
        const start = new Date(joiningDate);
        const now = new Date();
        const diffTime = Math.abs(now - start);
        const diffYears = (diffTime / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1);
        return `${diffYears} Years`;
    };

    // Confirmation State
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState({
        action: null, // 'approve' | 'reject'
        title: '',
        description: '',
        confirmText: '',
        cancelText: 'Cancel',
        variant: 'default' // 'default' | 'destructive'
    });
    const { toast } = useToast();

    useEffect(() => {
        // Get current user
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                setCurrentUser(user);

                // Fetch full employee details if ID exists to ensure Dept/Desig
                if (user.employeeId) {
                    axiosInstance.get(`/Employee/${user.employeeId}`)
                        .then(res => {
                            const emp = res.data.employee || res.data;
                            if (emp) {
                                console.log("Debug: Fetched Full Employee Profile", emp);
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
                        .catch(err => console.error("Failed to fetch employee context", err));
                }
            } catch (e) {
                console.error("Error parsing user", e);
            }
        }
    }, []);

    useEffect(() => {
        let actualId = id;
        if (id && id.includes('-')) {
            const parts = id.split('-');
            actualId = parts[parts.length - 1];
        }

        console.log("Frontend: ID changed:", id, "Actual ID:", actualId);
        if (actualId) {
            fetchLoanDetails(actualId);
        } else {
            console.log("Frontend: No ID found in useParams");
        }
    }, [id]);

    const fetchLoanDetails = async (loanId = id) => {
        try {
            console.log(`Frontend: Fetching details for loan ID: ${loanId}`);
            const response = await axiosInstance.get(`/Employee/loans/${loanId}`);
            console.log("Frontend: Loan details fetched successfully");
            setLoan(response.data);
        } catch (err) {
            console.error("Frontend: Failed to load loan details", err);
            setError('Failed to load loan details: ' + (err.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        console.log("Frontend: Render - Loading state");
        return <div className="p-8">Loading...</div>;
    }
    if (error) {
        console.log("Frontend: Render - Error state:", error);
        return <div className="p-8 text-red-500">{error}</div>;
    }
    if (!loan) {
        console.log("Frontend: Render - Loan not found state");
        return <div className="p-8">Loan not found</div>;
    }
    console.log("Frontend: Render - Success state, rendering form");

    // Calculations
    const installmentAmount = (loan.amount / loan.duration).toFixed(2);
    const startDate = new Date(loan.appliedDate);
    // Assuming repayment starts next month or same month? 
    // "from date started date" -> effectively Applied Date for form purposes unless specified.
    // End date = Start + Duration
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + loan.duration);

    const formatDate = (date) => {
        if (!date) return '...................';
        return new Date(date).toLocaleDateString(); // Simple Format
    };

    const canPerformAction = () => {
        if (!loan || !currentUser) return false;

        if (loan.status === 'Approved' || loan.status === 'Rejected') {
            return false;
        }

        // Admin
        if (currentUser.isAdmin || currentUser.role === 'Admin') {
            return true;
        }

        // Reportee - Only when Pending
        const userEmail = currentUser.companyEmail || currentUser.email;
        if (loan.status === 'Pending' && loan.primaryReporteeEmail && userEmail) {
            if (loan.primaryReporteeEmail.trim().toLowerCase() === userEmail.trim().toLowerCase()) {
                return true;
            }
        }

        // CEO - When Pending Authorization
        // Using robust check similar to backend getManagementHOD
        const isCEO = currentUser.department &&
            /management/i.test(currentUser.department) &&
            ['ceo', 'c.e.o', 'c.e.o.', 'director', 'managing director', 'general manager'].includes(currentUser.designation?.toLowerCase());

        if (loan.status === 'Pending Authorization' && isCEO) {
            return true;
        }

        return false;
    };

    const handleEdit = async () => {
        try {
            // We need full employee details for the AddLoanModal validation
            // loan.employeeObjectId only has limited fields.
            // Assuming loan.employeeObjectId._id is the MongoDB ID of the employee
            let empId = loan.employeeObjectId?._id || loan.employeeObjectId;

            // Fallback: Use loan.employeeId (String ID) if ObjectId is missing
            if (!empId) {
                empId = loan.employeeId;
            }

            if (!empId) {
                console.error("Employee ID missing from loan object");
                toast({ variant: "destructive", title: "Error", description: "Employee ID missing" });
                return;
            }

            // Fetch full employee
            // Check if empId implies a search (string ID) or direct get
            // If it's a string like 'EMP-001', the backend /Employee/:id might not handle it if it expects ObjId.
            // But let's try. If it fails, we might need to search.
            const response = await axiosInstance.get(`/Employee/${empId}`);

            // The response might be wrapped in data or direct? 
            // Typically getEmployeeById returns the employee object directly or { employee: ... }?
            // Checking getEmployeeById.js -> res.status(200).json(employee);
            if (response.data) {
                const rawEmp = response.data.employee || response.data; // Handle potential wrapper

                // Map raw data to the format expected by AddLoanModal (which matches getLoanEligibleEmployees structure)
                // AddLoanModal expects: { employeeId, employeeObjectId, name, status, salary, visaExpiry, visaType }

                // 1. Calculate Salary
                let salary = 0;
                if (rawEmp.monthlySalary) {
                    salary = rawEmp.monthlySalary;
                } else if (rawEmp.totalSalary) {
                    salary = rawEmp.totalSalary;
                } else if (rawEmp.salary && rawEmp.salary.monthlySalary) {
                    // Sometimes it might vary based on how getCompleteEmployee returns it (it flattens salary usually)
                    salary = rawEmp.salary.monthlySalary;
                }

                // 2. Visa Details
                // getCompleteEmployee returns { visaDetails: { employment: { expiryDate: ... }, ... } }
                let visaExpiry = null;
                let visaType = null;

                if (rawEmp.visaDetails) {
                    if (rawEmp.visaDetails.employment?.expiryDate) {
                        visaType = 'Employment';
                        visaExpiry = rawEmp.visaDetails.employment.expiryDate;
                    } else if (rawEmp.visaDetails.spouse?.expiryDate) {
                        visaType = 'Spouse';
                        visaExpiry = rawEmp.visaDetails.spouse.expiryDate;
                    } else if (rawEmp.visaDetails.visit?.expiryDate) {
                        visaType = 'Visit';
                        visaExpiry = rawEmp.visaDetails.visit.expiryDate;
                    }
                }

                const mappedEmp = {
                    employeeId: rawEmp.employeeId,
                    employeeObjectId: rawEmp._id,
                    name: `${rawEmp.firstName} ${rawEmp.lastName}`,
                    status: rawEmp.status,
                    salary: salary,
                    visaExpiry: visaExpiry,
                    visaType: visaType
                };

                setEditEmployeeData([mappedEmp]);
                setIsEditModalOpen(true);
            }
        } catch (err) {
            console.error("Error fetching employee for edit", err);
            // Fallback for debugging: Open modal anyway with current data if fetch fails? 
            // Better to show error.
            toast({ variant: "destructive", title: "Error", description: "Failed to load employee details for editing. Check console." });
        }
    };

    const openConfirmation = (action) => {
        if (action === 'approve') {
            setConfirmConfig({
                action: 'approve',
                title: 'Approve Request',
                description: 'Are you sure you want to approve this loan/advance request?',
                confirmText: 'Approve',
                cancelText: 'cancel',
                variant: 'default'
            });
        } else if (action === 'reject') {
            setConfirmConfig({
                action: 'reject',
                title: 'Reject Request',
                description: 'Are you sure you want to reject this loan/advance request? This action cannot be undone.',
                confirmText: 'Reject',
                cancelText: 'cancel',
                variant: 'destructive'
            });
        }
        setConfirmOpen(true);
    };



    const handleConfirmAction = async () => {
        setConfirmOpen(false);
        const { action } = confirmConfig;
        const status = action === 'approve' ? 'Approved' : 'Rejected';

        try {
            // PDF is generated server-side now
            await axiosInstance.put(`/Employee/loans/${id}/status`, {
                status: status
            });

            toast({
                title: "Success",
                description: `Loan request ${action}d successfully.`,
            });
            fetchLoanDetails();
        } catch (err) {
            console.error("Error updating status:", err);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to update loan status.",
            });
        } finally {
            setConfirmOpen(false);
        }
    };

    // Keep these as wrappers if buttons call them, or update buttons to call openConfirmation directly
    const handleApprove = () => openConfirmation('approve');
    const handleReject = () => openConfirmation('reject');

    const handleDownloadPDF = async () => {
        try {
            toast({ title: "Downloading...", description: "Generating PDF from server..." });
            const response = await axiosInstance.get(`/Employee/loans/${id}/pdf`, {
                responseType: 'blob'
            });
            const pdfUrl = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.setAttribute('download', `Loan_Application_${loan?.loanId || id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("PDF Download Error:", err);
            toast({
                variant: "destructive",
                title: "Download Failed",
                description: "Failed to download PDF from server.",
            });
        }
    };

    return (
        <PermissionGuard moduleId="hrm_loan" permissionType="view">
            <div className="flex h-screen bg-[#F0F4F8] text-foreground">
                <Sidebar />
                <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                    <Navbar />
                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto w-full pb-10">
                        {/* A4 Container - Width fixed, Height driven by Image Aspect Ratio */}
                        <div id="loan-form-container" className="mx-auto my-8 bg-white shadow-lg w-[210mm] relative text-black text-sm font-serif print:shadow-none print:w-full print:m-0" style={{ fontFamily: 'Times New Roman, serif' }}>

                            {/* Action Overlay - Upper Left of Form */}
                            <div className="absolute top-4 right-4 z-50 flex flex-row gap-2 print:hidden">
                                {/* Download Button - Always Visible */}
                                <button
                                    onClick={handleDownloadPDF}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-sm text-xs font-sans font-medium transition-colors flex items-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                                    Download PDF
                                </button>
                                {/* Approval/Rejection Buttons with 2-Stage Logic */}
                                {(() => {
                                    const status = loan.status; // or loan.approvalStatus
                                    if (status === 'Approved' || status === 'Rejected') return null;

                                    let canApprove = false;
                                    let btnLabel = "Approve";

                                    // Check Permissions
                                    if (currentUser) {
                                        const isAdmin = currentUser.role === 'Admin' || currentUser.isAdmin;

                                        // Check CEO (Management) - Robust Regex Check
                                        const isCEO = currentUser.department &&
                                            /management/i.test(currentUser.department) &&
                                            ['ceo', 'c.e.o', 'c.e.o.', 'director', 'managing director', 'general manager'].includes(currentUser.designation?.toLowerCase());

                                        if (status === 'Pending') {
                                            // 1. Pending -> Reportee Approval (or Admin)
                                            if (isAdmin) {
                                                canApprove = true;
                                            } else {
                                                // Reportee Check via Email
                                                const userEmail = currentUser.companyEmail || currentUser.email;
                                                console.log("Debug: Reportee Check", {
                                                    loanReportee: loan.primaryReporteeEmail,
                                                    userEmail,
                                                    match: loan.primaryReporteeEmail && userEmail && loan.primaryReporteeEmail.trim().toLowerCase() === userEmail.trim().toLowerCase()
                                                });

                                                if (loan.primaryReporteeEmail && userEmail) {
                                                    if (loan.primaryReporteeEmail.trim().toLowerCase() === userEmail.trim().toLowerCase()) {
                                                        canApprove = true;
                                                    }
                                                }
                                            }
                                            btnLabel = "Approve"; // Initial Approval
                                        } else if (status === 'Pending Authorization') {
                                            // 2. Pending Auth -> CEO Authorization (Final)
                                            if (isAdmin || isCEO) {
                                                canApprove = true;
                                                btnLabel = "Submit for Authorization";
                                            }
                                        }
                                    }

                                    return (
                                        <div className="bg-white p-1.5 rounded-lg shadow-lg border border-gray-200 flex flex-row gap-2">
                                            {/* Edit Button - Keep for Admin/Reportee if Pending */}
                                            {canPerformAction() && (
                                                <button
                                                    onClick={handleEdit}
                                                    className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                                                    title="Edit Loan"
                                                >
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                    </svg>
                                                </button>
                                            )}

                                            {/* Approve Button */}
                                            {canApprove && (
                                                <button
                                                    onClick={handleApprove}
                                                    className="w-10 h-10 flex items-center justify-center bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors"
                                                    title={btnLabel}
                                                >
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12"></polyline>
                                                    </svg>
                                                </button>
                                            )}

                                            {/* Reject Button - Available if canApprove is true */}
                                            {canApprove && (
                                                <button
                                                    onClick={handleReject}
                                                    className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors"
                                                    title="Reject"
                                                >
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Background Image - Determines Height */}
                            <div className="relative w-full z-0">
                                <img src="/assets/loan_bg_final.jpg" alt="Background" className="w-full h-auto block" />
                            </div>

                            {/* Content Overlay */}
                            <div className="absolute inset-0 z-10 p-6 pt-20 pb-4 flex flex-col h-full text-gray-800 leading-snug">

                                {/* Title (Manually placed below Logo area) */}
                                <div className="border-black pb-1 mb-2 w-max mt-4 mx-auto">
                                    <h1 className="text-xl font-bold uppercase underline decoration-1 underline-offset-2 text-gray-900">
                                        {loan.type === 'Loan' ? 'LOAN REQUEST FORM' : ' ADVANCE REQUEST FORM'}
                                    </h1>
                                </div>

                                {/* Row 1 */}
                                <div className="flex gap-2 items-baseline flex-nowrap">
                                    <span className="whitespace-nowrap">Applicant Name:</span>
                                    <span className="font-bold flex-1 border-b border-dotted border-gray-400 px-2 whitespace-nowrap">{loan.applicantName}</span>
                                    <span className="whitespace-nowrap ml-2">Department:</span>
                                    <span className="font-bold flex-1 border-b border-dotted border-gray-400 px-2 whitespace-nowrap">{loan.department}</span>
                                    <span className="whitespace-nowrap ml-2">Designation:</span>
                                    <span className="font-bold flex-1 border-b border-dotted border-gray-400 px-2 whitespace-nowrap">{loan.designation}</span>
                                </div>

                                {/* Row 2 */}
                                <div className="flex gap-2 items-baseline mt-5">
                                    <span className="whitespace-nowrap">HOD Name:</span>
                                    <span className="font-bold flex-1 border-b border-dotted border-gray-400 px-2 whitespace-nowrap">{loan.hodName}</span>
                                    <span className="whitespace-nowrap ml-2">Amount (AED):</span>
                                    <span className="font-bold w-32 border-b border-dotted border-gray-400 px-2">{Number(loan.amount).toLocaleString()}</span>
                                    <span className="whitespace-nowrap ml-2">Reason:</span>
                                    <span className="font-bold flex-[2] border-b border-dotted border-gray-400 px-2">{loan.reason}</span>
                                </div>

                                {/* Declaration */}
                                <div className="mt-5 text-justify font-serif text-sm">
                                    I <span className="font-bold border-b border-dotted border-gray-900 px-1 inline-block min-w-[50px] text-center">{loan.applicantName}</span> request the above-mentioned cash advance and hereby authorize to deduct the same from my upcoming salary or End of Service Benefit.
                                </div>

                                {/* Installments */}
                                <div className="flex gap-2 items-baseline mt-6 flex-wrap">
                                    <span className="whitespace-nowrap">Installment Amount / Month:</span>
                                    <span className="font-bold border-b border-dotted border-gray-400 px-2 min-w-[100px]">{installmentAmount}</span>

                                    <span className="whitespace-nowrap ml-2">Repayment Starting From:</span>
                                    <span className="font-bold border-b border-dotted border-gray-400 px-2 min-w-[100px]">{formatDate(startDate)}</span>

                                    <span className="whitespace-nowrap ml-1">To</span>
                                    <span className="font-bold border-b border-dotted border-gray-400 px-2 min-w-[100px]">{formatDate(endDate)}</span>

                                    <span className="whitespace-nowrap ml-2">No. of Installments:</span>
                                    <span className="font-bold border-b border-dotted border-gray-400 px-2 min-w-[50px]">{loan.duration}</span>
                                </div>

                                {/* Date / Signature */}
                                <div className="flex justify-between items-baseline mt-6">
                                    <div className="flex gap-2 items-baseline w-1/3">
                                        <span>Date:</span>
                                        <span className="font-bold flex-1 border-b border-dotted border-gray-400 px-2">{formatDate(loan.appliedDate)}</span>
                                    </div>
                                    <div className="flex gap-2 items-baseline w-1/3">
                                        <span>Signature:</span>
                                        <span className="flex-1 border-b border-dotted border-gray-400 h-8"></span>
                                    </div>
                                </div>

                                {/* HR Section */}
                                <div className="mt-4">
                                    <h3 className="font-bold underline mb-2 text-gray-900">HR DEPARTMENT</h3>
                                    <div className="space-y-4">
                                        <div className="flex gap-2 items-baseline flex-wrap">
                                            <span>Employee No.:</span>
                                            <span className="font-bold border-b border-dotted border-gray-400 px-2 min-w-[135px]">{employee?.employeeId || loan.employeeId}</span>


                                            <span className="ml-2">VISA Exp:</span>
                                            <span className="font-bold border-b border-dotted border-gray-400 px-2 min-w-[135px]">{formatDate(employee?.visaDetails?.employment?.expiryDate || employee?.visaDetails?.spouse?.expiryDate)}</span>

                                            <span className="ml-2">Labour Card Exp:</span>
                                            <span className="font-bold border-b border-dotted border-gray-400 px-2 min-w-[135px]">{formatDate(employee?.labourCardDetails?.expiryDate)}</span>
                                        </div>
                                        <div className="flex gap-2 items-baseline">
                                            <span>Joining Date:</span>
                                            <span className="font-bold flex-[0.5] border-b border-dotted border-gray-400 px-2">{formatDate(employee?.dateOfJoining || employee?.contractJoiningDate)}</span>
                                            <span className="ml-2">Year of Service:</span>
                                            <span className="font-bold flex-1 border-b border-dotted border-gray-400 px-2">{calculateServiceYears(employee?.dateOfJoining || employee?.contractJoiningDate)}</span>
                                        </div>
                                        <div className="flex justify-between items-baseline">
                                            <div className="flex gap-2 w-1/3">
                                                <span>Date:</span>
                                                <span className="flex-1 border-b border-dotted border-gray-400"></span>
                                            </div>
                                            <div className="flex gap-2 w-1/3">
                                                <span>Signature:</span>
                                                <span className="flex-1 border-b border-dotted border-gray-400"></span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Finance Section */}
                                <div className="mt-4">
                                    <h3 className="font-bold underline mb-2 text-gray-900">FINANCE DEPARTMENT</h3>
                                    <div className="space-y-4">
                                        <div className="flex gap-2 items-baseline">
                                            <span>Previous Advance if any (AED):</span>
                                            <span className="font-bold flex-1 border-b border-dotted border-gray-400 px-2">{previousLoanAmount ? Number(previousLoanAmount).toLocaleString() : ''}</span>
                                            <span>Salary Payable (AED):</span>
                                            <span className="font-bold flex-1 border-b border-dotted border-gray-400 px-2">{employee ? Number(employee.totalSalary || employee.monthlySalary || 0).toLocaleString() : ''}</span>
                                            <span>Till Date:</span>
                                            <span className="font-bold flex-[0.5] border-b border-dotted border-gray-400 px-2">{formatDate(endDate)}</span>
                                        </div>
                                        <div className="flex gap-2 items-baseline">
                                            <span>Installment Amount:</span>
                                            <span className="font-bold flex-1 border-b border-dotted border-gray-400 px-2">{installmentAmount}</span>
                                            <span>Repayment Starting From:</span>
                                            <span className="font-bold flex-1 border-b border-dotted border-gray-400 px-2">{formatDate(startDate)}</span>
                                            <span>To</span>
                                            <span className="font-bold flex-1 border-b border-dotted border-gray-400 px-2">{formatDate(endDate)}</span>
                                        </div>
                                        <div className="flex gap-2 items-baseline">
                                            <span>Note:</span>
                                            <span className="flex-1 border-b border-dotted border-gray-400"></span>
                                        </div>
                                        <div className="flex justify-between items-baseline">
                                            <div className="flex gap-2 w-1/3">
                                                <span>Date:</span>
                                                <span className="flex-1 border-b border-dotted border-gray-400"></span>
                                            </div>
                                            <div className="flex gap-2 w-1/3">
                                                <span>Signature:</span>
                                                <span className="flex-1 border-b border-dotted border-gray-400"></span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Management Section - Pushed to bottom if space permits, or just flow naturally */}
                                <div className="mt-4">
                                    <h3 className="font-bold underline mb-2 text-gray-900">MANAGEMENT APPROVAL</h3>
                                    <div className="p-3 space-y-4 bg-white/50 text-xs">
                                        <div className="flex gap-2 items-baseline">
                                            <span>Approved Amount:</span>
                                            <span className="flex-1 border-b border-dotted border-gray-300"></span>
                                            <span>Installment Amount Per Month:</span>
                                            <span className="flex-1 border-b border-dotted border-gray-300"></span>
                                            <span>Duration:</span>
                                            <span className="flex-[0.5] border-b border-dotted border-gray-300"></span>
                                        </div>
                                        <div className="flex justify-between items-baseline">
                                            <div className="flex gap-2 w-1/3">
                                                <span>Date:</span>
                                                <span className="flex-1 border-b border-dotted border-gray-300"></span>
                                            </div>
                                            <div className="flex gap-2 w-1/3">
                                                <span>Signature:</span>
                                                <span className="flex-1 border-b border-dotted border-gray-300"></span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <AddLoanModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSuccess={() => {
                    setIsEditModalOpen(false);
                    fetchLoanDetails(); // Refresh
                }}
                employees={editEmployeeData}
                initialData={loan}
            />

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{confirmConfig.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmConfig.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{confirmConfig.cancelText}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmAction}
                            className={confirmConfig.variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0d9488] hover:bg-[#0f766e]'}
                        >
                            {confirmConfig.confirmText}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PermissionGuard >
    );
}
