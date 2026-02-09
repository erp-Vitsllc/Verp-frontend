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
import { Loader2, Check, X, Download, Edit, ChevronDown, Award, FileText } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import AddLoanModal from '../components/AddLoanModal';
import { useToast } from '@/hooks/use-toast';
import ProfileHeader from '../../../emp/[employeeId]/components/ProfileHeader';
import { useRef } from 'react';



export default function LoanRequestDetails() {
    const { id: rawId } = useParams();
    const router = useRouter();
    // Clean ID (Extract from combined string like Loan-696e1... or Advance-696e1...)
    const id = rawId && rawId.includes('-') ? rawId.split('-').pop() : rawId;
    const [loan, setLoan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editEmployeeData, setEditEmployeeData] = useState([]);
    const [employee, setEmployee] = useState(null);
    const [previousLoanAmount, setPreviousLoanAmount] = useState(0);
    const [loanStats, setLoanStats] = useState({ loanCount: 0, advanceCount: 0 });

    const [showEditDropdown, setShowEditDropdown] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
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

    useEffect(() => {
        if (loan && loan.employeeId) {
            fetchEmployeeDetails(loan.employeeId);
            fetchLoanStats(loan.employeeId); // Replaced fetchPreviousLoans with more comprehensive stats
        }
    }, [loan]);

    const fetchLoanStats = async (empId) => {
        try {
            const response = await axiosInstance.get(`/Employee/loans?employeeId=${empId}`);
            if (response.data && Array.isArray(response.data.loans)) {
                // Calculate Stats
                const stats = response.data.loans.reduce((acc, l) => {
                    if (l.type === 'Loan') acc.loanCount++;
                    else if (l.type === 'Advance') acc.advanceCount++;

                    // Previous Loans Amount Logic (excluding current one)
                    if (l.id !== id && l.status === 'Approved') { // l.id from getLoans match? getLoans returns { id, ... }
                        acc.previousAmount += (l.amount || 0);
                    }
                    return acc;
                }, { loanCount: 0, advanceCount: 0, previousAmount: 0 });

                setLoanStats({ loanCount: stats.loanCount, advanceCount: stats.advanceCount });
                setPreviousLoanAmount(stats.previousAmount);
            }
        } catch (err) {
            console.error("Failed to fetch loan stats", err);
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
                    console.log("Frontend: Fetching profile for current user:", user.employeeId);
                    axiosInstance.get(`/Employee/${user.employeeId}`)
                        .then(res => {
                            const emp = res.data.employee || res.data;
                            if (emp) {
                                console.log("Frontend: Profile Context Loaded:", {
                                    dept: emp.department,
                                    desig: emp.designation
                                });
                                setCurrentUser(prev => ({
                                    ...prev,
                                    department: emp.department,
                                    designation: emp.designation,
                                    companyEmail: emp.companyEmail,
                                    firstName: emp.firstName,
                                    lastName: emp.lastName,
                                    employeeObjectId: emp._id // Store EmployeeBasic ObjectId for strict checks
                                }));
                            }
                        })
                        .catch(err => console.error("Frontend: Failed to fetch employee context", err));
                } else {
                    console.log("Frontend: Current user has no employeeId in localStorage");
                }
            } catch (e) {
                console.error("Error parsing user", e);
            }
        }
    }, []);

    useEffect(() => {
        console.log("Frontend: ID changed:", rawId, "Actual ID:", id);
        if (id) {
            fetchLoanDetails(id);
        } else {
            console.log("Frontend: No ID found in useParams");
        }
    }, [id]);

    const fetchLoanDetails = async (loanId = id) => {
        try {
            console.log(`Frontend: Fetching details for loan ID: ${loanId}`);
            const response = await axiosInstance.get(`/Employee/loans/${loanId}`);
            console.log("Frontend: Loan details fetched successfully:", response.data);
            if (response.data) {
                console.log("HR HOD Name from Backend:", response.data.hrHODName);
                console.log("Accounts HOD Name from Backend:", response.data.accountsHODName);
            }
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

        // Get IDs for Strict Comparison
        // For Loans, 'submittedTo' is an EmployeeBasic ObjectId 
        // We use 'employeeObjectId' stored in currentUser context.
        const currentEmpObjectId = currentUser.employeeObjectId;
        const status = loan.approvalStatus || loan.status;

        // 0. Requester/Initiator Check (For Drafts/Edits)
        const loanEmpObjectId = loan.employeeObjectId?._id || loan.employeeObjectId;
        const isApplicant = currentEmpObjectId && String(currentEmpObjectId) === String(loanEmpObjectId);
        const isInitiator = loan.createdBy && (String(loan.createdBy._id || loan.createdBy) === String(currentUser._id || currentUser.id));

        if (status === 'Draft' && (isApplicant || isInitiator)) {
            return true;
        }

        console.log("Loan Action Check:", { status, loanSubmittedTo: loan.submittedTo, currentEmpObjectId, currentUserEmail: currentUser.companyEmail });

        // 1. Strict Assignment Check (Matches Dashboard)
        if (loan.submittedTo && currentEmpObjectId) {
            // Compare as strings to be safe - handle populated objects
            const submittedToId = loan.submittedTo._id || loan.submittedTo;
            if (String(submittedToId) === String(currentEmpObjectId)) {
                return true;
            }
            // strict check failed, but we ALLOW FALLTHROUGH to role checks below
        }

        // 2. Strict Workflow Check (Array based)
        if (loan.workflow && currentEmpObjectId) {
            const hasPendingTask = loan.workflow.some(w =>
                w.status === 'Pending' &&
                w.assignedTo &&
                String(w.assignedTo) === String(currentEmpObjectId)
            );
            if (hasPendingTask) return true;
        }

        // 3. Fallback (Legacy / Role Based)
        // Only run if submittedTo/workflow didn't match (for safety) 
        // OR rely purely on strict assignment for cleaner security?
        // User requested "Only the corresponding user".
        // If system assigns correctly, strict check is enough.
        // But for safety against data migration/legacy, we keep role check ONLY if 'submittedTo' is missing.

        if (!loan.submittedTo) {
            const userEmail = currentUser.companyEmail || currentUser.email;
            const userDept = (currentUser.department || '').toLowerCase();
            const userDesig = (currentUser.designation || '').toLowerCase();

            // Reportee Check (Pending)
            if (status === 'Pending' && loan.primaryReporteeEmail && userEmail) {
                if (loan.primaryReporteeEmail.trim().toLowerCase() === userEmail.trim().toLowerCase()) {
                    return true;
                }
            }

            const isCEO = userDept.includes('management') &&
                ['ceo', 'c.e.o', 'c.e.o.', 'chief executive officer', 'director', 'managing director', 'general manager', 'gm', 'g.m', 'g.m.'].includes(userDesig);

            const isHR = userDept.includes('hr') || userDept.includes('human resource');
            const isFinance = userDept.includes('finance') || userDept.includes('account');

            if (status === 'Pending HR' && isHR) return true;
            if (status === 'Pending Accounts' && isFinance) return true;
            if (status === 'Pending Authorization' && isCEO) return true;
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
        const { action, status: forcedStatus } = confirmConfig;

        // Determine status based on action or use forced status
        let targetStatus = forcedStatus;
        if (!targetStatus) {
            targetStatus = action === 'approve' ? 'Approved' : 'Rejected';
        }

        setIsProcessing(true);
        try {
            // Use standard status update endpoint
            await axiosInstance.put(`/Employee/loans/${id}/status`, {
                status: targetStatus
            });

            toast({
                title: "Success",
                description: `Loan request ${targetStatus === 'Pending' ? 'submitted' : action === 'approve' ? 'approved' : 'rejected'} successfully.`,
                className: "bg-green-50 border-green-200 text-green-800"
            });
            await fetchLoanDetails();
        } catch (err) {
            console.error("Error updating status:", err);
            toast({
                variant: "destructive",
                title: "Error",
                description: err.response?.data?.message || "Failed to update loan status.",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpdateStatus = (newStatus) => {
        const isSubmit = newStatus === 'Pending';
        const isCancel = newStatus === 'Cancelled';

        setConfirmConfig({
            action: isSubmit ? 'submit' : (isCancel ? 'cancel' : 'update'),
            status: newStatus,
            title: isSubmit ? 'Submit for Approval' : (isCancel ? 'Cancel Request' : 'Update Status'),
            description: isSubmit ? 'Ready to send this request for approval?' : (isCancel ? 'Are you sure you want to cancel this request?' : `Change status to ${newStatus}?`),
            confirmText: isSubmit ? 'Yes, Submit' : (isCancel ? 'Yes, Cancel' : 'Confirm'),
            cancelText: 'No',
            variant: isCancel ? 'destructive' : 'default'
        });
        setConfirmOpen(true);
    };

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
            let errorMessage = "Failed to download PDF from server.";

            // Try to extract error message from Blob if available
            if (err.response?.data instanceof Blob) {
                try {
                    const text = await err.response.data.text();
                    const errorJson = JSON.parse(text);
                    errorMessage = errorJson.message || errorMessage;
                } catch (e) {
                    console.error("Failed to parse error blob", e);
                }
            } else if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            }

            toast({
                variant: "destructive",
                title: "Download Failed",
                description: errorMessage,
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
                        {employee && (
                            <div className="mx-auto my-8 w-full px-6 print:hidden flex flex-row gap-6 items-stretch">
                                <div className="flex-1">
                                    <ProfileHeader
                                        employee={employee}
                                        hideProgressBar={true}
                                        hideStatusToggle={true}
                                        hideRole={true}
                                        hideContactNumber={true}
                                        hideEmail={true}
                                        showNameUnderProfilePic={true}
                                        enlargeProfilePic={false}
                                        extraContent={(
                                            <div className="mt-4 grid grid-cols-1 gap-2">
                                                <div className="bg-purple-50/50 p-2.5 rounded-xl border border-purple-100/50 text-center flex items-center justify-between px-4">
                                                    <p className="text-[10px] text-purple-600 font-semibold uppercase tracking-wider">Total</p>
                                                    <p className="text-base font-bold text-purple-800">{(loanStats?.loanCount || 0) + (loanStats?.advanceCount || 0)}</p>
                                                </div>
                                                <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/50 text-center flex items-center justify-between px-4">
                                                    <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">Loans</p>
                                                    <p className="text-base font-bold text-blue-800">{loanStats?.loanCount || 0}</p>
                                                </div>
                                                <div className="bg-orange-50/50 p-2.5 rounded-xl border border-orange-100/50 text-center flex items-center justify-between px-4">
                                                    <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-wider">Advances</p>
                                                    <p className="text-base font-bold text-orange-800">{loanStats?.advanceCount || 0}</p>
                                                </div>
                                            </div>
                                        )}
                                    />
                                </div>
                                <div className="flex-1 h-full">
                                    {/* Action Card */}
                                    <div className="bg-white rounded-lg shadow-sm p-6 h-full flex flex-col relative overflow-hidden">
                                        <div className="grid grid-cols-2 gap-3 mb-6">
                                            {/* 1. Status Box */}
                                            <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center gap-2 ${loan?.status === 'Approved' ? 'bg-green-50 border-green-100 text-green-700' :
                                                loan?.status === 'Rejected' ? 'bg-red-50 border-red-100 text-red-700' :
                                                    'bg-yellow-50 border-yellow-100 text-yellow-700'
                                                }`}>
                                                <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Current Status</span>
                                                <span className="text-lg font-bold">{loan?.status || 'Unknown'}</span>
                                            </div>

                                            {/* 2. Download Action */}
                                            <button
                                                onClick={handleDownloadPDF}
                                                disabled={isProcessing}
                                                className={`p-4 rounded-xl border border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all flex flex-col items-center justify-center gap-2 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <Download className="w-6 h-6" />
                                                <span className="text-sm font-bold">Download PDF</span>
                                            </button>

                                            {/* 3. Action Buttons */}
                                            {(() => {
                                                const status = loan?.approvalStatus || loan?.status;

                                                if (status === 'Approved' || status === 'Rejected' || status === 'Cancelled') {
                                                    return (
                                                        <>
                                                            <div className="p-4 rounded-xl border bg-gray-50 border-gray-100 text-gray-400 flex flex-col items-center justify-center gap-2 opacity-60 cursor-not-allowed">
                                                                <Check className="w-6 h-6" />
                                                                <span className="text-sm font-bold capitalize">Completed</span>
                                                            </div>
                                                            <div className="p-4 rounded-xl border bg-gray-50 border-gray-100 text-gray-400 flex flex-col items-center justify-center gap-2 opacity-50 cursor-not-allowed">
                                                                <X className="w-6 h-6" />
                                                                <span className="text-sm font-bold">Reject</span>
                                                            </div>
                                                        </>
                                                    );
                                                }

                                                // 3.1 DRAFT CASE (Creator Only)
                                                if (status === 'Draft') {
                                                    const currentEmpObjectId = currentUser?.employeeObjectId;
                                                    const loanEmpObjectId = loan.employeeObjectId?._id || loan.employeeObjectId;

                                                    // Robust Ownership Check: Compare by Mongo ObjectId OR by string Employee ID (V001) OR by Creator ID
                                                    const isCreator = (
                                                        (currentEmpObjectId && String(currentEmpObjectId) === String(loanEmpObjectId)) ||
                                                        (currentUser?.employeeId && loan.employeeId && String(currentUser.employeeId) === String(loan.employeeId)) ||
                                                        (loan.createdBy && (String(loan.createdBy._id || loan.createdBy) === String(currentUser._id || currentUser.id)))
                                                    );

                                                    const isAdmin = currentUser?.isAdmin || currentUser?.role === 'Admin';

                                                    if (isCreator || isAdmin) {
                                                        return (
                                                            <>
                                                                <button
                                                                    onClick={() => handleUpdateStatus('Pending')}
                                                                    disabled={isProcessing}
                                                                    className={`p-4 rounded-xl border border-teal-100 bg-teal-50 text-teal-600 hover:bg-teal-100 transition-all flex flex-col items-center justify-center gap-2 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                >
                                                                    <Check className="w-6 h-6" />
                                                                    <span className="text-sm font-bold">Submit for Approval</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUpdateStatus('Cancelled')}
                                                                    disabled={isProcessing}
                                                                    className={`p-4 rounded-xl border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 transition-all flex flex-col items-center justify-center gap-2 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                >
                                                                    <X className="w-6 h-6" />
                                                                    <span className="text-sm font-bold">Cancel</span>
                                                                </button>
                                                            </>
                                                        );
                                                    }
                                                }

                                                // 3.2 APPROVAL CASE (Context Aware)
                                                let canApprove = false;
                                                let btnLabel = "Approve";

                                                if (currentUser) {
                                                    const isAdmin = currentUser.role === 'Admin' || currentUser.isAdmin;
                                                    const userDept = (currentUser.department || '').toLowerCase();
                                                    const userDesig = (currentUser.designation || '').toLowerCase();
                                                    const currentEmpObjectId = currentUser.employeeObjectId;

                                                    const isCEO = userDept.includes('management') &&
                                                        ['ceo', 'c.e.o', 'c.e.o.', 'chief executive officer', 'director', 'managing director', 'general manager', 'gm', 'g.m', 'g.m.'].includes(userDesig);
                                                    const isHR = userDept.includes('hr') || userDept.includes('human resource');
                                                    const isFinance = userDept.includes('finance') || userDept.includes('account');

                                                    if (isAdmin) {
                                                        canApprove = true;
                                                    } else if (loan.submittedTo) {
                                                        const submittedToId = String(loan.submittedTo._id || loan.submittedTo);
                                                        const currentUserId = String(currentUser._id || currentUser.id);
                                                        const currentEmpId = currentEmpObjectId ? String(currentEmpObjectId) : null;

                                                        // Check if assigned to this User OR this Employee record
                                                        if (submittedToId === currentUserId || (currentEmpId && submittedToId === currentEmpId)) {
                                                            canApprove = true;
                                                        } else {
                                                            // Role based fallbacks
                                                            if (status === 'Pending HR' && isHR) canApprove = true;
                                                            if (status === 'Pending Accounts' && isFinance) canApprove = true;
                                                            if (status === 'Pending Authorization' && isCEO) canApprove = true;
                                                        }
                                                    } else {
                                                        // Role based fallbacks (if submittedTo is missing)
                                                        if (status === 'Pending HR' && isHR) canApprove = true;
                                                        if (status === 'Pending Accounts' && isFinance) canApprove = true;
                                                        if (status === 'Pending Authorization' && isCEO) canApprove = true;
                                                    }

                                                    // Label Logic
                                                    if (status === 'Pending') btnLabel = "Send to HR";
                                                    else if (status === 'Pending HR') btnLabel = "Send to Accounts";
                                                    else if (status === 'Pending Accounts') btnLabel = "Send to Management";
                                                    else if (status === 'Pending Authorization') btnLabel = "Approve Loan";

                                                    // NEW: Reportee/Manager Fallback for button visibility
                                                    if (!canApprove && status === 'Pending' && loan.primaryReporteeEmail) {
                                                        const userEmail = (currentUser.companyEmail || currentUser.email || '').toLowerCase();
                                                        const managerEmail = loan.primaryReporteeEmail.toLowerCase();
                                                        if (userEmail && userEmail === managerEmail) {
                                                            canApprove = true;
                                                        }
                                                    }
                                                }

                                                if (canApprove) {
                                                    return (
                                                        <>
                                                            <button
                                                                onClick={handleApprove}
                                                                disabled={isProcessing}
                                                                className={`p-4 rounded-xl border border-green-100 bg-green-50 text-green-600 hover:bg-green-100 transition-all flex flex-col items-center justify-center gap-2 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            >
                                                                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
                                                                <span className="text-sm font-bold">{btnLabel}</span>
                                                            </button>
                                                            <button
                                                                onClick={handleReject}
                                                                disabled={isProcessing}
                                                                className={`p-4 rounded-xl border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 transition-all flex flex-col items-center justify-center gap-2 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            >
                                                                <X className="w-6 h-6" />
                                                                <span className="text-sm font-bold">Reject</span>
                                                            </button>
                                                        </>
                                                    );
                                                }

                                                const displayStatus = status === 'Pending' ? 'Manager Approval' :
                                                    status === 'Pending HR' ? 'HR Approval' :
                                                        status === 'Pending Accounts' ? 'Finance Approval' :
                                                            status === 'Pending Authorization' ? 'Management Authorization' : status;

                                                return (
                                                    <>
                                                        <div className="p-4 rounded-xl border bg-gray-50 border-gray-100 text-gray-400 flex flex-col items-center justify-center gap-2 opacity-60">
                                                            <Check className="w-6 h-6" />
                                                            <span className="text-xs font-semibold uppercase tracking-wider text-center">Awaiting {displayStatus}</span>
                                                        </div>
                                                        <div className="p-4 rounded-xl border bg-gray-50 border-gray-100 text-gray-400 flex flex-col items-center justify-center gap-2 opacity-50 cursor-not-allowed">
                                                            <X className="w-6 h-6" />
                                                            <span className="text-sm font-bold text-center">No Action</span>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>

                                        {/* Edit Options Dropdown - Full Width */}
                                        {canPerformAction() && (
                                            <div className="mt-auto relative" ref={dropdownRef}>
                                                <button
                                                    onClick={() => setShowEditDropdown(!showEditDropdown)}
                                                    className="w-full py-3 mt-4 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Edit className="w-5 h-5" />
                                                    <span className="font-bold">Edit Options</span>
                                                    <ChevronDown className={`w-4 h-4 transition-transform ${showEditDropdown ? 'rotate-180' : ''}`} />
                                                </button>

                                                {/* Dropdown Menu */}
                                                {showEditDropdown && (
                                                    <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
                                                        <button
                                                            onClick={handleEdit}
                                                            className="w-full px-4 py-4 flex items-center gap-4 hover:bg-gray-50 text-gray-700 transition-colors text-left"
                                                        >
                                                            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                                                                <Edit size={20} />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold">Edit Loan Details</p>
                                                                <p className="text-xs text-gray-500">Update amount, duration, or type</p>
                                                            </div>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}


                                        {/* Tracking Timeline */}
                                        {loan && (
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

                                                    const getUserName = (user, fallback) => {
                                                        if (!user) return fallback;
                                                        if (user.name) return user.name;
                                                        if (user.firstName) return `${user.firstName} ${user.lastName || ''}`;
                                                        return fallback;
                                                    };

                                                    const getUserId = (user, fallbackId) => {
                                                        if (user && user.employeeId) return user.employeeId;
                                                        return fallbackId || '';
                                                    };

                                                    // Define Steps for Loan
                                                    // Flow: Requester -> Reporting Manager -> CEO (Management)
                                                    // Statuses: Pending (Manager), Pending Authorization (CEO), Approved/Rejected

                                                    const steps = [
                                                        {
                                                            id: 'request',
                                                            label: 'Requester',
                                                            name: loan.createdBy?.name || loan.applicantName || 'Applicant',
                                                            employeeId: loan.employeeId, // Applicant ID
                                                            role: 'Initiator'
                                                        },
                                                        {
                                                            id: 'reportee',
                                                            label: 'Reportee',
                                                            name: getUserName(loan.managerApprovedBy || (loan.approvalStatus === 'Pending' ? loan.submittedTo : null), loan.hodName || 'Unknown'),
                                                            employeeId: getUserId(loan.managerApprovedBy, ''),
                                                            role: 'Reporting Manager'
                                                        },
                                                        {
                                                            id: 'hr',
                                                            label: 'HR',
                                                            name: getUserName(loan.hrApprovedBy || (loan.approvalStatus === 'Pending HR' ? loan.submittedTo : null), loan.hrHODName || 'Unknown'),
                                                            employeeId: getUserId(loan.hrApprovedBy, loan.hrHODId),
                                                            role: 'HR Manager'
                                                        },
                                                        {
                                                            id: 'accounts',
                                                            label: 'Accounts',
                                                            name: getUserName(loan.accountsApprovedBy || (loan.approvalStatus === 'Pending Accounts' ? loan.submittedTo : null), loan.accountsHODName || 'Unknown'),
                                                            employeeId: getUserId(loan.accountsApprovedBy, loan.accountsHODId),
                                                            role: 'Finance Manager'
                                                        },
                                                        {
                                                            id: 'ceo',
                                                            label: 'Management',
                                                            name: getUserName(loan.approvalStatus === 'Pending Authorization' ? loan.submittedTo : (loan.approvalStatus === 'Approved' ? loan.approvedBy : null), loan.ceoName || 'Unknown'),
                                                            employeeId: getUserId(loan.approvalStatus === 'Approved' ? loan.approvedBy : null, loan.ceoEmployeeId),
                                                            role: 'Management'
                                                        }
                                                    ];

                                                    const currentStatus = loan.approvalStatus || loan.status;
                                                    const timeline = [];
                                                    let isBlocked = false;

                                                    // Helper to find which step the rejection belongs to
                                                    const getRejectionStepIndex = (rejectedByUser) => {
                                                        if (!rejectedByUser) return 1; // Default to reportee if unknown
                                                        const dept = (rejectedByUser.department || '').toLowerCase();
                                                        const desig = (rejectedByUser.designation || '').toLowerCase();

                                                        if (dept.includes('management') && ['ceo', 'c.e.o', 'c.e.o.', 'chief executive officer', 'director', 'managing director', 'general manager', 'gm', 'g.m', 'g.m.'].includes(desig)) {
                                                            return 4; // Management
                                                        }
                                                        if (dept.includes('hr') || dept.includes('human resource')) {
                                                            return 2; // HR
                                                        }
                                                        if (dept.includes('finance') || dept.includes('account')) {
                                                            return 3; // Accounts
                                                        }
                                                        return 1; // Reportee Manager
                                                    };

                                                    const rejectionIndex = currentStatus === 'Rejected' ? getRejectionStepIndex(loan.rejectedBy) : -1;
                                                    const workflow = loan.workflow || [];

                                                    steps.forEach((step, index) => {
                                                        let status = 'pending';
                                                        let duration = '';
                                                        let isRejected = false;

                                                        // Workflow usually starts from Reportee (index 1)
                                                        const wfStep = index === 0 ? null : workflow[index - 1];
                                                        const prevWfStep = index <= 1 ? null : workflow[index - 2];

                                                        // 1. Determine Status prioritize Workflow History
                                                        if (index === 0) {
                                                            status = 'completed';
                                                        } else if (wfStep?.status === 'Approved' || wfStep?.status === 'Submitted') {
                                                            status = 'completed';
                                                        } else if (wfStep?.status === 'Rejected' || (index === rejectionIndex)) {
                                                            status = 'rejected';
                                                            isRejected = true;
                                                            isBlocked = true;
                                                        } else if (wfStep?.status === 'Pending') {
                                                            status = 'current';
                                                            isBlocked = true;
                                                        } else if (isBlocked) {
                                                            status = 'blocked';
                                                        } else {
                                                            // Fallback to current status mapping
                                                            if (index === 1) { // Reportee
                                                                if (currentStatus === 'Pending') { status = 'current'; isBlocked = true; }
                                                                else if (['Pending HR', 'Pending Accounts', 'Pending Authorization', 'Approved'].includes(currentStatus)) status = 'completed';
                                                            } else if (index === 2) { // HR
                                                                if (currentStatus === 'Pending HR') { status = 'current'; isBlocked = true; }
                                                                else if (['Pending Accounts', 'Pending Authorization', 'Approved'].includes(currentStatus)) status = 'completed';
                                                            } else if (index === 3) { // Accounts
                                                                if (currentStatus === 'Pending Accounts') { status = 'current'; isBlocked = true; }
                                                                else if (['Pending Authorization', 'Approved'].includes(currentStatus)) status = 'completed';
                                                            } else if (index === 4) { // Management
                                                                if (currentStatus === 'Pending Authorization') { status = 'current'; isBlocked = true; }
                                                                else if (currentStatus === 'Approved') status = 'completed';
                                                            }
                                                        }

                                                        // 2. Calculate Duration (Assigned to Submit)
                                                        let startTime = null;
                                                        let endTime = null;

                                                        if (index === 0) {
                                                            // Requester
                                                            startTime = loan.createdAt;
                                                            endTime = workflow[0]?.assignedAt || loan.createdAt;
                                                        } else {
                                                            // Approvers
                                                            startTime = wfStep?.assignedAt || (index === 1 ? loan.createdAt : null);
                                                            endTime = wfStep?.actionedAt || (status === 'current' ? new Date() : (status === 'completed' ? loan.updatedAt : null));
                                                        }

                                                        if (startTime && endTime) {
                                                            duration = getDuration(startTime, endTime);
                                                        }
                                                        timeline.push({
                                                            ...step,
                                                            status,
                                                            duration,
                                                            isRejected,
                                                            name: isRejected ? getUserName(loan.rejectedBy, step.name) : step.name
                                                        });
                                                    });

                                                    return (
                                                        <div className="relative pb-2">
                                                            <div className="flex justify-between relative z-10 w-full">
                                                                {timeline.map((step, idx) => (
                                                                    <div key={step.id} className="flex flex-col items-center gap-2 flex-1 relative group">
                                                                        {/* Connecting Line Segment */}
                                                                        {idx < timeline.length - 1 && (
                                                                            <div className="absolute top-[40px] left-1/2 w-full h-[2px] bg-gray-100 z-0">
                                                                                <div
                                                                                    className={`h-full transition-all duration-500 ${timeline[idx + 1].status === 'rejected' ? 'bg-red-500' : 'bg-green-500'}`}
                                                                                    style={{
                                                                                        width: ['completed', 'current', 'rejected'].includes(timeline[idx + 1].status) ? '100%' : '0%'
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        )}

                                                                        {/* Duration Badge - Top of Circle */}
                                                                        <div className="h-4 flex items-center justify-center">
                                                                            {step.duration && (
                                                                                <span className="text-[9px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200 whitespace-nowrap shadow-sm animate-in fade-in slide-in-from-bottom-1">
                                                                                    {step.label} takes ({step.duration})
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 transition-all ${step.status === 'completed' ? 'bg-green-500 border-green-500 text-white shadow-md scale-110' :
                                                                            step.status === 'rejected' ? 'bg-red-500 border-red-500 text-white shadow-md scale-110' :
                                                                                step.status === 'current' ? 'bg-white border-blue-500 text-blue-500 animate-pulse' :
                                                                                    'bg-white border-gray-300 text-gray-300'
                                                                            }`}>
                                                                            {step.status === 'completed' ? (
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                                                            ) : step.status === 'rejected' ? (
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                                                                            ) : (
                                                                                <span className="text-[10px] font-bold">{idx + 1}</span>
                                                                            )}
                                                                        </div>

                                                                        <div className="flex flex-col items-center text-center">
                                                                            <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${step.status === 'current' ? 'text-blue-600' : 'text-gray-600'}`}>
                                                                                {step.label}
                                                                            </span>
                                                                            <span className={`text-xs font-medium truncate max-w-[80px] ${step.name === 'Unknown' || step.name === 'N/A' ? 'text-red-500 font-bold' : 'text-gray-400'}`} title={step.name}>
                                                                                {step.name}
                                                                            </span>
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


                        {/* A4 Container - Width fixed, Height driven by Image Aspect Ratio */}
                        <div id="loan-form-container" className="mx-auto my-8 bg-white shadow-lg w-[210mm] relative text-black text-sm font-serif print:shadow-none print:w-full print:m-0" style={{ fontFamily: 'Times New Roman, serif' }}>



                            {/* Background Image - Determines Height */}
                            <div className="relative w-full z-0">
                                <img src="/assets/loan_bg_final.jpg" alt="Background" className="w-full h-auto block" />
                            </div>

                            {/* Content Overlay */}
                            <div className="absolute inset-0 z-10 p-6 pt-20 pb-4 flex flex-col h-full text-gray-800 leading-snug">

                                {/* Title (Manually placed below Logo area) */}
                                <div className="border-black pb-1 mb-2 w-max mt-4 mx-auto">
                                    <h1 className="text-xl font-bold uppercase underline decoration-1 underline-offset-2 text-gray-900">
                                        {loan.type === 'Loan' ? 'LOAN REQUEST FORM' : ' SALARY ADVANCE REQUEST FORM'}
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
                        <AlertDialogCancel disabled={isProcessing}>{confirmConfig.cancelText}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleConfirmAction();
                            }}
                            disabled={isProcessing}
                            className={confirmConfig.variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0d9488] hover:bg-[#0f766e]'}
                        >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            {confirmConfig.confirmText}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PermissionGuard>
    );
}
