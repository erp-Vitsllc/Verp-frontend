'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Country, State } from 'country-state-city';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
// react-phone-input-2 is now lazy loaded via DynamicPhoneInput component
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
import { formatPhoneForInput, formatPhoneForSave, normalizeText, normalizeContactNumber, getCountryName, getStateName, getFullLocation, sanitizeContact, contactsAreSame, getInitials, formatDate, calculateDaysUntilExpiry, calculateTenure, getAllCountriesOptions, getAllCountryNames } from './utils/helpers';
import { departmentOptions, statusOptions, getDesignationOptions } from './utils/constants';
import { hasPermission, isAdmin } from '@/utils/permissions';
import { toast } from '@/hooks/use-toast';


export default function EmployeeProfilePage() {
    const params = useParams();
    const router = useRouter();
    const employeeId = params?.employeeId;
    const DEFAULT_PHONE_COUNTRY = 'ae';

    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState('basic');
    const [activeSubTab, setActiveSubTab] = useState('basic-details');
    const [selectedSalaryAction, setSelectedSalaryAction] = useState('Salary History');
    const [salaryHistoryPage, setSalaryHistoryPage] = useState(1);
    const [salaryHistoryItemsPerPage, setSalaryHistoryItemsPerPage] = useState(10);
    const [imageError, setImageError] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        employeeId: '',
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
        secondaryReportee: ''
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
        gender: '',
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
    const [confirmDeleteTraining, setConfirmDeleteTraining] = useState({
        open: false,
        trainingIndex: null
    });
    const [confirmDeleteDocument, setConfirmDeleteDocument] = useState({
        open: false,
        index: null
    });
    const [reportingAuthorityOptions, setReportingAuthorityOptions] = useState([]);
    const [reportingAuthorityLoading, setReportingAuthorityLoading] = useState(false);
    const [reportingAuthorityError, setReportingAuthorityError] = useState('');
    const [showBankModal, setShowBankModal] = useState(false);
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
    const [savingSalary, setSavingSalary] = useState(false);
    const [uploadingDocument, setUploadingDocument] = useState(false);
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
        if (!employee?.reportingAuthority) return null;
        // Handle populated object
        if (typeof employee.reportingAuthority === 'object' && employee.reportingAuthority !== null) {
            return `${employee.reportingAuthority.firstName || ''} ${employee.reportingAuthority.lastName || ''}`.trim() || employee.reportingAuthority.employeeId || null;
        }
        // Handle string/ID
        const match = reportingAuthorityOptions.find(option => option.value === employee.reportingAuthority);
        return match?.label || null;
    }, [employee?.reportingAuthority, reportingAuthorityOptions]);

    const reportingAuthorityEmail = useMemo(() => {
        if (!employee?.reportingAuthority) return null;
        // Handle populated object
        if (typeof employee.reportingAuthority === 'object' && employee.reportingAuthority !== null) {
            return employee.reportingAuthority.email || employee.reportingAuthority.workEmail || null;
        }
        // Handle string/ID
        const match = reportingAuthorityOptions.find(option => option.value === employee.reportingAuthority);
        return match?.email || null;
    }, [employee?.reportingAuthority, reportingAuthorityOptions]);
    const [sendingApproval, setSendingApproval] = useState(false);
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
        file: null
    });
    const [labourCardErrors, setLabourCardErrors] = useState({});
    const [savingLabourCard, setSavingLabourCard] = useState(false);
    const labourCardFileRef = useRef(null);

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

    // Documents State
    const [showDocumentModal, setShowDocumentModal] = useState(false);
    const [documentForm, setDocumentForm] = useState({
        type: '',
        file: null,
        fileBase64: '',
        fileName: '',
        fileMime: ''
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
        trainingFrom: '',
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

    const openEditModal = useCallback(() => {
        if (!employee || activeTab !== 'basic') return;

        // Format date of birth to yyyy-MM-dd format
        let formattedDateOfBirth = '';
        if (employee.dateOfBirth) {
            const date = new Date(employee.dateOfBirth);
            if (!isNaN(date.getTime())) {
                formattedDateOfBirth = date.toISOString().split('T')[0]; // Extract yyyy-MM-dd
            }
        }

        // Normalize nationality to match exactly with allCountriesOptions
        const nationalityValue = employee.nationality || employee.country || '';
        let finalNationality = '';
        if (nationalityValue) {
            // First, try to get the country name from the code
            const countryName = getCountryName(nationalityValue.toString().trim().toUpperCase());

            // Find exact match in allCountriesOptions to ensure it matches the dropdown
            const matchedOption = allCountriesOptions.find(
                option => option.value.toLowerCase() === countryName.toLowerCase() ||
                    option.value.toLowerCase() === nationalityValue.toString().trim().toLowerCase()
            );

            // Use the matched option value (exact country name from options) or fallback to countryName
            finalNationality = matchedOption ? matchedOption.value : (countryName || nationalityValue);
        }

        setEditForm({
            employeeId: employee.employeeId || '',
            email: employee.email || employee.workEmail || '',
            contactNumber: formatPhoneForInput(employee.contactNumber || ''),
            dateOfBirth: formattedDateOfBirth,
            maritalStatus: employee.maritalStatus || '',
            fathersName: employee.fathersName || '',
            gender: employee.gender || '',
            nationality: finalNationality,
            numberOfDependents: employee.numberOfDependents ? String(employee.numberOfDependents) : '',
            status: employee.status || '',
            probationPeriod: employee.probationPeriod || null
        });
        setEditFormErrors({});
        setShowEditModal(true);
    }, [employee, activeTab, allCountriesOptions]);

    const openWorkDetailsModal = () => {
        if (!employee) return;

        // Set default probation period to 6 months if status is Probation and not set
        let probationPeriod = employee.probationPeriod;
        if ((employee.status === 'Probation' || !employee.status) && !probationPeriod) {
            probationPeriod = 6; // Default 6 months
        }

        setWorkDetailsForm({
            reportingAuthority: (() => {
                if (!employee?.reportingAuthority) return '';
                // If it's a populated object, extract the ID
                if (typeof employee.reportingAuthority === 'object' && employee.reportingAuthority !== null) {
                    // Try _id first (MongoDB ObjectId or string)
                    const id = employee.reportingAuthority._id;
                    if (id) {
                        return typeof id === 'string' ? id : (id.toString ? id.toString() : String(id));
                    }
                    // Fallback to employeeId if _id is not available
                    return employee.reportingAuthority.employeeId || '';
                }
                // If it's already a string/ID, return as is
                return String(employee.reportingAuthority || '');
            })(),
            overtime: employee.overtime || false,
            status: employee.status || 'Probation',
            probationPeriod: probationPeriod,
            designation: employee.designation || '',
            department: employee.department || '',
            primaryReportee: (() => {
                if (!employee?.primaryReportee) return '';
                // If it's a populated object, extract the ID
                if (typeof employee.primaryReportee === 'object' && employee.primaryReportee !== null) {
                    // Extract _id (MongoDB ObjectId or string) - this is what reportingAuthorityOptions use
                    const id = employee.primaryReportee._id;
                    if (id) {
                        // Convert to string to match options
                        return typeof id === 'string' ? id : (id.toString ? id.toString() : String(id));
                    }
                    // Fallback: if _id is not available, return empty and let user select
                    return '';
                }
                // If it's already a string/ID, return as is
                return String(employee.primaryReportee || '');
            })(),
            secondaryReportee: (() => {
                if (!employee?.secondaryReportee) return '';
                // If it's a populated object, extract the ID
                if (typeof employee.secondaryReportee === 'object' && employee.secondaryReportee !== null) {
                    // Extract _id (MongoDB ObjectId or string) - this is what reportingAuthorityOptions use
                    const id = employee.secondaryReportee._id;
                    if (id) {
                        // Convert to string to match options
                        return typeof id === 'string' ? id : (id.toString ? id.toString() : String(id));
                    }
                    // Fallback: if _id is not available, return empty and let user select
                    return '';
                }
                // If it's already a string/ID, return as is
                return String(employee.secondaryReportee || '');
            })()
        });
        setWorkDetailsErrors({});
        setShowWorkDetailsModal(true);
    };

    const handleOpenEducationModal = useCallback(() => {
        setEducationForm(initialEducationForm);
        setEducationErrors({});
        setEditingEducationId(null);
        setShowEducationModal(true);
    }, []);

    // Validate individual education field
    const validateEducationField = (field, value) => {
        const errors = { ...educationErrors };
        let error = '';

        if (field === 'universityOrBoard' || field === 'collegeOrInstitute' || field === 'course' || field === 'fieldOfStudy') {
            if (!value || value.trim() === '') {
                error = `${field === 'universityOrBoard' ? 'University / Board' : field === 'collegeOrInstitute' ? 'College / Institute' : field === 'course' ? 'Course' : 'Field of Study'} is required`;
            } else if (!/^[A-Za-z\s]+$/.test(value)) {
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

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        const isValidMimeType = allowedTypes.includes(file.type);
        const isValidExtension = allowedExtensions.includes(fileExtension);

        if (!isValidMimeType || !isValidExtension) {
            setEducationErrors(prev => ({
                ...prev,
                certificate: 'Only PDF, JPEG, or PNG file formats are allowed.'
            }));
            // Clear the file input
            if (educationCertificateFileRef.current) {
                educationCertificateFileRef.current.value = '';
            }
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

    const validateEducationForm = () => {
        const errors = {};

        // Validate University / Board
        if (!educationForm.universityOrBoard || educationForm.universityOrBoard.trim() === '') {
            errors.universityOrBoard = 'University / Board is required';
        } else if (!/^[A-Za-z\s]+$/.test(educationForm.universityOrBoard)) {
            errors.universityOrBoard = 'Only letters and spaces are allowed. No numbers or special characters.';
        }

        // Validate College / Institute
        if (!educationForm.collegeOrInstitute || educationForm.collegeOrInstitute.trim() === '') {
            errors.collegeOrInstitute = 'College / Institute is required';
        } else if (!/^[A-Za-z\s]+$/.test(educationForm.collegeOrInstitute)) {
            errors.collegeOrInstitute = 'Only letters and spaces are allowed. No numbers or special characters.';
        }

        // Validate Course
        if (!educationForm.course || educationForm.course.trim() === '') {
            errors.course = 'Course is required';
        } else if (!/^[A-Za-z\s]+$/.test(educationForm.course)) {
            errors.course = 'Only letters and spaces are allowed. No numbers or special characters.';
        }

        // Validate Field of Study
        if (!educationForm.fieldOfStudy || educationForm.fieldOfStudy.trim() === '') {
            errors.fieldOfStudy = 'Field of Study is required';
        } else if (!/^[A-Za-z\s]+$/.test(educationForm.fieldOfStudy)) {
            errors.fieldOfStudy = 'Only letters and spaces are allowed. No numbers or special characters.';
        }

        // Validate Completed Year
        if (!educationForm.completedYear || educationForm.completedYear.trim() === '') {
            errors.completedYear = 'Completed Year is required';
        } else if (!/^\d{4}$/.test(educationForm.completedYear)) {
            errors.completedYear = 'Year must be in YYYY format (e.g., 2024)';
        } else {
            const year = parseInt(educationForm.completedYear, 10);
            const currentYear = new Date().getFullYear();
            if (year < 1900 || year > currentYear) {
                errors.completedYear = `Year must be between 1900 and ${currentYear}`;
            }
        }

        // Validate Certificate
        if (!educationForm.certificateName || !educationForm.certificateData) {
            errors.certificate = 'Certificate file is required';
        } else {
            // Validate file type
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png'];
            const fileExtension = '.' + educationForm.certificateName.split('.').pop().toLowerCase();
            const isValidMimeType = allowedTypes.includes(educationForm.certificateMime);
            const isValidExtension = allowedExtensions.includes(fileExtension);

            if (!isValidMimeType || !isValidExtension) {
                errors.certificate = 'Only PDF, JPEG, or PNG file formats are allowed.';
            }
        }

        setEducationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSaveEducation = async () => {
        // Validate all fields
        if (!validateEducationForm()) {
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

    const handleDeleteEducation = (educationId) => {
        if (!educationId) return;
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
                    // Check if start date is before joining date
                    if (employee?.dateOfJoining) {
                        const joiningDate = new Date(employee.dateOfJoining);
                        joiningDate.setHours(0, 0, 0, 0);
                        date.setHours(0, 0, 0, 0);
                        if (date >= joiningDate) {
                            error = 'Start Date must be before the joining date';
                        }
                    }
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
                    // Check if end date is before joining date
                    if (employee?.dateOfJoining) {
                        const joiningDate = new Date(employee.dateOfJoining);
                        joiningDate.setHours(0, 0, 0, 0);
                        endDate.setHours(0, 0, 0, 0);
                        if (endDate >= joiningDate) {
                            error = 'End Date must be before the joining date';
                        }
                    }
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

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        const isValidMimeType = allowedTypes.includes(file.type);
        const isValidExtension = allowedExtensions.includes(fileExtension);

        if (!isValidMimeType || !isValidExtension) {
            setExperienceErrors(prev => ({
                ...prev,
                certificate: 'Only PDF, JPEG, or PNG file formats are allowed.'
            }));
            // Clear the file input
            if (experienceCertificateFileRef.current) {
                experienceCertificateFileRef.current.value = '';
            }
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
                // Check if start date is before joining date
                if (employee?.dateOfJoining) {
                    const joiningDate = new Date(employee.dateOfJoining);
                    joiningDate.setHours(0, 0, 0, 0);
                    startDate.setHours(0, 0, 0, 0);
                    if (startDate >= joiningDate) {
                        errors.startDate = 'Start Date must be before the joining date';
                    }
                }
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
                // Check if end date is before joining date
                if (employee?.dateOfJoining) {
                    const joiningDate = new Date(employee.dateOfJoining);
                    joiningDate.setHours(0, 0, 0, 0);
                    endDate.setHours(0, 0, 0, 0);
                    if (endDate >= joiningDate) {
                        errors.endDate = 'End Date must be before the joining date';
                    }
                }
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
        const file = e.target.files[0];
        if (file) {
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
        }
    };

    const handleEditDocument = (index) => {
        const doc = employee?.documents?.[index];
        if (doc) {
            setDocumentForm({
                type: doc.type || '',
                file: null,
                fileBase64: doc.document?.data || '',
                fileName: doc.document?.name || '',
                fileMime: doc.document?.mimeType || ''
            });
            setEditingDocumentIndex(index);
            setDocumentErrors({});
            setShowDocumentModal(true);
        }
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

    const handleDeleteDocument = (index) => {
        setConfirmDeleteDocument({
            open: true,
            index: index
        });
    };

    const confirmDeleteSalaryAction = async () => {
        const { salaryIndex, sortedHistory } = confirmDeleteSalary;
        if (salaryIndex === null || !sortedHistory) return;

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

    const confirmDeleteDocumentAction = async () => {
        const index = confirmDeleteDocument.index;
        if (index === null) return;

        setConfirmDeleteDocument({ open: false, index: null });
        setDeletingDocumentIndex(index);
        try {
            const updatedDocuments = [...(employee?.documents || [])];
            updatedDocuments.splice(index, 1);

            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                documents: updatedDocuments
            });
            // Optimistically update local state instead of refetching
            updateEmployeeOptimistically({ documents: updatedDocuments });
            toast({
                variant: "default",
                title: "Document Deleted",
                description: "Document has been deleted successfully."
            });
        } catch (error) {
            console.error('Failed to delete document:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || error.message || "Failed to delete document. Please try again."
            });
        } finally {
            setDeletingDocumentIndex(null);
        }
    };

    const handleSaveDocument = useCallback(async () => {
        if (!documentForm.type || !documentForm.type.trim()) {
            setDocumentErrors({ type: 'Document type is required' });
            return;
        }
        if (!documentForm.file && !documentForm.fileBase64 && editingDocumentIndex === null) {
            setDocumentErrors({ file: 'Document file is required' });
            return;
        }

        setSavingDocument(true);
        try {
            let documentUrl = null;
            let documentName = '';
            let documentMime = '';

            // Upload new document to Cloudinary FIRST (if new file provided)
            if (documentForm.file) {
                // New file selected - upload to Cloudinary
                documentName = documentForm.file.name;
                documentMime = documentForm.file.type || 'application/pdf';

                try {
                    setUploadingDocument(true);
                    const base64Data = await fileToBase64(documentForm.file);
                    const fullBase64 = `data:${documentMime};base64,${base64Data}`;

                    const uploadResponse = await axiosInstance.post(`/Employee/upload-document/${employeeId}`, {
                        document: fullBase64,
                        folder: `employee-documents/${employeeId}/documents`,
                        fileName: documentName,
                        resourceType: 'raw'
                    }, {
                        timeout: 30000 // 30 second timeout for large files
                    });

                    if (uploadResponse.data && uploadResponse.data.url) {
                        documentUrl = uploadResponse.data.url;
                    } else {
                        throw new Error('No URL returned from upload');
                    }
                } catch (uploadError) {
                    console.error('Error uploading document to Cloudinary:', uploadError);
                    setUploadingDocument(false);
                    setSavingDocument(false);
                    toast({
                        variant: "destructive",
                        title: "Upload failed",
                        description: uploadError.response?.data?.message || uploadError.message || "Failed to upload document. Please try again."
                    });
                    return;
                } finally {
                    setUploadingDocument(false);
                }
            } else if (documentForm.fileBase64) {
                // Existing file from form state (could be Cloudinary URL or base64)
                if (documentForm.fileBase64.startsWith('http://') || documentForm.fileBase64.startsWith('https://')) {
                    // Already a Cloudinary URL
                    documentUrl = documentForm.fileBase64;
                } else {
                    // Base64 data - upload to Cloudinary
                    documentName = documentForm.fileName || 'document.pdf';
                    documentMime = documentForm.fileMime || 'application/pdf';

                    try {
                        setUploadingDocument(true);
                        const fullBase64 = documentForm.fileBase64.includes(',')
                            ? documentForm.fileBase64
                            : `data:${documentMime};base64,${documentForm.fileBase64}`;

                        const uploadResponse = await axiosInstance.post(`/Employee/upload-document/${employeeId}`, {
                            document: fullBase64,
                            folder: `employee-documents/${employeeId}/documents`,
                            fileName: documentName,
                            resourceType: 'raw'
                        }, {
                            timeout: 30000
                        });

                        if (uploadResponse.data && uploadResponse.data.url) {
                            documentUrl = uploadResponse.data.url;
                        } else {
                            throw new Error('No URL returned from upload');
                        }
                    } catch (uploadError) {
                        console.error('Error uploading document to Cloudinary:', uploadError);
                        setUploadingDocument(false);
                        setSavingDocument(false);
                        toast({
                            variant: "destructive",
                            title: "Upload failed",
                            description: uploadError.response?.data?.message || uploadError.message || "Failed to upload document. Please try again."
                        });
                        return;
                    } finally {
                        setUploadingDocument(false);
                    }
                }
                documentName = documentForm.fileName || 'document.pdf';
                documentMime = documentForm.fileMime || 'application/pdf';
            } else if (editingDocumentIndex !== null && employee?.documents?.[editingDocumentIndex]?.document) {
                // Editing existing document - preserve existing document data
                const existingDoc = employee.documents[editingDocumentIndex].document;
                if (existingDoc.url) {
                    documentUrl = existingDoc.url;
                } else if (existingDoc.data) {
                    documentUrl = existingDoc.data; // Legacy base64 - will be migrated on next upload
                }
                documentName = existingDoc.name || 'document.pdf';
                documentMime = existingDoc.mimeType || 'application/pdf';
            }

            // Build document object with Cloudinary URL (preferred) or legacy data
            const documentData = {
                type: documentForm.type.trim(),
                document: documentUrl ? {
                    url: documentUrl.startsWith('http://') || documentUrl.startsWith('https://') ? documentUrl : undefined,
                    data: (!documentUrl.startsWith('http://') && !documentUrl.startsWith('https://')) ? documentUrl : undefined,
                    name: documentName,
                    mimeType: documentMime
                } : undefined
            };

            let updatedDocuments = [...(employee?.documents || [])];
            if (editingDocumentIndex !== null) {
                // When editing, preserve existing document if no new file is uploaded
                updatedDocuments[editingDocumentIndex] = {
                    ...updatedDocuments[editingDocumentIndex],
                    type: documentData.type,
                    document: documentData.document || updatedDocuments[editingDocumentIndex].document
                };
            } else {
                // Only push if document file exists (validation should prevent this, but double-check)
                if (documentData.document) {
                    updatedDocuments.push(documentData);
                } else {
                    throw new Error('Document file is required');
                }
            }

            const response = await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                documents: updatedDocuments
            });

            // Store editing state before resetting
            const wasEditing = editingDocumentIndex !== null;

            // Close modal and reset form immediately for better UX
            setShowDocumentModal(false);
            setDocumentForm({
                type: '',
                file: null,
                fileBase64: '',
                fileName: '',
                fileMime: ''
            });
            setDocumentErrors({});
            setEditingDocumentIndex(null);
            if (documentFileRef.current) {
                documentFileRef.current.value = '';
            }

            // Optimistically update local state - use response data if available, otherwise use our computed update
            const updatedEmployee = response.data?.employee;
            if (updatedEmployee) {
                setEmployee(updatedEmployee);
            } else {
                updateEmployeeOptimistically({ documents: updatedDocuments });
            }

            toast({
                variant: "default",
                title: wasEditing ? "Document Updated" : "Document Added",
                description: wasEditing ? "Document has been updated successfully." : "Document has been added successfully."
            });
        } catch (error) {
            console.error('Failed to save document:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || error.message || "Failed to save document. Please try again."
            });
        } finally {
            setSavingDocument(false);
        }
    }, [documentForm, editingDocumentIndex, employee, employeeId, documentFileRef, fileToBase64, setUploadingDocument, toast, updateEmployeeOptimistically]);

    // Training Handlers
    const handleTrainingFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
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
        }
    };

    const handleSaveTraining = useCallback(async () => {
        if (!trainingForm.trainingName || !trainingForm.trainingName.trim()) {
            setTrainingErrors({ trainingName: 'Training name is required' });
            return;
        }
        if (!trainingForm.trainingFrom || !trainingForm.trainingFrom.trim()) {
            setTrainingErrors({ trainingFrom: 'Training provider is required' });
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
                trainingFrom: trainingForm.trainingFrom.trim(),
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
                trainingFrom: '',
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

            // Validate primary reportee is mandatory
            if (!workDetailsForm.primaryReportee || workDetailsForm.primaryReportee.trim() === '') {
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
                primaryReportee: workDetailsForm.primaryReportee || null,
                secondaryReportee: workDetailsForm.secondaryReportee || null
            };

            // Probation Period is required if status is Probation
            if (workDetailsForm.status === 'Probation') {
                updatePayload.probationPeriod = probationPeriod;

                // Check if probation period has ended based on joining date
                if (employee.dateOfJoining && probationPeriod) {
                    const joiningDate = new Date(employee.dateOfJoining);
                    const probationEndDate = new Date(joiningDate);
                    probationEndDate.setMonth(probationEndDate.getMonth() + probationPeriod);

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
            gender: employee.gender || '',
            nationality: finalNationality,
            numberOfDependents: employee.numberOfDependents ? String(employee.numberOfDependents) : ''
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
            gender: '',
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

            // String fields: fathersName (letters and spaces only), nationality (letters, spaces, hyphens, apostrophes)
            if (field === 'fathersName') {
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
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (issueDate >= today) {
                        error = 'Issue date must be a past date';
                    } else if (emiratesIdForm.expiryDate) {
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
                    if (expiryDate <= today) {
                        error = 'Expiry date must be a future date';
                    } else if (emiratesIdForm.issueDate) {
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
        if (file) {
            setEmiratesIdForm(prev => ({ ...prev, file }));
            setEmiratesIdErrors(prev => {
                const updated = { ...prev };
                delete updated.file;
                return updated;
            });
        }
    };

    // Validate Labour Card date fields
    const validateLabourCardDateField = (field, value) => {
        const errors = { ...labourCardErrors };
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
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (issueDate >= today) {
                        error = 'Issue date must be a past date';
                    } else if (labourCardForm.expiryDate) {
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
                    if (expiryDate <= today) {
                        error = 'Expiry date must be a future date';
                    } else if (labourCardForm.issueDate) {
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
        if (file) {
            setLabourCardForm(prev => ({ ...prev, file }));
            setLabourCardErrors(prev => {
                const updated = { ...prev };
                delete updated.file;
                return updated;
            });
        }
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
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (issueDate >= today) {
                        error = 'Issue date must be a past date';
                    } else if (medicalInsuranceForm.expiryDate) {
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
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (expiryDate <= today) {
                        error = 'Expiry date must be a future date';
                    } else if (medicalInsuranceForm.issueDate) {
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
        if (file) {
            setMedicalInsuranceForm(prev => ({ ...prev, file }));
            setMedicalInsuranceErrors(prev => {
                const updated = { ...prev };
                delete updated.file;
                return updated;
            });
        }
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
                if (issueDate >= today) {
                    errors.issueDate = 'Issue date must be a past date';
                } else if (emiratesIdForm.expiryDate) {
                    const expiryDate = new Date(emiratesIdForm.expiryDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // Validate expiry date - must be future date
        if (!emiratesIdForm.expiryDate) {
            errors.expiryDate = 'Expiry date is required';
        } else {
            const dateValidation = validateDate(emiratesIdForm.expiryDate, true);
            if (!dateValidation.isValid) {
                errors.expiryDate = dateValidation.error;
            } else {
                const expiryDate = new Date(emiratesIdForm.expiryDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (expiryDate <= today) {
                    errors.expiryDate = 'Expiry date must be a future date';
                } else if (emiratesIdForm.issueDate) {
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
                file: null
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
                file: null
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
                file: null
            });
            setLabourCardErrors({});
            if (labourCardFileRef.current) {
                labourCardFileRef.current.value = '';
            }
        }
    };

    const handleSaveLabourCard = async () => {
        const errors = {};

        // Validate number
        if (!labourCardForm.number || !labourCardForm.number.trim()) {
            errors.number = 'Labour Card number is required';
        }

        // Validate issue date - must be past date
        if (!labourCardForm.issueDate) {
            errors.issueDate = 'Issue date is required';
        } else {
            const dateValidation = validateDate(labourCardForm.issueDate, true);
            if (!dateValidation.isValid) {
                errors.issueDate = dateValidation.error;
            } else {
                const issueDate = new Date(labourCardForm.issueDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (issueDate >= today) {
                    errors.issueDate = 'Issue date must be a past date';
                } else if (labourCardForm.expiryDate) {
                    const expiryDate = new Date(labourCardForm.expiryDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
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
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (expiryDate <= today) {
                    errors.expiryDate = 'Expiry date must be a future date';
                } else if (labourCardForm.issueDate) {
                    const issueDate = new Date(labourCardForm.issueDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // Validate file
        if (!labourCardForm.file && !employee?.labourCardDetails?.document?.data) {
            errors.file = 'Document is required';
        }

        if (Object.keys(errors).length > 0) {
            setLabourCardErrors(errors);
            return;
        }

        setSavingLabourCard(true);
        try {
            let upload = null;
            let uploadName = '';
            let uploadMime = '';

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

            await axiosInstance.patch(`/Employee/labour-card/${employeeId}`, {
                number: labourCardForm.number.trim(),
                issueDate: labourCardForm.issueDate,
                expiryDate: labourCardForm.expiryDate,
                upload,
                uploadName,
                uploadMime
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
                if (issueDate >= today) {
                    errors.issueDate = 'Issue date must be a past date';
                } else if (medicalInsuranceForm.expiryDate) {
                    const expiryDate = new Date(medicalInsuranceForm.expiryDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // Validate expiry date - must be future date
        if (!medicalInsuranceForm.expiryDate) {
            errors.expiryDate = 'Expiry date is required';
        } else {
            const dateValidation = validateDate(medicalInsuranceForm.expiryDate, true);
            if (!dateValidation.isValid) {
                errors.expiryDate = dateValidation.error;
            } else {
                const expiryDate = new Date(medicalInsuranceForm.expiryDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (expiryDate <= today) {
                    errors.expiryDate = 'Expiry date must be a future date';
                } else if (medicalInsuranceForm.issueDate) {
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
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (issueDate >= today) {
                        error = 'Issue date must be a past date';
                    } else if (drivingLicenseForm.expiryDate) {
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
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (expiryDate <= today) {
                        error = 'Expiry date must be a future date';
                    } else if (drivingLicenseForm.issueDate) {
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

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            setDrivingLicenseErrors(prev => ({
                ...prev,
                file: 'Only PDF, JPEG, or PNG file formats are allowed'
            }));
            if (e.target) {
                e.target.value = '';
            }
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
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (issueDate >= today) {
                    errors.issueDate = 'Issue date must be a past date';
                } else if (drivingLicenseForm.expiryDate) {
                    const expiryDate = new Date(drivingLicenseForm.expiryDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // Validate expiry date - must be future date
        if (!drivingLicenseForm.expiryDate) {
            errors.expiryDate = 'Expiry date is required';
        } else {
            const dateValidation = validateDate(drivingLicenseForm.expiryDate, true);
            if (!dateValidation.isValid) {
                errors.expiryDate = dateValidation.error;
            } else {
                const expiryDate = new Date(drivingLicenseForm.expiryDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (expiryDate <= today) {
                    errors.expiryDate = 'Expiry date must be a future date';
                } else if (drivingLicenseForm.issueDate) {
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

            await axiosInstance.patch(`/Employee/driving-license/${employeeId}`, {
                number: drivingLicenseForm.number.trim(),
                issueDate: drivingLicenseForm.issueDate,
                expiryDate: drivingLicenseForm.expiryDate,
                document: upload,
                documentName: uploadName,
                documentMime: uploadMime
            });

            await fetchEmployee();
            handleCloseDrivingLicenseModal();
            toast({
                variant: "default",
                title: "Driving License updated",
                description: "Driving License information has been saved successfully."
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
    const handleOpenBankModal = () => {
        if (employee) {
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
                // Don't clear fileBase64/fileName/fileMime - preserve existing document
            }));
            setBankFormErrors(prev => ({
                ...prev,
                file: ''
            }));
            return;
        }

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            setBankFormErrors(prev => ({
                ...prev,
                file: 'Only PDF, JPEG, or PNG file formats are allowed'
            }));
            if (e.target) {
                e.target.value = '';
            }
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

        // Validate Bank Attachment - Required only if not in DB
        const hasExistingBankAttachment = (employee?.bankAttachment?.url || employee?.bankAttachment?.data) ? true : false;
        if (!bankForm.file && !bankForm.fileBase64 && !hasExistingBankAttachment) {
            errors.file = 'Bank attachment is required';
            hasErrors = true;
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
        }
        setEditingSalaryIndex(null);
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

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            setSalaryFormErrors(prev => ({
                ...prev,
                offerLetter: 'Only PDF, JPEG, or PNG file formats are allowed'
            }));
            if (e.target) {
                e.target.value = '';
            }
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

    const handleSaveSalary = async () => {
        if (!employeeId) return;

        // Validate all fields
        const errors = {
            month: '',
            fromDate: '',
            basic: '',
            houseRentAllowance: '',
            vehicleAllowance: '',
            otherAllowance: '',
            offerLetter: ''
        };

        let hasErrors = false;

        // Validate Month
        if (!salaryForm.month || salaryForm.month.trim() === '') {
            errors.month = 'Month is required';
            hasErrors = true;
        } else if (!monthOptions.find(opt => opt.value === salaryForm.month)) {
            errors.month = 'Please select a valid month';
            hasErrors = true;
        }

        // Validate From Date - must be valid date
        if (!salaryForm.fromDate || salaryForm.fromDate.trim() === '') {
            errors.fromDate = 'From Date is required';
            hasErrors = true;
        } else {
            const dateValidation = validateDate(salaryForm.fromDate, true);
            if (!dateValidation.isValid) {
                errors.fromDate = dateValidation.error;
                hasErrors = true;
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

        // Validate Offer Letter - Required
        const hasExistingOfferLetter = (() => {
            if (editingSalaryIndex !== null && employee?.salaryHistory) {
                // Use history as-is (no sorting), latest entries are at the top
                const sortedHistory = [...employee.salaryHistory];
                const entryToEdit = sortedHistory[editingSalaryIndex];
                return (entryToEdit?.offerLetter?.url || entryToEdit?.offerLetter?.data) ? true : false;
            } else if (hasSalaryDetailsMemo && employee?.salaryHistory) {
                const activeEntry = employee.salaryHistory.find(entry => !entry.toDate);
                return (activeEntry?.offerLetter?.url || activeEntry?.offerLetter?.data) ? true : false;
            }
            return (employee?.offerLetter?.url || employee?.offerLetter?.data) ? true : false;
        })();

        if (!salaryForm.offerLetterFileBase64 && !salaryForm.offerLetterFile && !hasExistingOfferLetter) {
            errors.offerLetter = 'Offer letter is required';
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

            // Upload offer letter to Cloudinary FIRST (if new file provided)
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
                        fileName: salaryForm.offerLetterFile.name || 'offer-letter',
                        resourceType: 'raw'
                    }, {
                        timeout: 30000 // 30 second timeout for large files
                    });

                    if (uploadResponse.data && uploadResponse.data.url) {
                        offerLetterCloudinaryUrl = uploadResponse.data.url;
                        offerLetterName = salaryForm.offerLetterFile.name || 'offer-letter.pdf';
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
                    console.error('Error uploading offer letter to Cloudinary:', uploadError);
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
                        fileName: salaryForm.offerLetterFileName || 'offer-letter',
                        resourceType: 'raw'
                    }, {
                        timeout: 30000
                    });

                    if (uploadResponse.data && uploadResponse.data.url) {
                        offerLetterCloudinaryUrl = uploadResponse.data.url;
                        offerLetterName = salaryForm.offerLetterFileName || 'offer-letter.pdf';
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
                    console.error('Error uploading offer letter to Cloudinary:', uploadError);
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

            if (editingSalaryIndex !== null) {
                // Editing existing record from history - keep original dates
                // Use history as-is (no sorting), latest entries are at the top
                const sortedHistory = [...salaryHistory];

                const entryToEdit = sortedHistory[editingSalaryIndex];

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
                // Update offer letter if provided, otherwise preserve existing
                if (offerLetterCloudinaryUrl) {
                    updatedEntry.offerLetter = {
                        url: offerLetterCloudinaryUrl,
                        name: offerLetterName,
                        mimeType: offerLetterMime
                    };
                } else if (entryToEdit?.offerLetter) {
                    // Preserve existing offer letter if no new file is uploaded
                    updatedEntry.offerLetter = entryToEdit.offerLetter;
                }

                // Find and replace in original array
                const originalIndex = salaryHistory.findIndex(e =>
                    e._id === entryToEdit._id ||
                    (e.fromDate === entryToEdit.fromDate && e.basic === entryToEdit.basic)
                );
                if (originalIndex !== -1) {
                    salaryHistory[originalIndex] = updatedEntry;
                }
            } else {
                // Adding new record or editing initial salary through "Edit Salary Details"
                const today = new Date();
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

                // Check if this is editing the initial salary (when employee has basic/otherAllowance)
                const isEditingInitialSalary = hasSalaryDetailsMemo;

                if (isEditingInitialSalary) {
                    // Editing initial salary - preserve history by closing old entry and creating new one
                    const fromDate = salaryForm.fromDate ? new Date(salaryForm.fromDate) : today;
                    const month = salaryForm.month || monthNames[fromDate.getMonth()];

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
                        // Close the old initial salary entry by setting its toDate to the new fromDate
                        const oldEntry = salaryHistory[initialEntryIndex];
                        salaryHistory[initialEntryIndex] = {
                            ...oldEntry,
                            toDate: fromDate // Close the old entry at the new entry's fromDate
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
                    // Add offer letter if provided
                    if (offerLetterCloudinaryUrl) {
                        newInitialSalaryEntry.offerLetter = {
                            url: offerLetterCloudinaryUrl,
                            name: offerLetterName,
                            mimeType: offerLetterMime
                        };
                    }
                    salaryHistory.unshift(newInitialSalaryEntry); // Add new entry at the top (latest first)
                } else {
                    // Adding new salary record (not initial)
                    const fromDate = salaryForm.fromDate ? new Date(salaryForm.fromDate) : today;
                    const month = salaryForm.month || monthNames[fromDate.getMonth()];

                    // Update the previous entry's toDate to the new entry's fromDate
                    if (salaryHistory.length > 0) {
                        const currentActiveEntry = salaryHistory.find(entry => !entry.toDate);
                        if (currentActiveEntry) {
                            currentActiveEntry.toDate = fromDate;
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
                    // Add offer letter if provided
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
                basic: latestActiveEntry?.basic || basic,
                houseRentAllowance: latestActiveEntry?.houseRentAllowance || houseRentAllowance,
                additionalAllowances: additionalAllowances,
                otherAllowance: latestActiveEntry?.otherAllowance || otherAllowance,
                salaryHistory: salaryHistory
            };

            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, payload);

            // Optimistically update employee state with saved salary details
            // latestActiveEntry is already declared above
            updateEmployeeOptimistically({
                basic: latestActiveEntry?.basic || basic,
                houseRentAllowance: latestActiveEntry?.houseRentAllowance || houseRentAllowance,
                vehicleAllowance: latestActiveEntry?.vehicleAllowance || vehicleAllowance,
                fuelAllowance: latestActiveEntry?.fuelAllowance || fuelAllowance,
                otherAllowance: latestActiveEntry?.otherAllowance || otherAllowance,
                salaryHistory: salaryHistory,
                // Update offer letter if it was saved
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
                title: editingSalaryIndex !== null ? "Salary Record Updated" : "Salary Record Added",
                description: editingSalaryIndex !== null
                    ? "Salary record was updated successfully."
                    : "Salary record was added successfully."
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

        if (type === 'permanent') {
            // Convert state and country codes to full names
            const stateCode = employee?.state || '';
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
            const stateCode = employee?.currentState || '';
            countryCode = employee?.currentCountry || '';
            stateFullName = stateCode ? getStateName(countryCode, stateCode) : '';
            countryFullName = countryCode ? getCountryName(countryCode) : '';

            // If getCountryName returns the code (not found), try to find it in the countries list
            if (countryFullName === countryCode && countryCode) {
                const country = Country.getCountryByCode(countryCode);
                countryFullName = country ? country.name : countryCode;
            }

            setAddressForm({
                line1: employee?.currentAddressLine1 || '',
                line2: employee?.currentAddressLine2 || '',
                city: employee?.currentCity || '',
                state: stateFullName || stateCode || '',
                country: countryFullName || '',
                postalCode: employee?.currentPostalCode || ''
            });
        }

        // Load states for the selected country - use countryFullName if available, otherwise countryCode
        const countryToUse = countryFullName || countryCode;
        if (countryToUse) {
            // First try to find country by code
            let country = Country.getCountryByCode(countryToUse);
            if (!country) {
                // If not found by code, try to find by name
                country = Country.getAllCountries().find(c => c.name === countryToUse);
            }
            if (country) {
                const states = State.getStatesOfCountry(country.isoCode).map(state => ({
                    label: state.name,
                    value: state.name
                }));

                // Ensure current state value is in the options if it exists and doesn't match exactly
                const currentStateValue = stateFullName || stateCode || '';
                if (currentStateValue) {
                    // Check if state value matches any option (case-insensitive)
                    const matchingState = states.find(s =>
                        s.value.toLowerCase() === currentStateValue.toLowerCase() ||
                        s.label.toLowerCase() === currentStateValue.toLowerCase()
                    );

                    if (!matchingState) {
                        // Add the current state value to options if it's not already there
                        states.unshift({ label: currentStateValue, value: currentStateValue });
                    } else {
                        // Update form state to use the exact value from options to ensure match
                        setAddressForm(prev => ({
                            ...prev,
                            state: matchingState.value
                        }));
                    }
                }

                setAddressStateOptions(states);
            } else {
                // If country not found but we have a state value, still allow it
                if (stateFullName || stateCode) {
                    setAddressStateOptions([{ label: stateFullName || stateCode, value: stateFullName || stateCode }]);
                } else {
                    setAddressStateOptions([]);
                }
            }
        } else {
            setAddressStateOptions([]);
        }

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

            // Load states for selected country
            if (processedValue) {
                // Find country code from country name
                const country = Country.getAllCountries().find(c => c.name === processedValue);
                if (country) {
                    const states = State.getStatesOfCountry(country.isoCode).map(state => ({
                        label: state.name,
                        value: state.name
                    }));

                    // If states array is empty, it means the country doesn't have states/emirates
                    // In this case, allow manual entry by providing an empty array (field won't be disabled)
                    // But for countries with states, ensure we have options
                    if (states.length === 0) {
                        // Country has no states - allow empty options so field isn't disabled
                        // User can still type if needed, but for UAE we should have emirates
                        setAddressStateOptions([]);
                    } else {
                        setAddressStateOptions(states);
                    }
                } else {
                    // Country not found - allow empty options
                    setAddressStateOptions([]);
                }
            } else {
                setAddressStateOptions([]);
            }

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

        // Input restrictions
        if (field === 'city') {
            processedValue = value.replace(/[^A-Za-z\s]/g, '');
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
            } else if (!/^[A-Za-z\s]+$/.test(processedValue.trim())) {
                error = 'City must contain letters and spaces only';
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
            } else if (!/^[A-Za-z\s]+$/.test(addressForm.city.trim())) {
                errors.city = 'City must contain letters and spaces only';
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

    const handleSubmitForApproval = async () => {
        if (!employee || sendingApproval || !isProfileReady || approvalStatus !== 'draft') return;
        if (!employee.reportingAuthority || !reportingAuthorityEmail) {
            toast({
                variant: "default",
                title: "Reporting To missing",
                description: "Please assign someone to report to with a valid email before submitting for approval."
            });
            return;
        }
        try {
            setSendingApproval(true);
            await axiosInstance.post(`/Employee/${employeeId}/send-approval-email`);
            await fetchEmployee();
            toast({
                variant: "default",
                title: "Request sent",
                description: "Notification sent to the reporting authority. Waiting for activation."
            });
        } catch (error) {
            console.error('Failed to send approval request', error);
            toast({
                variant: "destructive",
                title: "Request failed",
                description: error.response?.data?.message || error.message || "Could not send approval request."
            });
        } finally {
            setSendingApproval(false);
        }
    };

    const handleActivateProfile = async () => {
        if (activatingProfile || !employee || approvalStatus !== 'submitted') return;
        try {
            setActivatingProfile(true);
            await axiosInstance.post(`/Employee/${employeeId}/approve-profile`);
            await fetchEmployee();
            toast({
                variant: "default",
                title: "Profile activated",
                description: "The employee profile has been activated."
            });
        } catch (error) {
            console.error('Failed to activate profile', error);
            toast({
                variant: "destructive",
                title: "Activation failed",
                description: error.response?.data?.message || error.message || "Could not activate profile."
            });
        } finally {
            setActivatingProfile(false);
        }
    };

    // Check if employee nationality is UAE (handles both code and full name)
    // Memoize the function so it can be passed to components
    const isUAENationality = useCallback(() => {
        if (!employee) return false;

        // Check both nationality and country fields
        const nationalityValue = (employee.nationality || employee.country || '').toString().trim();
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
    }, [employee?.nationality, employee?.country, getCountryName]);

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

            // 2. Validate Email (required, valid email format)
            const emailValidation = validateEmail(editForm.email, true);
            if (!emailValidation.isValid) {
                errors.email = emailValidation.error;
            }

            // 3. Validate Contact Number (required, valid international format)
            const contactDigits = (editForm.contactNumber || '').replace(/\D/g, '');
            const contactValidation = validatePhoneNumber(contactDigits, editCountryCode, true);
            if (!contactValidation.isValid) {
                errors.contactNumber = contactValidation.error;
            }

            // 4. Validate Date of Birth (required, valid date)
            const dobValidation = validateDate(editForm.dateOfBirth, true);
            if (!dobValidation.isValid) {
                errors.dateOfBirth = dobValidation.error;
            }

            // 5. Validate Marital Status (required, must be from predefined options)
            const validMaritalStatuses = ['single', 'married', 'divorced', 'widowed'];
            if (!editForm.maritalStatus || editForm.maritalStatus.trim() === '') {
                errors.maritalStatus = 'Marital Status is required';
            } else if (!validMaritalStatuses.includes(editForm.maritalStatus.toLowerCase())) {
                errors.maritalStatus = 'Please select a valid marital status option';
            }

            // 6. Validate Number of Dependents (optional, but must be valid number if provided and marital status is married)
            if (editForm.maritalStatus === 'married' && editForm.numberOfDependents && editForm.numberOfDependents.trim() !== '') {
                const dependentsValue = parseInt(editForm.numberOfDependents, 10);
                if (isNaN(dependentsValue) || dependentsValue < 0) {
                    errors.numberOfDependents = 'Number of dependents must be a valid positive number';
                } else if (dependentsValue > 50) {
                    errors.numberOfDependents = 'Number of dependents cannot exceed 50';
                }
            }

            // 7. Validate Father's Name (required, letters and spaces only - no numbers or special characters)
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

            // 7. Validate Gender (required, must be selected from given options)
            if (!editForm.gender || editForm.gender.trim() === '') {
                errors.gender = 'Gender is required';
            } else {
                const validGenders = ['male', 'female', 'other'];
                if (!validGenders.includes(editForm.gender.toLowerCase())) {
                    errors.gender = 'Please select a valid gender option';
                }
            }

            // 8. Validate Nationality (required, must be from country list or valid text)
            if (!editForm.nationality || editForm.nationality.trim() === '') {
                errors.nationality = 'Nationality is required';
            } else {
                const trimmedNationality = editForm.nationality.trim();
                if (trimmedNationality.length < 2) {
                    errors.nationality = 'Nationality must be at least 2 characters';
                } else if (!/^[A-Za-z\s'-]+$/.test(trimmedNationality)) {
                    errors.nationality = 'Nationality must contain only letters, spaces, hyphens, and apostrophes';
                }
                // Optionally validate against country list if getAllCountryNames is available
                // This is handled in the UI with a dropdown, but we validate the text format here
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
                email: editForm.email,
                contactNumber: formattedContactNumber,
                dateOfBirth: editForm.dateOfBirth || null,
                maritalStatus: editForm.maritalStatus,
                fathersName: editForm.fathersName,
                gender: editForm.gender,
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
            return;
        }

        try {
            fetchingEmployeeRef.current = true;
            setLoading(true);
            setError('');

            const response = await axiosInstance.get(`/Employee/${employeeId}`, {
                timeout: 60000 // 60 seconds timeout for employee detail fetch (may include large data)
            });
            let data = response.data?.employee || response.data;

            // Check and auto-update probation status if period has ended (only on initial load)
            if (!skipProbationCheck && data && data.status === 'Probation' && data.dateOfJoining) {
                if (data.probationPeriod) {
                    const joiningDate = new Date(data.dateOfJoining);
                    const probationEndDate = new Date(joiningDate);
                    probationEndDate.setMonth(probationEndDate.getMonth() + data.probationPeriod);

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    probationEndDate.setHours(0, 0, 0, 0);

                    // If probation period has ended, automatically update to Permanent
                    if (probationEndDate <= today) {
                        try {
                            await axiosInstance.patch(`/Employee/work-details/${employeeId}`, {
                                status: 'Permanent',
                                probationPeriod: null
                            });
                            // Optimistically update local state instead of refetching
                            data = { ...data, status: 'Permanent', probationPeriod: null };
                        } catch (updateErr) {
                            console.error('Error auto-updating probation status:', updateErr);
                            // Continue with original data if update fails
                        }
                    }
                } else {
                    // Set default 6 months if not set
                    try {
                        await axiosInstance.patch(`/Employee/work-details/${employeeId}`, {
                            probationPeriod: 6
                        });
                        // Optimistically update local state instead of refetching
                        data = { ...data, probationPeriod: 6 };
                    } catch (updateErr) {
                        console.error('Error setting default probation period:', updateErr);
                        // Continue with original data if update fails
                    }
                }
            }

            setEmployee(data);
            setImageError(false); // Reset image error when employee data changes
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
                    router.push('/Employee');
                }, 2000);
            } else {
                setError(err.response?.data?.message || err.message || 'Unable to load employee details');
            }
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
            // Reduced limit and optimized query - only fetch essential fields
            const response = await axiosInstance.get('/Employee', {
                params: {
                    limit: 200, // Reduced from 500 - sufficient for most cases
                }
            });
            const employees = Array.isArray(response.data?.employees) ? response.data.employees : [];
            const options = employees
                .filter((emp) => emp._id !== employeeId && emp.employeeId !== employeeId)
                .map((emp) => {
                    const fullName = [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim() || emp.employeeId || 'Unnamed Employee';
                    const label = `${fullName} (${emp.designation || emp.role || 'No designation'})`;
                    return {
                        value: emp._id,
                        label,
                        email: emp.email || emp.workEmail || '',
                        sortKey: normalizeText(fullName)
                    };
                })
                .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
                .map(({ sortKey, ...rest }) => rest);
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
        setEducationDetails(employee?.educationDetails || []);
        setExperienceDetails(employee?.experienceDetails || []);
    }, [employee]);

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
            router.push('/Employee');
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
            employee.passportDetails.countryOfIssue ||
            employee.passportDetails.document?.data)
    );
    const hasSalaryDetails = () => {
        if (!employee) return false;
        return !!(
            employee.basic ||
            employee.houseRentAllowance ||
            employee.otherAllowance ||
            (employee.additionalAllowances && employee.additionalAllowances.length > 0)
        );
    };

    const hasBankDetailsSection = () => {
        if (!employee) return false;
        const bankFields = [
            employee.bankName,
            employee.bank,
            employee.accountName,
            employee.bankAccountName,
            employee.accountNumber,
            employee.bankAccountNumber,
            employee.ibanNumber,
            employee.swiftCode,
            employee.ifscCode,
            employee.ifsc,
            employee.bankOtherDetails,
            employee.otherBankDetails
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

        let totalFields = 0;
        let completedFields = 0;

        // Basic Details fields (from modal)
        const basicFields = [
            { value: employee.employeeId, name: 'Employee ID' },
            { value: employee.contactNumber, name: 'Contact Number' },
            { value: employee.email || employee.workEmail, name: 'Email' },
            { value: employee.nationality, name: 'Nationality' },
            { value: employee.status, name: 'Status' }
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
        if (employee.passportDetails) {
            const passportFields = [
                { value: employee.passportDetails.number, name: 'Passport Number' },
                { value: employee.passportDetails.issueDate, name: 'Passport Issue Date' },
                { value: employee.passportDetails.expiryDate, name: 'Passport Expiry Date' },
                { value: employee.passportDetails.placeOfIssue, name: 'Place of Issue' }
            ];
            passportFields.forEach(({ value, name }) => {
                totalFields++;
                if (checkField(value, name, 'Passport')) completedFields++;
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
        const isVisaRequired = !nationality ||
            (nationality !== 'uae' &&
                nationality !== 'ae' &&
                nationality !== 'united arab emirates' &&
                nationality !== 'united arab emirate');
        if (isVisaRequired) {
            const visaTypes = ['visit', 'employment', 'spouse'];
            const hasAnyVisa = visaTypes.some(type => employee.visaDetails?.[type]?.number);

            if (hasAnyVisa) {
                // Check all visa types that exist
                visaTypes.forEach(type => {
                    const visa = employee.visaDetails?.[type];
                    if (visa?.number) {
                        const visaLabel = type.charAt(0).toUpperCase() + type.slice(1);
                        const visaFields = [
                            { value: visa.number, name: `${visaLabel} Visa Number` },
                            { value: visa.issueDate, name: `${visaLabel} Visa Issue Date` },
                            { value: visa.expiryDate, name: `${visaLabel} Visa Expiry Date` }
                        ];

                        // Sponsor is required only for Employment and Spouse visas, not for Visit visa
                        if (type === 'employment' || type === 'spouse') {
                            visaFields.push({ value: visa.sponsor, name: `${visaLabel} Visa Sponsor` });
                        }

                        visaFields.forEach(({ value, name }) => {
                            totalFields++;
                            if (checkField(value, name, 'Visa')) completedFields++;
                        });
                    }
                });
            } else {
                // No visa added yet - require at least one visa type
                totalFields += 4; // One visa type with 4 fields
                if (!sectionPendingMap.has('Visa')) {
                    sectionPendingMap.set('Visa', []);
                }
                sectionPendingMap.get('Visa').push('Add at least one visa (Visit/Employment/Spouse)');
            }
        }

        // Emirates ID fields (required for all employees)
        if (employee.emiratesIdDetails) {
            const emiratesIdFields = [
                { value: employee.emiratesIdDetails.number, name: 'Emirates ID Number' },
                { value: employee.emiratesIdDetails.issueDate, name: 'Emirates ID Issue Date' },
                { value: employee.emiratesIdDetails.expiryDate, name: 'Emirates ID Expiry Date' }
            ];
            emiratesIdFields.forEach(({ value, name }) => {
                totalFields++;
                if (checkField(value, name, 'Emirates ID')) completedFields++;
            });
        } else {
            // Emirates ID not added - add all fields to pending
            ['Emirates ID Number', 'Emirates ID Issue Date', 'Emirates ID Expiry Date'].forEach(name => {
                totalFields++;
                if (!sectionPendingMap.has('Emirates ID')) {
                    sectionPendingMap.set('Emirates ID', []);
                }
                sectionPendingMap.get('Emirates ID').push(name);
            });
        }

        // Medical Insurance fields (required for all employees)
        if (employee.medicalInsuranceDetails) {
            const medicalInsuranceFields = [
                { value: employee.medicalInsuranceDetails.provider, name: 'Medical Insurance Provider' },
                { value: employee.medicalInsuranceDetails.number, name: 'Medical Insurance Number' },
                { value: employee.medicalInsuranceDetails.issueDate, name: 'Medical Insurance Issue Date' },
                { value: employee.medicalInsuranceDetails.expiryDate, name: 'Medical Insurance Expiry Date' }
            ];
            medicalInsuranceFields.forEach(({ value, name }) => {
                totalFields++;
                if (checkField(value, name, 'Medical Insurance')) completedFields++;
            });
        } else {
            // Medical Insurance not added - add all fields to pending
            ['Medical Insurance Provider', 'Medical Insurance Number', 'Medical Insurance Issue Date', 'Medical Insurance Expiry Date'].forEach(name => {
                totalFields++;
                if (!sectionPendingMap.has('Medical Insurance')) {
                    sectionPendingMap.set('Medical Insurance', []);
                }
                sectionPendingMap.get('Medical Insurance').push(name);
            });
        }

        // Labour Card fields (required for all employees)
        if (employee.labourCardDetails) {
            const labourCardFields = [
                { value: employee.labourCardDetails.number, name: 'Labour Card Number' },
                { value: employee.labourCardDetails.issueDate, name: 'Labour Card Issue Date' },
                { value: employee.labourCardDetails.expiryDate, name: 'Labour Card Expiry Date' }
            ];
            labourCardFields.forEach(({ value, name }) => {
                totalFields++;
                if (checkField(value, name, 'Labour Card')) completedFields++;
            });
        } else {
            // Labour Card not added - add all fields to pending
            ['Labour Card Number', 'Labour Card Issue Date', 'Labour Card Expiry Date'].forEach(name => {
                totalFields++;
                if (!sectionPendingMap.has('Labour Card')) {
                    sectionPendingMap.set('Labour Card', []);
                }
                sectionPendingMap.get('Labour Card').push(name);
            });
        }

        // Driving License fields (required for all employees)
        if (employee.drivingLicenceDetails) {
            const drivingLicenseFields = [
                { value: employee.drivingLicenceDetails.number, name: 'Driving License Number' },
                { value: employee.drivingLicenceDetails.issueDate, name: 'Driving License Issue Date' },
                { value: employee.drivingLicenceDetails.expiryDate, name: 'Driving License Expiry Date' }
            ];
            drivingLicenseFields.forEach(({ value, name }) => {
                totalFields++;
                if (checkField(value, name, 'Driving License')) completedFields++;
            });
        } else {
            // Driving License not added - add all fields to pending
            ['Driving License Number', 'Driving License Issue Date', 'Driving License Expiry Date'].forEach(name => {
                totalFields++;
                if (!sectionPendingMap.has('Driving License')) {
                    sectionPendingMap.set('Driving License', []);
                }
                sectionPendingMap.get('Driving License').push(name);
            });
        }

        // Personal Details fields
        const personalFields = [
            { value: employee.dateOfBirth, name: 'Date of Birth' },
            { value: employee.gender, name: 'Gender' },
            { value: employee.fathersName, name: 'Father\'s Name' }
        ];
        personalFields.forEach(({ value, name }) => {
            totalFields++;
            if (checkField(value, name, 'Personal Details')) completedFields++;
        });

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

        // Work Details fields - Primary Reportee
        const primaryReporteeValue = (() => {
            if (!employee?.primaryReportee) return null;
            // Handle populated object
            if (typeof employee.primaryReportee === 'object' && employee.primaryReportee !== null) {
                return `${employee.primaryReportee.firstName || ''} ${employee.primaryReportee.lastName || ''}`.trim() || employee.primaryReportee.employeeId || null;
            }
            // Handle string/ID
            const match = reportingAuthorityOptions.find(opt => opt.value === employee.primaryReportee);
            return match?.label || employee.primaryReportee || null;
        })();
        totalFields++;
        if (checkField(primaryReporteeValue, 'Primary Reportee', 'Work Details')) completedFields++;

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
        return { percentage, pendingFields: pendingFields.slice(0, 15) }; // Limit to 15 items max
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

    const tenure = calculateTenure(employee?.dateOfJoining);

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
    const isProfileReady = profileCompletion >= 100;
    const approvalStatus = employee?.profileApprovalStatus || 'draft';
    const awaitingApproval = approvalStatus === 'submitted';
    const profileApproved = approvalStatus === 'active';
    const canSendForApproval = approvalStatus === 'draft' && isProfileReady;

    const isVisaRequirementApplicable = useMemo(() => {
        return !isUAENational;
    }, [isUAENational]);

    // Memoize onViewDocument callback to prevent unnecessary re-renders
    const handleViewDocument = useCallback((doc) => {
        if (doc === null) {
            setShowDocumentViewer(false);
            setViewingDocument({ data: '', name: '', mimeType: '' });
        } else {
            setViewingDocument(doc);
            setShowDocumentViewer(true);
        }
    }, []);

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
        return 'bg-gray-400';
    };

    // Status items for Employment Summary (only show if they exist with expiry dates)
    const statusItems = [];
    if (tenure) {
        statusItems.push({
            type: 'tenure',
            text: `${tenure.years} Years ${tenure.months} Months in VITS`
        });
    }
    if (visaDays !== null && visaDays !== undefined) {
        statusItems.push({
            type: 'visa',
            text: `Visa Expires in ${visaDays} days`
        });
    }
    if (passportDays !== null && passportDays !== undefined) {
        statusItems.push({
            type: 'passport',
            text: `Passport Expires in ${passportDays} days`
        });
    }
    if (eidDays !== null && eidDays !== undefined) {
        statusItems.push({
            type: 'eid',
            text: `Emirates ID Expires in ${eidDays} days`
        });
    }
    if (labourCardDays !== null && labourCardDays !== undefined) {
        statusItems.push({
            type: 'labourCard',
            text: `Labour Card Expires in ${labourCardDays} days`
        });
    }
    if (medDays !== null && medDays !== undefined) {
        statusItems.push({
            type: 'medical',
            text: `Medical Insurance Expires in ${medDays} days`
        });
    }
    if (drivingLicenseDays !== null && drivingLicenseDays !== undefined) {
        statusItems.push({
            type: 'drivingLicense',
            text: `Driving License Expires in ${drivingLicenseDays} days`
        });
    }

    const InfoRow = ({ label, value }) => (
        <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</span>
            <span className="text-sm text-gray-900">{value || '—'}</span>
        </div>
    );

    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                <Navbar />
                <div className="p-8">
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
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Profile Card */}
                                <ProfileHeader
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
                                    activatingProfile={activatingProfile}
                                    profileApproved={profileApproved}
                                />

                                {/* Employment Summary Card */}
                                <EmploymentSummary
                                    statusItems={statusItems}
                                    getStatusColor={getStatusColor}
                                />
                            </div>

                            {/* Main Tabs */}
                            <div className="rounded-lg shadow-sm">
                                <TabNavigation
                                    activeTab={activeTab}
                                    setActiveTab={setActiveTab}
                                    setActiveSubTab={setActiveSubTab}
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
                                            for (const entry of employee.salaryHistory) {
                                                if (entry?.offerLetter && (entry.offerLetter.url || entry.offerLetter.data || entry.offerLetter.name)) return true;
                                                if (entry?.attachment && (entry.attachment.url || entry.attachment.data || entry.attachment.name)) return true;
                                            }
                                        }

                                        // Check Education certificates (url or data)
                                        if (employee?.educationDetails && Array.isArray(employee.educationDetails)) {
                                            if (employee.educationDetails.some(edu => edu.certificate?.url || edu.certificate?.data || edu.certificate?.name)) return true;
                                        }

                                        // Check Experience certificates (url or data)
                                        if (employee?.experienceDetails && Array.isArray(employee.experienceDetails)) {
                                            if (employee.experienceDetails.some(exp => exp.certificate?.url || exp.certificate?.data || exp.certificate?.name)) return true;
                                        }

                                        // Check Training certificates (url or data)
                                        if (employee?.trainingDetails && Array.isArray(employee.trainingDetails)) {
                                            if (employee.trainingDetails.some(training => training.certificate?.url || training.certificate?.data || training.certificate?.name)) return true;
                                        }

                                        return false;
                                    })()}
                                    hasTraining={employee?.trainingDetails && employee.trainingDetails.length > 0}
                                    onTrainingClick={() => setShowTrainingModal(true)}
                                    onDocumentsClick={() => setShowDocumentModal(true)}
                                />

                                {/* Tab Content */}
                                <div className="p-6">
                                    {activeTab === 'basic' && (
                                        <BasicTab
                                            employee={employee}
                                            employeeId={employeeId}
                                            fetchEmployee={fetchEmployee}
                                            updateEmployeeOptimistically={updateEmployeeOptimistically}
                                            activeSubTab={activeSubTab}
                                            setActiveSubTab={setActiveSubTab}
                                            isAdmin={isAdmin}
                                            hasPermission={hasPermission}
                                            getCountryName={getCountryName}
                                            formatDate={formatDate}
                                            isUAENationality={isUAENationality}
                                            isVisaRequirementApplicable={isVisaRequirementApplicable}
                                            onEditBasic={openEditModal}
                                            onViewDocument={handleViewDocument}
                                            setViewingDocument={setViewingDocument}
                                            setShowDocumentViewer={setShowDocumentViewer}
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
                                        />
                                    )}

                                    {/* OLD BASIC TAB CODE REMOVED - Now using BasicTab component */}

                                    {activeTab === 'work-details' && (
                                        <WorkDetailsTab
                                            employee={employee}
                                            isAdmin={isAdmin}
                                            hasPermission={hasPermission}
                                            formatDate={formatDate}
                                            departmentOptions={departmentOptions}
                                            reportingAuthorityOptions={reportingAuthorityOptions}
                                            reportingAuthorityValueForDisplay={reportingAuthorityValueForDisplay}
                                            onEdit={openWorkDetailsModal}
                                        />
                                    )}

                                    {/* OLD WORK DETAILS TAB CODE REMOVED - Now using WorkDetailsTab component */}

                                    {activeTab === 'salary' && (
                                        <SalaryTab
                                            employee={employee}
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
                                            onOpenBankModal={handleOpenBankModal}
                                            onViewDocument={handleViewDocument}
                                            onEditSalary={(entry, index) => {
                                                setEditingSalaryIndex(index);
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
                                        />
                                    )}


                                    {activeTab === 'personal' && (isAdmin() || hasPermission('hrm_employees_view_personal', 'isView')) && (
                                        <PersonalTab
                                            employee={employee}
                                            isAdmin={isAdmin}
                                            hasPermission={hasPermission}
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
                                        />
                                    )}

                                    {activeTab === 'documents' && (isAdmin() || hasPermission('hrm_employees_view_documents', 'isView')) && (
                                        <DocumentsTab
                                            employee={employee}
                                            isAdmin={isAdmin}
                                            hasPermission={hasPermission}
                                            onOpenDocumentModal={() => {
                                                setDocumentForm({
                                                    type: '',
                                                    description: '',
                                                    file: null,
                                                    fileBase64: '',
                                                    fileName: '',
                                                    fileMime: ''
                                                });
                                                setDocumentErrors({});
                                                setEditingDocumentIndex(null);
                                                setShowDocumentModal(true);
                                            }}
                                            onViewDocument={(doc) => {
                                                setViewingDocument(doc);
                                                setShowDocumentViewer(true);
                                            }}
                                            onEditDocument={(index) => handleEditDocument(index)}
                                            onDeleteDocument={(index) => handleDeleteDocument(index)}
                                        />
                                    )}


                                    {activeTab === 'training' && (isAdmin() || hasPermission('hrm_employees_view_training', 'isView')) && (
                                        <TrainingTab
                                            employee={employee}
                                            isAdmin={isAdmin}
                                            hasPermission={hasPermission}
                                            formatDate={formatDate}
                                            deletingTrainingIndex={deletingTrainingIndex}
                                            onOpenTrainingModal={() => {
                                                setTrainingForm({
                                                    trainingName: '',
                                                    trainingDetails: '',
                                                    trainingFrom: '',
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
                                            onViewDocument={(doc) => {
                                                setViewingDocument(doc);
                                                setShowDocumentViewer(true);
                                            }}
                                            onEditTraining={(training, index) => {
                                                setTrainingForm({
                                                    trainingName: training.trainingName || '',
                                                    trainingDetails: training.trainingDetails || '',
                                                    trainingFrom: training.trainingFrom || '',
                                                    trainingDate: training.trainingDate ? new Date(training.trainingDate).toISOString().split('T')[0] : '',
                                                    trainingCost: training.trainingCost ? String(training.trainingCost) : '',
                                                    certificate: null,
                                                    certificateBase64: training.certificate?.data || '',
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
                    employee={employee}
                    onLabourCardFileChange={handleLabourCardFileChange}
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

            {/* Document Viewer Modal - Only render when open */}
            {showDocumentViewer && (
                <DocumentViewerModal
                    isOpen={true}
                    onClose={() => setShowDocumentViewer(false)}
                    viewingDocument={viewingDocument}
                />
            )}

        </div>
    );
}

