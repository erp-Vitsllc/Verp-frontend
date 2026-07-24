'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useListReturnBack } from '@/hooks/useListReturnBack';
import ListReturnBackButton from '@/components/ListReturnBackButton';

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
import { Loader2, Check, X, Download, Edit, Lock, Send, Trash2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import AddLoanModal from '../components/AddLoanModal';
import LoanFormCards from '../components/LoanFormCards';
import LoanHistoryDetails from '../components/LoanHistoryDetails';
import LoanPrintableForm from '../components/LoanPrintableForm';
import LoanActionPanel from '../components/LoanActionPanel';
import LoanApprovedAttachmentsTab from '../components/LoanApprovedAttachmentsTab';
import { canEditApprovedLoanSchedule } from '../utils/loanApprovedEdit';
import { buildLoanFormSummaries, EMPTY_LOAN_FORM_SUMMARIES } from '../utils/buildLoanFormSummaries';
import { isApprovedLoanRecord } from '../utils/loanScheduleUtils';
import {
    canAccountsPayLoan,
} from '../utils/loanPaymentPrefill';
import { notifyLoanPendingInboxChanged } from '../utils/loanPendingInboxCount';
import { clearModuleNotificationFeedsCache } from '@/utils/moduleNotifications';
import { HEADER_PAIR_CARD_FIXED } from '@/utils/headerPairLayout';
import { useToast } from '@/hooks/use-toast';
import { isAdmin } from '@/utils/permissions';
import ProfileHeader from '../../../emp/[employeeId]/components/ProfileHeader';




export default function LoanRequestDetails() {
    const { id: rawId } = useParams();
    const router = useRouter();
    const handleListReturnBack = useListReturnBack();
    // Clean ID (Extract from combined string like Loan-696e1... or Advance-696e1...)
    const id = rawId && rawId.includes('-') ? rawId.split('-').pop() : rawId;
    const [loan, setLoan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [scheduleOnlyEdit, setScheduleOnlyEdit] = useState(false);
    const [editEmployeeData, setEditEmployeeData] = useState([]);
    const [employee, setEmployee] = useState(null);
    const [imageError, setImageError] = useState(false);
    const [previousLoanAmount, setPreviousLoanAmount] = useState(0);
    const [allEmployeeFines, setAllEmployeeFines] = useState([]);
    const [allEmployeeLoans, setAllEmployeeLoans] = useState([]);
    const [fineSummaries, setFineSummaries] = useState(EMPTY_LOAN_FORM_SUMMARIES);
    const [loanStats, setLoanStats] = useState({
        loanCount: 0,
        advanceCount: 0,
        loanAmount: 0,
        advanceAmount: 0,
        loanPaid: 0,
        advancePaid: 0,
        totalCount: 0,
        totalAmount: 0,
        outstandingBalance: 0,
    });
    const [activeTab, setActiveTab] = useState('loanForm');
    const [summaryViewMode, setSummaryViewMode] = useState('count');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isResubmittingModal, setIsResubmittingModal] = useState(false);

    useEffect(() => {
        if (loan && loan.employeeId) {
            fetchEmployeeDetails(loan.employeeId);
            fetchLoanStats(loan.employeeId, loan);
        }
    }, [loan]);

    const fetchLoanStats = async (empId, currentLoan = loan) => {
        try {
            const [loansResponse, finesResponse] = await Promise.all([
                axiosInstance.get(`/Employee/loans?employeeId=${empId}`),
                axiosInstance.get(`/Fine?employeeId=${empId}&limit=1000`),
            ]);

            let allFines = [];
            if (finesResponse.data && Array.isArray(finesResponse.data.fines)) {
                allFines = finesResponse.data.fines;
            } else if (finesResponse.data && Array.isArray(finesResponse.data.data)) {
                allFines = finesResponse.data.data;
            } else if (Array.isArray(finesResponse.data)) {
                allFines = finesResponse.data;
            }
            setAllEmployeeFines(allFines);

            if (loansResponse.data && Array.isArray(loansResponse.data.loans)) {
                const allLoans = loansResponse.data.loans;
                setAllEmployeeLoans(allLoans);
                const stats = allLoans.reduce(
                    (acc, l) => {
                        const amount = Number(l.amount || 0);
                        const paid = Number(l.paidAmount || 0);
                        const remaining = Math.max(0, amount - paid);
                        const isApproved = isApprovedLoanRecord(l);

                        if (l.type === 'Loan') {
                            acc.loanCount++;
                            if (isApproved) {
                                acc.loanAmount += amount;
                                acc.loanPaid += paid;
                            }
                        } else if (l.type === 'Advance') {
                            acc.advanceCount++;
                            if (isApproved) {
                                acc.advanceAmount += amount;
                                acc.advancePaid += paid;
                            }
                        }

                        if (l.id !== id && isApproved) {
                            acc.previousAmount += amount;
                        }

                        if (isApproved) {
                            acc.totalCount++;
                            acc.totalAmount += amount;
                            acc.outstandingBalance += remaining;
                        }

                        return acc;
                    },
                    {
                        loanCount: 0,
                        advanceCount: 0,
                        loanAmount: 0,
                        advanceAmount: 0,
                        loanPaid: 0,
                        advancePaid: 0,
                        totalCount: 0,
                        totalAmount: 0,
                        outstandingBalance: 0,
                        previousAmount: 0,
                    }
                );

                setLoanStats({
                    loanCount: stats.loanCount,
                    advanceCount: stats.advanceCount,
                    loanAmount: stats.loanAmount,
                    advanceAmount: stats.advanceAmount,
                    loanPaid: stats.loanPaid,
                    advancePaid: stats.advancePaid,
                    totalCount: stats.totalCount,
                    totalAmount: stats.totalAmount,
                    outstandingBalance: stats.outstandingBalance,
                });
                setPreviousLoanAmount(stats.previousAmount);

                setFineSummaries(
                    buildLoanFormSummaries({
                        allEmployeeFines: allFines,
                        allLoans,
                        employeeId: empId,
                        currentLoan,
                    }),
                );
            }
        } catch (err) {
            console.error('Failed to fetch loan stats', err);
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
            const loanData = response.data;
            console.log('Frontend: Loan details fetched successfully:', loanData);
            if (loanData) {
                console.log('HR HOD Name from Backend:', loanData.hrHODName);
                console.log('Accounts HOD Name from Backend:', loanData.accountsHODName);
            }
            setLoan(loanData);

            const empTarget =
                loanData?.employeeObjectId?._id ||
                loanData?.employeeObjectId ||
                loanData?.employeeId;
            if (empTarget) {
                axiosInstance
                    .get(`/Employee/${empTarget}`)
                    .then((empRes) => {
                        if (empRes.data) {
                            setEmployee(empRes.data.employee || empRes.data);
                        }
                    })
                    .catch((err) => {
                        console.error('Failed to prefetch employee for profile card', err);
                    });
            }
        } catch (err) {
            console.error('Frontend: Failed to load loan details', err);
            setError('Failed to load loan details: ' + (err.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    const canResubmit = useMemo(() => {
        if (!currentUser || !loan || loan.status !== 'Rejected') return false;

        const workflow = loan.workflow || [];
        const currentUserId = String(currentUser._id || currentUser.id);
        const currentEmpObjectId = currentUser.employeeObjectId ? String(currentUser.employeeObjectId) : null;

        // Find the most recent approved step
        const approvedSteps = workflow.filter(w => w.status === 'Approved');
        if (approvedSteps.length > 0) {
            const lastApprovedStep = approvedSteps[approvedSteps.length - 1];
            const lastApproverId = String(lastApprovedStep.assignedTo?._id || lastApprovedStep.assignedTo);
            return lastApproverId === currentUserId || (currentEmpObjectId && lastApproverId === currentEmpObjectId);
        } else {
            // Rejected at first stage
            const creatorId = String(loan.createdBy?._id || loan.createdBy);
            const loanEmpObjectId = String(loan.employeeObjectId?._id || loan.employeeObjectId);
            return currentUserId === creatorId || (currentEmpObjectId && currentEmpObjectId === loanEmpObjectId);
        }
    }, [currentUser, loan]);

    const canShowApprovedHrEdit = useMemo(
        () => Boolean(loan && canEditApprovedLoanSchedule(currentUser, loan)),
        [currentUser, loan],
    );

    const employeeOwnerId = useMemo(() => loan?.employeeId || null, [loan?.employeeId]);

    const employeeForCard = useMemo(() => {
        if (employee) return employee;
        if (!loan) return null;

        const applicantName = (loan.applicantName || '').trim();
        const nameParts = applicantName.split(/\s+/).filter(Boolean);
        const embedded =
            loan.employeeObjectId && typeof loan.employeeObjectId === 'object'
                ? loan.employeeObjectId
                : null;

        return {
            employeeId: loan.employeeId,
            firstName: embedded?.firstName || nameParts[0] || applicantName || 'Employee',
            lastName: embedded?.lastName || nameParts.slice(1).join(' ') || '',
            designation: loan.designation || embedded?.designation || '-',
            department: loan.department || embedded?.department || '-',
            profilePic: embedded?.profilePic || null,
        };
    }, [employee, loan]);

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

    // Calculations
    const installmentAmount = (loan.amount / loan.duration).toFixed(2);
    const startDate = loan.monthStart
        ? new Date(`${loan.monthStart}-01`)
        : new Date(loan.appliedDate || loan.createdAt);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + (Number(loan.duration) || 1) - 1);

    const formatDate = (date) => {
        if (!date) return '—';
        return new Date(date).toLocaleDateString();
    };

    const toggleSummaryMode = () => {
        setSummaryViewMode((prev) => {
            if (prev === 'count') return 'amount';
            if (prev === 'amount') return 'remaining';
            return 'count';
        });
    };

    const isLoanType = loan.type === 'Loan';
    const typeLabel = isLoanType ? 'Loan' : 'Advance';
    const formTabLabel = isLoanType ? 'Loan Form' : 'Adv Form';
    const historyTabLabel = isLoanType ? 'Loan History & Details' : 'Advance History & Details';
    const editTabLabel = isLoanType ? 'Edit Loan' : 'Edit Adv';
    const currentAmount = Number(loan.amount || 0);
    const currentPaid = Number(loan.paidAmount || 0);
    const currentRemaining = Math.max(0, currentAmount - currentPaid);
    const isApprovedLoan = isApprovedLoanRecord(loan);

    const canApproveLoan = () => {
        if (!loan || !currentUser) return false;
        const status = loan.approvalStatus || loan.status;
        if (['Approved', 'Pending Payment to Employee', 'Paid', 'Rejected', 'Cancelled'].includes(status)) return false;

        if (isAdmin()) return true;

        const currentEmpObjectId = currentUser.employeeObjectId;
        const submittedToId = loan.submittedTo?._id || loan.submittedTo;
        const currentUserId = currentUser._id || currentUser.id;

        if (submittedToId) {
            if (
                String(submittedToId) === String(currentUserId) ||
                (currentEmpObjectId && String(submittedToId) === String(currentEmpObjectId))
            ) {
                return true;
            }
        }

        if (loan.workflow) {
            const hasPendingTask = loan.workflow.some(
                (w) =>
                    w.status === 'Pending' &&
                    w.assignedTo &&
                    (String(w.assignedTo) === String(currentUserId) ||
                        (currentEmpObjectId && String(w.assignedTo) === String(currentEmpObjectId)))
            );
            if (hasPendingTask) return true;
        }

        if (!loan.submittedTo) {
            const userEmail = currentUser.companyEmail || currentUser.email;
            const userDept = (currentUser.department || '').toLowerCase();
            const userDesig = (currentUser.designation || '').toLowerCase();
            const isCEO =
                userDept.includes('management') &&
                ['ceo', 'c.e.o', 'c.e.o.', 'chief executive officer', 'director', 'managing director', 'general manager', 'gm', 'g.m', 'g.m.'].includes(userDesig);
            const isHR = userDept.includes('hr') || userDept.includes('human resource');
            const isFinance = userDept.includes('finance') || userDept.includes('account');

            if (status === 'Pending' && loan.primaryReporteeEmail && userEmail) {
                if (loan.primaryReporteeEmail.trim().toLowerCase() === userEmail.trim().toLowerCase()) {
                    return true;
                }
            }
            if (status === 'Pending HR' && isHR) return true;
            if (status === 'Pending Accounts' && isFinance) return true;
            if (status === 'Pending Authorization' && isCEO) return true;
        }

        return false;
    };

    const canSubmitDraft = () => {
        if (!loan || !currentUser) return false;
        const status = loan.approvalStatus || loan.status;
        if (status !== 'Draft') return false;
        const currentEmpObjectId = currentUser.employeeObjectId;
        const loanEmpObjectId = loan.employeeObjectId?._id || loan.employeeObjectId;
        const isCreator =
            (currentEmpObjectId && String(currentEmpObjectId) === String(loanEmpObjectId)) ||
            (currentUser.employeeId &&
                loan.employeeId &&
                String(currentUser.employeeId) === String(loan.employeeId)) ||
            (loan.createdBy &&
                String(loan.createdBy._id || loan.createdBy) === String(currentUser._id || currentUser.id));
        return isCreator || isAdmin();
    };

    const canPerformAction = () => {
        if (!loan || !currentUser) return false;

        if (loan.status === 'Approved' || loan.status === 'Pending Payment to Employee' || loan.status === 'Rejected') {
            return false;
        }

        // Admin
        if (isAdmin()) {
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
        const submittedToId = loan.submittedTo?._id || loan.submittedTo;
        const currentUserId = currentUser._id || currentUser.id;

        if (submittedToId) {
            if (String(submittedToId) === String(currentUserId) || (currentEmpObjectId && String(submittedToId) === String(currentEmpObjectId))) {
                return true;
            }
        }

        // 2. Strict Workflow Check (Array based)
        if (loan.workflow) {
            const hasPendingTask = loan.workflow.some(w =>
                w.status === 'Pending' &&
                w.assignedTo &&
                (String(w.assignedTo) === String(currentUserId) || (currentEmpObjectId && String(w.assignedTo) === String(currentEmpObjectId)))
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

    const canShowEdit =
        !isApprovedLoan &&
        (canPerformAction() ||
            isAdmin() ||
            (loan.status === 'Rejected' && canResubmit));

    const approvedEditTabLabel = isLoanType ? 'Edit Loan' : 'Edit Adv';

    const handleEdit = async ({ scheduleOnly = false } = {}) => {
        setScheduleOnlyEdit(scheduleOnly);
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

        const loanStage = loan?.approvalStatus || loan?.status;
        if (action === 'approve' && loanStage === 'Pending Accounts') {
            if (!String(loan?.expenseAccountId || '').trim()) {
                toast({
                    title: 'Expense Account required',
                    description:
                        'Fill Expense Account on the Loan/Advance Parties card before Accounts can approve.',
                    variant: 'destructive',
                });
                return;
            }
            if (!String(loan?.paidThroughAccountId || '').trim()) {
                toast({
                    title: 'Paid Through required',
                    description:
                        'Fill Paid Through on the Loan/Advance Parties card before Accounts can approve.',
                    variant: 'destructive',
                });
                return;
            }
            if (
                String(loan.expenseAccountId).trim() ===
                String(loan.paidThroughAccountId).trim()
            ) {
                toast({
                    title: 'Accounts must differ',
                    description: 'Expense Account and Paid Through must be different.',
                    variant: 'destructive',
                });
                return;
            }
        }

        setIsProcessing(true);
        const actionLabel =
            action === 'approve' ? 'Approving' : action === 'reject' ? 'Rejecting' : 'Updating';
        const loadingToast = toast({
            title: `${actionLabel}…`,
            description:
                action === 'approve'
                    ? 'Please wait — updating status, notifications, and attachments can take a moment.'
                    : 'Please wait while the request is updated.',
            className: 'bg-amber-50 border-amber-200 text-amber-900',
            duration: 120000,
        });
        try {
            await axiosInstance.put(`/Employee/loans/${id}/status`, {
                status: targetStatus,
            });

            loadingToast.update({
                id: loadingToast.id,
                title: 'Success',
                description: `Loan request ${targetStatus === 'Pending' ? 'submitted' : action === 'approve' ? 'approved' : 'rejected'} successfully.`,
                className: 'bg-green-50 border-green-200 text-green-800',
                duration: 5000,
            });
            clearModuleNotificationFeedsCache();
            notifyLoanPendingInboxChanged();
            await fetchLoanDetails();
        } catch (err) {
            console.error("Error updating status:", err);
            loadingToast.update({
                id: loadingToast.id,
                title: 'Error',
                description: err.response?.data?.message || 'Failed to update loan status.',
                variant: 'destructive',
                className: undefined,
                duration: 8000,
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

    /**
     * Paid → create ERP payment + Zoho Expense from Loan Parties fields
     * (Expense Account, Paid Through, org, amount, acknowledgment attachment).
     */
    const handleMarkPaid = async () => {
        if (!loan) return;

        const expenseAccountId = String(loan.expenseAccountId || '').trim();
        const paidThroughAccountId = String(loan.paidThroughAccountId || '').trim();
        const expenseAccountName = String(loan.expenseAccountName || '').trim();
        const paidThroughAccountName = String(loan.paidThroughAccountName || '').trim();
        const zohoOrganizationId = String(loan.zohoOrganizationId || '').trim();
        const amount = Number(loan.amount) || 0;
        const paid = Number(loan.paidAmount) || 0;
        const balance = Math.max(0, amount - paid);

        if (!expenseAccountId || !paidThroughAccountId) {
            toast({
                variant: 'destructive',
                title: 'Accounts required',
                description:
                    'Fill Expense Account and Paid Through on the Loan Parties card before marking Paid.',
            });
            return;
        }
        if (expenseAccountId === paidThroughAccountId) {
            toast({
                variant: 'destructive',
                title: 'Accounts must differ',
                description: 'Expense Account and Paid Through must be different.',
            });
            return;
        }
        if (!zohoOrganizationId) {
            toast({
                variant: 'destructive',
                title: 'Zoho company required',
                description: 'Pick VEGA or NNIT on the Loan Parties card before marking Paid.',
            });
            return;
        }
        if (balance <= 0.01) {
            toast({
                variant: 'destructive',
                title: 'Already paid',
                description: 'There is no remaining amount to pay.',
            });
            return;
        }

        const ack =
            (Array.isArray(loan.approvalAttachments) &&
                loan.approvalAttachments.find((a) => a?.url || a?.publicId || a?.data)) ||
            loan.attachment ||
            null;
        const attachment =
            ack && (ack.url || ack.publicId || ack.data || ack.name)
                ? {
                      name: ack.name || `${typeLabel}_Acknowledgment_${loan.loanId || id}.pdf`,
                      url: ack.url || '',
                      publicId: ack.publicId || '',
                      mimeType: ack.mimeType || 'application/pdf',
                      data: ack.data || undefined,
                  }
                : null;

        setIsProcessing(true);
        const loadingToast = toast({
            title: 'Recording payment…',
            description: 'Creating payment and Zoho Expense from Loan Parties accounts.',
            className: 'bg-amber-50 border-amber-200 text-amber-900',
            duration: 120000,
        });

        try {
            const paymentType = loan.type === 'Advance' ? 'Advance' : 'Loan';
            const res = await axiosInstance.post('/Payment', {
                paymentType,
                paidBy: loan.employeeId,
                amount: balance,
                status: 'Completed',
                description: `Payment for ${loan.loanId || id}`,
                referenceId: loan.loanId || id,
                relatedEntityType: paymentType,
                relatedEntityId: loan._id || id,
                paymentSource: attachment ? 'Cash' : 'Salary',
                attachment: attachment || undefined,
                zohoOrganizationId,
                expenseAccountId,
                expenseAccountName,
                paidThroughAccountId,
                paidThroughAccountName,
            });

            loadingToast.update({
                id: loadingToast.id,
                title: res?.data?.zohoSync?.ok === false ? 'Paid in ERP — Zoho failed' : 'Paid',
                description:
                    res?.data?.message ||
                    `${typeLabel} marked paid. Zoho Expense uses Expense Account + Paid Through from Loan Parties.`,
                className:
                    res?.data?.zohoSync?.ok === false
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-green-50 border-green-200 text-green-800',
                duration: res?.data?.zohoSync?.ok === false ? 10000 : 6000,
            });
            clearModuleNotificationFeedsCache();
            notifyLoanPendingInboxChanged();
            await fetchLoanDetails();
        } catch (err) {
            console.error('Loan mark paid failed:', err);
            loadingToast.update({
                id: loadingToast.id,
                title: 'Payment failed',
                description:
                    err?.response?.data?.message ||
                    err?.message ||
                    'Could not create payment / Zoho Expense.',
                variant: 'destructive',
                className: undefined,
                duration: 8000,
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownloadPDF = async () => {
        try {
            toast({ title: "Downloading...", description: "Generating PDF from server..." });
            const response = await axiosInstance.get(`/Employee/loans/${id}/pdf`, {
                responseType: 'blob'
            });
            const pdfUrl = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.setAttribute('download', isApprovedLoan
                ? `${typeLabel}_Acknowledgment_${loan?.loanId || id}.pdf`
                : `Loan_Application_${loan?.loanId || id}.pdf`);
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
            <div className="flex min-h-screen w-full bg-[#F2F6F9] print:bg-white">
                <div className="print:hidden"><Sidebar /></div>
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="print:hidden shrink-0"><Navbar /></div>
                    <div className="flex-1 flex flex-col items-stretch justify-start py-4 sm:py-6 lg:py-8 print:py-0 relative overflow-y-auto w-full px-3 sm:px-5 lg:px-8">
                        <div className="w-full flex items-center justify-between mb-2 print:hidden">
                            <ListReturnBackButton onNavigate={handleListReturnBack} />
                        </div>

                        <div className="flex flex-col xl:flex-row gap-3 sm:gap-4 lg:gap-6 w-full mb-4 sm:mb-6 lg:mb-8 print:hidden items-stretch">
                            <div className={`flex-1 min-w-0 ${HEADER_PAIR_CARD_FIXED}`}>
                                {employeeForCard && (
                                    <div className="w-full h-full min-h-0">
                                        <ProfileHeader
                                            employee={employeeForCard}
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
                                            subtitle={loan.loanId}
                                            statusLabel={null}
                                            extraContent={(
                                                <div className="mt-3 space-y-3 w-full">
                                                    <div
                                                        className="grid grid-cols-2 gap-2 sm:gap-3 w-full min-w-0 cursor-pointer"
                                                        onClick={toggleSummaryMode}
                                                        title="Click to toggle between Count, Amount, and Remaining"
                                                    >
                                                        <div className="bg-blue-50 p-2 rounded-lg border border-blue-100 flex items-center justify-between gap-1 px-2 sm:px-3 min-w-0 transition-all hover:bg-blue-100">
                                                            <span className="text-[10px] text-blue-600 font-medium uppercase tracking-wide break-words leading-tight min-w-0">
                                                                {summaryViewMode === 'count' ? 'Total Count' : summaryViewMode === 'amount' ? 'Total Amount' : 'Balance'}
                                                            </span>
                                                            <span className="text-sm sm:text-lg font-bold text-blue-800 shrink-0 tabular-nums">
                                                                {summaryViewMode === 'count'
                                                                    ? (loanStats.totalCount || 0)
                                                                    : summaryViewMode === 'amount'
                                                                      ? (loanStats.totalAmount || 0).toLocaleString()
                                                                      : (loanStats.outstandingBalance || 0).toLocaleString()}
                                                            </span>
                                                        </div>
                                                        <div className="bg-green-50 p-2 rounded-lg border border-green-100 flex items-center justify-between gap-1 px-2 sm:px-3 min-w-0 transition-all hover:bg-green-100">
                                                            <span className="text-[10px] text-green-600 font-medium uppercase tracking-wide break-words leading-tight min-w-0">Loans</span>
                                                            <span className="text-sm sm:text-lg font-bold text-green-800 shrink-0 tabular-nums">
                                                                {summaryViewMode === 'count'
                                                                    ? (loanStats.loanCount || 0)
                                                                    : summaryViewMode === 'amount'
                                                                      ? (loanStats.loanAmount || 0).toLocaleString()
                                                                      : Math.max(0, (loanStats.loanAmount || 0) - (loanStats.loanPaid || 0)).toLocaleString()}
                                                            </span>
                                                        </div>
                                                        <div className="bg-purple-50 p-2 rounded-lg border border-purple-100 flex items-center justify-between gap-1 px-2 sm:px-3 min-w-0 transition-all hover:bg-purple-100">
                                                            <span className="text-[10px] text-purple-600 font-medium uppercase tracking-wide break-words leading-tight min-w-0">Advances</span>
                                                            <span className="text-sm sm:text-lg font-bold text-purple-800 shrink-0 tabular-nums">
                                                                {summaryViewMode === 'count'
                                                                    ? (loanStats.advanceCount || 0)
                                                                    : summaryViewMode === 'amount'
                                                                      ? (loanStats.advanceAmount || 0).toLocaleString()
                                                                      : Math.max(0, (loanStats.advanceAmount || 0) - (loanStats.advancePaid || 0)).toLocaleString()}
                                                            </span>
                                                        </div>
                                                        <div className="bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-center justify-between gap-1 px-2 sm:px-3 min-w-0 transition-all hover:bg-amber-100">
                                                            <span className="text-[10px] text-amber-600 font-medium uppercase tracking-wide break-words leading-tight min-w-0">Current</span>
                                                            <span className="text-sm sm:text-lg font-bold text-amber-800 shrink-0 tabular-nums">{currentAmount.toLocaleString()}</span>
                                                        </div>
                                                        <div className="bg-red-50 p-2 rounded-lg border border-red-100 flex items-center justify-between gap-1 px-2 sm:px-3 min-w-0 transition-all hover:bg-red-100">
                                                            <span className="text-[10px] text-red-600 font-medium uppercase tracking-wide break-words leading-tight min-w-0">Paid</span>
                                                            <span className="text-sm sm:text-lg font-bold text-red-800 shrink-0 tabular-nums">{currentPaid.toLocaleString()}</span>
                                                        </div>
                                                        <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 flex items-center justify-between gap-1 px-2 sm:px-3 min-w-0 transition-all hover:bg-gray-100">
                                                            <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wide break-words leading-tight min-w-0">Remaining</span>
                                                            <span className="text-sm sm:text-lg font-bold text-gray-800 shrink-0 tabular-nums">{currentRemaining.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                    {(() => {
                                                        const s = loan?.approvalStatus || loan?.status;
                                                        const isApprovedState = ['Approved', 'Pending Payment to Employee', 'Paid'].includes(s);
                                                        if (isApprovedState) return null;
                                                        let role = '';
                                                        let waitingForName = '';
                                                        if (s === 'Pending' || s === 'Pending HR') {
                                                            role = 'HR';
                                                            waitingForName = loan.hrHODName || loan.hodName;
                                                        } else if (s === 'Pending Accounts') {
                                                            role = 'Accounts';
                                                            waitingForName = loan.accountsHODName;
                                                        } else if (s === 'Pending Authorization') {
                                                            role = 'Management';
                                                            waitingForName = loan.ceoName;
                                                        }
                                                        let label = '';
                                                        if (s === 'Draft') label = 'Waiting for Requester';
                                                        else if (s === 'Rejected') label = 'Rejected';
                                                        else if (s === 'Cancelled') label = 'Cancelled';
                                                        else if (waitingForName) label = `Waiting for ${role}: ${waitingForName}`;
                                                        else if (role) label = `Waiting for ${role}`;
                                                        else label = s;
                                                        if (!label) return null;
                                                        const isRejected = label.includes('Rejected') || label.includes('Cancelled');
                                                        return (
                                                            <div className="w-full">
                                                                <span className={`text-[11px] font-black uppercase tracking-wider px-4 py-2.5 rounded-lg border shadow-sm w-full block text-center ${isRejected ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
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

                            <div className={`flex-1 min-w-0 ${HEADER_PAIR_CARD_FIXED}`}>
                                <LoanActionPanel
                                    loan={loan}
                                    typeLabel={typeLabel}
                                    isProcessing={isProcessing}
                                    canApproveLoan={canApproveLoan}
                                    canSubmitDraft={canSubmitDraft}
                                    canResubmit={canResubmit}
                                    canPayLoan={canAccountsPayLoan(loan, currentUser)}
                                    onDownload={handleDownloadPDF}
                                    onApprove={handleApprove}
                                    onReject={handleReject}
                                    onSubmit={() => handleUpdateStatus('Pending')}
                                    onCancel={() => handleUpdateStatus('Cancelled')}
                                    onResubmit={() => setIsResubmittingModal(true)}
                                    onPay={handleMarkPaid}
                                />
                            </div>
                        </div>

                        <div className="w-full flex items-center border-b border-gray-200 mb-6 print:hidden">
                            <button
                                onClick={() => setActiveTab('loanForm')}
                                className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all duration-200 ${activeTab === 'loanForm' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                            >
                                {formTabLabel}
                            </button>
                            <button
                                onClick={() => setActiveTab('historyDetails')}
                                className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all duration-200 ${activeTab === 'historyDetails' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                            >
                                {historyTabLabel}
                            </button>
                            {canShowEdit && (
                                <button
                                    onClick={() => (loan.status === 'Rejected' && canResubmit ? setIsResubmittingModal(true) : handleEdit())}
                                    className="py-3 px-6 text-sm font-semibold border-b-2 border-transparent text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all duration-200 flex items-center gap-1.5"
                                >
                                    <Edit className="w-4 h-4" />
                                    {editTabLabel}
                                </button>
                            )}
                            {canShowApprovedHrEdit && (
                                <button
                                    type="button"
                                    onClick={() => handleEdit({ scheduleOnly: true })}
                                    className="py-3 px-6 text-sm font-semibold border-b-2 border-transparent text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all duration-200 flex items-center gap-1.5"
                                >
                                    <Edit className="w-4 h-4" />
                                    {approvedEditTabLabel}
                                </button>
                            )}
                            {isApprovedLoan && (
                                <button
                                    onClick={() => setActiveTab('approvedAttachments')}
                                    className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all duration-200 ${
                                        activeTab === 'approvedAttachments'
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    Attachment
                                </button>
                            )}
                        </div>

                        <div className={`w-full ${activeTab === 'loanForm' ? 'block' : 'hidden'}`}>
                            <LoanFormCards
                                loan={loan}
                                employee={employee}
                                formatDate={formatDate}
                                typeLabel={typeLabel}
                                installmentAmount={installmentAmount}
                                startDate={startDate}
                                endDate={endDate}
                                previousLoanAmount={previousLoanAmount}
                                calculateServiceYears={calculateServiceYears}
                                fineSummaries={fineSummaries}
                                allEmployeeFines={allEmployeeFines}
                                allEmployeeLoans={allEmployeeLoans}
                                employeeOwnerId={employeeOwnerId}
                                canEditPartyPayables={(() => {
                                    if (!loan || !currentUser) return false;
                                    const status = String(loan.approvalStatus || loan.status || '');
                                    const hasZoho = Boolean(String(loan.zohoExpenseId || '').trim());
                                    const syncErr = Boolean(String(loan.zohoSyncError || '').trim());
                                    const amount = Number(loan.amount) || 0;
                                    const paid = Number(loan.paidAmount) || 0;
                                    const unpaid = amount > 0 && amount - paid > 0.01;

                                    const dept = String(currentUser.department || '').toLowerCase();
                                    const desig = String(currentUser.designation || '').toLowerCase();
                                    const isFinanceUser =
                                        isAdmin() ||
                                        dept.includes('finance') ||
                                        dept.includes('account') ||
                                        dept.includes('payroll') ||
                                        desig.includes('account') ||
                                        desig.includes('finance') ||
                                        desig.includes('payroll');

                                    // 1) Pending Accounts — first Accounts edit (approve stage)
                                    const atAccountsStage =
                                        status === 'Pending Accounts' && canApproveLoan();

                                    // 2) Pay to Employee — second Accounts edit before Mark Paid / Zoho
                                    const atPayToEmployee =
                                        !hasZoho &&
                                        (status === 'Pending Payment to Employee' ||
                                            (status === 'Approved' && unpaid)) &&
                                        canAccountsPayLoan(loan, currentUser);

                                    // 3) Disbursed but Zoho failed — allow Accounts to fix COA + retry
                                    const fixFailedZoho =
                                        !hasZoho &&
                                        syncErr &&
                                        isFinanceUser &&
                                        (status === 'Paid' ||
                                            (Number(loan?.amount) > 0 &&
                                                Number(loan?.paidAmount) >= Number(loan?.amount) - 0.01));

                                    return atAccountsStage || atPayToEmployee || fixFailedZoho;
                                })()}
                                onPartyPayableChange={(next) => {
                                    if (!next) return;
                                    setLoan((prev) =>
                                        prev
                                            ? {
                                                  ...prev,
                                                  expenseAccountId: String(next.expenseAccountId || '').trim(),
                                                  expenseAccountName: String(next.expenseAccountName || '').trim(),
                                                  paidThroughAccountId: String(next.paidThroughAccountId || '').trim(),
                                                  paidThroughAccountName: String(
                                                      next.paidThroughAccountName || '',
                                                  ).trim(),
                                              }
                                            : prev,
                                    );
                                }}
                                onPartyPayableSaved={() => fetchLoanDetails()}
                                onRetryZohoSuccess={() => fetchLoanDetails()}
                                onPaymentSuccess={() => fetchLoanDetails()}
                                allowPay={canAccountsPayLoan(loan, currentUser)}
                            />
                        </div>

                        {activeTab === 'historyDetails' && (
                            <LoanHistoryDetails
                                loan={loan}
                                employee={employee}
                                formatDate={formatDate}
                                typeLabel={typeLabel}
                            />
                        )}

                        {isApprovedLoan && activeTab === 'approvedAttachments' && (
                            <LoanApprovedAttachmentsTab loan={loan} loanRouteId={id} />
                        )}

                        <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none" aria-hidden>
                            <LoanPrintableForm
                                loan={loan}
                                employee={employee}
                                formatDate={formatDate}
                                installmentAmount={installmentAmount}
                                startDate={startDate}
                                endDate={endDate}
                                previousLoanAmount={previousLoanAmount}
                                calculateServiceYears={calculateServiceYears}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <AddLoanModal
                isOpen={isEditModalOpen || isResubmittingModal}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setIsResubmittingModal(false);
                    setScheduleOnlyEdit(false);
                }}
                onSuccess={() => {
                    setIsEditModalOpen(false);
                    setIsResubmittingModal(false);
                    setScheduleOnlyEdit(false);
                    fetchLoanDetails();
                }}
                employees={editEmployeeData}
                initialData={loan}
                isResubmitting={isResubmittingModal}
                scheduleOnlyEdit={scheduleOnlyEdit}
                employeeDetails={employee}
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
