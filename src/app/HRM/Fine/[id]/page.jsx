'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { ArrowLeft, Loader2, Download, Printer, Check, X, Edit, AlertCircle, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import AddFineModal from '../components/AddFineModal';
import ProfileHeader from '../../../emp/[employeeId]/components/ProfileHeader';
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

import { calculateDaysUntilExpiry, calculateTenure, getExpiryColor } from '../../../emp/[employeeId]/utils/helpers';

export default function FineDetailsPage({ params }) {
    // Handle params whether it's a Promise (Next.js 15+) or Object
    const resolvedParams = (params instanceof Promise) ? use(params) : params;
    let { id } = resolvedParams || {};

    // Sanitize ID (remove artifacts like ":1")
    if (id && typeof id === 'string' && id.includes(':')) {
        id = id.split(':')[0].trim();
    }

    const router = useRouter();
    const { toast } = useToast();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const [fine, setFine] = useState(null);
    const [employeeDetails, setEmployeeDetails] = useState(null);
    const [hodDetails, setHodDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Alert Dialog State
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState(null);

    const executeStatusUpdate = async () => {
        if (!pendingStatus) return;

        try {
            setActionLoading(true);
            const targetId = fine?._id || id;

            // Prepare Payload with Dynamic Approvers
            const payload = { fineStatus: pendingStatus };
            const approverId = currentUser.id || currentUser._id;

            if (approverId) {
                if (pendingStatus === 'Pending Accounts') {
                    payload.hrApprovedBy = approverId;
                } else if (pendingStatus === 'Pending Authorization') {
                    payload.accountsApprovedBy = approverId;
                } else if (pendingStatus === 'Approved') {
                    payload.approvedBy = approverId;
                }
            }

            const res = await axiosInstance.put(`/Fine/${targetId}`, payload);

            toast({
                title: "Success",
                description: `Fine status updated to ${pendingStatus}.`,
                variant: "success",
                className: "bg-green-50 border-green-200 text-green-800"
            });
            setIsAlertOpen(false);
            refreshData();
        } catch (err) {
            console.error("Status update error:", err);
            toast({
                title: "Error",
                description: err.response?.data?.message || "Failed to update fine status.",
                variant: "destructive"
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleUpdateStatus = (status) => {
        setPendingStatus(status);
        setIsAlertOpen(true);
    };

    const refreshData = () => {
        window.location.reload();
    };

    // Fetch Current User
    // Fetch Current User
    useEffect(() => {
        const initUser = async () => {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    setCurrentUser(parsedUser); // Initial load

                    // Fetch full employee details to ensure we have department/designation
                    // Use employeeId if available (preferred), otherwise user ID
                    let userId = parsedUser.employeeId || parsedUser.id || parsedUser._id;

                    // Sanitize userId (remove anything that isn't a hex char if it looks like a hex ID, or keep as string)
                    if (userId && typeof userId === 'string') {
                        // Only split if it contains ':' (log format artifact)
                        if (userId.includes(':')) userId = userId.split(':')[0].trim();
                        else userId = userId.trim();
                    }

                    // Accept both ObjectIds (24 hex) and custom Employee IDs (non-empty strings)
                    if (userId) {
                        try {
                            const res = await axiosInstance.get(`/Employee/${userId}`, {
                                validateStatus: (status) => status === 200 || status === 404
                            });

                            if (res.status === 200) {
                                const fullData = res.data.employee || res.data;
                                if (fullData) {
                                    setCurrentUser(prev => ({
                                        ...prev,
                                        department: fullData.department,
                                        designation: fullData.designation,
                                        employeeId: fullData.employeeId,
                                        // Preserve auth flags
                                        isAdmin: prev.isAdmin,
                                        role: prev.role
                                    }));
                                }
                            }
                        } catch (err) {
                            console.warn("Background fetch warning:", err.message);
                        }
                    } else {
                        console.warn("Skipping background fetch: Invalid User ID format", userId);
                    }
                } catch (e) {
                    console.error("Error parsing user data:", e);
                }
            }
        };
        initUser();
    }, [router, toast]);

    const [allEmployees, setAllEmployees] = useState([]);
    const [allEmployeeFines, setAllEmployeeFines] = useState([]);
    const [fineSummaries, setFineSummaries] = useState({
        totalFineCount: 0,
        totalAmount: 0,
        paidFineCount: 0,
        outstandingBalance: 0,
        distinctTypesCount: 0,
        startMonthYear: '-',
        endMonthYear: '-',
        personalLoan: { amount: 0, duration: 0, paid: 0, count: 0 },
        salaryAdvance: { amount: 0, duration: 0, paid: 0, count: 0 }
    });

    // Helpers (getYearMonth, addMonthsToYM, getEmpShare) remain the same...
    const getYearMonth = (val) => {
        if (!val) return 0;
        if (typeof val === 'string') {
            const parts = val.split(/[-/T ]/);
            if (parts.length >= 2) {
                const y = parseInt(parts[0]);
                const m = parseInt(parts[1]);
                if (y > 1000 && m >= 1 && m <= 12) return y * 100 + m;
            }
        }
        const d = new Date(val);
        if (isNaN(d.getTime())) return 0;
        return d.getFullYear() * 100 + (d.getMonth() + 1);
    };

    const addMonthsToYM = (ym, months) => {
        if (ym <= 0) return 0;
        let y = Math.floor(ym / 100);
        let m = ym % 100;
        m += months;
        while (m > 12) { m -= 12; y += 1; }
        while (m < 1) { m += 12; y -= 1; }
        return y * 100 + m;
    };

    const getEmpShare = (f) => {
        if (!f) return 0;
        const isCompany = (f.responsibleFor || '').toLowerCase() === 'company';
        if (isCompany) return 0;
        const isSplit = (f.responsibleFor || '').toLowerCase() === 'employee & company';
        if (isSplit) return parseFloat(f.employeeAmount) || (parseFloat(f.fineAmount) / 2) || 0;
        return parseFloat(f.employeeAmount || f.fineAmount) || 0;
    };

    // Fetch Employees for Modal
    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const res = await axiosInstance.get('/Employee');
                setAllEmployees(res.data.employees || res.data);
            } catch (e) {
                console.error("Failed to fetch employees list", e);
            }
        };
        fetchEmployees();
    }, []);

    // Fetch Fine and Employee Details
    useEffect(() => {
        const fetchAllDetails = async () => {
            if (!id) return;
            try {
                setLoading(true);
                // 1. Fetch Fine
                const fineRes = await axiosInstance.get(`/Fine/${id}`);
                const fineData = fineRes.data;
                console.log("Fine details fetched successfully:", fineData);
                if (fineData) {
                    console.log("HR HOD Name from Backend:", fineData.hrHODName);
                    console.log("Accounts HOD Name from Backend:", fineData.accountsHODName);
                }
                setFine(fineData);

                // 2. Fetch Assigned Employee Details
                if (fineData.assignedEmployees && fineData.assignedEmployees.length > 0) {
                    let empId = fineData.assignedEmployees[0].employeeId;

                    // Sanitize empId if it contains artifacts like ':1'
                    if (empId && typeof empId === 'string' && empId.includes(':')) {
                        empId = empId.split(':')[0].trim();
                    }

                    try {
                        const empRes = await axiosInstance.get(`/Employee/${empId}`);
                        const empDetails = empRes.data.employee || empRes.data;
                        setEmployeeDetails(empDetails);

                        // 3. Fetch all fines for this employee to calculate summaries
                        try {
                            const allFinesRes = await axiosInstance.get(`/Fine?employeeId=${empId}&limit=1000`);
                            let allFines = [];
                            if (allFinesRes.data && Array.isArray(allFinesRes.data.fines)) {
                                allFines = allFinesRes.data.fines;
                            } else if (allFinesRes.data && Array.isArray(allFinesRes.data.data)) {
                                allFines = allFinesRes.data.data;
                            } else if (Array.isArray(allFinesRes.data)) {
                                allFines = allFinesRes.data;
                            }

                            setAllEmployeeFines(allFines);

                            if (allFines.length > 0 || fineData) {
                                // Ensure the current fine is in our processing list if it's not already there
                                const processedFines = [...allFines];
                                if (fineData && !processedFines.some(f => (f._id === fineData._id || f.fineId === fineData.fineId))) {
                                    processedFines.push(fineData);
                                }

                                // Filter out rejected fines
                                const activeFines = processedFines.filter(f => f.fineStatus !== 'Rejected' && f.fineStatus !== 'Cancelled');
                                const totalAmount = activeFines.reduce((sum, f) => sum + getEmpShare(f), 0);
                                const paidAmount = activeFines.reduce((sum, f) => sum + (f.paidAmount || 0), 0);
                                const paidFines = activeFines.filter(f => f.fineStatus === 'Paid' || (getEmpShare(f) > 0 && f.paidAmount >= getEmpShare(f)));

                                // Group by category for the breakdown table
                                const aggregates = {
                                    'Vehicle': { amount: 0, paid: 0, count: 0, duration: 0 },
                                    'Safety': { amount: 0, paid: 0, count: 0, duration: 0 },
                                    'Project': { amount: 0, paid: 0, count: 0, duration: 0 },
                                    'Loss': { amount: 0, paid: 0, count: 0, duration: 0 },
                                    'Other': { amount: 0, paid: 0, count: 0, duration: 0 },
                                };

                                activeFines.forEach(f => {
                                    const fType = (f.fineType || f.category || f.subCategory || '').toLowerCase();
                                    let cat = 'Other';
                                    if (fType.includes('vehicle')) cat = 'Vehicle';
                                    else if (fType.includes('safety')) cat = 'Safety';
                                    else if (fType.includes('project')) cat = 'Project';
                                    else if (fType.includes('loss and damage')) cat = 'Loss';
                                    else if (fType.includes('loss') || (fType.includes('damage') && !fType.includes('other'))) cat = 'Loss';
                                    else if (fType.includes('property')) cat = 'Loss';

                                    aggregates[cat].amount += getEmpShare(f);
                                    aggregates[cat].paid += (f.paidAmount || 0);
                                    aggregates[cat].count += 1;
                                    aggregates[cat].duration += (parseInt(f.payableDuration) || 1);
                                });

                                // --- LOAN AND ADVANCE INTEGRATION ---
                                let loanSummary = {
                                    personalLoan: { amount: 0, duration: 0, paid: 0, count: 0 },
                                    salaryAdvance: { amount: 0, duration: 0, paid: 0, count: 0 }
                                };
                                let loanInstallments = 0;

                                try {
                                    const loansRes = await axiosInstance.get(`/Employee/loans?employeeId=${empId}`);
                                    const allLoans = Array.isArray(loansRes.data.loans) ? loansRes.data.loans :
                                        (Array.isArray(loansRes.data.data) ? loansRes.data.data : []);

                                    const approvedLoans = allLoans.filter(l => (l.applicationStatus || '').toLowerCase() === 'approved');

                                    const pLoans = approvedLoans.filter(l => (l.type || '').toLowerCase() === 'loan');
                                    const sAdvances = approvedLoans.filter(l => (l.type || '').toLowerCase() === 'advance');

                                    loanSummary.personalLoan = {
                                        amount: pLoans.reduce((sum, l) => sum + (Number(l.amount) || 0), 0),
                                        duration: pLoans.reduce((sum, l) => sum + (Number(l.duration) || 0), 0),
                                        paid: pLoans.reduce((sum, l) => sum + (Number(l.paidAmount) || 0), 0),
                                        count: pLoans.length
                                    };
                                    loanSummary.salaryAdvance = {
                                        amount: sAdvances.reduce((sum, l) => sum + (Number(l.amount) || 0), 0),
                                        duration: sAdvances.reduce((sum, l) => sum + (Number(l.duration) || 0), 0),
                                        paid: sAdvances.reduce((sum, l) => sum + (Number(l.paidAmount) || 0), 0),
                                        count: sAdvances.length
                                    };

                                    // Calculate Loan installments for Next Deduction inside same scope
                                    loanInstallments = approvedLoans.reduce((sum, l) => {
                                        const amt = Number(l.amount) || 0;
                                        const dur = Number(l.duration) || 1;
                                        const pd = Number(l.paidAmount) || 0;
                                        if (amt - pd > 0.5) return sum + (amt / dur);
                                        return sum;
                                    }, 0);
                                } catch (err) {
                                    console.error("Failed to fetch loans:", err);
                                }

                                // Next Deduction logic: Sum of (Share / Duration) for fines active in the upcoming payroll month
                                const now = new Date();
                                // "Next" deduction usually targets the immediate upcoming payroll (current + 1)
                                const targetYM = addMonthsToYM(now.getFullYear() * 100 + (now.getMonth() + 1), 1);
                                const targetMonthName = monthNames[(now.getMonth() + 1) % 12];

                                const nextSalaryDeduction = activeFines.reduce((sum, f) => {
                                    // Use live data for the current fine we are viewing
                                    const isCurrent = (fineData && (f._id === fineData._id || f.fineId === fineData.fineId));
                                    const record = isCurrent ? fineData : f;

                                    const share = getEmpShare(record);
                                    if (share <= 0) return sum;

                                    const outstanding = share - (record.paidAmount || 0);
                                    if (outstanding <= 0) return sum;

                                    const startYM = getYearMonth(record.monthStart || record.awardedDate);
                                    const duration = parseInt(record.payableDuration) || 1;
                                    const endYM = addMonthsToYM(startYM, duration - 1);

                                    // STRICT DATE CHECK: Target month must be within [Start, End]
                                    if (startYM > 0 && targetYM >= startYM && targetYM <= endYM) {
                                        return sum + (share / duration);
                                    }
                                    return sum;
                                }, 0);


                                const totalNextDeduction = nextSalaryDeduction + loanInstallments;

                                // Mapped from fineData installment dates
                                let startMonthStr = '-';
                                let endMonthStr = '-';

                                // Fallback to awardedDate if monthStart is missing (common for simple fines)
                                const baseMonthStr = fineData.monthStart || fineData.awardedDate;

                                if (baseMonthStr) {
                                    try {
                                        let date;
                                        if (typeof baseMonthStr === 'string' && baseMonthStr.includes('-')) {
                                            const p = baseMonthStr.split('-');
                                            date = new Date(parseInt(p[0]), (parseInt(p[1]) || 1) - 1, 1);
                                        } else {
                                            date = new Date(baseMonthStr);
                                        }

                                        if (!isNaN(date.getTime())) {
                                            const formatMY = (d) => `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                                            startMonthStr = formatMY(date);

                                            const duration = parseInt(fineData.payableDuration) || 1;
                                            const startYM = getYearMonth(baseMonthStr);
                                            const endYM = addMonthsToYM(startYM, duration - 1);

                                            // Reuse helpers for end date string
                                            const ey = Math.floor(endYM / 100);
                                            const em = endYM % 100;
                                            endMonthStr = `${em.toString().padStart(2, '0')}/${ey}`;
                                        }
                                    } catch (e) {
                                        console.error("Date parsing error:", e);
                                        startMonthStr = baseMonthStr;
                                    }
                                }
                                setFineSummaries({
                                    startMonthYear: startMonthStr,
                                    endMonthYear: endMonthStr,
                                    nextSalaryDeduction: Math.round(totalNextDeduction),
                                    targetMonthName: targetMonthName,
                                    aggregates,
                                    ...loanSummary,
                                    outstandingBalance: (totalAmount - paidAmount) +
                                        (loanSummary.personalLoan.amount - loanSummary.personalLoan.paid) +
                                        (loanSummary.salaryAdvance.amount - loanSummary.salaryAdvance.paid)
                                });
                            }
                        } catch (err) {
                            console.error("Failed to fetch all employee fines:", err);
                        }
                    } catch (empErr) {
                        console.warn("Employee fetch warning:", empErr);
                    }
                }
            } catch (err) {
                console.error('Error fetching details:', err);
                toast({
                    title: "Error",
                    description: "Failed to load fine details.",
                    variant: "destructive"
                });
            } finally {
                setLoading(false);
            }
        };

        fetchAllDetails();
    }, [id, toast]);

    const handleDownloadPdf = async () => {
        try {
            setDownloading(true);
            const response = await axiosInstance.get(`/Fine/${id}/pdf`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `FineForm-${fine.fineId || id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast({
                title: "Success",
                description: "PDF downloaded successfully.",
                variant: "success",
                className: "bg-green-50 border-green-200 text-green-800"
            });
        } catch (err) {
            console.error('Download error:', err);
            toast({
                title: "Download Failed",
                description: "Failed to generate PDF locally.",
                variant: "destructive"
            });
        } finally {
            setDownloading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const calculateServiceYears = (joinDate) => {
        if (!joinDate) return '-';
        const start = new Date(joinDate);
        const now = new Date();

        let years = now.getFullYear() - start.getFullYear();
        let months = now.getMonth() - start.getMonth();
        let days = now.getDate() - start.getDate();

        if (days < 0) {
            months--;
            const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            days += lastMonth.getDate();
        }
        if (months < 0) {
            years--;
            months += 12;
        }

        let result = [];
        if (years > 0) result.push(`${years} ${years === 1 ? 'Year' : 'Years'}`);
        if (months > 0) result.push(`${months} ${months === 1 ? 'Month' : 'Months'}`);
        if (days > 0 || result.length === 0) result.push(`${days} ${days === 1 ? 'Day' : 'Days'}`);

        return result.join(' ');
    };

    // Helper to format date
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString();
    };

    // Derived Data moved up to satisfy Rules of Hooks
    const mainEmployee = employeeDetails || (fine?.assignedEmployees?.[0] ? {
        firstName: fine.assignedEmployees[0].employeeName,
        lastName: '',
        employeeId: fine.assignedEmployees[0].employeeId
    } : {});

    // Logic to find active visa expiry (similar to VisaCard component)
    const activeVisaExpiry = useMemo(() => {
        if (!mainEmployee || !mainEmployee.visaDetails) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isValid = (dateStr) => dateStr && new Date(dateStr) >= today;

        const details = mainEmployee.visaDetails;
        // Prioritize Valid: Employment > Spouse > Visit
        if (isValid(details.employment?.expiryDate)) return details.employment.expiryDate;
        if (isValid(details.spouse?.expiryDate)) return details.spouse.expiryDate;
        if (isValid(details.visit?.expiryDate)) return details.visit.expiryDate;

        // Fallback to any existing one if all are expired
        return details.employment?.expiryDate || details.spouse?.expiryDate || details.visit?.expiryDate || null;
    }, [mainEmployee]);

    // Labour Card Expiry
    const labourCardExpiry = mainEmployee.labourCardDetails?.expiryDate || mainEmployee.labourCardExpiryDate || null;

    // Permission Logic
    // Permission Logic
    const canPerformAction = () => {
        if (!currentUser || !fine || !employeeDetails) return false;

        const isAdmin = currentUser.role === 'Admin' || currentUser.isAdmin;
        // Admin Force Override: Always true? Or subject to flow? 
        // Usually Admin can unblock anything.
        if (isAdmin) return true;

        const dept = (currentUser.department || '').toLowerCase();
        const desig = (currentUser.designation || '').toLowerCase();

        // CEO/Management Check
        const isCEO = dept.includes('management') && ['ceo', 'c.e.o', 'c.e.o.', 'chief executive officer', 'director', 'managing director', 'general manager', 'gm', 'g.m', 'g.m.'].includes(desig);

        // HR Check
        const isHR = dept.includes('hr') || dept.includes('human resource');

        // Accounts Check
        const isAccounts = dept.includes('account') || dept.includes('finance');

        const status = fine.fineStatus;

        // Reportee Check - STRICT: Must be the Assigned Employee for this fine
        // "Buttons only enabled for the reportee"
        let isAssignedEmployee = false;
        if (fine.assignedEmployees && fine.assignedEmployees.length > 0) {
            const currentEmpId = String(currentUser.employeeId || '').trim().toLowerCase();
            const currentObjId = String(currentUser._id || currentUser.id || '').trim();

            isAssignedEmployee = fine.assignedEmployees.some(assigned => {
                const aId = String(assigned.employeeId || '').trim().toLowerCase();
                // Match against custom ID or fallback to checking if assigned ID matches user's Object ID
                return (aId && aId === currentEmpId) || (aId && aId === currentObjId);
            });
        }

        if (status === 'Pending') {
            return isAssignedEmployee;
        }

        if (status === 'Pending HR') {
            return isHR;
        }

        if (status === 'Pending Accounts') {
            return isAccounts;
        }

        if (status === 'Pending Authorization') {
            return isCEO;
        }

        return false;
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F2F6F9]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!fine) return null;

    // Derived Data
    const toTitleCase = (str) => {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const rawName = `${mainEmployee.firstName || ''} ${mainEmployee.lastName || ''}`.trim() || fine?.assignedEmployees?.[0]?.employeeName;
    const employeeName = toTitleCase(rawName);
    const designation = mainEmployee.designation || '-';
    const department = mainEmployee.department || '-';
    const hodName = mainEmployee.reportsTo?.name || 'Manager'; // Fallback logic



    const handleApprove = async () => {
        try {
            setLoading(true);
            const targetId = fine?._id || id;
            const res = await axiosInstance.put(`/Fine/${targetId}/approve`);
            toast({
                title: "Success",
                description: res.data.message || "Fine approved successfully.",
                variant: "success",
                className: "bg-green-50 border-green-200 text-green-800"
            });
            // Refresh
            window.location.reload();
        } catch (err) {
            console.error("Approval error:", err);
            toast({
                title: "Error",
                description: err.response?.data?.message || "Failed to approve fine.",
                variant: "destructive"
            });
            setLoading(false);
        }
    };

    const handleReject = async () => {
        try {
            setLoading(true);
            const targetId = fine?._id || id;
            console.log("Rejecting Fine. targetId:", targetId, "fine._id:", fine?._id, "sanitized id:", id);
            const res = await axiosInstance.put(`/Fine/${targetId}`, { fineStatus: 'Rejected' });
            toast({
                title: "Success",
                description: "Fine rejected successfully.",
                variant: "success",
                className: "bg-green-50 border-green-200 text-green-800"
            });
            window.location.reload();
        } catch (err) {
            console.error("Rejection error:", err);
            toast({
                title: "Error",
                description: err.response?.data?.message || "Failed to reject fine.",
                variant: "destructive"
            });
            setLoading(false);
        }
    };

    const handleEdit = () => {
        // Redirect to edit page or open modal
        // Assuming there is an edit page or using the AddFineModal in edit mode?
        // Usually it's /HRM/Fine/edit/[id] or a modal. 
        // Current task doesn't specify creating an edit page, just the button.
        // I'll assume standard edit route /HRM/Fine/[id]/edit for now or just log it if route not exist.
        // Actually, let's look for an edit route. 
        // But for now, I'll just add the button with a placeholder alert or router push if I'm confident.
        // Let's assume a modal or separate page. 
        // Given existing patterns, it's likely a modal or same page edit.
        // I will just add the button visual for now as requested.
        alert("Edit functionality to be implemented or route to be defined.");
    };

    // Categorizing Fine Amounts for the Breakdown Table
    const fineTypes = [
        { label: 'Vehicle Fine', key: 'Vehicle Fine', catMatch: 'Vehicle' },
        { label: 'Safety Fine', key: 'Safety Fine', catMatch: 'Safety' },
        { label: 'Project Damage', key: 'Project Damage', catMatch: 'Project' },
        { label: 'Loss and Damage', key: 'Loss and Damage', catMatch: 'Loss' },
        { label: 'Other Fine / Damage', key: 'Other Fine / Damage', catMatch: 'Other' },
    ];

    // --- Profile Cards Logic ---
    const employeeForCard = employeeDetails || (fine?.assignedEmployees?.[0] ? {
        ...fine.assignedEmployees[0],
        firstName: fine.assignedEmployees[0].employeeName?.split(' ')[0] || '',
        lastName: fine.assignedEmployees[0].employeeName?.split(' ').slice(1).join(' ') || '',
        designation: mainEmployee.designation,
        department: mainEmployee.department,
        // Add other fields if available in mainEmployee
        ...mainEmployee
    } : null);

    const tenure = calculateTenure(employeeForCard?.dateOfJoining || employeeForCard?.contractJoiningDate);

    // Calculate expiry days for status items
    const visaDays = calculateDaysUntilExpiry(employeeForCard?.visaDetails?.employment?.expiryDate || employeeForCard?.visaDetails?.spouse?.expiryDate || employeeForCard?.visaDetails?.visit?.expiryDate);
    const passportDays = calculateDaysUntilExpiry(employeeForCard?.passportDetails?.expiryDate);
    const eidDays = calculateDaysUntilExpiry(employeeForCard?.emiratesIdDetails?.expiryDate);
    const labourCardDays = calculateDaysUntilExpiry(employeeForCard?.labourCardDetails?.expiryDate);
    const medDays = calculateDaysUntilExpiry(employeeForCard?.medicalInsuranceDetails?.expiryDate);
    const drivingLicenseDays = calculateDaysUntilExpiry(employeeForCard?.drivingLicenseDetails?.expiryDate);

    const statusItems = [
        { label: 'Visa', days: visaDays, color: getExpiryColor(visaDays) },
        { label: 'Passport', days: passportDays, color: getExpiryColor(passportDays) },
        { label: 'Emirates ID', days: eidDays, color: getExpiryColor(eidDays) },
        { label: 'Labour Card', days: labourCardDays, color: getExpiryColor(labourCardDays) },
        { label: 'Medical Ins.', days: medDays, color: getExpiryColor(medDays) },
        { label: 'Dr. License', days: drivingLicenseDays, color: getExpiryColor(drivingLicenseDays) },
    ];

    // --- Timeline Logic ---
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
        if (user.name) return user.name; // User schema
        if (user.firstName) return `${user.firstName} ${user.lastName || ''}`; // Employee schema fallback
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

    const timelineSteps = [
        {
            id: 'request',
            label: 'Requester',
            name: getUserName(fine.createdBy, 'System / Creator'),
            date: fine.createdAt
        },
        {
            id: 'reportee',
            label: 'Reportee',
            name: getUserName(fine.managerApprovedBy, fine.assignedEmployees?.[0]?.employeeName || 'Employee'),
            role: 'Employee'
        },
        {
            id: 'hr',
            label: 'HR',
            name: getUserName(fine.hrApprovedBy || (fine.fineStatus === 'Pending HR' ? fine.submittedTo : null), fine.hrHODName || 'HR Department'),
            role: 'Human Resources'
        },
        {
            id: 'accounts',
            label: 'Accounts',
            name: getUserName(fine.accountsApprovedBy || (fine.fineStatus === 'Pending Accounts' ? fine.submittedTo : null), fine.accountsHODName || 'Accounts Department'),
            role: 'Finance'
        },
        {
            id: 'ceo',
            label: 'CEO',
            name: getUserName(fine.fineStatus === 'Pending Authorization' ? fine.submittedTo : (fine.fineStatus === 'Approved' ? fine.approvedBy : null), 'Management'),
            role: 'CEO'
        }
    ];

    console.log("Fine Tracker Steps Debug:", {
        hrHOD: fine.hrHODName,
        accountsHOD: fine.accountsHODName,
        managerApproved: fine.managerApprovedBy,
        hrApproved: fine.hrApprovedBy,
        accountsApproved: fine.accountsApprovedBy
    });

    const timeline = [];
    let isBlocked = false;

    const currentStatus = fine.fineStatus;

    // Helper to find which step the rejection belongs to
    const getRejectionStepIndex = (rejectedByUser) => {
        if (!rejectedByUser) return 1; // Default to reportee if unknown
        const dept = (rejectedByUser.department || '').toLowerCase();
        const desig = (rejectedByUser.designation || '').toLowerCase();

        if (dept.includes('management') && ['ceo', 'c.e.o', 'c.e.o.', 'chief executive officer', 'director', 'managing director', 'general manager', 'gm', 'g.m'].includes(desig)) {
            return 4; // CEO
        }
        if (dept.includes('hr') || dept.includes('human resource')) {
            return 2; // HR
        }
        if (dept.includes('finance') || dept.includes('account')) {
            return 3; // Accounts
        }
        return 1; // Reportee Manager
    };

    const rejectionIndex = currentStatus === 'Rejected' ? getRejectionStepIndex(fine.rejectedBy) : -1;

    timelineSteps.forEach((step, index) => {
        let status = 'pending';
        let duration = '';
        let isRejected = false;

        if (index === 0) {
            status = 'completed';
        } else if (currentStatus === 'Rejected' && index === rejectionIndex) {
            status = 'rejected';
            isRejected = true;
            isBlocked = true;
        } else if (isBlocked) {
            status = 'blocked';
        } else {
            if (index === 1) { // Reportee
                if (['Pending HR', 'Pending Accounts', 'Pending Authorization', 'Approved'].includes(currentStatus)) {
                    status = 'completed';
                    // duration = getDuration(fine.createdAt, fine.updatedAt); // Approx
                } else if (currentStatus === 'Pending') {
                    status = 'active';
                    isBlocked = true; // Block future steps until this one is done
                }
            }
            else if (index === 2) { // HR
                if (['Pending Accounts', 'Pending Authorization', 'Approved'].includes(currentStatus)) {
                    status = 'completed';
                } else if (currentStatus === 'Pending HR') {
                    status = 'active';
                    isBlocked = true;
                }
            }
            else if (index === 3) { // Accounts
                if (['Pending Authorization', 'Approved'].includes(currentStatus)) {
                    status = 'completed';
                } else if (currentStatus === 'Pending Accounts') {
                    status = 'active';
                    isBlocked = true;
                }
            }
            else if (index === 4) { // CEO
                if (currentStatus === 'Approved') {
                    status = 'completed';
                    duration = getDuration(fine.createdAt, fine.approvedDate);
                } else if (currentStatus === 'Pending Authorization') {
                    status = 'active';
                    isBlocked = true;
                }
            }
        }

        // Add step
        timeline.push({
            ...step,
            status,
            duration,
            isRejected,
            name: isRejected ? getUserName(fine.rejectedBy, step.name) : step.name
        });
    });

    return (
        <PermissionGuard moduleId="hrm_fine" permissionType="view">
            <div className="flex min-h-screen w-full bg-[#F2F6F9] print:bg-white">
                <div className="print:hidden"><Sidebar /></div>
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="print:hidden"><Navbar /></div>
                    <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    You are about to change the status of this fine to <span className="font-bold">{pendingStatus}</span>.
                                    This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={executeStatusUpdate} disabled={actionLoading}>
                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <div className="flex-1 flex flex-col items-center justify-start py-8 print:py-0 relative overflow-y-auto w-full px-6 md:px-8">
                        {/* Download Button Top Right */}


                        {/* Top Grid: Profile + Action Card */}
                        <div className="flex flex-col xl:flex-row gap-6 w-full mb-8 print:hidden items-stretch">

                            {/* Left Column: Profile & Stats */}
                            <div className="flex-1 flex flex-col gap-6">
                                {employeeForCard && (
                                    <ProfileHeader
                                        employee={employeeForCard}
                                        hideProgressBar={true}
                                        hideStatusToggle={true}
                                        hideRole={true}
                                        hideContactNumber={true}
                                        hideEmail={true}
                                        enlargeProfilePic={false}
                                        showNameUnderProfilePic={true}
                                        extraContent={(
                                            <div className="grid grid-cols-2 gap-3 w-full">
                                                {/* Total - Blue */}
                                                <div className="flex items-center justify-between px-4 py-3 bg-blue-50 rounded-xl border border-blue-100">
                                                    <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">TOTAL</span>
                                                    <span className="text-lg font-bold text-blue-800">{fineSummaries.totalFineCount || 0}</span>
                                                </div>

                                                {/* Vehicle - Green */}
                                                <div className="flex items-center justify-between px-4 py-3 bg-green-50 rounded-xl border border-green-100">
                                                    <span className="text-xs font-bold text-green-600 uppercase tracking-widest">VEHICLE</span>
                                                    <span className="text-lg font-bold text-green-800">{fineSummaries.aggregates?.['Vehicle']?.count || 0}</span>
                                                </div>

                                                {/* Safety - Purple */}
                                                <div className="flex items-center justify-between px-4 py-3 bg-purple-50 rounded-xl border border-purple-100">
                                                    <span className="text-xs font-bold text-purple-600 uppercase tracking-widest">SAFETY</span>
                                                    <span className="text-lg font-bold text-purple-800">{fineSummaries.aggregates?.['Safety']?.count || 0}</span>
                                                </div>

                                                {/* Project Damage - Amber */}
                                                <div className="flex items-center justify-between px-4 py-3 bg-amber-50 rounded-xl border border-amber-100">
                                                    <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">PROJECT DAMAGE</span>
                                                    <span className="text-lg font-bold text-amber-800">{fineSummaries.aggregates?.['Project']?.count || 0}</span>
                                                </div>

                                                {/* Loss and Damage - Red */}
                                                <div className="flex items-center justify-between px-4 py-3 bg-red-50 rounded-xl border border-red-100">
                                                    <span className="text-xs font-bold text-red-600 uppercase tracking-widest">LOSS & DAMAGE</span>
                                                    <span className="text-lg font-bold text-red-800">{fineSummaries.aggregates?.['Loss']?.count || 0}</span>
                                                </div>

                                                {/* Other Damage - Gray */}
                                                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                                                    <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">OTHER DAMAGE</span>
                                                    <span className="text-lg font-bold text-gray-800">{fineSummaries.aggregates?.['Other']?.count || 0}</span>
                                                </div>
                                            </div>
                                        )}
                                    />
                                )}
                                {/* EmploymentSummary removed */}
                            </div>

                            {/* Right Column: Action Card */}
                            <div className="flex-1">
                                <div className="bg-white rounded-lg shadow-sm p-6 h-full flex flex-col relative overflow-hidden">
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        {/* Status Box */}
                                        <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center gap-2 ${fine?.fineStatus === 'Approved' ? 'bg-green-50 border-green-100 text-green-700' :
                                            fine?.fineStatus === 'Rejected' ? 'bg-red-50 border-red-100 text-red-700' :
                                                'bg-yellow-50 border-yellow-100 text-yellow-700'
                                            }`}>
                                            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Current Status</span>
                                            <span className="text-lg font-bold">{fine?.fineStatus || 'Unknown'}</span>
                                        </div>

                                        {/* Download Action */}
                                        <button
                                            onClick={handleDownloadPdf}
                                            disabled={downloading}
                                            className="p-4 rounded-xl border border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all flex flex-col items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {downloading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6" />}
                                            <span className="text-sm font-bold">Download PDF</span>
                                        </button>

                                        {/* Approve/Action Button */}
                                        {(() => {
                                            const status = fine?.fineStatus;
                                            if (status === 'Approved' || status === 'Rejected') {
                                                return (
                                                    <div className="p-4 rounded-xl border bg-gray-50 border-gray-100 text-gray-400 flex flex-col items-center justify-center gap-2 opacity-60 cursor-not-allowed">
                                                        <Check className="w-6 h-6" />
                                                        <span className="text-sm font-bold">Completed</span>
                                                    </div>
                                                );
                                            }

                                            if (canPerformAction()) {
                                                let btnLabel = "Approve";
                                                if (status === 'Pending') btnLabel = "Send to HR";
                                                else if (status === 'Pending HR') btnLabel = "Send to Accounts";
                                                else if (status === 'Pending Accounts') btnLabel = "Send to CEO";
                                                else if (status === 'Pending Authorization') btnLabel = "Approve Fine";

                                                return (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setPendingStatus(
                                                                    status === 'Pending' ? 'Pending HR' :
                                                                        status === 'Pending HR' ? 'Pending Accounts' :
                                                                            status === 'Pending Accounts' ? 'Pending Authorization' :
                                                                                'Approved'
                                                                );
                                                                setIsAlertOpen(true);
                                                            }}
                                                            className="p-4 rounded-xl border border-green-100 bg-green-50 text-green-600 hover:bg-green-100 transition-all flex flex-col items-center justify-center gap-2"
                                                        >
                                                            <Check className="w-6 h-6" />
                                                            <span className="text-sm font-bold">{btnLabel}</span>
                                                        </button>

                                                        <button
                                                            onClick={handleReject}
                                                            className="p-4 rounded-xl border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 transition-all flex flex-col items-center justify-center gap-2"
                                                        >
                                                            <X className="w-6 h-6" />
                                                            <span className="text-sm font-bold">Reject</span>
                                                        </button>
                                                    </>
                                                );
                                            }

                                            return (
                                                <div className="p-4 rounded-xl border bg-gray-50 border-gray-100 text-gray-400 flex flex-col items-center justify-center gap-2 opacity-60 cursor-not-allowed">
                                                    <Lock className="w-6 h-6" />
                                                    <span className="text-sm font-bold">Waiting for Action</span>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Edit Fine Details Button - Full Width */}
                                    {(canPerformAction() || currentUser.role === 'Admin' || currentUser.isAdmin) && (
                                        <div className="mt-auto pt-4">
                                            <button
                                                onClick={() => setShowEditModal(true)}
                                                className="w-full py-3 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Edit className="w-5 h-5" />
                                                <span className="font-bold">Edit Fine Details</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* Timeline */}
                                    {fine && (
                                        <div className="mt-auto pt-6 border-t border-gray-100">
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-6">Tracking History</h3>
                                            <div className="relative pb-2">
                                                <div className="absolute top-[15px] left-0 w-[calc(100%+3rem)] -ml-6 h-0.5 bg-gray-100 z-0">
                                                    <div className="h-full bg-green-500 transition-all duration-500" style={{
                                                        width: `${(timeline.filter(t => t.status === 'completed').length / (timeline.length - 1)) * 100}%`
                                                    }}></div>
                                                </div>

                                                <div className="flex justify-between relative z-10 w-full">
                                                    {timeline.map((step, idx) => (
                                                        <div key={step.id} className="flex flex-col items-center gap-2 flex-1 relative group">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 transition-all ${step.status === 'completed' ? 'bg-green-500 border-green-500 text-white shadow-md scale-110' :
                                                                step.status === 'rejected' ? 'bg-red-500 border-red-500 text-white shadow-md scale-110' :
                                                                    step.status === 'current' ? 'bg-white border-blue-500 text-blue-500 animate-pulse' :
                                                                        'bg-white border-gray-200 text-gray-300'
                                                                }`}>
                                                                {step.status === 'completed' ? <Check size={14} strokeWidth={3} /> :
                                                                    step.status === 'rejected' ? <X size={14} strokeWidth={3} /> :
                                                                        <div className={`w-2 h-2 rounded-full ${step.status === 'current' ? 'bg-blue-500' : 'bg-gray-300'}`} />}
                                                            </div>

                                                            <div className="flex flex-col items-center text-center">
                                                                <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${step.status === 'current' ? 'text-blue-600' :
                                                                    step.status === 'completed' ? 'text-green-600' :
                                                                        step.status === 'rejected' ? 'text-red-600' : 'text-gray-400'
                                                                    }`}>{step.label}</span>
                                                                <span className="text-[10px] font-medium text-gray-600 max-w-[80px] truncate">{step.name}</span>
                                                                {step.duration && <span className="text-[9px] text-gray-400 mt-0.5 font-mono">{step.duration}</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* A4 SHEET - With Background Image */}
                        <div
                            className="bg-white shadow-2xl print:shadow-none w-[1240px] h-[1855px] relative flex flex-col text-black font-sans box-border overflow-hidden print:m-0 print:w-full print:h-full scale-[0.75] origin-top print:scale-100 mb-[-350px] print:mb-0"
                            style={{
                                backgroundImage: 'url(/assets/forms/fine_form_bg_new.jpg)',
                                backgroundSize: '100% 100%',
                                backgroundRepeat: 'no-repeat'
                            }}
                        >


                            {/* Content Container - Pushed down to avoid header */}
                            <div className="px-12 pt-52 flex-1 flex flex-col gap-6">

                                {/* SECTION 1: FINE DETAILS */}
                                <div className="border border-black bg-white/90">
                                    {/* Blue Header */}
                                    <div className="bg-[#9bc4e9] border-b border-black text-center py-2 text-base font-semibold">
                                        Fine Details
                                    </div>

                                    {/* Details Grid */}
                                    <div className="grid grid-cols-2 text-sm">
                                        {/* Left Side */}
                                        <div className="border-r border-black">
                                            <div className="flex border-b border-black h-12">
                                                <div className="w-[120px] px-2 flex items-center font-medium border-r border-black">Employee Name</div>
                                                <div className="flex-1 px-2 flex items-center">{employeeName}</div>
                                            </div>
                                            <div className="flex border-b border-black h-12">
                                                <div className="w-[120px] px-2 flex items-center font-medium border-r border-black">HOD Name</div>
                                                <div className="flex-1 px-2 flex items-center">{hodName}</div>
                                            </div>
                                            <div className="flex border-b border-black h-12">
                                                <div className="w-[120px] px-2 flex items-center font-medium border-r border-black">Fine Type</div>
                                                <div className="flex-1 px-2 flex items-center">{fine.fineType || '-'}</div>
                                            </div>
                                            <div className="flex border-b border-black h-12">
                                                <div className="w-[120px] px-2 flex items-center font-medium border-r border-black">Employee Fine Amount</div>
                                                <div className="flex-1 px-2 flex items-center font-bold">
                                                    {getEmpShare(fine).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="flex h-12">
                                                <div className="w-[120px] px-2 flex items-center font-medium border-r border-black">Fine Payed By</div>
                                                <div className="flex-1 px-2 flex items-center">{fine.responsibleFor || '-'}</div>
                                            </div>
                                        </div>
                                        {/* Right Side */}
                                        <div>
                                            <div className="flex border-b border-black h-12">
                                                <div className="w-[120px] px-2 flex items-center font-medium border-r border-black">Department</div>
                                                <div className="flex-1 px-2 flex items-center">{department}</div>
                                            </div>
                                            <div className="flex border-b border-black h-12">
                                                <div className="w-[120px] px-2 flex items-center font-medium border-r border-black">Designation</div>
                                                <div className="flex-1 px-2 flex items-center">{designation}</div>
                                            </div>
                                            <div className="flex border-b border-black h-12">
                                                <div className="w-[120px] px-2 flex items-center font-medium border-r border-black">Fine Reason</div>
                                                <div className="flex-1 px-2 flex items-center">{fine.category || '-'}</div>
                                            </div>
                                            <div className="flex border-b border-black h-12">
                                                <div className="w-[120px] px-2 flex items-center font-medium border-r border-black">Service Charge</div>
                                                <div className="flex-1 px-2 flex items-center">-</div>
                                            </div>
                                            <div className="flex h-12">
                                                <div className="w-[120px] px-2 flex items-center font-medium border-r border-black">Fine Status</div>
                                                <div className="flex-1 px-2 flex items-center font-bold capitalize">{fine.fineStatus || '-'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Description Row */}
                                    <div className="border-t border-black flex border-b border-black">
                                        <div className="w-[120px] px-2 py-2 flex items-start font-medium border-r border-black text-sm">
                                            Fine Description :-
                                        </div>
                                        <div className="flex-1 px-2 py-2 text-sm min-h-[80px]">
                                            {fine.description || "No description provided."}

                                        </div>
                                    </div>


                                </div>

                                {/* Declaration */}
                                <div className="p-4 text-sm text-black font-bold leading-relaxed text-justify">
                                    <p>
                                        I <span className="font-bold border-b-2 border-dotted border-black px-1">{employeeName}</span> acknowledge that the fine mentioned above has been committed due to my responsibility. I understand and accept that I am accountable for this charge. I hereby authorize the deduction of the specified amount from my upcoming salary, as per the schedule outlined below:
                                    </p>
                                </div>

                                {/* SECTION 2: ACCOUNT / HR DEPT */}
                                <div className="border border-black bg-white/90">
                                    <div className="bg-[#9bc4e9] border-b border-black text-center py-2 text-base font-semibold">
                                        Account /HR Department
                                    </div>

                                    <div className="flex border-b border-black text-sm">
                                        <div className="flex-1 flex border-r border-black">
                                            <div className="w-1/2 px-2 py-3 flex items-center justify-center font-medium border-r border-black">No Of Installments</div>
                                            <div className="w-1/2 px-2 py-3 flex items-center justify-center">{fine.payableDuration || 1}</div>
                                        </div>
                                        <div className="flex-1 flex border-r border-black">
                                            <div className="w-1/2 px-2 py-3 flex items-center justify-center font-medium border-r border-black text-center">Start<br />month/year</div>
                                            <div className="w-1/2 px-2 py-3 flex items-center justify-center">{fineSummaries.startMonthYear}</div>
                                        </div>
                                        <div className="flex-1 flex">
                                            <div className="w-1/2 px-2 py-3 flex items-center justify-center font-medium border-r border-black text-center">END<br />Month/Year</div>
                                            <div className="w-1/2 px-2 py-3 flex items-center justify-center">{fineSummaries.endMonthYear}</div>
                                        </div>
                                    </div>

                                    {/* Employee Stats Grid */}
                                    <div className="grid grid-cols-2 text-sm">
                                        {/* Left */}
                                        <div className="border-r border-black">
                                            <div className="flex border-b border-black h-10">
                                                <div className="w-1/2 px-2 flex items-center font-medium border-r border-black">Visa Expiry</div>
                                                <div className="flex-1 px-2 flex items-center">{formatDate(activeVisaExpiry)}</div>
                                            </div>
                                            <div className="flex border-b border-black h-10">
                                                <div className="w-1/2 px-2 flex items-center font-medium border-r border-black">Joining Date</div>
                                                <div className="flex-1 px-2 flex items-center">{formatDate(mainEmployee.dateOfJoining || mainEmployee.contractJoiningDate || mainEmployee.joiningDate)}</div>
                                            </div>
                                            <div className="flex border-b border-black h-10">
                                                <div className="w-1/2 px-2 flex items-center font-medium border-r border-black">Total Fine</div>
                                                <div className="flex-1 px-2 flex items-center">{fineSummaries.totalFineCount} ({fineSummaries.totalAmount?.toLocaleString()})</div>
                                            </div>
                                            <div className="flex h-10">
                                                <div className="w-1/2 px-2 flex items-center font-medium border-r border-black">Paid Fine</div>
                                                <div className="flex-1 px-2 flex items-center">{fineSummaries.paidFineCount}</div>
                                            </div>
                                        </div>
                                        {/* Right */}
                                        <div>
                                            <div className="flex border-b border-black h-10">
                                                <div className="w-1/2 px-2 flex items-center font-medium border-r border-black">Labour Card Expiry</div>
                                                <div className="flex-1 px-2 flex items-center">{formatDate(labourCardExpiry)}</div>
                                            </div>
                                            <div className="flex border-b border-black h-10">
                                                <div className="w-1/2 px-2 flex items-center font-medium border-r border-black">Year Of service</div>
                                                <div className="flex-1 px-2 flex items-center">{calculateServiceYears(mainEmployee.dateOfJoining || mainEmployee.contractJoiningDate || mainEmployee.joiningDate)}</div>
                                            </div>
                                            <div className="flex border-b border-black h-10">
                                                <div className="w-1/2 px-2 flex items-center font-medium border-r border-black">Total Fine Type</div>
                                                <div className="flex-1 px-2 flex items-center">{fineSummaries.distinctTypesCount || 5}</div>
                                            </div>
                                            <div className="flex h-10">
                                                <div className="w-1/2 px-2 flex items-center font-medium border-r border-black">Outstanding balance</div>
                                                <div className="flex-1 px-2 flex items-center">{fineSummaries.outstandingBalance?.toLocaleString()}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 3: FINE BREAKDOWN */}
                                <div className="border border-black text-sm bg-white/90">
                                    {/* Header */}
                                    <div className="flex bg-[#9bc4e9] border-b border-black text-center font-semibold h-10 items-center">
                                        <div className="w-[30%] border-r border-black h-full flex items-center justify-center">Fine Type</div>
                                        <div className="w-[15%] border-r border-black h-full flex items-center justify-center">Fine Amount</div>
                                        <div className="w-[20%] border-r border-black h-full flex items-center justify-center">Fine Duration</div>
                                        <div className="w-[15%] border-r border-black h-full flex items-center justify-center">Paid Amount</div>
                                        <div className="w-[20%] h-full flex items-center justify-center">Outstanding</div>
                                    </div>

                                    {/* Rows */}
                                    {fineTypes.map((type, idx) => {
                                        const agg = fineSummaries.aggregates?.[type.catMatch] || { amount: 0, paid: 0, count: 0 };
                                        return (
                                            <div key={idx} className="flex border-b border-black h-11 items-center">
                                                <div className="w-[30%] px-2 border-r border-black h-full flex items-center">{type.label} ({agg.count})</div>
                                                <div className="w-[15%] text-center border-r border-black h-full flex items-center justify-center">{agg.amount || '0'}</div>
                                                <div className="w-[20%] text-center border-r border-black h-full flex items-center justify-center">{agg.duration || '0'}</div>
                                                <div className="w-[15%] text-center border-r border-black h-full flex items-center justify-center">{agg.paid || '0'}</div>
                                                <div className="w-[20%] text-center h-full flex items-center justify-center">{agg.amount - agg.paid || '0'}</div>
                                            </div>
                                        );
                                    })}

                                    {/* SECTION 4: LOAN HEADER (Embedded in table as per layout) */}
                                    <div className="flex bg-[#9bc4e9] border-b border-black text-center font-semibold h-10 items-center border-t border-black">
                                        <div className="w-[30%] border-r border-black h-full flex items-center justify-center">Loan/Salary Advance</div>
                                        <div className="w-[15%] border-r border-black h-full flex items-center justify-center">Amount</div>
                                        <div className="w-[20%] border-r border-black h-full flex items-center justify-center">Duration</div>
                                        <div className="w-[15%] border-r border-black h-full flex items-center justify-center">Paid Amount</div>
                                        <div className="w-[20%] h-full flex items-center justify-center">Outstanding</div>
                                    </div>

                                    {/* Loan Rows */}
                                    <div className="flex border-b border-black h-11 items-center">
                                        <div className="w-[30%] px-2 border-r border-black h-full flex items-center">Personal Loan ({fineSummaries.personalLoan?.count || 0})</div>
                                        <div className="w-[15%] text-center border-r border-black h-full flex items-center justify-center">{fineSummaries.personalLoan?.amount?.toLocaleString() || '0'}</div>
                                        <div className="w-[20%] text-center border-r border-black h-full flex items-center justify-center">{fineSummaries.personalLoan?.duration || '0'}</div>
                                        <div className="w-[15%] text-center border-r border-black h-full flex items-center justify-center">{fineSummaries.personalLoan?.paid?.toLocaleString() || '0'}</div>
                                        <div className="w-[20%] text-center h-full flex items-center justify-center">{(fineSummaries.personalLoan?.amount - fineSummaries.personalLoan?.paid)?.toLocaleString() || '0'}</div>
                                    </div>
                                    <div className="flex h-11 items-center">
                                        <div className="w-[30%] px-2 border-r border-black h-full flex items-center">Salary Advance ({fineSummaries.salaryAdvance?.count || 0})</div>
                                        <div className="w-[15%] text-center border-r border-black h-full flex items-center justify-center">{fineSummaries.salaryAdvance?.amount?.toLocaleString() || '0'}</div>
                                        <div className="w-[20%] text-center border-r border-black h-full flex items-center justify-center">{fineSummaries.salaryAdvance?.duration || '0'}</div>
                                        <div className="w-[15%] text-center border-r border-black h-full flex items-center justify-center">{fineSummaries.salaryAdvance?.paid?.toLocaleString() || '0'}</div>
                                        <div className="w-[20%] text-center h-full flex items-center justify-center">{(fineSummaries.salaryAdvance?.amount - fineSummaries.salaryAdvance?.paid)?.toLocaleString() || '0'}</div>
                                    </div>
                                </div>

                                {/* SUMMARY ROW */}
                                <div className="border border-black bg-white/90 text-sm flex h-12">
                                    <div className="w-[25%] border-r border-black flex items-center px-2 font-medium">Total Outstading</div>
                                    <div className="w-[25%] border-r border-black flex items-center justify-center font-bold">
                                        {fineSummaries.outstandingBalance?.toLocaleString()}
                                    </div>
                                    <div className="flex-1 flex items-center pl-4 font-medium">
                                        Next Month Deduction : <span className="ml-2 font-bold text-red-600">{fineSummaries.nextSalaryDeduction?.toLocaleString() || '0'}</span>
                                    </div>
                                </div>

                                {/* SIGNATURES */}
                                <div className="bg-transparent mb-6">
                                    <p className="text-sm font-medium mb-1">Acknowledged By :-</p>
                                    <div className="border border-black bg-white/90 flex h-40 text-sm">
                                        <div className="flex-1 border-r border-black flex flex-col p-2">
                                            <div className="font-semibold text-center h-10">Employee Name<br />Signature</div>
                                            <div className="flex-1 flex items-center justify-center text-xs text-gray-400 italic"></div>
                                        </div>
                                        <div className="flex-1 border-r border-black flex flex-col p-2">
                                            <div className="font-semibold text-center h-10">HOD Name<br />Signature</div>
                                            <div className="flex-1 flex items-center justify-center"></div>
                                        </div>
                                        <div className="flex-1 border-r border-black flex flex-col p-2">
                                            <div className="font-semibold text-center h-10">HR Officer Name<br />Signature</div>
                                            <div className="flex-1 flex items-center justify-center"></div>
                                        </div>
                                        <div className="flex-1 border-r border-black flex flex-col p-2">
                                            <div className="font-semibold text-center h-10">Accounts Name<br />Signature</div>
                                            <div className="flex-1 flex items-center justify-center"></div>
                                        </div>
                                        <div className="flex-1 flex flex-col p-2">
                                            <div className="font-semibold text-center h-10">MGMT Name<br />Signature</div>
                                            <div className="flex-1 flex items-center justify-center relative">
                                                {fine.fineStatus === 'Approved' && (
                                                    <div className="border-2 border-green-600 text-green-600 font-bold text-lg px-2 py-1 rounded rotate-[-12deg] opacity-70">
                                                        APPROVED
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>

                {/* Edit Fine Modal */}
                {showEditModal && (
                    <AddFineModal
                        isOpen={showEditModal}
                        onClose={() => setShowEditModal(false)}
                        onSuccess={refreshData}
                        employees={allEmployees}
                        initialData={fine} // Pass as initialData strictly
                        currentUser={currentUser}
                    />
                )}
            </div>
        </PermissionGuard >
    );
}
